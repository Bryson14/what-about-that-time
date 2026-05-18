import type { APIRoute } from "astro";
import { getEventById, getEventSubjects, addSubjectToEvent, getSubjectById } from "../../../../lib/db";
import { guardAuth, checkGroupAccess, jsonError, json, validationError } from "../../../../lib/api";
import { logger } from "../../../../lib/logging";
import { addSubjectToEventSchema } from "../../../../lib/validation";

export const GET: APIRoute = async (context) => {
  try {
    const auth = await guardAuth(context.request, "list event subjects");
    if (auth instanceof Response) return auth;
    const session = auth.session;

    const id = Number(context.params.id!);
    const event = await getEventById(id);
    if (!event) return jsonError("event not found", 404);

    const accessDenied = checkGroupAccess(session, event.group_name, "read", String(id));
    if (accessDenied) return accessDenied;

    const subjects = await getEventSubjects(id);
    return json(subjects);
  } catch (err) {
    logger.error("failed to list event subjects", { eventId: context.params.id, error: String(err) });
    return jsonError("internal server error", 500);
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const auth = await guardAuth(context.request, "add subject to event");
    if (auth instanceof Response) return auth;
    const session = auth.session;

    const id = Number(context.params.id!);
    const event = await getEventById(id);
    if (!event) return jsonError("event not found", 404);

    const accessDenied = checkGroupAccess(session, event.group_name, "create", String(id));
    if (accessDenied) return accessDenied;

    const body = await context.request.json();
    const parsed = addSubjectToEventSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.issues);

    const subject = await getSubjectById(parsed.data.subject_id);
    if (!subject) return jsonError("subject not found", 404);

    await addSubjectToEvent(id, subject.id);
    logger.info("subject added to event", { username: session.username, eventId: String(id), subjectId: String(subject.id) });
    return json({ event_id: id, subject_id: subject.id }, 201);
  } catch (err) {
    logger.error("failed to add subject to event", { eventId: context.params.id, error: String(err) });
    return jsonError("internal server error", 500);
  }
};
