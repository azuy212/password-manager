-- Password Manager — VEK + Recovery Key
-- Adds VEK columns and crypto_version to users table.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS encrypted_vek_password TEXT,
  ADD COLUMN IF NOT EXISTS encrypted_vek_recovery TEXT,
  ADD COLUMN IF NOT EXISTS crypto_version INTEGER NOT NULL DEFAULT 1;

-- Restrict column grants to include new columns
REVOKE ALL ON users FROM authenticated;
GRANT SELECT (id, email, public_key, encrypted_vek_password,
              encrypted_vek_recovery, crypto_version,
              created_at, updated_at)
  ON users TO authenticated;
GRANT INSERT (id, email, public_key, salt,
              encrypted_vek_password, encrypted_vek_recovery,
              crypto_version, created_at, updated_at)
  ON users TO authenticated;
GRANT UPDATE (email, public_key, encrypted_vek_password,
              encrypted_vek_recovery, crypto_version, updated_at)
  ON users TO authenticated;

CREATE INDEX IF NOT EXISTS idx_users_crypto_version ON users(crypto_version);
