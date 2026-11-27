import { randomUUID } from "node:crypto";
import { demoPasswordSignIn, demoSession, endDemoSession, localDemo, origin, secure, startDemoSession } from "../../../lib/demo-auth";
import { rateLimit } from "../../../lib/database";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== origin) return new Response("Forbidden", { status: 403 });
  const body = await request.formData();
  switch (body.get("operation")) {
    case "start": {
      if (await demoSession()) return Response.redirect(origin, 303);
      if (secure && !await rateLimit(request, "start-demo")) {
        return Response.redirect(new URL("/?error=rate-limit", origin), 303);
      }
      await startDemoSession(`guest-${randomUUID()}`, "demo");
      return Response.redirect(origin, 303);
    }
    case "sign-out":
      await endDemoSession();
      return Response.redirect(new URL("/?returning=1", origin), 303);
    default:
      if (!localDemo) return new Response("Forbidden", { status: 403 });
      if (!await demoPasswordSignIn(body.get("email"), body.get("password"))) {
        return Response.redirect(new URL("/?error=credentials", origin), 303);
      }
      return Response.redirect(origin, 303);
  }
}
