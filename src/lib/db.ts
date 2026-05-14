import { env } from "cloudflare:workers";

export interface Event {
  id: number;
  title: string;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  created_at: string;
}

export function getDb() {
  return env.what_about_that_time_events;
}
