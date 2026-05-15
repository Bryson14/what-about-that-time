import type { APIRoute } from "astro";
import { createUser, getSessionFromRequest, isAdminUser, listUsers } from "../../../lib/auth";

export const GET: APIRoute = async (context) => {
  const session = await getSessionFromRequest(context.request);
  if (!session || !isAdminUser(session)) {
    return new Response("Forbidden", { status: 403 });
  }

  const users = await listUsers();
  return new Response(JSON.stringify(users), {
    headers: { "content-type": "application/json" },
  });
};

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromRequest(context.request);
  if (!session || !isAdminUser(session)) {
    return new Response("Forbidden", { status: 403 });
  }

  const body = await context.request.json();
  const username = body?.username?.toString() ?? "";
  const password = body?.password?.toString() ?? "";
  const fullName = body?.fullName?.toString() ?? "";

  const result = await createUser(username, password, fullName);
  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(null, { status: 201 });
};
