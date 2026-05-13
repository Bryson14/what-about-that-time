export const AUTH_COOKIE = "auth_session";
export const AUTH_TOKEN = "bryson_authenticated_session";

export const USERNAME = "bryson";
export const PASSWORD = "abc123!!";

export function isAuthenticated(request: Request): boolean {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.split(";").some((c) => {
    const [name, value] = c.trim().split("=");
    return name === AUTH_COOKIE && value === AUTH_TOKEN;
  });
}
