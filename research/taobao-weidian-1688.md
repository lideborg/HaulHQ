# Taobao, Weidian, and 1688: A Practical Guide for Superbuy Users

This document covers the three Chinese marketplaces most commonly used by Western buyers via shopping agents (daigou) like Superbuy, Sugargoo, CSSBuy, Pandabuy (RIP), and Kakobuy. Context: rep/replica community usage and general haul shopping.

---

## 1. Taobao (淘宝)

### What it is
Taobao is Alibaba's flagship consumer-to-consumer (C2C) marketplace, launched in 2003. It is the largest e-commerce platform in China by listing volume, with hundreds of millions of monthly active users. It is the "default" place mainland Chinese consumers shop online for everyday goods.

### Who shops there / who sells there
- **Buyers:** Mainstream Chinese consumers, all demographics. Mobile-first; the Taobao app is ubiquitous.
- **Sellers:** A mix of individual sellers, small businesses, and brands. Tmall (天猫) is the B2C sister platform on the same infrastructure where official brand flagship stores live; Taobao proper is more C2C and small-merchant.
- Prices are retail. MOQ is typically 1.

### How it differs
- Taobao = giant retail bazaar (single-unit retail, huge selection, decent buyer protection via Alipay escrow).
- Weidian = much smaller, mobile-first, individual sellers (often single-person shops or WeChat-adjacent merchants).
- 1688 = wholesale, factory-direct, MOQs, lower prices, weaker buyer protection.

### Relevance to the rep community
- Historically the primary venue for replica goods in the late 2010s. Many "trusted sellers" (TS) lists started here.
- Listings get taken down periodically due to Alibaba's IP enforcement, but new listings re-appear under coded names ("LV bag," "L0uis," etc., or "高版本" = "high version").
- Many rep sellers maintain a Taobao storefront as a "front" while doing real communication / final pricing on WeChat.
- Increasingly, rep sellers have migrated to Weidian to escape takedowns — but Taobao still has many.

### URL structure
- Item: `https://item.taobao.com/item.htm?id=<numeric_item_id>`
- Tmall item: `https://detail.tmall.com/item.htm?id=<numeric_item_id>`
- Shop: `https://shop<shop_id>.taobao.com` or `https://<shop_name>.taobao.com`
- The `id=` numeric is the canonical identifier; agents parse this to fetch the listing.

### Trust signals
- **Seller rating tiers (信誉/credit):** hearts → diamonds → blue crowns → gold crowns. Each tier has 5 levels.
  - Hearts (心): newest sellers, 1-250 transactions.
  - Diamonds (钻): 251-10,000.
  - Blue crowns (蓝冠): 10,001-500,000.
  - Gold/yellow crowns (金冠): 500,000+.
  - For rep buying, a few diamonds is usually fine; gold crowns are well-established but rare.
- **DSR (Detail Seller Rating):** three scores (item description match, service attitude, shipping speed) on a 5-point scale. Anything 4.7+ is normal; 4.8+ is good. Red number = above category average, green = below.
- **Store age:** displayed on the shop page ("开店时间"). 2+ years is a reasonable signal; reps stores often get nuked so newer is not always bad.
- **Sales volume (月销/总销):** monthly sales on a listing. A listing with 500+ sales and recent reviews is a stronger signal than store age alone.
- **Reviews (评价):** sortable, filterable by photo. Photo reviews ("有图") matter — they're harder to fake.
- **Tmall flag:** Tmall stores paid a deposit and submitted business licenses; significantly more trustworthy than raw Taobao for non-rep goods.

### Pricing
- Retail prices, MOQ 1, free domestic shipping common.
- Generally 1.5x-3x the 1688 wholesale price for the same item if you can find the source factory.

### Common scams
- **Bait-and-switch listings:** photos show authentic, seller ships generic/lower-tier rep. Mitigation: use QC photos via your agent before shipping.
- **Fake reviews:** "刷单" — sellers run brushed transactions to inflate ratings. Photo reviews from the last 30 days with varied accounts are harder to fake.
- **Stolen photos:** seller copies a famous rep factory's listing photos but ships a knockoff of the knockoff. Cross-reference with rep community spreadsheets.
- **Price-anchor scam:** listing is 3 RMB to drive ranking; real price is in chat. Annoying for agents — confirm the real SKU/price in messages.
- **"Authentic" fakes:** seller swears it's authentic at suspiciously low prices. It is not.

