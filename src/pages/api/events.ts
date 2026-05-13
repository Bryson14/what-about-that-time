import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const GET: APIRoute = async (context) => {
  const db = env.what_about_that_time_events;
  const events = await db
    .prepare("SELECT * FROM events ORDER BY start_date ASC")
    .all();
  return new Response(JSON.stringify(events.results), {
    headers: { "content-type": "application/json" },
  });
};

export const POST: APIRoute = async (context) => {
  const db = env.what_about_that_time_events;
  const body = await context.request.json();
  const { title, start_date, end_date, notes } = body;

  if (!title || !start_date) {
    return new Response(JSON.stringify({ error: "title and start_date are required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const result = await db
    .prepare("INSERT INTO events (title, start_date, end_date, notes) VALUES (?1, ?2, ?3, ?4)")
    .bind(title, start_date, end_date ?? null, notes ?? null)
    .run();

  return new Response(JSON.stringify({ id: result.meta.last_row_id }), {
    status: 201,
    headers: { "content-type": "application/json" },
  });
};
