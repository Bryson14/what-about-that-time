import type { APIRoute } from "astro";
import { AUTH_COOKIE, AUTH_TOKEN, USERNAME, PASSWORD } from "../../lib/auth";

export const POST: APIRoute = async (context) => {
  const formData = await context.request.formData();
  const username = formData.get("username")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";

  if (username !== USERNAME || password !== PASSWORD) {
    return context.redirect("/login?error=1");
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: "/app",
      "Set-Cookie": `${AUTH_COOKIE}=${AUTH_TOKEN}; HttpOnly; Path=/; SameSite=Lax; Secure`,
    },
  });
};
