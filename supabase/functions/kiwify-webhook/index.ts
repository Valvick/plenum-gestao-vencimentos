// supabase/functions/kiwify-webhook/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type KiwifySubscriptionPlan = {
  id: string;
  name: string;
  frequency: string; // "monthly", "weekly", etc.
  qty_charges: number;
};

type KiwifySubscription = {
  id: string;
  start_date: string; // ISO
  next_payment: string; // ISO
  status: string; // "active" | "canceled" | "late" | ...
  plan: KiwifySubscriptionPlan;
  subscription_id: string;
  access_url: string | null;
};

type KiwifyCustomer = {
  full_name: string;
  email: string;
  mobile: string | null;
  CPF: string | null;
  ip: string | null;
};

type KiwifyProduct = {
  product_id: string;
  product_name: string;
};

type KiwifyWebhookBody = {
  order_id: string;
  order_ref: string;
  order_status: string; // "paid", "refunded", etc.
  payment_method: string;
  store_id: string;
  payment_merchant_id: string;
  installments: number;
  card_type: string | null;
  card_last4digits: string | null;
  card_rejection_reason: string | null;
  boleto_URL: string | null;
  boleto_barcode: string | null;
  boleto_expiry_date: string | null;
  pix_code: string | null;
  pix_expiration: string | null;
  sale_type: string;
  created_at: string;
  updated_at: string;
  approved_date: string | null;
  refunded_at: string | null;

  Product?: KiwifyProduct;
  Customer?: KiwifyCustomer;
  Subscription?: KiwifySubscription;

  // às vezes plataformas intermediárias adicionam campos extras aqui
  [key: string]: unknown;
};

