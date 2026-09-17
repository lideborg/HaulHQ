// Payment-request email for a friend's confirmed haul — the "cart table"
// design Hampus picked (2026-09-08). Renders the itemized order with product
// thumbnails, a single destination-aware shipping figure, TOTAL DUE NOW, and a
// black PAY button linked to PayPal.Me with the amount + USD suffix baked in.
//
// Usage (from web-v2/):
//   node scripts/payment-email.mjs --friend Itay              # preview: writes /tmp + prints summary
//   node scripts/payment-email.mjs --friend Itay --send       # sends to the friend's email
//   node scripts/payment-email.mjs --friend Itay --send --to hampus.lideborg@gmail.com  # test send
import { writeFileSync } from "node:fs";
import { loadEnv } from "./lib/env.mjs";
import { adminClient } from "./lib/storage.mjs";

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const FRIEND = flag("--friend");
const SEND = args.includes("--send");
const TO = flag("--to");
if (!FRIEND) { console.error("usage: node scripts/payment-email.mjs --friend <name> [--send] [--to email]"); process.exit(1); }

const PAYPAL_BASE = "https://www.paypal.com/paypalme/lideborg";
const REPLY_TO = "hampus.lideborg@gmail.com"; // orders@ has no inbox — replies must land in Gmail

// Shipping model — mirrors src/lib/shipping.ts (keep in sync).
const EMS_FIRST = 35.15, EMS_ADDL = 9.27, HANDLING = 6, STEP_G = 500, PACKAGING = 1.18, MARGIN = 1.2, INTL_FACTOR = 1.3;
const isUS = (c) => { const s = (c ?? "").trim().toUpperCase(); return s === "" || s === "US" || s === "USA" || s.startsWith("UNITED STATES"); };
function shippingUsd(grams, country) {
  if (grams <= 0) return null;
  const units = Math.ceil((grams * PACKAGING) / STEP_G);
  return Math.round((EMS_FIRST + EMS_ADDL * (units - 1) + HANDLING) * MARGIN * (isUS(country) ? 1 : INTL_FACTOR));
}

const env = loadEnv(".env.local");
const sb = adminClient(env);

const { data: friend, error: fe } = await sb.from("friends")
  .select("id, name, email, shipping_address").ilike("name", FRIEND).single();
if (fe || !friend) { console.error("friend not found:", FRIEND, fe?.message ?? ""); process.exit(1); }
if (!friend.email) { console.error(`${friend.name} has no email on file — cannot send.`); process.exit(1); }

const { data: items, error: ie } = await sb.from("items")
  .select("chosen_size, quantity, quoted_price_usd, status, products(brand, display_title, image_urls, weight_g)")
  .eq("owner_id", friend.id).eq("status", "confirmed");
if (ie) { console.error(ie.message); process.exit(1); }
if (!items?.length) { console.error("no confirmed items for", friend.name); process.exit(1); }
const unpriced = items.filter((i) => i.quoted_price_usd == null);
if (unpriced.length) { console.error(`${unpriced.length} confirmed item(s) have no quoted price — quote them first.`); process.exit(1); }
const unweighed = items.filter((i) => i.products?.weight_g == null);
if (unweighed.length) { console.error(`${unweighed.length} item(s) missing weight_g — set weights first (shipping would under-count).`); process.exit(1); }

items.sort((a, b) => b.quoted_price_usd - a.quoted_price_usd);
const qty = (i) => i.quantity ?? 1;
const subtotal = items.reduce((s, i) => s + i.quoted_price_usd * qty(i), 0);
const grams = items.reduce((s, i) => s + (i.products?.weight_g ?? 0) * qty(i), 0);
const country = friend.shipping_address?.country;
const ship = shippingUsd(grams, country);
if (ship == null) { console.error("shipping estimate failed"); process.exit(1); }
const total = subtotal + ship;
const units = items.reduce((s, i) => s + qty(i), 0);
const pay = `${PAYPAL_BASE}/${total}USD`;
// Short destination for the shipping line ("SHIPPING TO US / TO SWEDEN").
const destShort = isUS(country) ? "US" : (country ?? "").trim().replace(/\s+/g, " ");
const today = new Date();
const dateLabel = today.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
// Sequential order number: Nth approved haul of the year, always 3 digits.
const { count: approvedCount } = await sb.from("hauls")
  .select("*", { count: "exact", head: true })
  .eq("status", "approved")
  .gte("approved_at", `${today.getFullYear()}-01-01`);
