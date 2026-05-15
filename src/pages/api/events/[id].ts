import type { APIRoute } from "astro";
import { getEventById, updateEvent, deleteEvent } from "../../../lib/db";
import { updateEventSchema } from "../../../lib/validation";
import { getSessionFromRequest } from "../../../lib/auth";

export const PUT: APIRoute = async (context) => {
  const session = await getSessionFromRequest(context.request);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const id = Number(context.params.id!);
  const body = await context.request.json();
  const parsed = updateEventSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.issues }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const existing = await getEventById(id);
  if (!existing) {
    return new Response(JSON.stringify({ error: "event not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  const updated = await updateEvent(id, parsed.data);
  if (!updated) {
    return new Response(JSON.stringify({ error: "no fields to update" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(null, { status: 204 });
};

export const DELETE: APIRoute = async (context) => {
  const session = await getSessionFromRequest(context.request);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const id = Number(context.params.id!);

  const existing = await getEventById(id);
  if (!existing) {
    return new Response(JSON.stringify({ error: "event not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  await deleteEvent(id);
  return new Response(null, { status: 204 });
};
