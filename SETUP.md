# PocketSec account + Pro plan setup

## 1. Supabase (login + database)
1. Create a free project at supabase.com.
2. SQL Editor: paste and run `supabase_schema.sql`.
3. Authentication > Providers > Email: keep "Confirm email" ON.
4. Authentication > URL Configuration: set Site URL to your domain (e.g. https://pocketsec.com).
5. Project Settings > API: copy the Project URL and the `anon` public key.
   Never put the `service_role` key in the website. It only goes in the webhook.

## 2. Lemon Squeezy (payments)
1. Create a store. Add one product with 2 subscription variants: $2/month and $18/year.
2. Copy each variant's checkout link. Copy the yearly variant ID.
3. Settings > Webhooks: add the URL from step 3 below, tick all `subscription_*` events,
   and set a signing secret (long random text).

## 3. Deploy the webhook
```
npm i -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set LS_SIGNING_SECRET=your_secret LS_YEARLY_VARIANT_ID=123456
supabase functions deploy lemon-webhook --no-verify-jwt
```
Webhook URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/lemon-webhook`

## 4. Connect the website
Open `pocketsec-account.html` and edit the `CFG` block near the bottom: Supabase URL,
anon key, and the two checkout links. Host it on Cloudflare Pages or Vercel.

## 5. Test
Use Lemon Squeezy test mode: sign up, confirm email, click "Pro monthly", pay with the
test card, then press "Refresh plan". Plan should show Pro and ads should disappear.

## 6. Protect every Pro tool on the server
Hiding buttons in the page is not security. Each Pro function (scanner, scraper, SEO
checker) must check the plan itself:
```ts
const token = req.headers.get("authorization")?.replace("Bearer ", "");
const { data: { user } } = await userClient.auth.getUser(token);
const { data: p } = await admin.from("profiles").select("plan,pro_until").eq("id", user?.id).single();
if (!p || p.plan !== "pro" || (p.pro_until && new Date(p.pro_until) < new Date()))
  return new Response("Pro plan required", { status: 402 });
```

## Also needed before launch
Privacy Policy (mention Supabase, Lemon Squeezy, ipify), Terms, Acceptable Use
(no scanning domains you don't own), and Refund policy.
