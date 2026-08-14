# Factories sellers — buy-link audit

Goal: for each seller in the `sellers` table, does it carry a direct buy-link
(weidian/taobao/1688/youshop/mulebuy) = **agent-orderable, keep** — or is it
**photo-only** (order needs a WhatsApp/WeChat/email message = manual work) =
candidate to prune from the factories index.

Method: opened the shop album grid, fetched the first product album's HTML,
grepped for a buy-link. **Caveat: this checks the FIRST album per shop.** A shop
marked "no link" *could* have links on other albums — for the big multi-brand
ones (flagged ⚠︎ below) re-check a few more albums before pruning.

Checked full table (~48 sellers).

---

## ✅ HAS BUY-LINKS — keep (17)

| Seller | Evidence |
|--------|----------|
| 99team | weidian per album (SKU variant) |
| scarlettluxury | weidian/taobao |
| yolo66 / yolo88 / yolo55 | youshop10/Superbuy |
| Taurus-reps (deateath) | weidian |
| summer-original (KICKSAGA) | taobao/weidian |
| Swag Made | direct Taobao shop 349170071 |
| Crypto made | direct Taobao shop 590930507 |
| Frank Chang | direct Taobao shop 1781922864 |
| pengreps | weidian + Mulebuy (checked) |
| colareps | weidian (checked) |
| 718 Manufacturing | k.youshop (checked) |
| Ash Made | k.youshop (checked) |
| CharlesKing | weidian (checked) |
| gengarreps | mulebuy (checked) |
| MVT | tb.cn taobao short link (checked) |
| RMism | k.youshop (checked) |
| tangreps | weidian (checked) |

## ❌ NO LINK — photo-only, needs WhatsApp/WeChat/email → **PRUNE CANDIDATES (27)**

| Seller | Category | Note |
|--------|----------|------|
| paypalshop | Gucci/bags/multi | email-to-source |
| aristide | quiet luxury | WhatsApp +86 18008430453 |
| aristide-women | quiet luxury (womens) | WhatsApp +86 18008430453 |
| iofferman | Tom Ford eyewear | WhatsApp (confirmed) |
| luxury999designer | BV belts / Chanel glasses | WhatsApp (confirmed) |
| ivyonlinestore2 | The Row womens shoes | WhatsApp (confirmed) |
| gz30038 | womens shoes / The Row | WeChat (confirmed) |
| alina-fashion-store2 | Missoni / womens RTW | WeChat (confirmed) |
| acmeco | Loro Piana / MM6 | first-album check |
| andy879 | BV belts | WhatsApp shop (no albums on grid) |
| atomu | (r/QC rec) | first-album check |
| bluesea818 | BV belts | no albums on grid |
| cn--made ⚠︎ | huge multi-brand | first-album check — recheck before pruning |
| copy-brand | Chanel/Gucci/Dior glasses | photo-only |
| crteam | Prada | no albums on grid |
| eyeglow-glasses | Tom Ford eyewear | photo-only |
| jhj88888888 | Gucci | photo-only |
| lireplica | Prada | photo-only |
| Logan ⚠︎ | big streetwear multi-brand | first-album check — recheck before pruning |
| logoshoesmarket | The Row shoes/bags | photo-only |
| luisaviaroma | Gucci | photo-only |
| luxury-glasses | Chanel eyewear (~1795 albums) | photo-only |
| luxurysneakers | Chanel/apparel | photo-only |
| madebykungfu ⚠︎ | Prada/Miu Miu | first-album check — recheck before pruning |
| mrlocker | Gucci | WhatsApp +86 15851068876 |
| sunglasses-brand | Chanel/TF eyewear (huge) | no albums on grid |
| zozo-eyewear | eyewear directory | photo-only |

## 🟡 KEEP despite no link (Hampus's call)
- **HappyWhale** — photo-only/WhatsApp but works well; keep.

## 🗑️ DEAD — remove regardless
- **tao227105 (Summer Luxury)** — Yupoo 404s.

---

**Suggested action:** the no-link shops are heavy on eyewear + belt/single-brand
photo catalogs (the ones that make you message on WhatsApp). Prune the ones you're
not actively using.

---

## Recheck of the 3 ⚠︎ multi-brand shops (6 albums each)

- **cn--made** — 1/6 albums had a link → **MIXED** (provides links on some items). Lean keep.
- **madebykungfu** — 1/6 → **MIXED**. Lean keep.
- **Logan (loganhere)** — 0/6 → **confirmed photo-only**, prune candidate stands.

`tao227105` deleted from the `sellers` table (was 404).

---

## WhatsApp outreach pack

You can't auto-send from here (no WhatsApp integration), but here's the template +
each shop's number so it's a fast copy/tap job. Ask if they hand out order links;
keep the ones who say yes (like HappyWhale), drop the rest.

**Template message:**
> Hi! We order through a shopping agent (Superbuy / CSSBuy). Do you provide a
> Weidian, Taobao or 1688 link for your items so we can order that way? If yes
> we'd love to buy regularly; if you only sell direct, no problem. Thanks!

**Numbers found (wa.me = tap to open):**

