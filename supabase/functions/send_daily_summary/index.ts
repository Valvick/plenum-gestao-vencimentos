// supabase/functions/send_daily_summary/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
  "SUPABASE_SERVICE_ROLE_KEY",
)!;
const APP_URL =
  Deno.env.get("APP_URL") ??
  "https://plenum-gestao-vencimentos.vercel.app";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const ADMIN_EMAILS = (Deno.env.get("ADMIN_EMAILS") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter((s) => !!s);

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
);

interface ComplianceItem {
  id?: string;
  empresa_id?: string;
  colaborador_nome: string;
  tipo_item?: string;
  item_nome?: string;
  data_vencimento: string;
  dias_para_vencer: number;
  status?: string;
}

function buildHtmlEmail(items: ComplianceItem[]): string {
  if (items.length === 0) {
    return `
      <p>Bom dia!</p>
      <p>Hoje não há exames ou cursos vencidos ou a vencer em até 30 dias.</p>
      <p>Você pode acessar o painel completo em:
        <a href="${APP_URL}">${APP_URL}</a>
      </p>
    `;
  }

  // 🔎 AGRUPAMENTOS (apenas usando dias_para_vencer)
  const vencidos = items.filter((i) => i.dias_para_vencer < 0);
  const venceHoje = items.filter((i) => i.dias_para_vencer === 0);
  const ate30 = items.filter(
    (i) => i.dias_para_vencer > 0 && i.dias_para_vencer <= 30,
  );

  // 👥 Contagem por COLABORADORES (não por item)
  const vencidosPessoas = new Set(
    vencidos.map((i) => i.colaborador_nome),
  ).size;
  const venceHojePessoas = new Set(
    venceHoje.map((i) => i.colaborador_nome),
  ).size;
  const ate30Pessoas = new Set(
    ate30.map((i) => i.colaborador_nome),
  ).size;

  const totalPessoas = new Set(
    items.map((i) => i.colaborador_nome),
  ).size;
  const totalItens = items.length;

  // 🔎 TABELA ORIGINAL — mantida 100%
  const rows = items
    .map((item) => {
      const data = new Date(
        item.data_vencimento,
      ).toLocaleDateString("pt-BR");
      const dias = item.dias_para_vencer;
      let destaque = "";

      if (dias < 0) destaque = "VENCIDO";
      else if (dias === 0) destaque = "Vence HOJE";
      else destaque = `Vence em ${dias} dia(s)`;

      const tipo = item.tipo_item ?? "";
      const nome = item.item_nome ?? "";
      const status = item.status ?? "";

      return `
        <tr>
          <td style="padding:4px 8px;border:1px solid #ddd;">
            ${item.colaborador_nome}
          </td>
          <td style="padding:4px 8px;border:1px solid #ddd;">
            ${tipo}
          </td>
          <td style="padding:4px 8px;border:1px solid #ddd;">
            ${nome}
          </td>
          <td style="padding:4px 8px;border:1px solid #ddd;">
            ${data}
          </td>
          <td style="padding:4px 8px;border:1px solid #ddd;">
            ${destaque}
          </td>
          <td style="padding:4px 8px;border:1px solid #ddd;">
            ${status}
          </td>
        </tr>
      `;
    })
    .join("");

  // 🔥 RESUMO adicionando as quantidades que você pediu
  return `
    <p>Bom dia!</p>
    <p>Segue o resumo diário de exames e cursos vencidos ou que vencem em até 30 dias.</p>

    <p><strong>Resumo por situação (colaboradores afetados):</strong></p>

    <ul>
      <li><strong>Vencidos:</strong> ${vencidosPessoas} colaborador(es) (${vencidos.length} item(ns))</li>
      <li><strong>Vencem HOJE:</strong> ${venceHojePessoas} colaborador(es) (${venceHoje.length} item(ns))</li>
      <li><strong>Vencem em até 30 dias:</strong> ${ate30Pessoas} colaborador(es) (${ate30.length} item(ns))</li>
    </ul>

    <p><strong>Total geral:</strong> ${totalPessoas} colaborador(es), ${totalItens} item(ns)</p>

    <table style="border-collapse:collapse;font-family:Arial, sans-serif;font-size:13px;">
      <thead>
        <tr style="background:#f2f2f2;">
          <th style="padding:6px 8px;border:1px solid #ddd;">Colaborador</th>
          <th style="padding:6px 8px;border:1px solid #ddd;">Tipo</th>
          <th style="padding:6px 8px;border:1px solid #ddd;">Exame/Curso</th>
          <th style="padding:6px 8px;border:1px solid #ddd;">Data de vencimento</th>
          <th style="padding:6px 8px;border:1px solid #ddd;">Situação</th>
          <th style="padding:6px 8px;border:1px solid #ddd;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <p style="margin-top:16px;">
      Para ver os detalhes completos, acesse o painel:<br />
      <a href="${APP_URL}">${APP_URL}</a>
    </p>
  `;
}

async function sendEmail(html: string) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY não configurada");
  if (ADMIN_EMAILS.length === 0)
    throw new Error("ADMIN_EMAILS não configurado");

  const payload = {
    from: "Gestão de Vencimentos <no-reply@plenum.app>",
    to: ADMIN_EMAILS,
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
    const text = await res.text();
    throw new Error(`Erro ao enviar e-mail: ${res.status} - ${text}`);
  }
}

serve(async (_req) => {
  try {
    console.log("Iniciando send_daily_summary...");

    const { data, error } = await supabase
      .from("v_compliance")
      .select(
        "id, empresa_id, colaborador_nome, tipo_item, item_nome, data_vencimento, dias_para_vencer, status",
      )
      .lte("dias_para_vencer", 30)
      .order("dias_para_vencer", { ascending: true });

    if (error) {
      return new Response(
        JSON.stringify({
          error: "Erro ao buscar v_compliance",
          details: error,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const items = (data ?? []) as ComplianceItem[];

    const html = buildHtmlEmail(items);
    await sendEmail(html);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Erro interno", details: `${err}` }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
