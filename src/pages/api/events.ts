import type { APIRoute } from "astro";
import { getAllEvents, createEvent } from "../../lib/db";
import { createEventSchema } from "../../lib/validation";

export const GET: APIRoute = async () => {
  const events = await getAllEvents();
  return new Response(JSON.stringify(events), {
    headers: { "content-type": "application/json" },
  });
};

export const POST: APIRoute = async (context) => {
  const body = await context.request.json();
  const parsed = createEventSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.issues }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const id = await createEvent(parsed.data);

  return new Response(JSON.stringify({ id }), {
    status: 201,
    headers: { "content-type": "application/json" },
  });
};
