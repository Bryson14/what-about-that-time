import type { APIRoute } from "astro";
import { createUser, getSessionFromRequest, isAdminUser, listUsers } from "../../../lib/auth";
import { createUserSchema } from "../../../lib/validation";
import { logger } from "../../../lib/logging";

export const GET: APIRoute = async (context) => {
  try {
    const session = await getSessionFromRequest(context.request);
    if (!session || !isAdminUser(session)) {
      logger.warn("non-admin attempted to list users", { username: session?.username });
      return new Response("Forbidden", { status: 403 });
    }

    const users = await listUsers();
    return new Response(JSON.stringify(users), {
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    logger.error("failed to list users", { error: String(err) });
    return new Response(JSON.stringify({ error: "internal server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const session = await getSessionFromRequest(context.request);
    if (!session || !isAdminUser(session)) {
      logger.warn("non-admin attempted to create user", { username: session?.username });
      return new Response("Forbidden", { status: 403 });
    }

    const body = await context.request.json();
    const parsed = createUserSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn("user creation validation failed", {
        username: session.username,
        issues: JSON.stringify(parsed.error.issues),
      });
      return new Response(JSON.stringify({ error: parsed.error.issues }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const { username, password, fullName, allowedGroups } = parsed.data;
    const result = await createUser(username, password, fullName, allowedGroups, "user");
    if (!result.ok) {
      logger.warn("user creation failed", { username: username.trim().toLowerCase(), error: result.error });
      return new Response(JSON.stringify({ error: result.error }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    logger.info("user created", { username: username.trim().toLowerCase(), createdBy: session.username });
    return new Response(null, { status: 201 });
  } catch (err) {
    logger.error("failed to create user", { error: String(err) });
    return new Response(JSON.stringify({ error: "internal server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};
