import { z } from "zod";

export const DEFAULT_GROUPS = ["Adams Family"];

export const createEventSchema = z.object({
  title: z.string().min(1, "title is required").max(200, "title must be at most 200 characters"),
  start_date: z.string().min(1, "start_date is required"),
  end_date: z.string().optional().nullable(),
  notes: z.string().max(5000, "notes must be at most 5000 characters").optional().nullable(),
  group_name: z.string().min(1, "group is required").max(100, "group must be at most 100 characters"),
});

export const updateEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  start_date: z.string().min(1).optional(),
  end_date: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  group_name: z.string().min(1).max(100).optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional().default(""),
});

export const createUserSchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(8).max(128),
  fullName: z.string().min(1).max(100),
  allowedGroups: z.array(z.string().min(1).max(100)).optional().default(DEFAULT_GROUPS),
});

export const updateUserGroupsSchema = z.object({
  allowedGroups: z.array(z.string().min(1).max(100)).min(1, "at least one group is required"),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserGroupsInput = z.infer<typeof updateUserGroupsSchema>;
