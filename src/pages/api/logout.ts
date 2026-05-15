import type { APIRoute } from "astro";
import { AUTH_COOKIE, buildAuthClearCookie, destroySession } from "../../lib/auth";

export const POST: APIRoute = async (context) => {
  const cookie = context.request.headers.get("cookie") ?? "";
  const found = cookie.split(";").find((c) => c.trim().startsWith(`${AUTH_COOKIE}=`));
  if (found) {
    const [, token = ""] = found.trim().split("=");
    if (token) {
      await destroySession(decodeURIComponent(token));
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
