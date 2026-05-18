import type { APIRoute } from "astro";
import { getEventById, updateEvent, deleteEvent, getGroupById } from "../../../lib/db";
import { updateEventSchema } from "../../../lib/validation";
import { isAdminUser } from "../../../lib/auth";
import { guardAuth, checkGroupAccess, jsonError, noContent, validationError } from "../../../lib/api";
import { logger } from "../../../lib/logging";

export const PUT: APIRoute = async (context) => {
  try {
    const auth = await guardAuth(context.request, "update event");
    if (auth instanceof Response) return auth;
    const session = auth.session;

    const id = Number(context.params.id!);
    const body = await context.request.json();
    const parsed = updateEventSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn("event update validation failed", {
        username: session.username,
        eventId: String(id),
        issues: JSON.stringify(parsed.error.issues),
      });
      return validationError(parsed.error.issues);
    }

    const existing = await getEventById(id);
    if (!existing) {
      logger.warn("event not found for update", { username: session.username, eventId: String(id) });
      return jsonError("event not found", 404);
    }

    if (!isAdminUser(session) && existing.created_by !== session.username) {
      logger.warn("event update blocked for non-owner", {
        username: session.username,
        eventId: String(id),
        created_by: existing.created_by,
      });
      return jsonError("you can only edit your own events", 403);
    }

    const accessDenied = checkGroupAccess(session, existing.group_name, "update", String(id));
    if (accessDenied) return accessDenied;

    if (parsed.data.group_id !== undefined) {
      const newGroup = await getGroupById(parsed.data.group_id);
      if (!newGroup) return jsonError("group not found", 404);
      const targetDenied = checkGroupAccess(session, newGroup.name, "update", String(id));
      if (targetDenied) return targetDenied;
    }

    const updated = await updateEvent(id, parsed.data);
    if (!updated) {
      logger.warn("event update produced no changes", { username: session.username, eventId: String(id) });
      return jsonError("no fields to update", 400);
    }

    logger.info("event updated", { username: session.username, eventId: String(id) });
    return noContent();
  } catch (err) {
    logger.error("failed to update event", { eventId: context.params.id, error: String(err) });
    return jsonError("internal server error", 500);
  }
};

export const DELETE: APIRoute = async (context) => {
  try {
    const auth = await guardAuth(context.request, "delete event");
    if (auth instanceof Response) return auth;
    const session = auth.session;

    const id = Number(context.params.id!);

    const existing = await getEventById(id);
    if (!existing) {
      logger.warn("event not found for deletion", { username: session.username, eventId: String(id) });
      return jsonError("event not found", 404);
    }

    if (!isAdminUser(session) && existing.created_by !== session.username) {
      logger.warn("event deletion blocked for non-owner", {
        username: session.username,
        eventId: String(id),
        created_by: existing.created_by,
      });
      return jsonError("you can only delete your own events", 403);
    }

    const accessDenied = checkGroupAccess(session, existing.group_name, "delete", String(id));
    if (accessDenied) return accessDenied;

    await deleteEvent(id);
    logger.info("event deleted", { username: session.username, eventId: String(id) });
    return noContent();
  } catch (err) {
    logger.error("failed to delete event", { eventId: context.params.id, error: String(err) });
    return jsonError("internal server error", 500);
  }
};
