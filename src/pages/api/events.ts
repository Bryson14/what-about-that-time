import type { APIRoute } from "astro";
import { createEvent, getPaginatedEvents } from "../../lib/db";
import { createEventSchema, paginationSchema } from "../../lib/validation";
import { getSessionFromRequest, isAdminUser } from "../../lib/auth";
import { logger } from "../../lib/logging";

export const GET: APIRoute = async (context) => {
  try {
    const session = await getSessionFromRequest(context.request);
    if (!session) {
      logger.warn("unauthorized access to events list");
      return new Response("Unauthorized", { status: 401 });
    }

    const parsed = paginationSchema.safeParse(
      Object.fromEntries(context.url.searchParams.entries())
    );

    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "invalid pagination parameters" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const { page, pageSize, search } = parsed.data;
    const groups = isAdminUser(session) ? undefined : session.allowedGroups;
    const result = await getPaginatedEvents(page, pageSize, search, groups);
    return new Response(JSON.stringify(result), {
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

    const { group_name, ...rest } = parsed.data;

    if (!isAdminUser(session) && !session.allowedGroups.includes(group_name)) {
      logger.warn("event creation blocked for unauthorized group", {
        username: session.username,
        group_name,
      });
      return new Response(JSON.stringify({ error: "you do not have access to this group" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }

    const id = await createEvent({ ...rest, created_by: session.username, group_name });
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
