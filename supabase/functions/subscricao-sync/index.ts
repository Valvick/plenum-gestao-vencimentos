// supabase/functions/subscricao-sync/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type KiwifyOrder = {
  order_id?: string;
  order_status?: string;
  product_id?: string | number;
  product_type?: string;
  subscription_id?: string | null;
  buyer?: {
    email?: string;
    name?: string;
  };
};

type KiwifyPayload = {
  url?: string;
  signature?: string;
  order?: KiwifyOrder;
};

type UsuarioRow = {
  id: number;
  empresa_id: string;
  auth_user_id?: string | null;
  email?: string | null;
};

serve(async (req) => {
  try {
    // ========================
    // 0) MÉTODO
    // ========================
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ ok: false, error: "method_not_allowed" }),
        { status: 405, headers: { "Content-Type": "application/json" } },
      );
    }

    // (token a gente coloca depois, se quiser)

    const body = (await req.json()) as KiwifyPayload;
    const order = body.order;

    if (!order) {
      console.error("Payload sem campo 'order'. Body:", body);
      return new Response(
        JSON.stringify({ ok: false, error: "missing_order" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const buyerEmail =
      order.buyer?.email?.toLowerCase().trim() ?? null;

    if (!buyerEmail) {
      console.error("Webhook sem buyer.email:", order);
      return new Response(
        JSON.stringify({ ok: false, error: "missing_buyer_email" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const status = order.order_status;
    if (status !== "paid") {
      console.log("Webhook com status não pago, ignorando:", status);
      return new Response(
        JSON.stringify({ ok: true, ignored: true, reason: "status_not_paid" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // ========================
    // 1) Localizar (ou criar) usuário pelo e-mail
    // ========================
    const { data: usuarios, error: userError } = await supabase
      .from("usuarios")
      .select("id, empresa_id, auth_user_id, email")
      .eq("email", buyerEmail)
      .limit(1);

    if (userError) {
      console.error("Erro ao buscar usuario por email:", userError);
      return new Response(
        JSON.stringify({ ok: false, error: "user_query_error" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    let usuario: UsuarioRow | null = (usuarios?.[0] as UsuarioRow) || null;

    if (!usuario) {
      console.warn(
        "Nenhum usuario encontrado com este email. Vamos criar empresa e usuário padrão.",
        buyerEmail,
      );

      // 1) Criar empresa
      const { data: novaEmpresa, error: empresaError } = await supabase
        .from("empresas")
        .insert({
          nome: order.buyer?.name || "Nova Empresa",
          cnpj: null,
          email_notificacao: buyerEmail,
        })
        .select("id")
        .single();

      if (empresaError || !novaEmpresa) {
        console.error(
          "Erro ao criar empresa para novo cliente:",
          empresaError,
        );
        return new Response(
          JSON.stringify({ ok: false, error: "create_empresa_error" }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }

      // 2) Criar usuário "interno" sem auth_user_id ainda
      const { data: novoUsuario, error: usuarioError } = await supabase
        .from("usuarios")
        .insert({
          empresa_id: novaEmpresa.id,
          email: buyerEmail,
          role: "admin",
          acesso_ativo: true,
          // auth_user_id fica null; vamos ligar depois no primeiro login
        })
        .select("id, empresa_id")
        .single();

      if (usuarioError || !novoUsuario) {
        console.error(
          "Erro ao criar usuario interno para novo cliente:",
          usuarioError,
        );
        return new Response(
          JSON.stringify({ ok: false, error: "create_usuario_error" }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }

      usuario = {
        id: novoUsuario.id,
        empresa_id: novoUsuario.empresa_id,
        auth_user_id: null,
        email: buyerEmail,
      };
    }

    const usuarioId = usuario.id;
    const empresaId = usuario.empresa_id;

    // ========================
    // 2) Preparar dados da assinatura
    // ========================
    const hoje = new Date();
    const hojeISO = hoje.toISOString().slice(0, 10); // YYYY-MM-DD

    const diasAcesso = 30;
    const dataFim = new Date(hoje);
    dataFim.setDate(dataFim.getDate() + diasAcesso);
    const dataFimISO = dataFim.toISOString().slice(0, 10);

    const subscriptionId =
      order.subscription_id && String(order.subscription_id).trim() !== ""
        ? String(order.subscription_id)
        : null;

    if (!subscriptionId) {
      console.warn(
        "Webhook sem Subscription.id/subscription_id. Ainda assim vamos registrar por empresa.",
      );
    }

    const gatewaySaleId = order.order_id
      ? String(order.order_id)
      : null;

    const plano = `kiwify_prod_${order.product_id ?? "default"}`;

    const assinaturaInsert = {
      empresa_id: empresaId,
      // usuario_id: null, // se quiser, pode preencher depois com auth_user_id
      plano,
      status: "ativa",
      data_inicio: hojeISO,
      data_fim: dataFimISO,
      gateway: "kiwify",
      gateway_subscription_id: subscriptionId,
      gateway_sale_id: gatewaySaleId,
    };

    const { error: insertError } = await supabase
      .from("assinaturas")
      .insert(assinaturaInsert);

    if (insertError) {
      console.error(
        "Erro ao inserir assinatura:",
        insertError,
        assinaturaInsert,
      );
      return new Response(
        JSON.stringify({ ok: false, error: "insert_assinatura_error" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    console.log(
      "Assinatura registrada com sucesso para empresa",
      empresaId,
      "usuario interno",
      usuarioId,
      "email",
      buyerEmail,
    );

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Erro inesperado na função subscricao-sync:", err);
    return new Response(
      JSON.stringify({ ok: false, error: "unexpected_error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
