import type { APIRoute } from "astro";
import { createEvent, getPaginatedEvents, getGroupById } from "../../lib/db";
import { createEventSchema, paginationSchema } from "../../lib/validation";
import { isAdminUser } from "../../lib/auth";
import { guardAuth, checkGroupAccess, jsonError, validationError, json } from "../../lib/api";
import { logger } from "../../lib/logging";

export const GET: APIRoute = async (context) => {
  try {
    const auth = await guardAuth(context.request, "access events list");
    if (auth instanceof Response) return auth;
    const session = auth.session;

    const parsed = paginationSchema.safeParse(
      Object.fromEntries(context.url.searchParams.entries())
    );

    if (!parsed.success) {
      return jsonError("invalid pagination parameters", 400);
    }

    const { page, pageSize, search } = parsed.data;
    const groups = isAdminUser(session) ? undefined : session.allowedGroups;
    const result = await getPaginatedEvents(page, pageSize, search, groups);
    return json(result);
  } catch (err) {
    logger.error("failed to fetch events list", { error: String(err) });
    return jsonError("internal server error", 500);
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const auth = await guardAuth(context.request, "create event");
    if (auth instanceof Response) return auth;
    const session = auth.session;

    const body = await context.request.json();
    const parsed = createEventSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn("event creation validation failed", {
        username: session.username,
        issues: JSON.stringify(parsed.error.issues),
      });
      return validationError(parsed.error.issues);
    }

    const { group_id, ...rest } = parsed.data;

    const group = await getGroupById(group_id);
    if (!group) return jsonError("group not found", 404);

    const accessDenied = checkGroupAccess(session, group.name, "create", "new");
    if (accessDenied) return accessDenied;

    const id = await createEvent({ ...rest, created_by: session.username, group_id });
    logger.info("event created", { username: session.username, id: String(id) });
    return json({ id }, 201);
  } catch (err) {
    logger.error("failed to create event", { error: String(err) });
    return jsonError("internal server error", 500);
  }
};
