import type { APIRoute } from "astro";
import { deleteUser, getSessionFromRequest, isAdminUser } from "../../../../lib/auth";
import { logger } from "../../../../lib/logging";

export const DELETE: APIRoute = async (context) => {
  try {
    const session = await getSessionFromRequest(context.request);
    if (!session || !isAdminUser(session)) {
      logger.warn("non-admin attempted to delete user", { username: session?.username });
      return new Response("Forbidden", { status: 403 });
    }

    const username = context.params.username ?? "";
    const result = await deleteUser(username);
    if (!result.ok) {
      logger.warn("user deletion failed", { username: username.trim().toLowerCase(), error: result.error });
      return new Response(JSON.stringify({ error: result.error }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    logger.info("user deleted", { username: username.trim().toLowerCase(), deletedBy: session.username });
    return new Response(null, { status: 204 });
  } catch (err) {
    logger.error("failed to delete user", { username: context.params.username, error: String(err) });
    return new Response(JSON.stringify({ error: "internal server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};
