// People sign in with a phone number. Behind the scenes each account has a
// private email-style ID made from that number, so no SMS service is needed.
export const LOGIN_DOMAIN = "users.rmc-portal.app";

export function normalizePhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("0092")) d = "0" + d.slice(4);
  else if (d.startsWith("92") && d.length === 12) d = "0" + d.slice(2);
  return d;
}

export function isValidPhone(raw: string): boolean {
  return /^03\d{9}$/.test(normalizePhone(raw));
}

export function phoneToLoginId(raw: string): string {
  return `${normalizePhone(raw)}@${LOGIN_DOMAIN}`;
}
