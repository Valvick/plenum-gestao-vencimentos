// src/lib/assinaturas.ts
import { SupabaseClient } from "@supabase/supabase-js";

export type Assinatura = {
  id: string;
  empresa_id: string;
  usuario_id: string | null;
  plano: string;
  status: "ativa" | "inadimplente" | "cancelada";
  data_inicio: string; // "YYYY-MM-DD"
  data_fim: string;    // "YYYY-MM-DD"
  gateway: string;
  gateway_subscription_id: string | null;
  gateway_sale_id: string | null;
};

/**
 * Retorna a assinatura ATIVA da empresa,
 * já filtrando por data_fim >= hoje.
 *
 * Se não houver assinatura válida, retorna null.
 */
export async function getAssinaturaAtiva(
  supabase: SupabaseClient,
  empresaId: string
): Promise<Assinatura | null> {
  const hoje = new Date();
  const hojeISO = hoje.toISOString().slice(0, 10); // "YYYY-MM-DD"

  const { data, error } = await supabase
    .from("assinaturas")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("status", "ativa")
    // 👇 só pega assinaturas que ainda NÃO venceram
    .gte("data_fim", hojeISO)
    .order("data_fim", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Erro ao buscar assinatura:", error);
    return null;
  }

  const assinatura = (data?.[0] as Assinatura) || null;
  if (!assinatura) return null;

  return assinatura;
}
