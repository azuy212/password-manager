-- Password Manager — Initial Schema
-- Base tables, indexes, RLS policies, and triggers.

-- ─── Users ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  public_key TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Vaults ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  encrypted_encryption_key TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Vault Entries ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vault_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  encrypted_payload TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (octet_length(encrypted_payload) <= 524288)
);

-- ─── Shared Entries ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shared_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES vault_entries(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared_with_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  encrypted_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entry_id, shared_with_id)
);

-- ─── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_vaults_user_id ON vaults(user_id);
CREATE INDEX idx_vaults_user_id_deleted_at ON vaults(user_id, deleted_at);
CREATE INDEX idx_vault_entries_vault_id ON vault_entries(vault_id);
CREATE INDEX idx_shared_entries_entry_id ON shared_entries(entry_id);
CREATE INDEX idx_shared_entries_owner_id ON shared_entries(owner_id);
CREATE INDEX idx_shared_entries_shared_with_id ON shared_entries(shared_with_id);
CREATE INDEX idx_vault_entries_deleted_at ON vault_entries(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_vaults_deleted_at ON vaults(deleted_at) WHERE deleted_at IS NOT NULL;

-- ─── Enable Row Level Security ─────────────────────────────────────────────────

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_entries ENABLE ROW LEVEL SECURITY;

-- ─── RLS: users ────────────────────────────────────────────────────────────────

CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can create their own profile"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can view other users' public keys"
  ON users FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ─── RLS: vaults ───────────────────────────────────────────────────────────────

CREATE POLICY "Users can view their own vaults"
  ON vaults FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can create their own vaults"
  ON vaults FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vaults"
  ON vaults FOR UPDATE
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can delete their own vaults"
  ON vaults FOR DELETE
  USING (auth.uid() = user_id);

-- ─── RLS: vault_entries ────────────────────────────────────────────────────────

CREATE POLICY "Users can view their own entries"
  ON vault_entries FOR SELECT
  USING (
    vault_entries.deleted_at IS NULL
    AND (
      EXISTS (
        SELECT 1 FROM vaults
        WHERE vaults.id = vault_entries.vault_id
          AND vaults.user_id = auth.uid()
          AND vaults.deleted_at IS NULL
      )
      OR EXISTS (
        SELECT 1 FROM shared_entries se
        WHERE se.entry_id = vault_entries.id
          AND se.shared_with_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create entries in their vaults"
  ON vault_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vaults
      WHERE vaults.id = vault_entries.vault_id
        AND vaults.user_id = auth.uid()
        AND vaults.deleted_at IS NULL
    )
  );

CREATE POLICY "Users can update their own entries"
  ON vault_entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM vaults
      WHERE vaults.id = vault_entries.vault_id
        AND vaults.user_id = auth.uid()
        AND vaults.deleted_at IS NULL
    )
    AND vault_entries.deleted_at IS NULL
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vaults
      WHERE vaults.id = vault_entries.vault_id
        AND vaults.user_id = auth.uid()
        AND vaults.deleted_at IS NULL
    )
  );

CREATE POLICY "Users can delete their own entries"
  ON vault_entries FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM vaults
      WHERE vaults.id = vault_entries.vault_id
        AND vaults.user_id = auth.uid()
    )
  );

-- ─── RLS: shared_entries ───────────────────────────────────────────────────────

CREATE POLICY "Users can view entries shared with them"
  ON shared_entries FOR SELECT
  USING (
    auth.uid() = shared_with_id
    OR auth.uid() = owner_id
  );

CREATE POLICY "Users can share entries"
  ON shared_entries FOR INSERT
  WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (
      SELECT 1 FROM vault_entries ve
      JOIN vaults v ON v.id = ve.vault_id
      WHERE ve.id = entry_id
        AND v.user_id = auth.uid()
        AND ve.deleted_at IS NULL
        AND v.deleted_at IS NULL
    )
  );

CREATE POLICY "Users can remove shares"
  ON shared_entries FOR DELETE
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can update shared entries they own"
  ON shared_entries FOR UPDATE
  USING (auth.uid() = owner_id);

-- ─── Realtime ──────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE vault_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE shared_entries;

-- ─── Auto-update updated_at ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vaults_updated_at
  BEFORE UPDATE ON vaults
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_vault_entries_updated_at
  BEFORE UPDATE ON vault_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ─── Auto-increment version ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_version_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = COALESCE(OLD.version, 0) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vault_entries_version
  BEFORE UPDATE ON vault_entries
  FOR EACH ROW
  EXECUTE FUNCTION increment_version_column();

CREATE TRIGGER trg_vaults_version
  BEFORE UPDATE ON vaults
  FOR EACH ROW
  EXECUTE FUNCTION increment_version_column();
