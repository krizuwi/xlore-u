export const ADMIN_EMAIL = "unicourse02@gmail.com";

export function isAdminUser(user) {
  return Boolean(user?.email_verified_at) &&
    String(user?.email ?? "").trim().toLowerCase() === ADMIN_EMAIL;
}