| Seller | WhatsApp |
|--------|----------|
| aristide / aristide-women | +86 18008430453 · wa.me/8618008430453 |
| iofferman | +86 13262083689 · wa.me/8613262083689 |
| luxury999designer | +86 13420101252 · wa.me/message/6QC42IO5ZA7EP1 |
| ivyonlinestore2 | +86 18650168258 / +86 15880821518 |
| andy879 | +86 15001211108 / +86 13521802983 |
| mrlocker | +86 15851068876 · wa.me/8615851068876 |
| acmeco | +86 13030546755 / +86 15060732458 |
| copy-brand | +86 16585073420 / +86 15902030625 |
| logoshoesmarket | +86 15637763251 · wa.me/8615637763251 |
| jhj88888888 | +86 18650207990 / +86 13174659396 |
| luisaviaroma | wa.me/8617307942331 · wa.me/8618274961948 |
| luxurysneakers | +86 17850816026 · wa.me/8617850816026 |
| lireplica | +86 15949144477 · wa.me/8615949144477 |
| paypalshop | (no WhatsApp) email buyers009@gmail.com |

**No number published (Discord/WeChat only — check their site if you want to keep):**
atomu, crteam, Logan, gz30038, alina-fashion-store2, bluesea818, eyeglow-glasses,
luxury-glasses, sunglasses-brand, zozo-eyewear.

### Pre-filled "do you send links?" tap-links (send from your phone, human pace)

> ⚠️ Do NOT bulk-blast these from a fresh WhatsApp Web session — WhatsApp bans
> accounts for rapid cold-messaging. Tap them one at a time from your phone over
> a day or two. Also: do NOT put these sellers in a shared group (they're
> competitors; it exposes every number to every other seller).

- iofferman — https://wa.me/8613262083689?text=Hi!%20We%20order%20through%20a%20shopping%20agent%20(Superbuy%20%2F%20CSSBuy).%20Do%20you%20provide%20a%20Weidian%2C%20Taobao%20or%201688%20link%20for%20your%20items%20so%20we%20can%20order%20that%20way%3F%20If%20yes%20we%20would%20love%20to%20buy%20regularly%3B%20if%20not%2C%20no%20problem.%20Thanks!
- logoshoesmarket — https://wa.me/8615637763251?text=Hi!%20We%20order%20through%20a%20shopping%20agent%20(Superbuy%20%2F%20CSSBuy).%20Do%20you%20provide%20a%20Weidian%2C%20Taobao%20or%201688%20link%20for%20your%20items%20so%20we%20can%20order%20that%20way%3F%20If%20yes%20we%20would%20love%20to%20buy%20regularly%3B%20if%20not%2C%20no%20problem.%20Thanks!
- aristide — https://wa.me/8618008430453?text=Hi!%20We%20order%20through%20a%20shopping%20agent%20(Superbuy%20%2F%20CSSBuy).%20Do%20you%20provide%20a%20Weidian%2C%20Taobao%20or%201688%20link%20for%20your%20items%20so%20we%20can%20order%20that%20way%3F%20If%20yes%20we%20would%20love%20to%20buy%20regularly%3B%20if%20not%2C%20no%20problem.%20Thanks!
- luxury999designer — https://wa.me/8613420101252?text=Hi!%20We%20order%20through%20a%20shopping%20agent%20(Superbuy%20%2F%20CSSBuy).%20Do%20you%20provide%20a%20Weidian%2C%20Taobao%20or%201688%20link%3F%20Thanks!
- ivyonlinestore2 — https://wa.me/8618650168258?text=Hi!%20Do%20you%20provide%20a%20Weidian%2C%20Taobao%20or%201688%20link%20so%20we%20can%20order%20via%20Superbuy%2FCSSBuy%3F%20Thanks!
- andy879 — https://wa.me/8615001211108?text=Hi!%20Do%20you%20provide%20a%20Weidian%2C%20Taobao%20or%201688%20link%20so%20we%20can%20order%20via%20Superbuy%2FCSSBuy%3F%20Thanks!
- mrlocker — https://wa.me/8615851068876?text=Hi!%20Do%20you%20provide%20a%20Weidian%2C%20Taobao%20or%201688%20link%20so%20we%20can%20order%20via%20Superbuy%2FCSSBuy%3F%20Thanks!
- acmeco — https://wa.me/8613030546755?text=Hi!%20Do%20you%20provide%20a%20Weidian%2C%20Taobao%20or%201688%20link%20so%20we%20can%20order%20via%20Superbuy%2FCSSBuy%3F%20Thanks!
- copy-brand — https://wa.me/8616585073420?text=Hi!%20Do%20you%20provide%20a%20Weidian%2C%20Taobao%20or%201688%20link%20so%20we%20can%20order%20via%20Superbuy%2FCSSBuy%3F%20Thanks!
- jhj88888888 — https://wa.me/8618650207990?text=Hi!%20Do%20you%20provide%20a%20Weidian%2C%20Taobao%20or%201688%20link%20so%20we%20can%20order%20via%20Superbuy%2FCSSBuy%3F%20Thanks!
- luisaviaroma — https://wa.me/8617307942331?text=Hi!%20Do%20you%20provide%20a%20Weidian%2C%20Taobao%20or%201688%20link%20so%20we%20can%20order%20via%20Superbuy%2FCSSBuy%3F%20Thanks!
- luxurysneakers — https://wa.me/8617850816026?text=Hi!%20Do%20you%20provide%20a%20Weidian%2C%20Taobao%20or%201688%20link%20so%20we%20can%20order%20via%20Superbuy%2FCSSBuy%3F%20Thanks!
- lireplica — https://wa.me/8615949144477?text=Hi!%20Do%20you%20provide%20a%20Weidian%2C%20Taobao%20or%201688%20link%20so%20we%20can%20order%20via%20Superbuy%2FCSSBuy%3F%20Thanks!
