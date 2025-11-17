// supabase/functions/invite_user/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Variáveis de ambiente do projeto
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
// URL do seu app (pra onde o usuário vai cair depois de aceitar o convite)
const APP_URL =
  Deno.env.get("APP_URL") ?? "https://plenum-gestao-vencimentos.vercel.app";

if (!SUPABASE_URL || !SERVICE_ROLE) {
  throw new Error(
    "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados",
  );
}

// Client com SERVICE ROLE (admin)
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

// Helper pra CORS
function corsResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      // ⬇️ AQUI incluímos o x-client-info e apikey
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-Client-Info, apikey, X-Requested-With, Accept",
    },
  });
}

serve(async (req) => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return corsResponse("OK", 200);
  }

  try {
    if (req.method !== "POST") {
      return corsResponse(
        JSON.stringify({ error: "Method not allowed" }),
        405,
      );
    }

    const { email, empresa_id, role } = await req.json();

    if (!email || !empresa_id) {
      return corsResponse(
        JSON.stringify({ error: "Campos obrigatórios: email, empresa_id" }),
        400,
      );
    }

    // 1) Enviar convite oficial do Supabase Auth
    const { data: inviteData, error: errInvite } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${APP_URL}/`,
        data: {
          empresa_id,
          role: role ?? "user",
        },
      });

    if (errInvite || !inviteData?.user) {
      console.error("Erro ao convidar usuário no Auth:", errInvite);
      return corsResponse(
        JSON.stringify({
          error: errInvite?.message ?? "Erro ao convidar usuário",
        }),
        500,
      );
    }

    const newUser = inviteData.user;

    // 2) Inserir na tabela public.usuarios
    const { error: errInsert } = await supabaseAdmin.from("usuarios").insert({
      auth_user_id: newUser.id,
      empresa_id,
      nome: email,
      role: role ?? "user",
      email,
    });

    if (errInsert) {
      console.error("Erro ao inserir em usuarios:", errInsert);
      return corsResponse(
        JSON.stringify({ error: errInsert.message }),
        500,
      );
    }

    // 3) Retorno OK
    return corsResponse(
      JSON.stringify({
        ok: true,
        message:
          "Convite enviado com sucesso. O usuário deve verificar o e-mail.",
        user_id: newUser.id,
      }),
      200,
    );
  } catch (e) {
    console.error("Erro geral invite_user:", e);
    return corsResponse(
      JSON.stringify({ error: `${e}` }),
      500,
    );
  }
});
