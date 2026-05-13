import type { APIRoute } from "astro";
import { AUTH_COOKIE } from "../../lib/auth";

export const POST: APIRoute = async (context) => {
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/",
      "Set-Cookie": `${AUTH_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`,
    },
  });
};
