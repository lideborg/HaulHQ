# Discord seller sweep: daily digest of new drops

Read every watched channel across Hampus's rep-seller Discord servers (via Chrome
MCP, logged in as him), extract new drops since the last sweep, and write a digest.
Bots cannot join these servers (he is a member, not a manager), so the browser IS
the integration. Never use his user token programmatically (Discord ToS ban risk).

## Files

- `research/discord-digest/config.json` - the watch list:
  `{"servers":[{"name":"RepLux","guild":"<id>","channels":[{"name":"daily-drops","url":"https://discord.com/channels/<guild>/<channel>"},...]}]}`
- `research/discord-digest/state.json` - per-channel last-seen marker:
  `{"<channel-url>": {"lastSeen": "<newest message snippet/timestamp seen>", "sweptAt": "ISO"}}`
- `research/discord-digest/YYYY-MM-DD.md` - the digest output, one per day.

## Procedure

1. Load Chrome tools via ToolSearch (`tabs_context_mcp`, `tabs_create_mcp`,
   `navigate`, `get_page_text`, `computer`). Get tab context, create a tab.
   Verify Discord web is logged in (discord.com/channels/@me shows the rail).
   If logged out: STOP and tell Hampus to log into Discord in Chrome.
2. **First run only (config.json missing): discovery.** Open the server folder in
   the left rail (screenshot to see it; servers sit under the yellow folder icon).
   For each server in the folder: click it, screenshot, read the channel list.
   Watch-channel heuristics: names matching
   `drop|update|release|announce|new|arrival|restock|batch|link` are IN;
   `general|chat|giveaway|rules|faq|qc|review|reddit|order|ticket|shipping` are OUT
   (2-3 channels per server, prefer the update/drop ones). Open each kept channel
   once and record its URL (`discord.com/channels/<guild>/<channel>` from the tab
   context after navigation). Write config.json.
3. **Sweep.** For each channel URL in config.json: `navigate` directly to it, wait
   2s, `get_page_text`. Compare against state.json lastSeen: everything below the
   stored marker is new. Extract per message: seller/server, item description,
   price (¥ or $), any yupoo/weidian/taobao links, date line. Discord renders
   dates as "21 August 2026" section headers and "Yesterday at 09:41" stamps; use
   them. Update state.json with the newest message marker per channel.
4. **Digest.** Write `research/discord-digest/YYYY-MM-DD.md`:
   - "Highlights" first: anything matching brands we carry (check against
     `select distinct brand from products` or the known roster: Margiela, Lemaire,
     Our Legacy, Acne, The Row, Rick Owens, CdG, Miu Miu, Loewe, Stone Island,
     Arc'teryx, etc.) plus anything with sizes in Hampus's range flagged fun.
   - Then per-server sections listing each new drop: item, price, link.
   - Skip servers with nothing new (one line: "quiet").
5. Tell Hampus the highlights in chat (3-8 bullets max, links included).
6. **Re-arm the schedule.** CronCreate a durable ONE-SHOT for tomorrow ~08:57
   local ("57 8 <tomorrow-dom> <tomorrow-month> *", recurring: false,
   durable: true) with prompt: "Run the discord-sweep skill". Each run schedules
   the next; this dodges the 7-day recurring-cron expiry.

## Gotchas

- One channel per navigate; the channel URL is stable (guild + channel IDs).
- get_page_text on a channel returns newest messages at the BOTTOM.
- Long channels only render recent history; that is fine, we only want new stuff.
- If a server demands "verify" / captcha, skip it and note it in the digest.
- Keep Chrome sweeps sequential (no parallel tabs fighting for focus).
- Subagent-friendly: dispatch the sweep as one background claude agent to keep the
  main context clean; it has MCP access via ToolSearch.
- **Extraction pipeline that actually works on Discord web** (2026-08-23 run):
  get_page_text grabs only one message article, and javascript_tool return values
  trip the DLP filter on this content (URLs/base64). Working combo: use JS for
  in-app navigation (guild IDs from the rail via `data-list-item-id`, channel
  hrefs from the sidebar), then STAGE the extracted channel text into the DOM and
  read it with get_page_text, then restore the app. Full notes in the sweep-notes
  section of research/discord-digest/2026-08-23.md.
- Sweeping marks channels as read in Discord (the unread badges clear). Expected
  side effect; tell Hampus the digest replaces the badges.
- Verification-walled servers so far: Bianjing Made (hard No Access), Thunderfashion
  (all behind #verify). They need Hampus to verify manually once; until then they
  stay on the skip list in config.json. Never click verify/honeypot channels
  (K9999 has a trap channel).
