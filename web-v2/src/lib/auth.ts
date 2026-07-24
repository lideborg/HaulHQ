// Friend password + id helpers. Pure (no next/headers) so it stays unit-testable.
// Passwords are bcrypt-hashed; the admin/db never sees plaintext.
import bcrypt from "bcryptjs";

// Anonymous login id: "u" + 5 digits (10000-99999). Not a secret — it's a
// username; the password is the secret. `rand` is injectable for tests.
export function randomUserId(rand: () => number = Math.random): string {
  return "u" + String(10000 + Math.floor(rand() * 90000));
}

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
