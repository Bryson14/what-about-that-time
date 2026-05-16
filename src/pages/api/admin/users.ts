import type { APIRoute } from "astro";
import { createUser, listUsers } from "../../../lib/auth";
import { createUserSchema } from "../../../lib/validation";
import { guardAdmin, jsonError, noContent, json, validationError } from "../../../lib/api";
import { logger } from "../../../lib/logging";

export const GET: APIRoute = async (context) => {
  try {
    const auth = await guardAdmin(context.request, "list users");
    if (auth instanceof Response) return auth;

    const users = await listUsers();
    return json(users);
  } catch (err) {
    logger.error("failed to list users", { error: String(err) });
    return jsonError("internal server error", 500);
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const auth = await guardAdmin(context.request, "create user");
    if (auth instanceof Response) return auth;
    const session = auth.session;

    const body = await context.request.json();
    const parsed = createUserSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn("user creation validation failed", {
        username: session.username,
        issues: JSON.stringify(parsed.error.issues),
      });
      return validationError(parsed.error.issues);
    }

    const { username, password, fullName, allowedGroups } = parsed.data;
    const result = await createUser(username, password, fullName, allowedGroups, "user");
    if (!result.ok) {
      logger.warn("user creation failed", { username: username.trim().toLowerCase(), error: result.error });
      return jsonError(result.error, 400);
    }

    logger.info("user created", { username: username.trim().toLowerCase(), createdBy: session.username });
    return noContent();
  } catch (err) {
    logger.error("failed to create user", { error: String(err) });
    return jsonError("internal server error", 500);
  }
};
