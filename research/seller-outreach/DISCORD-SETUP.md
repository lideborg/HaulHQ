# Discord MCP setup

Status: MCP server installed and built at `~/tools/mcp-discord` (barryyip0625/mcp-discord v1.3.8, source from 2026-08-05, verified starting on stdio). Only missing piece: a Discord bot token.

## What Hampus does (5 min)

1. Go to https://discord.com/developers/applications and click **New Application**. Name it **HaulHQ Bot**, create.
2. Open the **Bot** tab in the left sidebar. Scroll to **Privileged Gateway Intents** and enable **MESSAGE CONTENT INTENT**, then save. Without this the bot sees every message as empty text.
3. Still on the Bot tab, under **Token** click **Reset Token** and copy it. It is shown only once, so paste it straight into Claude (step below).
4. Go to **OAuth2 > URL Generator**. Check the scope **bot**. Under Bot Permissions check: **View Channels**, **Send Messages**, **Read Message History**, **Send Messages in Threads**, **Create Public Threads**.
5. Copy the **Generated URL** at the bottom. Open it in a browser, pick a server, **Authorize**. Repeat with the same URL once per server (the URL is reusable, one authorize per server).
6. Optional lockdown per server: the bot only needs the seller-update channels. In Discord, edit a channel > **Permissions** > add the bot (or its auto-created role) and allow it there, or deny it on channels it should not see. Channel overrides beat the server-wide grant.

## Then paste the token to Claude

One command in a terminal, replace `<TOKEN>` with the real token:

```
claude mcp add --scope user -e DISCORD_TOKEN=<TOKEN> discord -- node /Users/lidelaptop/tools/mcp-discord/build/index.js
```

Then start a new Claude Code session and run `/mcp` to confirm **discord** shows as connected. `--scope user` makes it available in every project on this Mac.

## What Claude can then do

The server exposes 43 tools. The ones that matter for seller channels:

Reading:
- `discord_list_servers`: all servers the bot is in
- `discord_get_server_info`: channels and member count for a server
- `discord_read_messages`: messages from any text channel or thread (pass the thread ID as the channelId), with before/after/around filtering by message ID or ISO date
- `discord_list_forum_threads`: all threads in a forum channel, active and archived
- `discord_get_forum_post`: a forum post plus its messages

Writing:
- `discord_send`: send to a channel or thread, optional reply-to a message ID
- `discord_reply_to_forum`: reply inside an existing forum post or thread
- `discord_create_forum_post`: new forum post with tags
- `discord_add_reaction` / `discord_add_multiple_reactions`

Also available but not needed here: channel/category create/edit/delete, webhooks, roles, member listing, message edit/delete, `discord_search_messages` (uses a Discord search endpoint that is not officially open to bots, may error; reading recent messages per channel is the reliable path).

## Limitations

- Bots cannot read anyone's DMs. Server channels only.
- The bot only sees servers it was invited to, and only channels its permissions allow.
- Regular (non-forum) threads: read and reply by using the thread's own ID as the channelId. Get IDs via Discord Developer Mode (Settings > Advanced), then right-click a channel/thread/message > Copy ID.
- Message Content Intent is fine unverified while the bot is in fewer than 100 servers, which is the case here.
