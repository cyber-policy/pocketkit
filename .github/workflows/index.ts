// Supabase Edge Function: receives Lemon Squeezy subscription events and updates profiles.plan
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const secret = Deno.env.get("LS_SIGNING_SECRET")!;
const yearlyVariant = Deno.env.get("LS_YEARLY_VARIANT_ID");
const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const hex = (b: ArrayBuffer) =>
  [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  // 1. Verify the request really came from Lemon Squeezy
  const raw = await req.text();
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  if (!safeEq(sig, req.headers.get("x-signature") ?? "")) {
    return new Response("bad signature", { status: 401 });
  }

  // 2. Work out the plan
  const e = JSON.parse(raw);
  const ev = e.meta?.event_name as string | undefined;
  const uid = e.meta?.custom_data?.user_id as string | undefined;
  const a = e.data?.attributes;
  if (!ev?.startsWith("subscription_") || !uid || !a) return new Response("ignored");

  const until: string | null = a.ends_at ?? a.renews_at ?? null;
  const active =
    ["active", "on_trial", "past_due"].includes(a.status) ||
    (a.status === "cancelled" && until !== null && new Date(until).getTime() > Date.now());

  // 3. Save it (service role bypasses row-level security)
  const { error } = await admin.from("profiles").update({
    plan: active ? "pro" : "free",
    plan_interval: active ? (String(a.variant_id) === yearlyVariant ? "year" : "month") : null,
    pro_until: active ? until : null,
    ls_customer_id: String(a.customer_id),
  }).eq("id", uid);

  return new Response(error ? "db error" : "ok", { status: error ? 500 : 200 });
});
