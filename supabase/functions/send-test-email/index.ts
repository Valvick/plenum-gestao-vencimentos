// supabase/functions/send-test-email/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "no-reply@segvenc.app";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!RESEND_API_KEY) {
    console.error("Faltando RESEND_API_KEY nas variáveis de ambiente");
    return new Response(
      JSON.stringify({ error: "RESEND_API_KEY não configurada" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Body inválido (esperado JSON)" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const to = body.to as string | undefined;
  const empresaNome = (body.empresaNome as string | undefined) ?? "Sua empresa";

  if (!to) {
    return new Response(
      JSON.stringify({ error: "Campo 'to' é obrigatório" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const subject = "Teste de notificações - SegVenc";
  const html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #0f172a;">
      <h2>Teste de e-mail do SegVenc</h2>
      <p>Olá,</p>
      <p>Este é um <strong>e-mail de teste</strong> enviado pelo SegVenc para a empresa <strong>${empresaNome}</strong>.</p>
      <p>Se você recebeu esta mensagem, significa que as notificações por e-mail estão funcionando corretamente 🎯.</p>
      <hr style="margin: 16px 0; border: none; border-top: 1px solid #e5e7eb;" />
      <p style="font-size: 12px; color: #6b7280;">
        SegVenc · Gestão de vencimentos de exames, cursos e ASO
      </p>
    </div>
  `;

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `SegVenc <${FROM_EMAIL}>`,
      to: [to],
      subject,
      html,
    }),
  });

  if (!resendResponse.ok) {
    const text = await resendResponse.text();
    console.error("Erro Resend:", text);

    return new Response(
      JSON.stringify({
        error: "Erro ao enviar e-mail via Resend",
        detail: text,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return new Response(
    JSON.stringify({ ok: true }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
