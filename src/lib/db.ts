import { env } from "cloudflare:workers";

export interface Event {
  id: number;
  title: string;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  created_at: string;
}

export type EventCreate = Pick<Event, "title" | "start_date"> & {
  end_date?: string | null;
  notes?: string | null;
};

export type EventUpdate = Partial<Pick<Event, "title" | "start_date">> & {
  end_date?: string | null;
  notes?: string | null;
};

const db = () => env.what_about_that_time_events;

export async function getAllEvents(): Promise<Event[]> {
  const result = await db()
    .prepare("SELECT * FROM events ORDER BY start_date ASC")
    .all<Event>();
  return result.results;
}

export async function getEventById(id: number): Promise<Event | null> {
  return db()
    .prepare("SELECT * FROM events WHERE id = ?")
    .bind(id)
    .first<Event>();
}

export async function createEvent(input: EventCreate): Promise<number> {
  const result = await db()
    .prepare(
      "INSERT INTO events (title, start_date, end_date, notes) VALUES (?, ?, ?, ?)"
    )
    .bind(input.title, input.start_date, input.end_date ?? null, input.notes ?? null)
    .run();
  return result.meta.last_row_id as number;
}

export async function updateEvent(id: number, input: EventUpdate): Promise<boolean> {
  const sets: string[] = [];
  const values: unknown[] = [];

  if (input.title !== undefined) { sets.push("title = ?"); values.push(input.title); }
  if (input.start_date !== undefined) { sets.push("start_date = ?"); values.push(input.start_date); }
  if (input.end_date !== undefined) { sets.push("end_date = ?"); values.push(input.end_date); }
  if (input.notes !== undefined) { sets.push("notes = ?"); values.push(input.notes); }

  if (sets.length === 0) return false;

  values.push(id);
  const result = await db()
    .prepare(`UPDATE events SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();

  return result.meta.changes > 0;
}

export async function deleteEvent(id: number): Promise<boolean> {
  const result = await db()
    .prepare("DELETE FROM events WHERE id = ?")
    .bind(id)
    .run();
  return result.meta.changes > 0;
}
