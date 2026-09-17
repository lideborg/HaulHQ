# WhatsApp seller outreach + contact labeling

Drive WhatsApp Web (Chrome MCP, logged in as Hampus) to: message rep sellers,
read their replies, label number-only chats with their real Yupoo shop names, and
record each seller's verdict. Read-only until a send/rename, which Hampus has
authorized for this workflow. Never send/rename outside an explicit ask.

## Setup

1. Load Chrome tools via ToolSearch (tabs_context_mcp, navigate, computer, browser_batch).
2. WhatsApp Web is already logged in. Find the tab whose url is web.whatsapp.com
   (tabs_context lists it, e.g. "(1) WhatsApp"). Use THAT tabId; do not open a new
   login. If no WhatsApp tab exists, navigate one to https://web.whatsapp.com and
   tell Hampus to scan the QR if it shows a login screen.

## Open a specific seller's chat (reliable)

`navigate` the WhatsApp tab to `https://web.whatsapp.com/send?phone=<digits>`
(country code, no +, no spaces, e.g. 8619305040493). Wait ~6s (first load is slow).
The chat opens directly, which is far more reliable than clicking the chat list
(the list reorders whenever a new message lands).

## Send a follow-up message

1. Click the message box (~y 878-888, x ~890) and `type` the message.
2. Verify the chat header shows the right number BEFORE sending (zoom region
   [455,5,760,28]).
3. Press Return to send. Confirm delivery: zoom the last outgoing bubble; double
   grey ticks = delivered.

Keep messages short, English, Superbuy-framed. Canonical link ask:
"Hi! Do you provide Weidian or Taobao links for your items? I order through an
agent (Superbuy) and just need the direct product link to buy. Thanks!"

## Rename a number-only chat to its Yupoo shop name

1. Open the chat (send-URL above).
2. Click the header title (the number, ~[520,11]) to open the Contact info panel
   on the right. If it doesn't open on the first click, click again.
3. Click **Add** (the add-contact icon in the panel, ~[1136,178]).
4. The "New contact" form opens. First name field ~[1150,62]: triple_click it,
   then cmd+a, Delete, then `type` the Yupoo name, e.g. "repsunofficial (Yupoo)".
5. **Leave "Sync contact to phone" OFF** (default). This makes it a WhatsApp-only
   label, NOT written to Hampus's phone/Google address book. Confirm the toggle is
   grey before saving.
6. Click the green save/check button (bottom-right, ~[1153,880]).
7. Verify: zoom the header [455,5,760,28] shows the new name.

Coordinates drift with window width (1316 vs 1358 when the panel is open) - always
screenshot before the Add click and the save click rather than trusting fixed
coords. A misclick in the panel can hit Block/Report/Delete; check the screenshot.

## Number -> Yupoo seller map (keep updated as replies come in)

Source of truth is research/seller-outreach/SELLER-STATUS.md. Known so far:
- 8613599020759 paypalshop · 8619305040493 repsunofficial · 8618650207990 jhj88888888 (Old Chen)
- 8617679961231 yolo66 (yolo55/66/88) · 8618026340737 niuyue688 · 85244466429 zozo-eyewear
- 8618060779381 colastudioglobal · 8615057706023 eyeglow-glasses · 15735141111 charlesking77
- 85362343061 fashionbroda · 8617070885566 colareps · 8618843113303 crteam
- 8615637763251 logoshoesmarket · 8618008430453 aristide/aristide-women
- No-agents (label "<name> (no links)"): 8613262083689 iofferman · 8615851068876 mrlocker ·
  8613521802983 andy879 · 8617850816026 luxurysneakers · 8616526564479 copy-brand ·
  8617307942331 luisaviaroma · 8615949144477 lireplica

## After any reply: record the verdict

Update research/seller-outreach/SELLER-STATUS.md (GOOD/LIKELY/PENDING/NO-AGENTS)
AND the `sellers` table notes. GOOD = they give a weidian/taobao link. NO-AGENTS =
direct-pay only (Wise/WU/PayPal F&F) - set their seller_brand_links active=false,
delete the sellers row, back up in removed-sellers-backup.md. See the import-product
skill + the [[haul-shop-import-pipeline]] memory for the seller ledger rule.
