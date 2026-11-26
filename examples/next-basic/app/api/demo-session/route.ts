import { demoPasswordSignIn, endDemoSession, origin } from "../../../lib/demo-auth";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== origin) return new Response("Forbidden", { status: 403 });
  const body = await request.formData();
  if (body.get("operation") === "sign-out") {
    await endDemoSession();
  } else if (!await demoPasswordSignIn(body.get("email"), body.get("password"))) {
    return Response.redirect(new URL("/?error=credentials", origin), 303);
  }
  return Response.redirect(origin, 303);
}
