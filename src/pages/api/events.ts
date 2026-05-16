import type { APIRoute } from "astro";
import { getAllEvents, createEvent } from "../../lib/db";
import { createEventSchema } from "../../lib/validation";
import { getSessionFromRequest } from "../../lib/auth";
import { logger } from "../../lib/logging";

export const GET: APIRoute = async (context) => {
  try {
    const session = await getSessionFromRequest(context.request);
    if (!session) {
      logger.warn("unauthorized access to events list");
      return new Response("Unauthorized", { status: 401 });
    }

    const events = await getAllEvents();
    return new Response(JSON.stringify(events), {
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    logger.error("failed to fetch events list", { error: String(err) });
    return new Response(JSON.stringify({ error: "internal server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const session = await getSessionFromRequest(context.request);
    if (!session) {
      logger.warn("unauthorized attempt to create event");
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await context.request.json();
    const parsed = createEventSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn("event creation validation failed", {
        username: session.username,
        issues: JSON.stringify(parsed.error.issues),
      });
      return new Response(JSON.stringify({ error: parsed.error.issues }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const id = await createEvent({ ...parsed.data, created_by: session.username });
    logger.info("event created", { username: session.username, id: String(id) });

    return new Response(JSON.stringify({ id }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    logger.error("failed to create event", { error: String(err) });
    return new Response(JSON.stringify({ error: "internal server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};
