import { env } from "cloudflare:workers";

export interface Event {
  id: number;
  title: string;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  group_name: string;
}

export type EventCreate = Pick<Event, "title" | "start_date" | "created_by" | "group_name"> & {
  end_date?: string | null;
  notes?: string | null;
};

export type EventUpdate = Partial<Pick<Event, "title" | "start_date" | "group_name">> & {
  end_date?: string | null;
  notes?: string | null;
};

const db = () => env.what_about_that_time_events;

export async function getAllEvents(groups?: string[]): Promise<Event[]> {
  if (groups && groups.length > 0) {
    const placeholders = groups.map(() => "?").join(", ");
    const result = await db()
      .prepare(`SELECT * FROM events WHERE group_name IN (${placeholders}) ORDER BY start_date ASC`)
      .bind(...groups)
      .all<Event>();
    return result.results;
  }

  const result = await db()
    .prepare("SELECT * FROM events ORDER BY start_date ASC")
    .all<Event>();
  return result.results;
}

export interface PaginatedEvents {
  events: Event[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getPaginatedEvents(
  page: number,
  pageSize: number,
  search: string,
  groups?: string[]
): Promise<PaginatedEvents> {
  const searchPattern = `%${search}%`;

  let countSql: string;
  let dataSql: string;
  let bindValues: unknown[];

  if (groups && groups.length > 0) {
    const placeholders = groups.map(() => "?").join(", ");
    countSql = `SELECT COUNT(*) as total FROM events WHERE group_name IN (${placeholders}) AND (title LIKE ? OR notes LIKE ?)`;
    dataSql = `SELECT * FROM events WHERE group_name IN (${placeholders}) AND (title LIKE ? OR notes LIKE ?) ORDER BY start_date ASC LIMIT ? OFFSET ?`;
    bindValues = [...groups, searchPattern, searchPattern];
  } else {
    countSql = "SELECT COUNT(*) as total FROM events WHERE title LIKE ? OR notes LIKE ?";
    dataSql = "SELECT * FROM events WHERE title LIKE ? OR notes LIKE ? ORDER BY start_date ASC LIMIT ? OFFSET ?";
    bindValues = [searchPattern, searchPattern];
  }

  const countRow = await db()
    .prepare(countSql)
    .bind(...bindValues)
    .first<{ total: number }>();

  const total = countRow?.total ?? 0;

  const offset = (page - 1) * pageSize;
  const events = await db()
    .prepare(dataSql)
    .bind(...bindValues, pageSize, offset)
    .all<Event>();

  return {
    events: events.results,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
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
      "INSERT INTO events (title, start_date, end_date, notes, created_by, group_name) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(input.title, input.start_date, input.end_date ?? null, input.notes ?? null, input.created_by, input.group_name)
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
  if (input.group_name !== undefined) { sets.push("group_name = ?"); values.push(input.group_name); }

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