### Shopping agent interaction
- Best supported platform across all agents (Superbuy, Sugargoo, etc.). Pasting an `item.taobao.com` URL into Superbuy works seamlessly.
- Agents handle Alipay payment, domestic shipping to their warehouse, QC photos.
- SKU selection (size, color) usually exposed in the agent's UI, but for rep listings the variant is often "ask seller" — leave a note in the order.

### "Trusted sellers" lists
- Reddit's /r/RepLadies, /r/FashionReps (when active), Discord servers, and the long-running rep spreadsheets ("RepArchive," various "TS lists") are heavily Taobao-centric historically.
- A "TS" tag means the community has consensus the seller ships a known-quality factory batch.

---

## 2. Weidian (微店)

### What it is
Weidian (literally "micro-shop") is a mobile-first marketplace launched in 2013 by Koudai. It was designed for individual sellers and WeChat-based commerce — essentially "let anyone with a phone open a shop and sell to their social network."

### Who shops there / who sells there
- **Buyers:** Younger Chinese consumers, often via WeChat referrals, niche/hobbyist communities (lolita fashion, JK uniforms, anime merch, fashion reps).
- **Sellers:** Individuals, micro-businesses, hobbyist makers. Lower barrier to entry than Taobao — no business license required for basic shops.
- Many sellers use Weidian as their "official" storefront for orders that get coordinated on WeChat.

### How it differs
- Smaller catalog, much weaker on-platform search than Taobao.
- Mobile-only UX historically; the desktop site exists but is bare.
- Less aggressive IP enforcement than Taobao → many rep sellers migrated here after Taobao crackdowns.
- Buyer protection exists but is weaker; disputes are harder to resolve, especially for non-Chinese-speaking buyers.

### Relevance to the rep community
- **Currently the dominant rep marketplace.** The big-name rep factories' "official" shops (e.g., for shoes: many of the well-known batches) are on Weidian.
- A lot of TS lists in 2023-2025 are Weidian-first.
- Sellers communicate via WeChat for new releases, batch comparisons, and pre-orders. The Weidian listing is just the checkout mechanism.

### URL structure
- Item: `https://weidian.com/item.html?itemID=<numeric_id>` (note capital ID; lowercase `itemid` also works)
- Shop: `https://shop<shop_id>.v.weidian.com` or `https://weidian.com/?userid=<id>`
- Mini-program / app deeplinks are common; agents typically need the `itemID`.

### Trust signals
- **Sales count on listing (已售):** primary signal. Hundreds-to-thousands of sales on a single SKU = real seller.
- **Shop followers (粉丝):** more followers = more established. 10k+ is solid for a niche rep shop.
- **Reviews:** thinner than Taobao. Many shops disable or hide reviews. Weight community reputation more heavily than on-platform reviews.
- **Shop age / 开店时间:** visible on shop profile, less prominent than Taobao.
- **No "crown" rating system** — Weidian's rating UX is much simpler. You're relying more on community vetting.
- **Real-name verified / 实名认证 / 企业认证 (business cert):** modest signal; presence is good, absence is normal.

### Pricing
- Retail, often slightly higher than equivalent Taobao listings because Weidian rep sellers know they're the "safer" venue post-takedowns.
- MOQ 1.

### Common scams
- **Ghost shops:** shop disappears after taking payment. Mitigation: only buy from community-vetted sellers.
- **WeChat redirect scams:** "pay me on WeChat directly, cheaper" — avoid; you lose all platform protection and your agent can't help.
- **Wrong-batch shipping:** seller has multiple batches/factories; ships the cheaper one unless you specify. Always note the exact batch in the order.
- **Pre-order black holes:** pre-orders for unreleased items can sit for months; some never ship.
- **Stolen-design knockoffs of the knockoffs:** non-TS sellers copy listing photos from a famous rep seller and ship inferior product.

