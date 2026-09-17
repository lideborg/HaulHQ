# Seller status ledger

The single source of truth for "can we buy from this seller through Superbuy?"
Update this file on EVERY seller reply, discovery, or removal. Statuses:
- **GOOD**: proven Weidian/Taobao links (confirmed by reply, or we already imported via their links)
- **LIKELY**: strong signal (weidian shop QR, links in some albums) but not confirmed
- **PENDING**: outreach sent, waiting on reply
- **NO-AGENTS**: refuses links / direct-ship only. Removed from factories index.
- **UNREACHABLE**: no contact found anywhere. Removal candidate.

Also mirror per-seller facts into the `sellers` table notes (if still in the index).
Removed sellers are backed up in removed-sellers-backup.md (links are set
active=false, never deleted, so restoring is one UPDATE).

Last full audit: 2026-08-23 (50-shop sweep + DB cross-check + WhatsApp outreach).

## GOOD (links proven)

| Seller | Evidence | Contact / how to buy |
|---|---|---|
| crteam | Replied 2026-08-23: "OF COURSE, WE GIVE WEIDIAN LINK, we can create for you" | WhatsApp +86 188 4311 3303. Prices: ourteambox.com passcode 321, search code under each Yupoo photo (e.g. bls0601) |
| i795 | Hampus has their Discord; taobao-sourced products in shop | Discord (Hampus) |
| happywhale | Hampus: they add links | WhatsApp +852 4667 9770(3?) |
| scarlettluxury | Albums carry weidian/taobao links; 12+ imported | WhatsApp +86 182 9645 3796 |
| 99team | 8 products imported via weidian | WhatsApp +852 4680 7196 |
| makemood | Album headers carry real Taobao Link: | WhatsApp +86 132 9585 1295 (verify) |
| chaosmade | Album headers = weidian buy links | - |
| Swag Made (swaggymade) | Taobao shop MADEBYSWAG1, shopid 349170071 | - |
| Crypto made | Taobao shopid 590930507 | - |
| Frank Chang | Taobao shopid 1781922864 | - |
| atomu | Weidian shop weidian.com/?userid=1260160183 (Shop Link album) | WeChat QR (qr/) |
| 718 Manufacturing | Weidian shop1679474173; 4 products imported | Discord discord.gg/vRghxpSEMS |
| acmeco | 3 products imported via weidian | - |
| cn--made (CNMADE) | 38 products imported via weidian | WhatsApp +1 424 386 5585 / +44 7784 914648 |
| Logan (loganhere) | 5 products imported via taobao | - |
| MVT (mvt-shop01) | 12 products imported via taobao | WhatsApp +852 5694 9345 |
| madebykungfu | 2 products imported via weidian | WhatsApp +86 131 6135 2083 |
| tangreps | Sweep: 3/3 newest albums embed links | WhatsApp +86 188 5083 3321 |
| thethunder | 19 products imported via weidian | - |
| Taurus-reps (deateath) | Sweep: 2/3 newest albums embed links (older lack them) | WhatsApp +852 5736 3298 |
| steven-1989 | Sweep: 3/3 newest albums embed links | - |
| charlesking77 | Replied 2026-08-23: Weidian only (no Taobao); item code sits in each album with the weidian link below it. Old photo-pages lack the link: send the item code, they provide it. Stephanie vest resolved: itemID 7805197396 | WhatsApp +1 573 514 1111 |
| fashionbroda | Replied 2026-08-23: "normally we put weidianlink on each album" (homepage albums are brand covers without links, product albums have them) | WhatsApp +853 6234 3061. Also on DesignerReps |
| colareps | Replied 2026-08-23: "we have weidian link" | WhatsApp +86 170 7088 5566 |
| eyeglow-glasses | Replied 2026-08-23: "I have hidden payment link for taobao agent. Which one do you need" - link them the item, they send the taobao link | WhatsApp +86 150 5770 6023 |
| jhj88888888 (Old Chen) | Replied 2026-08-23: no Taobao, but "If I have a Weidian link, you can copy it to the purchasing platform" - send product photos, they reply with weidian link | WhatsApp +86 186 5020 7990 |
| colastudioglobal | Replied 2026-08-23: sent their Weidian shop weidian.com/?userid=1785487515. Workflow: WhatsApp them the item picture, they send the weidian link | WhatsApp +86 180 6077 9381. Yupoo: colastudioglobal.x.yupoo.com |
| niuyue688 | Replied 2026-08-24: "My friend, I have Weidian" | WhatsApp +86 180 2634 0737 (alt +86 186 1318 6639) |
| yolo66 / yolo55 / yolo88 | Albums embed k.youshop10.com short links that 302 to weidian item pages (verified buyable). Same operator | WhatsApp +86 176 7996 1231 |
| zozo-eyewear | Replied 2026-08-24: "I can create weidian payment link for your order - tell me the model, I give price" | WhatsApp +852 4446 6429 |
| aristide / aristide-women | Replied 2026-08-24: "I can provide a Weidian link for you to place the order" | WhatsApp +86 180 0843 0453; Discord |
| logoshoesmarket | Replied 2026-08-24: gives links (webshop logoshoesmarket.wgstores.com, email ggshoes0126). BUT Stephanie's 4 items (2 jackets sz36 + 2 sunglasses) all SOLD OUT - removed from her order | WhatsApp +86 156 3776 3251 |
| paypalshop | Replied 2026-08-24: sent Weidian shop weidian.com/?userid=1678005873 (Lao Du), not the earlier Wise-agent route | WhatsApp +86 135 9902 0759 |

## LIKELY

| Seller | Signal | Contact |
|---|---|---|
| rmism | Weidian shop QR in Contact album | Discord discord.gg/h6rHXht4CC |

## PENDING (outreach page: research/seller-outreach/send-whatsapp.html)

repsunofficial (follow-up sent), summer-original (KICKSAGA),
gengarreps (QR/IG), ashmade (QR/Discord)

## AMBIGUOUS - needs a direct follow-up

| Seller | What they said | Follow-up to send |
|---|---|---|
| repsunofficial (+86 193 0504 0493) | Sent album passwords (888888) + QC-pic pitch, never confirmed a link | "Do you have a Weidian or Taobao link for each item? I order through my agent (Superbuy) and just need the product link." |

## NO-AGENTS (removed from factories index)

| Seller | Reply | Date |
|---|---|---|
| iofferman | "we don't have link. your agent can contact us or we ship direct" | 2026-08-21 |
| mrlocker | "Hello friend, I don't work with agents" (sister shops mrlockerfactory + mrlockerlady, same answer applies) | 2026-08-23 |
| andy879 | "Sorry I don't have link to pay" (follow-up: WU/Worldremit/Paysend/Remitly/Wise/Rewire only) | 2026-08-23 |
| luxurysneakers | "sorry no. My clients can purchase directly from me" | 2026-08-23 |
| copy-brand | Pushes "Flyway Store" direct payment instead of links | 2026-08-23 |
| luisaviaroma | Replied "not" to the links question | 2026-08-23 |
| lireplica | Direct pay only: PayPal F&F / Western Union / MoneyGram / Wise (password-protected yupoos lirepicasport + lennyshop, pw lennyshop) | 2026-08-23 |

## UNREACHABLE (no contact found; removal candidates)

alina-fashion-store2 (REMOVED 2026-08-23: contact page literally says no contact),
ivyonlinestore2, luxury999designer, gz30038, luxury-glasses, sunglasses-brand,
bluesea818, zoey818 (password-protected, pw 888888, still no contact info inside)
