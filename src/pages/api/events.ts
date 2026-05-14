import type { APIRoute } from "astro";
import { getDb, type Event } from "../../lib/db";
import { createEventSchema } from "../../lib/validation";

export const GET: APIRoute = async () => {
  const db = getDb();
  const events = await db
    .prepare("SELECT * FROM events ORDER BY start_date ASC")
    .all<Event>();
  return new Response(JSON.stringify(events.results), {
    headers: { "content-type": "application/json" },
  });
};

export const POST: APIRoute = async (context) => {
  const db = getDb();
  const body = await context.request.json();
  const parsed = createEventSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.issues }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const { title, start_date, end_date, notes } = parsed.data;

  const result = await db
    .prepare("INSERT INTO events (title, start_date, end_date, notes) VALUES (?1, ?2, ?3, ?4)")
    .bind(title, start_date, end_date ?? null, notes ?? null)
    .run();

  return new Response(JSON.stringify({ id: result.meta.last_row_id }), {
    status: 201,
    headers: { "content-type": "application/json" },
  });
};
