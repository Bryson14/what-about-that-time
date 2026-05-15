import type { APIRoute } from "astro";
import { deleteUser, getSessionFromRequest, isAdminUser } from "../../../../lib/auth";

export const DELETE: APIRoute = async (context) => {
  const session = await getSessionFromRequest(context.request);
  if (!session || !isAdminUser(session)) {
    return new Response("Forbidden", { status: 403 });
  }

  const username = context.params.username ?? "";
  const result = await deleteUser(username);
  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(null, { status: 204 });
};