const orderNo = flag("--order") ?? `HQ-${today.getFullYear()}-${String(approvedCount ?? 0).padStart(3, "0")}`;
const firstName = (friend.name ?? "").split(" ")[0];

// 96x120 cover-cropped thumbs via Supabase image transforms (2x for retina).
const thumb = (u) => u ? u.replace("/object/public/", "/render/image/public/") + "?width=96&height=120&resize=cover&quality=80" : "";

const F = `font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;`;
const micro = `${F}font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#999999;`;
const microDark = `${F}font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#111111;`;

// One shared table for header + item rows so the SIZE/QTY/PRICE columns are
// pixel-aligned (nested per-row tables drift in Gmail). border-bottom lives on
// every td of a row. padding-right:2px on numeric right cells compensates the
// trailing space that letter-spacing:2px adds to the tracked headers.
const rowBorder = "border-bottom:1px solid #eeeeee;";
const row = (it) => {
  const p = it.products ?? {};
  const size = it.chosen_size == null || it.chosen_size === "One Size" ? "OS" : it.chosen_size;
  return `<tr>
<td width="48" valign="middle" style="padding:10px 0;${rowBorder}"><img src="${thumb(p.image_urls?.[0])}" width="48" height="60" alt="${p.display_title ?? ""}" style="display:block;width:48px;height:60px;border:0;background-color:#f5f5f5;${F}font-size:8px;color:#111111;"></td>
<td valign="middle" style="padding:10px 0 10px 12px;${rowBorder}">
<div style="${F}font-size:12px;line-height:16px;color:#111111;">${p.display_title ?? "Item"}</div>
<div style="${micro}padding-top:2px;">${p.brand ?? ""}</div>
</td>
<td width="60" align="center" valign="middle" style="padding:10px 0;${rowBorder}${F}font-size:12px;color:#111111;">${size}</td>
<td width="40" align="center" valign="middle" style="padding:10px 0;${rowBorder}${F}font-size:12px;color:#111111;">${qty(it)}</td>
<td width="70" align="right" valign="middle" style="padding:10px 0 10px 0;padding-right:2px;${rowBorder}${F}font-size:12px;color:#111111;white-space:nowrap;">$${(it.quoted_price_usd * qty(it)).toFixed(2)}</td>
</tr>`;
};

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>HaulHQ payment request</title><style>body{margin:0;padding:0}@media (max-width:620px){.container{width:100%!important}}</style></head>
<body style="margin:0;padding:0;background-color:#ffffff;" bgcolor="#ffffff">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Total due now: $${total.toFixed(2)} &middot; ${units} item${units === 1 ? "" : "s"} confirmed&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff"><tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" class="container" style="width:560px;max-width:560px;">
<tr><td align="center" style="padding:0 0 28px 0;border-bottom:1px solid #111111;${F}font-size:15px;letter-spacing:6px;color:#111111;font-weight:600;">HAULHQ</td></tr>
<tr><td style="padding:32px 0 6px 0;${F}font-size:17px;color:#111111;">Your order is confirmed.</td></tr>
<tr><td style="padding:0 0 14px 0;${micro}">${dateLabel}</td></tr>
<tr><td style="padding:0 0 24px 0;${F}font-size:13px;line-height:20px;color:#666666;">Hi ${firstName}, your ${units} item${units === 1 ? " is" : "s are"} confirmed with the factory and ready to order. Review your order and pay below.</td></tr>
<tr><td style="padding:0 0 8px 0;border-bottom:1px solid #eeeeee;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="${micro}padding-bottom:12px;">ORDER Nº&nbsp;&nbsp;<span style="color:#111111;">${orderNo}</span></td>
<td align="right" style="${micro}padding-bottom:12px;">${units} ITEMS</td>
</tr></table></td></tr>
<tr><td style="padding:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td colspan="2" style="padding:8px 0 10px 0;border-bottom:1px solid #111111;${micro}">ITEM</td>
<td width="60" align="center" style="padding:8px 0 10px 0;border-bottom:1px solid #111111;${micro}">SIZE</td>
<td width="40" align="center" style="padding:8px 0 10px 0;border-bottom:1px solid #111111;${micro}">QTY</td>
<td width="70" align="right" style="padding:8px 0 10px 0;border-bottom:1px solid #111111;${micro}">PRICE</td>
</tr>
${items.map(row).join("")}
</table></td></tr>
<tr><td style="padding:16px 0 0 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="${micro}padding:4px 0;">Subtotal</td><td align="right" style="padding-right:2px;${F}font-size:13px;color:#111111;">$${subtotal.toFixed(2)}</td></tr>
<tr><td style="${micro}padding:4px 0;">Shipping to ${destShort} (est.)</td><td align="right" style="padding-right:2px;${F}font-size:13px;color:#111111;">$${ship.toFixed(2)}</td></tr>
<tr><td style="${microDark}padding:12px 0 4px 0;font-weight:600;">Total due now</td><td align="right" style="padding-right:2px;${F}font-size:17px;color:#111111;padding-top:8px;">$${total.toFixed(2)}</td></tr>
</table></td></tr>
<tr><td style="padding:8px 0 0 0;${F}font-size:11px;line-height:16px;color:#999999;">Shipping is estimated from item weight. Any difference is settled when the parcel is weighed at the warehouse.</td></tr>
<tr><td align="center" style="padding:28px 0 28px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#111111" style="background-color:#111111;border:1px solid #111111;">
<a href="${pay}" style="display:block;padding:15px 0;text-align:center;${F}font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#ffffff;text-decoration:none;background-color:#111111;">Pay $${total.toFixed(2)}</a>
</td></tr></table></td></tr>
<tr><td align="center" style="padding:20px 0 0 0;border-top:1px solid #eeeeee;${F}font-size:12px;line-height:18px;color:#666666;">Questions? Just reply to this email.</td></tr>
<tr><td align="center" style="padding:36px 0 0 0;${micro}">HAULHQ&nbsp;&nbsp;&middot;&nbsp;&nbsp;INVITE ONLY&nbsp;&nbsp;&middot;&nbsp;&nbsp;HAULHQ.SHOP</td></tr>
</table></td></tr></table></body></html>`;

const text = `Your order is confirmed.

