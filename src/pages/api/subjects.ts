import type { APIRoute } from "astro";
import { getAllSubjects, createSubject } from "../../lib/db";
import { createSubjectSchema } from "../../lib/validation";
import { guardAuth, guardAdmin, jsonError, json, validationError } from "../../lib/api";
import { logger } from "../../lib/logging";

export const GET: APIRoute = async (context) => {
  try {
    const auth = await guardAuth(context.request, "list subjects");
    if (auth instanceof Response) return auth;
    const subjects = await getAllSubjects();
    return json(subjects);
  } catch (err) {
    logger.error("failed to list subjects", { error: String(err) });
    return jsonError("internal server error", 500);
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const auth = await guardAdmin(context.request, "create subject");
    if (auth instanceof Response) return auth;
    const body = await context.request.json();
    const parsed = createSubjectSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.issues);
    const id = await createSubject(parsed.data.name);
    logger.info("subject created", { id: String(id) });
    return json({ id }, 201);
  } catch (err) {
    logger.error("failed to create subject", { error: String(err) });
    return jsonError("internal server error", 500);
  }
};
