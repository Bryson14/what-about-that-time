import type { APIRoute } from "astro";
import { authenticateUser, buildAuthSetCookie, createSession } from "../../lib/auth";

export const POST: APIRoute = async (context) => {
  const formData = await context.request.formData();
  const username = formData.get("username")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";

  const user = await authenticateUser(username, password);
  if (!user) {
    return context.redirect("/login?error=1");
  }

  const sessionToken = await createSession(user);

  return new Response(null, {
    status: 302,
    headers: {
      Location: "/app",
      "Set-Cookie": buildAuthSetCookie(sessionToken),
    },
  });
};
