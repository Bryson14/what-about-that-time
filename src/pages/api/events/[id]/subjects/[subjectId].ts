import type { APIRoute } from "astro";
import { getEventById, removeSubjectFromEvent } from "../../../../../lib/db";
import { guardAuth, checkGroupAccess, jsonError, noContent } from "../../../../../lib/api";
import { logger } from "../../../../../lib/logging";

export const DELETE: APIRoute = async (context) => {
  try {
    const auth = await guardAuth(context.request, "remove subject from event");
    if (auth instanceof Response) return auth;
    const session = auth.session;

    const id = Number(context.params.id!);
    const subjectId = Number(context.params.subjectId!);

    const event = await getEventById(id);
    if (!event) return jsonError("event not found", 404);

    const accessDenied = checkGroupAccess(session, event.group_name, "delete", String(id));
    if (accessDenied) return accessDenied;

    await removeSubjectFromEvent(id, subjectId);
    logger.info("subject removed from event", { username: session.username, eventId: String(id), subjectId: String(subjectId) });
    return noContent();
  } catch (err) {
    logger.error("failed to remove subject from event", { eventId: context.params.id, error: String(err) });
    return jsonError("internal server error", 500);
  }
};
