// supabase/functions/invite_user/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const APP_URL = Deno.env.get("APP_URL") ?? "https://app.segvenc.app";

if (!SUPABASE_URL || !SERVICE_ROLE) {
  throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados");
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

// CORS p/ funcionar no navegador (localhost, app.segvenc.app, etc.)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: corsHeaders,
      });
    }

    const { email, empresa_id, role } = await req.json();

    if (!email || !empresa_id) {
      return new Response(
        JSON.stringify({
          error: "Campos obrigatórios: email, empresa_id",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 1) Convidar usuário via Auth (envia e-mail de convite)
    const { data, error: errInvite } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${APP_URL}/`, // para onde o link do e-mail aponta
        data: {
          empresa_id,
          role: role ?? "user",
        },
      });

    if (errInvite || !data?.user) {
      console.error("Erro ao convidar user auth:", errInvite);
      return new Response(
        JSON.stringify({
          error: errInvite?.message ?? "Erro ao convidar usuário",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const newUser = data.user;

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
      return new Response(
        JSON.stringify({ error: errInsert.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3) OK
    return new Response(
      JSON.stringify({
        ok: true,
        message:
          "Convite enviado. Peça para o usuário verificar a caixa de entrada e o spam.",
        user_id: newUser.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("Erro geral invite_user:", e);
    return new Response(
      JSON.stringify({
        error: `${e}`,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

