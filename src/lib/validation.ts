import { z } from "zod";

export const DEFAULT_GROUPS = ["Adams Family"];
export const ALL_GROUPS = [...DEFAULT_GROUPS, "Meiling Family"];
export const MIN_PAGE_SIZE = 1;
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 10;

export const createEventSchema = z.object({
  title: z.string().min(1, "title is required").max(200, "title must be at most 200 characters"),
  start_date: z.string().min(1, "start_date is required"),
  end_date: z.string().optional().nullable(),
  notes: z.string().max(5000, "notes must be at most 5000 characters").optional().nullable(),
  group_id: z.coerce.number().int().positive("group is required"),
});

export const updateEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  start_date: z.string().min(1).optional(),
  end_date: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  group_id: z.coerce.number().int().positive().optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(MIN_PAGE_SIZE).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  search: z.string().optional().default(""),
});

export const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
});

export const createTagSchema = z.object({
  name: z.string().min(1).max(100),
});

export const createSubjectSchema = z.object({
  name: z.string().min(1).max(100),
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

export const errorResponseSchema = z.object({
  error: z.union([z.string(), z.array(z.any())]),
});

export const paginatedEventsResponseSchema = z.object({
  events: z.array(z.object({
    id: z.number(),
    title: z.string(),
    start_date: z.string(),
    end_date: z.string().nullable(),
    notes: z.string().nullable(),
    created_by: z.string(),
    created_at: z.string(),
    group_id: z.number(),
    group_name: z.string(),
  })),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
});

export const storedUserSchema = z.object({
  fullName: z.string(),
  role: z.enum(["admin", "user"]),
  allowedGroups: z.array(z.string()),
  passwordHash: z.string(),
  salt: z.string(),
});

export const sessionUserSchema = z.object({
  username: z.string(),
  fullName: z.string(),
  role: z.enum(["admin", "user"]),
  allowedGroups: z.array(z.string()),
});
