---
name: payment-email
description: Send a friend their HaulHQ payment-request email (the store-checkout style order confirmation with itemized list, thumbnails, shipping, and PayPal button). Use when Hampus says "send <friend> the payment email / payment link / confirmation email" after a haul's items are verified.
---

# Payment-request email

One command renders and sends the checkout-style email Hampus approved
(2026-09-08): HAULHQ wordmark, order meta row, single-table ITEM/SIZE/QTY/PRICE
grid with 48×60 product thumbnails, subtotal + single destination-labeled shipping figure,
TOTAL DUE NOW, and a black `PAY $X` button. Order Nº is `HQ-<year>-<NNN>`
(3 digits, sequential = Nth approved haul of the year, auto-derived; override
with `--order`). Date sits under the heading, not in the meta row.

## The command

From `web-v2/`:

```
node scripts/payment-email.mjs --friend <Name>            # dry run: prints totals, writes /tmp preview
node scripts/payment-email.mjs --friend <Name> --send     # sends to the friend's email on file
node scripts/payment-email.mjs --friend <Name> --send --to hampus.lideborg@gmail.com   # test send
```

The script pulls the friend's `confirmed` items + prices + weights from
Supabase, computes destination-aware shipping (US calibrated; non-US ×1.3 —
same model as the cart), and refuses to run if any item is unpriced or
unweighed (fix those first).

## Procedure — never skip these

1. **Verify buyability FIRST.** Before any payment request, sweep every
   confirmed item's source on Superbuy (live + chosen size in stock). Dead
   source → sold_out + item `unavailable` + resolve with the friend BEFORE
   asking for money. (Itay's first email went out with 2 items that turned out
   dead/OOS — never again.)
2. **Dry run** and eyeball the preview (`/tmp/payment-email-<name>.html`) —
   items, sizes, thumbnails, totals, destination.
3. **Cross-check the total against the friend's cart** (their haul page shows
   the same numbers — subtotal + single shipping figure). Cart and email must
   tell one story.
4. Get Hampus's go, then `--send` (or he sends manually — then just give him
   the preview + the amount + `paypal.me/lideborg/<total>USD` link).
5. **Log it** in `research/orders/<name>.md` (timeline row: date, total, link,
   Resend id) and freeze the friend's product numbers `#1..N` at this point.

## Hard rules baked into the template (don't undo)

- **PayPal link = `https://www.paypal.com/paypalme/lideborg/<TOTAL>USD`** — the
  USD suffix is mandatory; a bare amount pre-fills SEK (Hampus's account
  currency; caused a real mis-send 2026-09-07). Button label, summary total,
  and link amount must match to the cent.
- **One shipping number, no ranges** (Hampus, 2026-09-07). Label `SHIPPING TO <DEST> (EST.)` (destination shown, e.g. TO US / TO SWEDEN);
  total labeled `TOTAL DUE NOW` with NO currency marker (Hampus, 2026-09-08 —
  prices are always USD); one fine-print line: estimated from item weight,
  settles at real parcel weight.
- **No plain-text PayPal fallback link** under the button (Hampus, 2026-09-08 —
  button only).
- **`reply_to: hampus.lideborg@gmail.com`** on every send — `orders@haulhq.shop`
  has no inbox; without reply_to, "just reply to this email" is a lie.
- Flat luxury register: no emoji, no exclamation marks, no em dashes in copy,
  one CTA. From: `HaulHQ <orders@haulhq.shop>` (domain verified in Resend).
- Thumbnails are cover-cropped on the fly via Supabase render endpoint
  (`/render/image/public/...?width=96&height=120&resize=cover`) — never
  hotlink source images; products must have their images in our storage.
- Layout is ONE shared table for header + item rows (nested per-row tables
  drift in Gmail); right-aligned numeric cells carry `padding-right:2px` to
  offset the tracked headers' trailing letter-spacing. Keep it that way.
- Email tech constraints (from the 2026-09-07 research): tables + inline styles
  only, no background-image (Gmail strips the whole style), #111/#fff not pure
  black/white (Gmail mobile force-invert), letter-spacing in px, padded-link
  button (no VML), <90KB HTML.

## Related

- Sender/template: `web-v2/scripts/payment-email.mjs` (single source of truth —
  edit the template THERE).
- Design references + rejected variants: `research/email-designs/`.
- Shipping model: `web-v2/src/lib/shipping.ts` (script mirrors its constants —
  keep in sync when recalibrating).
