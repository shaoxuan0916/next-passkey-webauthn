CREATE TABLE IF NOT EXISTS next_passkey.demo_rate_limits (
  client text NOT NULL,
  scope text NOT NULL,
  expires_at timestamptz NOT NULL,
  hits integer NOT NULL,
  PRIMARY KEY (client, scope)
);

CREATE INDEX IF NOT EXISTS demo_rate_limits_expiry
  ON next_passkey.demo_rate_limits (expires_at);
