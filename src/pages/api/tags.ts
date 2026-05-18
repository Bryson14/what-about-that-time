import type { APIRoute } from "astro";
import { getAllTags, createTag } from "../../lib/db";
import { createTagSchema } from "../../lib/validation";
import { guardAuth, guardAdmin, jsonError, json, validationError } from "../../lib/api";
import { logger } from "../../lib/logging";

export const GET: APIRoute = async (context) => {
  try {
    const auth = await guardAuth(context.request, "list tags");
    if (auth instanceof Response) return auth;
    const tags = await getAllTags();
    return json(tags);
  } catch (err) {
    logger.error("failed to list tags", { error: String(err) });
    return jsonError("internal server error", 500);
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const auth = await guardAdmin(context.request, "create tag");
    if (auth instanceof Response) return auth;
    const body = await context.request.json();
    const parsed = createTagSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.issues);
    const id = await createTag(parsed.data.name);
    logger.info("tag created", { id: String(id) });
    return json({ id }, 201);
  } catch (err) {
    logger.error("failed to create tag", { error: String(err) });
    return jsonError("internal server error", 500);
  }
};
