-- Password Manager — Security Hardening
-- Fixes from schema audit: restricted column access, soft-delete consistency,
-- audit logging, and missing triggers/indexes.

-- ─── 1. Restrict users table column access ─────────────────────────────────────

-- Drop the overly broad policy that exposed all columns to all authenticated users
DROP POLICY IF EXISTS "Users can view other users' public keys" ON users;

-- Revoke blanket access, then grant only necessary columns
REVOKE ALL ON users FROM authenticated;
GRANT SELECT (id, email, public_key, created_at, updated_at) ON users TO authenticated;
GRANT INSERT (id, email, public_key, salt, created_at, updated_at) ON users TO authenticated;
GRANT UPDATE (email, public_key, updated_at) ON users TO authenticated;

-- Secure salt access: only the owning user can retrieve their salt
CREATE OR REPLACE FUNCTION get_my_salt()
RETURNS TEXT AS $$
  SELECT salt FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── 2. Add missing columns to shared_entries ──────────────────────────────────

ALTER TABLE shared_entries
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD CONSTRAINT shared_entries_no_self_share CHECK (owner_id != shared_with_id);

-- ─── 3. Fix RLS policies ──────────────────────────────────────────────────────

-- vault_entries DELETE: enforce soft-delete consistency
DROP POLICY IF EXISTS "Users can delete their own entries" ON vault_entries;
CREATE POLICY "Users can delete their own entries"
  ON vault_entries FOR DELETE
  USING (
    vault_entries.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM vaults
      WHERE vaults.id = vault_entries.vault_id
        AND vaults.user_id = auth.uid()
    )
  );

-- shared_entries SELECT: filter out soft-deleted rows
DROP POLICY IF EXISTS "Users can view entries shared with them" ON shared_entries;
CREATE POLICY "Users can view shares they own or received"
  ON shared_entries FOR SELECT
  USING (
    (auth.uid() = shared_with_id OR auth.uid() = owner_id)
    AND deleted_at IS NULL
  );

-- shared_entries UPDATE: add WITH CHECK clause and deleted_at filter
DROP POLICY IF EXISTS "Users can update shared entries they own" ON shared_entries;
CREATE POLICY "Users can update shared entries they own"
  ON shared_entries FOR UPDATE
  USING (auth.uid() = owner_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = owner_id);

-- ─── 4. Add missing indexes ────────────────────────────────────────────────────

-- Replace single-column entry_id index with composite for shared_entries SELECT policy
DROP INDEX IF EXISTS idx_shared_entries_entry_id;
CREATE INDEX idx_shared_entries_entry_id_shared_with_id
  ON shared_entries(entry_id, shared_with_id);

-- Partial index for soft-deleted shared entries
CREATE INDEX idx_shared_entries_deleted_at
  ON shared_entries(deleted_at) WHERE deleted_at IS NOT NULL;

-- ─── 5. Add missing updated_at triggers ───────────────────────────────────────

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_shared_entries_updated_at
  BEFORE UPDATE ON shared_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ─── 6. Add vaults to realtime publication ─────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE vaults;

-- ─── 7. Audit log ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_table_name ON audit_log(table_name);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit log"
  ON audit_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Audit events can be recorded"
  ON audit_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Audit logs cannot be updated"
  ON audit_log FOR UPDATE
  USING (false);

CREATE POLICY "Audit logs cannot be deleted"
  ON audit_log FOR DELETE
  USING (false);

-- Audit trigger function
CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
  action TEXT;
  details JSONB;
  audit_user_id UUID;
  audit_record_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    action := 'INSERT';
    details := jsonb_build_object('new', row_to_json(NEW));
    audit_record_id := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    action := 'UPDATE';
    details := jsonb_build_object(
      'old', row_to_json(OLD),
      'new', row_to_json(NEW),
      'changed_columns', (
        SELECT jsonb_agg(key)
        FROM jsonb_each(row_to_json(NEW)::jsonb)
        WHERE value <> (row_to_json(OLD)::jsonb)->key
      )
    );
    audit_record_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    action := 'DELETE';
    details := jsonb_build_object('old', row_to_json(OLD));
    audit_record_id := OLD.id;
  END IF;

  -- Determine user_id based on table name to avoid field resolution errors
  IF TG_TABLE_NAME = 'users' THEN
    audit_user_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  ELSIF TG_TABLE_NAME = 'vaults' THEN
    audit_user_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END;
  ELSIF TG_TABLE_NAME = 'vault_entries' THEN
    IF TG_OP = 'DELETE' THEN
      SELECT v.user_id INTO audit_user_id FROM vaults v WHERE v.id = OLD.vault_id;
    ELSE
      SELECT v.user_id INTO audit_user_id FROM vaults v WHERE v.id = NEW.vault_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'shared_entries' THEN
    audit_user_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.owner_id ELSE NEW.owner_id END;
  ELSE
    audit_user_id := auth.uid();
  END IF;

  INSERT INTO audit_log (user_id, action, table_name, record_id, details)
  VALUES (audit_user_id, action, TG_TABLE_NAME, audit_record_id, details);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_vaults
  AFTER INSERT OR UPDATE OR DELETE ON vaults
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER trg_audit_vault_entries
  AFTER INSERT OR UPDATE OR DELETE ON vault_entries
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER trg_audit_shared_entries
  AFTER INSERT OR UPDATE OR DELETE ON shared_entries
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER trg_audit_users
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();