Deno.serve(async (req) => {
  try {
    // =========================
    // 1) Valida o secret na URL
    // =========================
    const url = new URL(req.url);
    const urlSecret = url.searchParams.get("secret");
    const expectedSecret = Deno.env.get("KIWIFY_WEBHOOK_SECRET");

    if (!expectedSecret || urlSecret !== expectedSecret) {
      return new Response("Unauthorized", { status: 401 });
    }

    // =========================
    // 2) Lê o corpo JSON
    // =========================
    const body = (await req.json().catch(() => null)) as
      | KiwifyWebhookBody
      | null;

    if (!body) {
      return new Response("Invalid JSON", { status: 400 });
    }

    // =========================
    // 3) Cria cliente Supabase (SERVICE ROLE)
    // =========================
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      console.error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados");
      return new Response("Server misconfigured", { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // =========================
    // 4) Descobre tipo de evento (heurística)
    //    A Kiwify não manda o nome do trigger no JSON,
    //    então usamos order_status + Subscription.status
    // =========================
    const subscriptionStatus = body.Subscription?.status || null;
    const orderStatus = body.order_status || null;

    let eventType = "unknown";

    if (orderStatus === "paid" && subscriptionStatus === "active") {
      eventType = "subscription_paid_or_renewed";
    } else if (subscriptionStatus === "canceled" || orderStatus === "refunded") {
      eventType = "subscription_canceled_or_refunded";
    } else if (subscriptionStatus === "late") {
      // assumindo que Kiwify use "late" para assinaturas em atraso
      eventType = "subscription_late";
    }

    // =========================
    // 5) Loga o payload bruto
    // =========================
    await supabase.from("kiwify_webhook_logs").insert({
      event_type: eventType,
      raw_payload: body as unknown as Record<string, unknown>,
    });

    // =========================
    // 6) Extrai dados principais
    // =========================
    const buyerEmail = body.Customer?.email ?? null;

    if (!buyerEmail) {
      console.warn("Webhook sem email do comprador:", body);
      return new Response("Missing buyer email", { status: 200 });
    }

    const subscription = body.Subscription ?? null;

    const gatewaySubscriptionId =
      subscription?.subscription_id || subscription?.id || null;

    const gatewaySaleId = body.order_id ?? null;

    const plano =
      subscription?.plan?.name ??
      body.Product?.product_name ??
      "SegVenc – Plano Mensal";

    // =========================
    // 7) Buscar usuario + empresa pelo e-mail
    //    (usuarios.nome = email, pelo seu print)
    // =========================
    const { data: usuarios, error: usuariosError } = await supabase
      .from("usuarios")
      .select("id, empresa_id, auth_user_id, nome")
      .eq("nome", buyerEmail)
      .limit(1);

    if (usuariosError) {
      console.error("Erro ao buscar usuario por email:", usuariosError);
      return new Response("Error fetching user", { status: 500 });
    }

    const usuario = usuarios?.[0];

    if (!usuario) {
      console.warn("Nenhum usuario encontrado para email:", buyerEmail);
      return new Response("User not found, skipping", { status: 200 });
    }

    const empresaId = usuario.empresa_id;
    const usuarioId = usuario.auth_user_id;

    // =========================
    // Helpers
    // =========================
    const parseDate = (value: string | null | undefined): Date | null => {
      if (!value) return null;
      const d = new Date(value);
      if (isNaN(d.getTime())) return null;
      return d;
    };

    const now = new Date();

    // =========================
    // 8) Lógica: compra aprovada / renovação
    // =========================
    if (eventType === "subscription_paid_or_renewed") {
      // Tentamos usar as datas da assinatura.
      const start =
        parseDate(subscription?.start_date) ??
        parseDate(body.approved_date) ??
        now;

      const end =
        parseDate(subscription?.next_payment) ??
        // fallback: 30 dias
        new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Ver se já existe assinatura dessa empresa + subscription_id
      const { data: existingRows, error: existingError } = await supabase
        .from("assinaturas")
        .select("id")
        .eq("empresa_id", empresaId)
        .eq("gateway", "kiwify")
        .eq("gateway_subscription_id", gatewaySubscriptionId)
        .limit(1);

      if (existingError) {
        console.error("Erro ao buscar assinatura existente:", existingError);
        return new Response("Error reading subscription", { status: 500 });
      }

      if (existingRows && existingRows.length > 0) {
        const existing = existingRows[0];

        const { error: updateError } = await supabase
          .from("assinaturas")
          .update({
            plano,
            status: "ativa",
            data_inicio: start.toISOString().slice(0, 10), // date YYYY-MM-DD
            data_fim: end.toISOString().slice(0, 10),
            gateway_sale_id: gatewaySaleId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (updateError) {
          console.error("Erro ao atualizar assinatura:", updateError);
          return new Response("Error updating subscription", { status: 500 });
        }
      } else {
        const { error: insertError } = await supabase.from("assinaturas").insert({
          empresa_id: empresaId,
          usuario_id: usuarioId,
          plano,
          status: "ativa",
          data_inicio: start.toISOString().slice(0, 10),
          data_fim: end.toISOString().slice(0, 10),
          gateway: "kiwify",
          gateway_subscription_id: gatewaySubscriptionId,
          gateway_sale_id: gatewaySaleId,
        });

        if (insertError) {
          console.error("Erro ao criar assinatura:", insertError);
          return new Response("Error creating subscription", { status: 500 });
        }
      }
    }

    // =========================
    // 9) Lógica: cancelamento
    // =========================
    if (eventType === "subscription_canceled_or_refunded") {
      const { error: cancelError } = await supabase
        .from("assinaturas")
        .update({
          status: "cancelada",
          updated_at: new Date().toISOString(),
        })
        .eq("empresa_id", empresaId)
        .eq("gateway", "kiwify")
        .eq("gateway_subscription_id", gatewaySubscriptionId);

      if (cancelError) {
        console.error("Erro ao cancelar assinatura:", cancelError);
        return new Response("Error canceling subscription", { status: 500 });
      }
    }

    // =========================
    // 🔟 Lógica: inadimplente (late)
    // =========================
    if (eventType === "subscription_late") {
      const { error: lateError } = await supabase
        .from("assinaturas")
        .update({
          status: "inadimplente",
          updated_at: new Date().toISOString(),
        })
        .eq("empresa_id", empresaId)
        .eq("gateway", "kiwify")
        .eq("gateway_subscription_id", gatewaySubscriptionId);

      if (lateError) {
        console.error("Erro ao marcar assinatura como inadimplente:", lateError);
        return new Response("Error marking subscription late", {
          status: 500,
        });
      }
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Erro no kiwify-webhook:", err);
    return new Response("Internal error", { status: 500 });
  }
});
