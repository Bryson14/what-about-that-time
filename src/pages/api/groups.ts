import type { APIRoute } from "astro";
import { getAllGroups, createGroup } from "../../lib/db";
import { createGroupSchema } from "../../lib/validation";
import { guardAuth, guardAdmin, jsonError, json, validationError } from "../../lib/api";
import { logger } from "../../lib/logging";

export const GET: APIRoute = async (context) => {
  try {
    const auth = await guardAuth(context.request, "list groups");
    if (auth instanceof Response) return auth;
    const groups = await getAllGroups();
    return json(groups);
  } catch (err) {
    logger.error("failed to list groups", { error: String(err) });
    return jsonError("internal server error", 500);
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const auth = await guardAdmin(context.request, "create group");
    if (auth instanceof Response) return auth;
    const body = await context.request.json();
    const parsed = createGroupSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.issues);
    const id = await createGroup(parsed.data.name);
    logger.info("group created", { id: String(id) });
    return json({ id }, 201);
  } catch (err) {
    logger.error("failed to create group", { error: String(err) });
    return jsonError("internal server error", 500);
  }
};
