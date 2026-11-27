import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { Pool } from "pg";
import type { PasskeyOperation } from "next-passkey-webauthn/next";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 4,
  connectionTimeoutMillis: 5_000,
});

export async function rateLimit(request: Request, scope: PasskeyOperation | "request" | "start-demo") {
  // Vercel sets this header at ingress. Other hosts share one budget until configured.
  const ip = process.env.VERCEL === "1" ? request.headers.get("x-vercel-forwarded-for") : null;
  const client = createHmac("sha256", process.env.DEMO_SESSION_SECRET ?? "")
    .update(ip && isIP(ip) ? ip : "shared").digest("hex");
  const limit = scope === "request" ? 180 : scope === "start-demo" ? 12 : 60;
  const result = await pool.query(
    `INSERT INTO next_passkey.demo_rate_limits AS bucket (client, scope, expires_at, hits)
       VALUES ($1, $2, statement_timestamp() + interval '1 minute', 1)
     ON CONFLICT (client, scope) DO UPDATE SET
       expires_at = CASE WHEN bucket.expires_at <= statement_timestamp()
         THEN excluded.expires_at ELSE bucket.expires_at END,
       hits = CASE WHEN bucket.expires_at <= statement_timestamp() THEN 1 ELSE bucket.hits + 1 END
     WHERE bucket.expires_at <= statement_timestamp() OR bucket.hits < $3
     RETURNING hits`,
    [client, scope, limit],
  );
  if (scope === "request" && Math.random() < 0.01) {
    await pool.query("DELETE FROM next_passkey.demo_rate_limits WHERE expires_at <= statement_timestamp()");
  }
  return result.rowCount === 1;
}
