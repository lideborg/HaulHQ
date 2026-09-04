// Friend password + id helpers. Pure (no next/headers) so it stays unit-testable.
// Passwords are bcrypt-hashed; the admin/db never sees plaintext.
import bcrypt from "bcryptjs";

// One-time token for the send-yourself setup/reset link.
export function randomToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

// Emails are compared and stored in this canonical form everywhere.
export function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

export function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

// Reset links are single-use and short-lived; `now` injectable for tests.
export function resetTokenExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + 60 * 60 * 1000);
}

export function tokenExpired(expiresIso: string | null, now: Date = new Date()): boolean {
  if (!expiresIso) return true;
  return new Date(expiresIso).getTime() <= now.getTime();
}
