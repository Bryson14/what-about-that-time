import type { APIRoute } from "astro";
import { getEventById, getEventTags, addTagToEvent, getTagById } from "../../../../lib/db";
import { guardAuth, checkGroupAccess, jsonError, json } from "../../../../lib/api";
import { logger } from "../../../../lib/logging";
import { z } from "zod";

const addTagSchema = z.object({ tag_id: z.coerce.number().int().positive() });

export const GET: APIRoute = async (context) => {
  try {
    const auth = await guardAuth(context.request, "list event tags");
    if (auth instanceof Response) return auth;
    const session = auth.session;

    const id = Number(context.params.id!);
    const event = await getEventById(id);
    if (!event) return jsonError("event not found", 404);

    const accessDenied = checkGroupAccess(session, event.group_name, "read", String(id));
    if (accessDenied) return accessDenied;

    const tags = await getEventTags(id);
    return json(tags);
  } catch (err) {
    logger.error("failed to list event tags", { eventId: context.params.id, error: String(err) });
    return jsonError("internal server error", 500);
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const auth = await guardAuth(context.request, "add tag to event");
    if (auth instanceof Response) return auth;
    const session = auth.session;

    const id = Number(context.params.id!);
    const event = await getEventById(id);
    if (!event) return jsonError("event not found", 404);

    const accessDenied = checkGroupAccess(session, event.group_name, "create", String(id));
    if (accessDenied) return accessDenied;

    const body = await context.request.json();
    const parsed = addTagSchema.safeParse(body);
    if (!parsed.success) return jsonError("tag_id is required", 400);

    const tag = await getTagById(parsed.data.tag_id);
    if (!tag) return jsonError("tag not found", 404);

    await addTagToEvent(id, tag.id);
    logger.info("tag added to event", { username: session.username, eventId: String(id), tagId: String(tag.id) });
    return json({ event_id: id, tag_id: tag.id }, 201);
  } catch (err) {
    logger.error("failed to add tag to event", { eventId: context.params.id, error: String(err) });
    return jsonError("internal server error", 500);
  }
};
