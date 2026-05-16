import { getSessionFromRequest, isAdminUser, type SessionUser } from "./auth";
import { logger } from "./logging";

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

export function jsonError(message: string, status: number): Response {
  return json({ error: message }, status);
}

export function validationError(issues: unknown[]): Response {
  return json({ error: issues }, 400);
}

export async function guardAuth(
  request: Request,
  action: string
): Promise<{ session: SessionUser } | Response> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    logger.warn(`unauthorized attempt to ${action}`);
    return new Response("Unauthorized", { status: 401 });
  }
  return { session };
}

export async function guardAdmin(
  request: Request,
  action: string
): Promise<{ session: SessionUser } | Response> {
  const auth = await guardAuth(request, action);
  if (auth instanceof Response) return auth;
  if (!isAdminUser(auth.session)) {
    logger.warn(`non-admin attempted to ${action}`, { username: auth.session.username });
    return new Response("Forbidden", { status: 403 });
  }
  return auth;
}

export function checkGroupAccess(
  session: SessionUser,
  group: string,
  action: string,
  eventId: string
): Response | null {
  if (!isAdminUser(session) && !session.allowedGroups.includes(group)) {
    logger.warn(`event ${action} blocked for unauthorized group`, {
      username: session.username,
      eventId,
      group_name: group,
    });
    return jsonError("you do not have access to this event", 403);
  }
  return null;
}
