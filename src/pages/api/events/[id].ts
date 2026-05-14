import type { APIRoute } from "astro";
import { getDb, type Event } from "../../../lib/db";
import { updateEventSchema } from "../../../lib/validation";

export const PUT: APIRoute = async (context) => {
  const db = getDb();
  const id = context.params.id!;
  const body = await context.request.json();
  const parsed = updateEventSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.issues }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const existing = await db
    .prepare("SELECT id FROM events WHERE id = ?1")
    .bind(id)
    .first<Pick<Event, "id">>();
  if (!existing) {
    return new Response(JSON.stringify({ error: "event not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  const { title, start_date, end_date, notes } = parsed.data;
  const sets: string[] = [];
  const values: unknown[] = [];

  if (title !== undefined) { sets.push("title = ?"); values.push(title); }
  if (start_date !== undefined) { sets.push("start_date = ?"); values.push(start_date); }
  if (end_date !== undefined) { sets.push("end_date = ?"); values.push(end_date); }
  if (notes !== undefined) { sets.push("notes = ?"); values.push(notes); }

  if (sets.length === 0) {
    return new Response(JSON.stringify({ error: "no fields to update" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  values.push(id);
  await db
    .prepare(`UPDATE events SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();

  return new Response(null, { status: 204 });
};

export const DELETE: APIRoute = async (context) => {
  const db = getDb();
  const id = context.params.id!;

  const existing = await db
    .prepare("SELECT id FROM events WHERE id = ?1")
    .bind(id)
    .first<Pick<Event, "id">>();
  if (!existing) {
    return new Response(JSON.stringify({ error: "event not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  await db.prepare("DELETE FROM events WHERE id = ?1").bind(id).run();

  return new Response(null, { status: 204 });
};
