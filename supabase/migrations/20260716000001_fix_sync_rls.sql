-- Password Manager — Fix Sync RLS & Column Grants
-- Ensures soft-delete updates succeed on retry, all VEK columns
-- have proper grants, and authenticated role has table-level access.

-- ─── 1. Grant table-level permissions to authenticated role ───────────────────
-- The authenticated role must have ALL on vaults, vault_entries, shared_entries
-- otherwise Supabase PostgREST returns "permission denied for table".

GRANT ALL ON vaults, vault_entries, shared_entries TO authenticated;

-- ─── 2. Fix vaults UPDATE policy — allow updating soft-deleted rows ───────────

DROP POLICY IF EXISTS "Users can update their own vaults" ON vaults;
CREATE POLICY "Users can update their own vaults"
  ON vaults FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 3. Fix vault_entries UPDATE policy — remove self deleted_at check ────────

DROP POLICY IF EXISTS "Users can update their own entries" ON vault_entries;
CREATE POLICY "Users can update their own entries"
  ON vault_entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM vaults
      WHERE vaults.id = vault_entries.vault_id
        AND vaults.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vaults
      WHERE vaults.id = vault_entries.vault_id
        AND vaults.user_id = auth.uid()
        AND vaults.deleted_at IS NULL
    )
  );

-- ─── 4. Ensure users table VEK columns have proper grants ─────────────────────

REVOKE ALL ON users FROM authenticated;
GRANT SELECT (id, email, public_key, salt, encrypted_vek_password,
              encrypted_vek_recovery, crypto_version, x25519_public_key,
              created_at, updated_at)
  ON users TO authenticated;
GRANT INSERT (id, email, public_key, salt, x25519_public_key,
              encrypted_vek_password, encrypted_vek_recovery,
              crypto_version, created_at, updated_at)
  ON users TO authenticated;
GRANT UPDATE (email, public_key, salt, encrypted_vek_password,
              encrypted_vek_recovery, crypto_version, x25519_public_key,
              updated_at)
  ON users TO authenticated;
