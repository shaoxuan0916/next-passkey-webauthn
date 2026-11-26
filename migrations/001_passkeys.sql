BEGIN;

CREATE SCHEMA next_passkey;
REVOKE ALL ON SCHEMA next_passkey FROM PUBLIC;

CREATE TABLE next_passkey.accounts (
  rp_id text NOT NULL,
  account_id text NOT NULL,
  user_handle text NOT NULL,
  PRIMARY KEY (rp_id, account_id),
  UNIQUE (rp_id, user_handle)
);

CREATE TABLE next_passkey.credentials (
  rp_id text NOT NULL,
  id text NOT NULL,
  account_id text NOT NULL,
  public_key bytea NOT NULL,
  counter bigint NOT NULL CHECK (counter BETWEEN 0 AND 4294967295),
  transports text[] NOT NULL,
  backup_eligible boolean NOT NULL,
  backed_up boolean NOT NULL CHECK (NOT backed_up OR backup_eligible),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  PRIMARY KEY (rp_id, id),
  FOREIGN KEY (rp_id, account_id) REFERENCES next_passkey.accounts ON DELETE CASCADE
);

CREATE INDEX ON next_passkey.credentials (rp_id, account_id, created_at DESC, id);

CREATE TABLE next_passkey.attempts (
  id uuid PRIMARY KEY,
  rp_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('enroll', 'sign-in')),
  binding text NOT NULL,
  challenge text NOT NULL,
  account_id text,
  user_handle text,
  expires_at timestamptz NOT NULL,
  CHECK ((kind = 'enroll' AND account_id IS NOT NULL AND user_handle IS NOT NULL)
      OR (kind = 'sign-in' AND account_id IS NULL AND user_handle IS NULL))
);

CREATE INDEX ON next_passkey.attempts (expires_at);
REVOKE ALL ON ALL TABLES IN SCHEMA next_passkey FROM PUBLIC;

COMMIT;
