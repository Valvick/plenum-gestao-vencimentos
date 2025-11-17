// supabase/functions/daily_alertas/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const APP_URL =
  Deno.env.get("APP_URL") ?? "https://plenum-gestao-vencimentos.vercel.app";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// ainda deixo ADMIN_EMAILS só como fallback (se quiser usar depois)
const ADMIN_EMAILS = (Deno.env.get("ADMIN_EMAILS") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter((s) => !!s);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// LOGO DO SISTEMA
const LOGO_URL =
  "https://tjkdvkgroedamemwkyhi.supabase.co/storage/v1/object/public/brand/plenum_icon_512x512.png";

// ------------------------------------------------------------
// TIPOS
// ------------------------------------------------------------
type AlertaItem = {
  empresa_id: string;
  colaborador_nome: string;
  tipo: string;
  curso_exame: string;
  vencimento: string;
  qtde_dias: number;
  status: string;
};

type EmpresaEmail = {
  empresa_id: string;
  email: string;
  nome: string | null;
  ativo: boolean;
};

// ------------------------------------------------------------
// TEMPLATE PREMIUM
// ------------------------------------------------------------
function templateHTML(conteudo: string, titulo: string, botaoUrl: string) {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>${titulo}</title>
<style>
body {
  background-color: #f6f7f9;
  margin: 0;
  padding: 0;
  font-family: Arial, Helvetica, sans-serif;
}
.wrapper {
  max-width: 620px;
  margin: 0 auto;
  padding: 30px 0;
}
.card {
  background: #ffffff;
  border-radius: 12px;
  padding: 32px;
  box-shadow: 0 5px 24px rgba(0, 0, 0, 0.08);
}
.logo {
  text-align: center;
  margin-bottom: 22px;
}
.logo img {
  width: 110px;
  border-radius: 10px;
}
h1 {
  font-size: 22px;
  color: #1d3557;
  text-align: center;
}
p {
  font-size: 15px;
  color: #333;
  line-height: 1.6;
}
.button {
  display: inline-block;
  margin-top: 22px;
  background: #1d3557;
  color: #fff !important;
  padding: 10px 18px;
  border-radius: 6px;
  text-decoration: none;
  font-size: 14px;
}
.footer {
  margin-top: 28px;
  text-align: center;
  font-size: 12px;
  color: #777;
}
.brand {
  margin-top: 6px;
  font-weight: bold;
  color: #1d3557;
}
</style>
</head>

<body>
<div class="wrapper">
  <div class="card">
    <div class="logo">
      <img src="${LOGO_URL}" />
    </div>

    <h1>${titulo}</h1>

    <div class="content">
      ${conteudo}
    </div>

    <div style="text-align:center;">
      <a class="button" href="${botaoUrl}" target="_blank">Acessar o Painel</a>
    </div>
  </div>

  <div class="footer">
    E-mail automático enviado pelo sistema.<br />
    <span class="brand">SegVenc – Gestão Inteligente de Vencimentos</span>
  </div>
</div>
</body>
</html>
`;
}

// ------------------------------------------------------------
// MONTAGEM DO CONTEÚDO (por empresa)
// ------------------------------------------------------------
function montarConteudo(items: AlertaItem[]): string {
  if (items.length === 0) {
    return `
      <p>Bom dia!</p>
      <p>Hoje não há exames ou cursos vencidos ou a vencer em até 30 dias.</p>
    `;
  }

  const vencidos = items.filter((i) => i.qtde_dias < 0);
  const venceHoje = items.filter((i) => i.qtde_dias === 0);
  const ate30 = items.filter((i) => i.qtde_dias > 0 && i.qtde_dias <= 30);

  const vencidosPessoas = new Set(vencidos.map((i) => i.colaborador_nome)).size;
  const hojePessoas = new Set(venceHoje.map((i) => i.colaborador_nome)).size;
  const ate30Pessoas = new Set(ate30.map((i) => i.colaborador_nome)).size;
  const totalPessoas = new Set(items.map((i) => i.colaborador_nome)).size;
  const totalItens = items.length;

  const rows = items
    .map((item) => {
      const data = new Date(item.vencimento).toLocaleDateString("pt-BR");
      let situacao = "";
      if (item.qtde_dias < 0) situacao = "VENCIDO";
      else if (item.qtde_dias === 0) situacao = "Vence HOJE";
      else situacao = `Vence em ${item.qtde_dias} dias`;

      return `
      <tr>
        <td style="padding:6px;border:1px solid #ccc;">${item.colaborador_nome}</td>
        <td style="padding:6px;border:1px solid #ccc;">${item.tipo}</td>
        <td style="padding:6px;border:1px solid #ccc;">${item.curso_exame}</td>
        <td style="padding:6px;border:1px solid #ccc;">${data}</td>
        <td style="padding:6px;border:1px solid #ccc;">${situacao}</td>
        <td style="padding:6px;border:1px solid #ccc;">${item.status}</td>
      </tr>
    `;
    })
    .join("");

  return `
    <p>Bom dia!</p>

    <p><strong>Resumo de vencimentos (colaboradores afetados):</strong></p>

    <ul>
      <li><strong>Vencidos:</strong> ${vencidosPessoas} colaborador(es) (${vencidos.length} item(ns))</li>
      <li><strong>Vence HOJE:</strong> ${hojePessoas} colaborador(es) (${venceHoje.length} item(ns))</li>
      <li><strong>A vencer em até 30 dias:</strong> ${ate30Pessoas} colaborador(es) (${ate30.length} item(ns))</li>
    </ul>

    <p><strong>Total geral:</strong> ${totalPessoas} colaborador(es), ${totalItens} item(ns)</p>

    <table style="border-collapse:collapse;font-size:14px;margin-top:18px;">
      <thead>
        <tr style="background:#f2f2f2;">
          <th style="padding:6px;border:1px solid #ccc;">Colaborador</th>
          <th style="padding:6px;border:1px solid #ccc;">Tipo</th>
          <th style="padding:6px;border:1px solid #ccc;">Exame/Curso</th>
          <th style="padding:6px;border:1px solid #ccc;">Vencimento</th>
          <th style="padding:6px;border:1px solid #ccc;">Situação</th>
          <th style="padding:6px;border:1px solid #ccc;">Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ------------------------------------------------------------
// ENVIO DE EMAIL VIA RESEND
// ------------------------------------------------------------
async function enviarEmail(html: string, toList: string[]) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY não configurada");
  if (!toList.length) throw new Error("Lista de destinatários vazia");

  const payload = {
    from: "Gestão de Vencimentos <alertas@segvenc.app>",
    to: toList,
    subject: "Resumo diário de vencimentos",
    html,
  };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Erro ao enviar email: ${res.status} - ${txt}`);
  }
}

// ------------------------------------------------------------
// HANDLER PRINCIPAL
// ------------------------------------------------------------
serve(async () => {
  try {
    // 1) Buscar todos os alertas (com empresa_id)
    const { data: alertas, error: erroAlertas } = await supabase
      .from("v_alertas_vencimentos")
      .select(
        "empresa_id, colaborador_nome, tipo, curso_exame, vencimento, qtde_dias, status",
      )
      .lte("qtde_dias", 30)
      .order("qtde_dias", { ascending: true });

    if (erroAlertas) {
      console.error("Erro ao buscar v_alertas_vencimentos:", erroAlertas);
      return new Response(JSON.stringify({ error: erroAlertas }), {
        status: 500,
      });
    }

    const itens = (alertas ?? []) as AlertaItem[];

    // 2) Se não tiver nenhum alerta, opcionalmente podemos enviar um único e-mail
    //    global usando ADMIN_EMAILS. Por enquanto, só logamos e saímos.
    if (!itens.length) {
      console.log("Nenhum alerta encontrado para até 30 dias.");
      return new Response(
        JSON.stringify({ ok: true, total_items: 0, total_empresas: 0 }),
        { status: 200 },
      );
    }

    // 3) Buscar todos os e-mails de notificação ativos
    const { data: emails, error: erroEmails } = await supabase
      .from("empresas_emails_alerta")
      .select("empresa_id, email, nome, ativo")
      .eq("ativo", true);

    if (erroEmails) {
      console.error("Erro ao buscar empresas_emails_alerta:", erroEmails);
      return new Response(JSON.stringify({ error: erroEmails }), {
        status: 500,
      });
    }

    const listaEmails = (emails ?? []) as EmpresaEmail[];

    // 4) Mapear empresa -> [emails]
    const emailsPorEmpresa = new Map<string, string[]>();
    for (const row of listaEmails) {
      if (!emailsPorEmpresa.has(row.empresa_id)) {
        emailsPorEmpresa.set(row.empresa_id, []);
      }
      emailsPorEmpresa.get(row.empresa_id)!.push(row.email);
    }

    // 5) Agrupar alertas por empresa
    const alertasPorEmpresa = new Map<string, AlertaItem[]>();
    for (const item of itens) {
      if (!alertasPorEmpresa.has(item.empresa_id)) {
        alertasPorEmpresa.set(item.empresa_id, []);
      }
      alertasPorEmpresa.get(item.empresa_id)!.push(item);
    }

    let totalEmailsEnviados = 0;
    const empresasSemEmail: string[] = [];

    // 6) Para cada empresa com alertas, enviar e-mail para seus destinatários
    for (const [empresaId, itensEmpresa] of alertasPorEmpresa.entries()) {
      const destinatarios = emailsPorEmpresa.get(empresaId) ?? [];

      if (!destinatarios.length) {
        console.warn(
          `Empresa ${empresaId} tem alertas, mas não possui e-mails configurados.`,
        );
        empresasSemEmail.push(empresaId);
        continue;
      }

      const conteudo = montarConteudo(itensEmpresa);
      const html = templateHTML(
        conteudo,
        "Resumo Diário de Vencimentos",
        APP_URL,
      );

      await enviarEmail(html, destinatarios);
      totalEmailsEnviados += 1;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        total_items: itens.length,
        total_empresas_com_alerta: alertasPorEmpresa.size,
        total_emails_enviados: totalEmailsEnviados,
        empresas_sem_email: empresasSemEmail,
      }),
      { status: 200 },
    );
  } catch (e) {
    console.error("Erro geral:", e);
    return new Response(JSON.stringify({ error: `${e}` }), { status: 500 });
  }
});
