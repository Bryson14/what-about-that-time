import type { APIRoute } from "astro";
import { env } from "cloudflare:workers"

export const PUT: APIRoute = async (context) => {
  const db = env.what_about_that_time_events;
  const id = context.params.id;
  const body = await context.request.json();
  const { title, start_date, end_date, notes } = body;

  const existing = await db.prepare("SELECT id FROM events WHERE id = ?1").bind(id).first();
  if (!existing) {
    return new Response(JSON.stringify({ error: "event not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  await db
    .prepare(
      "UPDATE events SET title = ?1, start_date = ?2, end_date = ?3, notes = ?4 WHERE id = ?5"
    )
    .bind(title, start_date, end_date ?? null, notes ?? null, id)
    .run();

  return new Response(null, { status: 204 });
};

export const DELETE: APIRoute = async (context) => {
  const db = env.what_about_that_time_events;
  const id = context.params.id;

  const existing = await db.prepare("SELECT id FROM events WHERE id = ?1").bind(id).first();
  if (!existing) {
    return new Response(JSON.stringify({ error: "event not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  await db.prepare("DELETE FROM events WHERE id = ?1").bind(id).run();

  return new Response(null, { status: 204 });
};
