import type { APIRoute } from "astro";
import { getAllEvents, createEvent } from "../../lib/db";
import { createEventSchema } from "../../lib/validation";
import { getSessionFromRequest } from "../../lib/auth";

export const GET: APIRoute = async (context) => {
  const session = await getSessionFromRequest(context.request);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const events = await getAllEvents();
  return new Response(JSON.stringify(events), {
    headers: { "content-type": "application/json" },
  });
};

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromRequest(context.request);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const body = await context.request.json();
  const parsed = createEventSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.issues }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const id = await createEvent({ ...parsed.data, created_by: session.username });

  return new Response(JSON.stringify({ id }), {
    status: 201,
    headers: { "content-type": "application/json" },
  });
};
