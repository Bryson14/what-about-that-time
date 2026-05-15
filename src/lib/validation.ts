import { z } from "zod";

export const createEventSchema = z.object({
  title: z.string().min(1, "title is required"),
  start_date: z.string().min(1, "start_date is required"),
  end_date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateEventSchema = z.object({
  title: z.string().min(1).optional(),
  start_date: z.string().min(1).optional(),
  end_date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
