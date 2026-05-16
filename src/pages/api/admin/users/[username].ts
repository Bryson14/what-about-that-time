import type { APIRoute } from "astro";
import { deleteUser, getSessionFromRequest, isAdminUser, updateUserGroups } from "../../../../lib/auth";
import { updateUserGroupsSchema } from "../../../../lib/validation";
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

export const PUT: APIRoute = async (context) => {
  try {
    const session = await getSessionFromRequest(context.request);
    if (!session || !isAdminUser(session)) {
      logger.warn("non-admin attempted to update user groups", { username: session?.username });
      return new Response("Forbidden", { status: 403 });
    }

    const username = context.params.username ?? "";
    const body = await context.request.json();
    const parsed = updateUserGroupsSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn("user groups update validation failed", {
        username: session.username,
        target: username,
        issues: JSON.stringify(parsed.error.issues),
      });
      return new Response(JSON.stringify({ error: parsed.error.issues }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const result = await updateUserGroups(username, parsed.data.allowedGroups);
    if (!result.ok) {
      logger.warn("user groups update failed", { username: username.trim().toLowerCase(), error: result.error });
      return new Response(JSON.stringify({ error: result.error }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    logger.info("user groups updated", { username: username.trim().toLowerCase(), updatedBy: session.username });
    return new Response(null, { status: 204 });
  } catch (err) {
    logger.error("failed to update user groups", { username: context.params.username, error: String(err) });
    return new Response(JSON.stringify({ error: "internal server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};
