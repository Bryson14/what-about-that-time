import { env } from "cloudflare:workers";

export interface Group {
  id: number;
  name: string;
}

export interface Tag {
  id: number;
  name: string;
}

export interface Subject {
  id: number;
  name: string;
}

export interface Event {
  id: number;
  title: string;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  group_id: number;
  group_name: string;
}

export type EventCreate = Pick<Event, "title" | "start_date" | "created_by" | "group_id"> & {
  end_date?: string | null;
  notes?: string | null;
};

export type EventUpdate = Partial<Pick<Event, "title" | "start_date" | "group_id">> & {
  end_date?: string | null;
  notes?: string | null;
};

const db = () => env.what_about_that_time_events;

export async function getAllEvents(groups?: string[]): Promise<Event[]> {
  if (groups && groups.length > 0) {
    const placeholders = groups.map(() => "?").join(", ");
    const result = await db()
      .prepare(
        `SELECT events.*, groups.name as group_name FROM events JOIN groups ON events.group_id = groups.id WHERE groups.name IN (${placeholders}) ORDER BY start_date ASC`
      )
      .bind(...groups)
      .all<Event>();
    return result.results;
  }

  const result = await db()
    .prepare("SELECT events.*, groups.name as group_name FROM events JOIN groups ON events.group_id = groups.id ORDER BY start_date ASC")
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
    countSql = `SELECT COUNT(*) as total FROM events JOIN groups ON events.group_id = groups.id WHERE groups.name IN (${placeholders}) AND (events.title LIKE ? OR events.notes LIKE ?)`;
    dataSql = `SELECT events.*, groups.name as group_name FROM events JOIN groups ON events.group_id = groups.id WHERE groups.name IN (${placeholders}) AND (events.title LIKE ? OR events.notes LIKE ?) ORDER BY events.start_date ASC LIMIT ? OFFSET ?`;
    bindValues = [...groups, searchPattern, searchPattern];
  } else {
    countSql = "SELECT COUNT(*) as total FROM events JOIN groups ON events.group_id = groups.id WHERE events.title LIKE ? OR events.notes LIKE ?";
    dataSql = "SELECT events.*, groups.name as group_name FROM events JOIN groups ON events.group_id = groups.id WHERE events.title LIKE ? OR events.notes LIKE ? ORDER BY events.start_date ASC LIMIT ? OFFSET ?";
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
    .prepare("SELECT events.*, groups.name as group_name FROM events JOIN groups ON events.group_id = groups.id WHERE events.id = ?")
    .bind(id)
    .first<Event>();
}

export async function createEvent(input: EventCreate): Promise<number> {
  const result = await db()
    .prepare(
      "INSERT INTO events (title, start_date, end_date, notes, created_by, group_id) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(input.title, input.start_date, input.end_date ?? null, input.notes ?? null, input.created_by, input.group_id)
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
  if (input.group_id !== undefined) { sets.push("group_id = ?"); values.push(input.group_id); }

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

// ── Groups ────────────────────────────────────────────────────────────────────

export async function getAllGroups(): Promise<Group[]> {
  const result = await db().prepare("SELECT id, name FROM groups ORDER BY name ASC").all<Group>();
  return result.results;
}

export async function getGroupById(id: number): Promise<Group | null> {
  return db().prepare("SELECT id, name FROM groups WHERE id = ?").bind(id).first<Group>();
}

export async function createGroup(name: string): Promise<number> {
  const result = await db()
    .prepare("INSERT INTO groups (name) VALUES (?) ON CONFLICT(name) DO NOTHING")
    .bind(name)
    .run();
  if (result.meta.last_row_id) return result.meta.last_row_id as number;
  const existing = await db().prepare("SELECT id FROM groups WHERE name = ?").bind(name).first<{ id: number }>();
  if (!existing) throw new Error("failed to create or find group");
  return existing.id;
}

// ── Tags ──────────────────────────────────────────────────────────────────────

export async function getAllTags(): Promise<Tag[]> {
  const result = await db().prepare("SELECT id, name FROM tags ORDER BY name ASC").all<Tag>();
  return result.results;
}

export async function getTagById(id: number): Promise<Tag | null> {
  return db().prepare("SELECT id, name FROM tags WHERE id = ?").bind(id).first<Tag>();
}

export async function createTag(name: string): Promise<number> {
  const result = await db()
    .prepare("INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING")
    .bind(name)
    .run();
  if (result.meta.last_row_id) return result.meta.last_row_id as number;
  const existing = await db().prepare("SELECT id FROM tags WHERE name = ?").bind(name).first<{ id: number }>();
  if (!existing) throw new Error("failed to create or find tag");
  return existing.id;
}

export async function getEventTags(eventId: number): Promise<Tag[]> {
  const result = await db()
    .prepare("SELECT tags.id, tags.name FROM tags JOIN event_tags ON tags.id = event_tags.tag_id WHERE event_tags.event_id = ? ORDER BY tags.name ASC")
    .bind(eventId)
    .all<Tag>();
  return result.results;
}

export async function addTagToEvent(eventId: number, tagId: number): Promise<void> {
  await db()
    .prepare("INSERT OR IGNORE INTO event_tags (event_id, tag_id) VALUES (?, ?)")
    .bind(eventId, tagId)
    .run();
}

export async function removeTagFromEvent(eventId: number, tagId: number): Promise<boolean> {
  const result = await db()
    .prepare("DELETE FROM event_tags WHERE event_id = ? AND tag_id = ?")
    .bind(eventId, tagId)
    .run();
  return result.meta.changes > 0;
}

// ── Subjects ──────────────────────────────────────────────────────────────────

export async function getAllSubjects(): Promise<Subject[]> {
  const result = await db().prepare("SELECT id, name FROM subjects ORDER BY name ASC").all<Subject>();
  return result.results;
}

export async function getSubjectById(id: number): Promise<Subject | null> {
  return db().prepare("SELECT id, name FROM subjects WHERE id = ?").bind(id).first<Subject>();
}

export async function createSubject(name: string): Promise<number> {
  const result = await db()
    .prepare("INSERT INTO subjects (name) VALUES (?) ON CONFLICT(name) DO NOTHING")
    .bind(name)
    .run();
  if (result.meta.last_row_id) return result.meta.last_row_id as number;
  const existing = await db().prepare("SELECT id FROM subjects WHERE name = ?").bind(name).first<{ id: number }>();
  if (!existing) throw new Error("failed to create or find subject");
  return existing.id;
}

export async function getEventSubjects(eventId: number): Promise<Subject[]> {
  const result = await db()
    .prepare("SELECT subjects.id, subjects.name FROM subjects JOIN event_subjects ON subjects.id = event_subjects.subject_id WHERE event_subjects.event_id = ? ORDER BY subjects.name ASC")
    .bind(eventId)
    .all<Subject>();
  return result.results;
}

export async function addSubjectToEvent(eventId: number, subjectId: number): Promise<void> {
  await db()
    .prepare("INSERT OR IGNORE INTO event_subjects (event_id, subject_id) VALUES (?, ?)")
    .bind(eventId, subjectId)
    .run();
}

export async function removeSubjectFromEvent(eventId: number, subjectId: number): Promise<boolean> {
  const result = await db()
    .prepare("DELETE FROM event_subjects WHERE event_id = ? AND subject_id = ?")
    .bind(eventId, subjectId)
    .run();
  return result.meta.changes > 0;
}