### Shopping agent interaction
- Well supported by all major agents now, but Weidian has historically been **finicky**: link parsing sometimes fails, you may need to paste the `itemID` manually or use the agent's "manual order" / custom-order feature.
- Variant selection is more limited in agent UIs — write notes in Chinese (or use the agent's translation) specifying size, color, batch.
- Some Weidian sellers refuse orders from agents they don't like; using a major agent (Superbuy, Sugargoo) generally avoids this.
- Refunds/disputes are harder than on Taobao — your agent is your primary recourse.

### "Trusted sellers" lists
- Most active rep TS lists in 2024-2025 are Weidian-heavy. Reddit r/RepLadies wikis, FashionReps Discord, and various Notion/Google Doc spreadsheets maintain Weidian seller IDs.
- "WeChat + Weidian" pattern is normal: discover the seller via community, chat on WeChat, place order on their Weidian, pay/ship via Superbuy.

---

## 3. 1688 (阿里巴巴 / Alibaba.com domestic)

### What it is
1688.com is Alibaba's **domestic Chinese wholesale** marketplace (B2B). Distinct from Alibaba.com (the international-facing English wholesale site) and from Taobao (consumer retail). The name comes from "yī liù bā bā" rhyming with "Alibaba." Founded 1999, making it the oldest of the three.

### Who shops there / who sells there
- **Buyers:** Chinese resellers, small business owners, factory procurement, drop-shippers, market-stall vendors. Most Taobao sellers source from 1688.
- **Sellers:** Factories, wholesalers, trading companies. Many listings are direct from the manufacturer.
- Domestic-only by design; UI is Chinese-only and the platform assumes Chinese business buyers.

### How it differs
- **Wholesale pricing tiers:** prices drop with quantity. A listing might show 50 RMB at 1pc, 35 RMB at 10pc, 28 RMB at 100pc.
- **MOQs (起订量):** many listings require minimum quantities (e.g., 2, 10, 50 pieces). Some allow MOQ 1 ("一件代发" = drop-ship friendly).
- **Less buyer protection:** disputes assume B2B context. Returns are harder.
- **Plain-er listings:** photos are often utilitarian factory shots, not lifestyle marketing.
- **Same-factory sourcing:** the actual factory making the Taobao item often lists it on 1688 too — for cheaper.

### Relevance to the rep community
- For reps: 1688 is **less common** than Taobao/Weidian because rep factories rarely list openly on 1688 (Alibaba enforces IP harder on the B2B side and 1688 attracts more compliance attention).
- However, 1688 is widely used for:
  - **Plain-clothes / unbranded basics** (blank tees, hoodies, hardware, accessories) sourced cheaply.
  - **"Replica adjacent"** — generic-style bags, shoes, jewelry, sunglasses without trademarked logos.
  - **Hauls / drop-shipping resellers** sourcing inventory.
  - **Streetwear blanks** for custom/bootleg projects.
- For non-rep haulers, 1688 is often the **best value** if you can hit the MOQ and don't need premium QC.

### URL structure
- Item: `https://detail.1688.com/offer/<numeric_offer_id>.html`
- Shop: `https://<shop_name>.1688.com` or `https://shop<id>.1688.com`
- The `offer` ID is the canonical listing identifier.

### Trust signals
- **诚信通 (Chéngxìn Tōng / "Trust Pass") years:** 1688's paid verification badge. The number of years a seller has held it is a primary signal. 5+ years is solid; 10+ is very established.
- **实力商家 ("Strength Merchant") / 超级工厂 ("Super Factory") / 工厂认证 ("Factory Verified"):** premium tier badges; these are factories Alibaba has audited.
- **回头率 (Repeat-buyer rate):** percentage of buyers who reorder. A standout 1688 metric. 30%+ is strong.
- **30天成交 (30-day transaction count) and 30天成交件数 (units sold):** more reliable than Taobao's monthly sales number for B2B context.
- **主营 (main category):** how focused the seller is on one product line. Hyper-focused sellers tend to be real factories; generalists are often trading companies.
- **DSR equivalents:** three-score system similar to Taobao.

### Pricing
- Cheapest of the three by a meaningful margin for the same-or-similar item — often 30-60% less than retail Taobao.
- MOQ matters: hitting the next price tier often makes the agent's service fee + shipping worthwhile.
- "一件代发" listings = MOQ 1 (drop-ship friendly), priced higher than the bulk tier but still typically cheaper than Taobao.

### Common scams
- **Trading company posing as factory:** the listing claims "厂家直销" (factory direct) but they're a middleman. Less of a "scam," more of a markup.
- **Sample-vs-bulk quality drift:** sample is great; the production run quality is worse. Standard wholesale risk.
- **Photo-reuse:** small sellers steal real factory photos; product is inferior. The same risk as Taobao but harder to verify because there are fewer photo reviews.
- **MOQ trickery:** the headline price is at a quantity you'll never hit; real MOQ-1 price is 2-3x.
- **Mixed-batch shipments:** if you order 50 of an item, expect some variance. For reps, this is amplified.

### Shopping agent interaction
- All major agents (Superbuy, Sugargoo, CSSBuy) support 1688 URLs.
- **Quirks:**
  - Some 1688 sellers refuse orders flagged as agent buyers (small percentage). Major agents work around this.
  - **Domestic shipping costs** can be charged separately from item price on 1688 — the agent's checkout will show this.
  - **MOQs are enforced** — your agent can't force a seller to break MOQ. If MOQ is 5, you order 5.
  - **Tax invoice (发票)** prompts and B2B-isms in the UI sometimes confuse the agent's parsers; fall back to manual order if needed.
- For finding cheaper sources: rep buyers sometimes screenshot a Taobao item and reverse-image-search it on 1688 to find the source factory at a lower price. Apps like "1688 image search" or tools built into Superbuy's browser extension help with this.

### "Trusted sellers" lists
- Much less developed than for Taobao/Weidian on the rep side, since rep factories largely aren't on 1688.
- For **haul / blanks / streetwear sourcing**, dedicated subreddits and Discord servers (r/Chinabuy-adjacent) maintain informal 1688 supplier lists for things like blank hoodies, beanies, hardware, jewelry findings, accessories.
- For reverse-sourced rep adjacent goods (unbranded "inspired by" pieces), you're more on your own — vetting is by Trust Pass years + repeat-buyer rate + sample order.

---

## Quick comparison cheatsheet

| Dimension | Taobao | Weidian | 1688 |
|---|---|---|---|
| Type | C2C retail | Mobile-first individual | B2B wholesale |
| MOQ | 1 | 1 | Often 1, but tiered pricing |
| Pricing | Retail | Retail (slight premium) | Wholesale (cheapest) |
| Buyer protection | Strong (Alipay) | Weak | Weak (B2B assumption) |
| Rep-scene relevance | High (legacy) | Highest (current) | Low (mostly blanks/adjacents) |
| Best trust signals | Crowns + DSR + photo reviews | Sales count + community vetting | Trust Pass years + repeat-buyer % |
| Agent support quality | Excellent | Good (occasional friction) | Good (watch for MOQ + shipping) |
| URL pattern | `item.taobao.com/item.htm?id=` | `weidian.com/item.html?itemID=` | `detail.1688.com/offer/<id>.html` |
| Common scam | Bait-and-switch, brushed reviews | Ghost shops, WeChat redirects | Trading-company-as-factory, sample drift |

---

## Practical workflow for a Superbuy buyer

1. **Find the item** via community recommendation (Reddit/Discord TS list) or by browsing.
2. **Identify the platform** from the URL pattern. Use the agent's link parser; if it fails (often on Weidian), copy the numeric ID and use the agent's manual-order form.
3. **Vet the seller** using the platform-appropriate trust signals above, plus community lists.
4. **Note variants/batch in Chinese** in the order notes — especially for Weidian rep orders where batch matters.
5. **Pay via the agent** (Superbuy holds funds in your wallet; never pay sellers directly off-platform).
6. **Request QC photos** from the agent before consolidating/shipping. This is the single biggest fraud-prevention step regardless of platform.
7. **For 1688**: factor MOQ + domestic shipping into whether the price advantage is real after the agent's service fee.
8. **If something is wrong:** dispute through the agent. Taobao disputes resolve fastest; Weidian and 1688 are slower and more dependent on the agent's relationships with the seller.
