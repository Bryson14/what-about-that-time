import type { APIRoute } from "astro";
import { AUTH_COOKIE, buildAuthClearCookie, destroySession } from "../../lib/auth";
import { logger } from "../../lib/logging";

export const POST: APIRoute = async (context) => {
  const cookie = context.request.headers.get("cookie") ?? "";
  const found = cookie.split(";").find((c) => c.trim().startsWith(`${AUTH_COOKIE}=`));
  if (found) {
    const [, token = ""] = found.trim().split("=");
    if (token) {
      try {
        await destroySession(decodeURIComponent(token));
      } catch {
        logger.debug("failed to destroy session during logout", { token: token.slice(0, 8) });
      }
    }
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: "/",
      "Set-Cookie": buildAuthClearCookie(),
    },
  });
};
