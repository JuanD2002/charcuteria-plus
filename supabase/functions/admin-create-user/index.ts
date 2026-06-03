// Edge function: super-admin-only user creation
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    // Verify caller is super admin
    const { data: isSA } = await admin.rpc("is_super_admin", { _user_id: userData.user.id });
    if (!isSA) return json({ error: "Forbidden: requires super admin" }, 403);

    const body = await req.json();
    const { email, password, display_name, is_active } = body ?? {};
    if (!email || !password) return json({ error: "email and password required" }, 400);
    if (String(password).length < 6) return json({ error: "Password must be at least 6 chars" }, 400);

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: display_name || email.split("@")[0] },
    });
    if (createErr) return json({ error: createErr.message }, 400);

    // Mark profile active if requested (default true since super admin is creating it)
    const active = is_active === false ? false : true;
    await admin
      .from("profiles")
      .update({ is_active: active, display_name: display_name || email.split("@")[0] })
      .eq("user_id", created.user.id);

    return json({ user_id: created.user.id, email: created.user.email }, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
