import type { APIRoute } from "astro";
import { authenticateUser, buildAuthSetCookie, createSession } from "../../lib/auth";
import { logger } from "../../lib/logging";

export const POST: APIRoute = async (context) => {
  try {
    const formData = await context.request.formData();
    const username = formData.get("username")?.toString() ?? "";
    const password = formData.get("password")?.toString() ?? "";

    const normalized = username.trim().toLowerCase();
    const user = await authenticateUser(normalized, password);
    if (!user) {
      logger.warn("failed login attempt", { username: normalized });
      return context.redirect("/login?error=1");
    }

    const sessionToken = await createSession(user);
    logger.info("user logged in", { username: user.username });

    return new Response(null, {
      status: 302,
      headers: {
        Location: "/app",
        "Set-Cookie": buildAuthSetCookie(sessionToken),
      },
    });
  } catch (err) {
    logger.error("login error", { error: String(err) });
    return context.redirect("/login?error=1");
  }
};
