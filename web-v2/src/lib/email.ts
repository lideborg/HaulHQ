// Transactional email via Resend (domain haulhq.shop, verified in Resend).
// Auth flows must never break on email problems: when RESEND_API_KEY is unset
// (dev) the message is logged instead of sent, and send failures only log.
import { Resend } from "resend";

const FROM = "HaulHQ <hello@haulhq.shop>";

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://haulhq.shop";
}

// Shared shell so every mail matches the site's plain black-on-white tone.
function shell(body: string): string {
  return `<div style="font-family:Helvetica,Arial,sans-serif;color:#111;max-width:420px;margin:0 auto;padding:32px 16px">
<p style="font-size:12px;letter-spacing:0.25em;text-transform:uppercase;font-weight:600;margin:0 0 24px">HaulHQ</p>
${body}
<p style="font-size:11px;color:#999;margin-top:32px">HaulHQ is invite-only. If this email wasn't meant for you, you can ignore it.</p>
</div>`;
}

export function welcomeEmailHtml(): string {
  return shell(`<p style="font-size:14px;margin:0 0 12px">You're in.</p>
<p style="font-size:13px;color:#444;margin:0 0 12px">Your account is set up. Sign in any time with your email and password, browse the shop, and build your haul. The admin sources and orders everything once you confirm.</p>
<p style="margin:24px 0 0"><a href="${siteUrl()}/shop" style="display:inline-block;background:#000;color:#fff;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;text-decoration:none;padding:10px 18px">Open the shop</a></p>`);
}

export function resetEmailHtml(resetUrl: string): string {
  return shell(`<p style="font-size:14px;margin:0 0 12px">Reset your password</p>
<p style="font-size:13px;color:#444;margin:0 0 12px">Someone (hopefully you) asked to reset the password for this account. The link below works once and expires in 60 minutes.</p>
<p style="margin:24px 0 0"><a href="${resetUrl}" style="display:inline-block;background:#000;color:#fff;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;text-decoration:none;padding:10px 18px">Choose a new password</a></p>
<p style="font-size:12px;color:#666;margin:16px 0 0">Didn't ask for this? Ignore it and your password stays as it is.</p>`);
}

async function send(to: string, subject: string, html: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email:dev] to=${to} subject="${subject}" (RESEND_API_KEY unset, not sent)`);
    return;
  }
  try {
    const { error } = await new Resend(key).emails.send({ from: FROM, to, subject, html });
    if (error) console.error(`[email] send failed to=${to}:`, error);
  } catch (e) {
    console.error(`[email] send threw to=${to}:`, e);
  }
}

export function sendWelcomeEmail(to: string): Promise<void> {
  return send(to, "Welcome to HaulHQ", welcomeEmailHtml());
}

export function sendResetEmail(to: string, resetUrl: string): Promise<void> {
  return send(to, "Reset your HaulHQ password", resetEmailHtml(resetUrl));
}
