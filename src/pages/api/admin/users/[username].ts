import type { APIRoute } from "astro";
import { deleteUser, resetUserPassword, updateUserGroups } from "../../../../lib/auth";
import { resetUserPasswordSchema, updateUserGroupsSchema } from "../../../../lib/validation";
import { guardAdmin, jsonError, noContent, validationError } from "../../../../lib/api";
import { logger } from "../../../../lib/logging";

export const DELETE: APIRoute = async (context) => {
  try {
    const auth = await guardAdmin(context.request, "delete user");
    if (auth instanceof Response) return auth;
    const session = auth.session;

    const username = context.params.username ?? "";
    const result = await deleteUser(username);
    if (!result.ok) {
      logger.warn("user deletion failed", { username: username.trim().toLowerCase(), error: result.error });
      return jsonError(result.error, 400);
    }

    logger.info("user deleted", { username: username.trim().toLowerCase(), deletedBy: session.username });
    return noContent();
  } catch (err) {
    logger.error("failed to delete user", { username: context.params.username, error: String(err) });
    return jsonError("internal server error", 500);
  }
};

export const PUT: APIRoute = async (context) => {
  try {
    const auth = await guardAdmin(context.request, "update user groups");
    if (auth instanceof Response) return auth;
    const session = auth.session;

    const username = context.params.username ?? "";
    const body = await context.request.json();
    const parsed = updateUserGroupsSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn("user groups update validation failed", {
        username: session.username,
        target: username,
        issues: JSON.stringify(parsed.error.issues),
      });
      return validationError(parsed.error.issues);
    }

    const result = await updateUserGroups(username, parsed.data.allowedGroups);
    if (!result.ok) {
      logger.warn("user groups update failed", { username: username.trim().toLowerCase(), error: result.error });
      return jsonError(result.error, 400);
    }

    logger.info("user groups updated", { username: username.trim().toLowerCase(), updatedBy: session.username });
    return noContent();
  } catch (err) {
    logger.error("failed to update user groups", { username: context.params.username, error: String(err) });
    return jsonError("internal server error", 500);
  }
};

export const PATCH: APIRoute = async (context) => {
  try {
    const auth = await guardAdmin(context.request, "reset user password");
    if (auth instanceof Response) return auth;
    const session = auth.session;

    const username = context.params.username ?? "";
    const body = await context.request.json();
    const parsed = resetUserPasswordSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn("user password reset validation failed", {
        username: session.username,
        target: username,
        issues: JSON.stringify(parsed.error.issues),
      });
      return validationError(parsed.error.issues);
    }

    const result = await resetUserPassword(username, parsed.data.password);
    if (!result.ok) {
      logger.warn("user password reset failed", { username: username.trim().toLowerCase(), error: result.error });
      return jsonError(result.error, 400);
    }

    logger.info("user password reset", { username: username.trim().toLowerCase(), updatedBy: session.username });
    return noContent();
  } catch (err) {
    logger.error("failed to reset user password", { username: context.params.username, error: String(err) });
    return jsonError("internal server error", 500);
  }
};
