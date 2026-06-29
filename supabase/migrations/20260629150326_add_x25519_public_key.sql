-- Password Manager — Add X25519 Public Key
-- Required for ECDH-based key wrapping in the sharing flow.
-- Each user gets a separate X25519 keypair (distinct from their Ed25519
-- signing keypair) so that ECDH key exchange can be performed without
-- compromising the identity key.

-- ─── 1. Add column ────────────────────────────────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS x25519_public_key TEXT;

COMMENT ON COLUMN users.x25519_public_key IS
  'X25519 public key serialized as JSON number[] for ECDH key exchange in the sharing flow. Generated during account creation and stored for recipient lookup.';

-- ─── 2. Update column-level grants to include the new column ───────────────────

REVOKE ALL ON users FROM authenticated;
GRANT SELECT (id, email, public_key, x25519_public_key, created_at, updated_at)
  ON users TO authenticated;
GRANT INSERT (id, email, public_key, salt, x25519_public_key, created_at, updated_at)
  ON users TO authenticated;
GRANT UPDATE (email, public_key, x25519_public_key, updated_at)
  ON users TO authenticated;
