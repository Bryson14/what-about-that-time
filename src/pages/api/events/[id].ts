import type { APIRoute } from "astro";
import { getEventById, updateEvent, deleteEvent } from "../../../lib/db";
import { updateEventSchema } from "../../../lib/validation";
import { getSessionFromRequest, isAdminUser } from "../../../lib/auth";
import { logger } from "../../../lib/logging";

export const PUT: APIRoute = async (context) => {
  try {
    const session = await getSessionFromRequest(context.request);
    if (!session) {
      logger.warn("unauthorized attempt to update event");
      return new Response("Unauthorized", { status: 401 });
    }

    const id = Number(context.params.id!);
    const body = await context.request.json();
    const parsed = updateEventSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn("event update validation failed", {
        username: session.username,
        eventId: String(id),
        issues: JSON.stringify(parsed.error.issues),
      });
      return new Response(JSON.stringify({ error: parsed.error.issues }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const existing = await getEventById(id);
    if (!existing) {
      logger.warn("event not found for update", { username: session.username, eventId: String(id) });
      return new Response(JSON.stringify({ error: "event not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    if (!isAdminUser(session) && !session.allowedGroups.includes(existing.group_name)) {
      logger.warn("event update blocked for unauthorized group", {
        username: session.username,
        eventId: String(id),
        group_name: existing.group_name,
      });
      return new Response(JSON.stringify({ error: "you do not have access to this event" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }

    if (parsed.data.group_name !== undefined && !isAdminUser(session) && !session.allowedGroups.includes(parsed.data.group_name)) {
      logger.warn("event update blocked for unauthorized target group", {
        username: session.username,
        eventId: String(id),
        group_name: parsed.data.group_name,
      });
      return new Response(JSON.stringify({ error: "you do not have access to this group" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }

    const updated = await updateEvent(id, parsed.data);
    if (!updated) {
      logger.warn("event update produced no changes", { username: session.username, eventId: String(id) });
      return new Response(JSON.stringify({ error: "no fields to update" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    logger.info("event updated", { username: session.username, eventId: String(id) });
    return new Response(null, { status: 204 });
  } catch (err) {
    logger.error("failed to update event", { eventId: context.params.id, error: String(err) });
    return new Response(JSON.stringify({ error: "internal server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};

export const DELETE: APIRoute = async (context) => {
  try {
    const session = await getSessionFromRequest(context.request);
    if (!session) {
      logger.warn("unauthorized attempt to delete event");
      return new Response("Unauthorized", { status: 401 });
    }

    const id = Number(context.params.id!);

    const existing = await getEventById(id);
    if (!existing) {
      logger.warn("event not found for deletion", { username: session.username, eventId: String(id) });
      return new Response(JSON.stringify({ error: "event not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    if (!isAdminUser(session) && !session.allowedGroups.includes(existing.group_name)) {
      logger.warn("event deletion blocked for unauthorized group", {
        username: session.username,
        eventId: String(id),
        group_name: existing.group_name,
      });
      return new Response(JSON.stringify({ error: "you do not have access to this event" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }

    await deleteEvent(id);
    logger.info("event deleted", { username: session.username, eventId: String(id) });
    return new Response(null, { status: 204 });
  } catch (err) {
    logger.error("failed to delete event", { eventId: context.params.id, error: String(err) });
    return new Response(JSON.stringify({ error: "internal server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};
