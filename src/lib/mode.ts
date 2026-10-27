// Admins can work in "admin" or "personal" mode. The choice only decides where
// they land after signing in; every admin page still checks the role itself.
export const MODE_COOKIE = "masqq_mode";
export type Mode = "admin" | "personal";