Hi ${firstName}, your ${units} items are confirmed and ready to order.

${items.map((i) => `- ${i.products?.display_title} (${i.products?.brand}) · size ${i.chosen_size ?? "OS"} · qty ${qty(i)} · $${(i.quoted_price_usd * qty(i)).toFixed(2)}`).join("\n")}

Subtotal: $${subtotal.toFixed(2)}
Shipping to ${destShort} (est.): $${ship.toFixed(2)}
Total due now: $${total.toFixed(2)}

Pay: ${pay}

Shipping is estimated from item weight and settles at the real parcel weight.
Questions? Just reply to this email.`;

const summary = { friend: friend.name, to: TO ?? friend.email, items: units, subtotal, shipping: ship, total, country: country ?? "(none — treated as US)", pay };
console.table ? console.log(summary) : console.log(JSON.stringify(summary, null, 2));

const out = `/tmp/payment-email-${friend.name.toLowerCase().replace(/\s+/g, "-")}.html`;
writeFileSync(out, html);
console.log("preview:", out);

if (SEND) {
  if (!env.RESEND_API_KEY) { console.error("RESEND_API_KEY missing"); process.exit(1); }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "HaulHQ <orders@haulhq.shop>",
      to: [TO ?? friend.email],
      reply_to: REPLY_TO,
      subject: `Your order is confirmed — $${total.toFixed(2)}`,
      html,
      text,
    }),
  });
  const body = await res.json();
  if (!res.ok) { console.error("send failed:", res.status, body); process.exit(1); }
  console.log("SENT:", body.id, "→", TO ?? friend.email);
} else {
  console.log("(dry run — pass --send to actually send)");
}
