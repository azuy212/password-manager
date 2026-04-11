-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  public_key TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create vaults table
CREATE TABLE IF NOT EXISTS vaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  encrypted_encryption_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create vault_entries table
CREATE TABLE IF NOT EXISTS vault_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id UUID REFERENCES vaults(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  username TEXT NOT NULL,
  encrypted_password TEXT NOT NULL,
  encrypted_notes TEXT,
  url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create shared_entries table
CREATE TABLE IF NOT EXISTS shared_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID REFERENCES vault_entries(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  shared_with_id UUID REFERENCES users(id) ON DELETE CASCADE,
  encrypted_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entry_id, shared_with_id)
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for vaults
CREATE POLICY "Users can view their own vaults"
  ON vaults FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own vaults"
  ON vaults FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vaults"
  ON vaults FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own vaults"
  ON vaults FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for vault_entries
CREATE POLICY "Users can view entries in their vaults"
  ON vault_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create entries in their vaults"
  ON vault_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own entries"
  ON vault_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own entries"
  ON vault_entries FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for shared_entries
CREATE POLICY "Users can view entries shared with them"
  ON shared_entries FOR SELECT
  USING (auth.uid() = shared_with_id OR auth.uid() = owner_id);

CREATE POLICY "Users can share entries"
  ON shared_entries FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can remove shares"
  ON shared_entries FOR DELETE
  USING (auth.uid() = owner_id);

-- Indexes for better performance
CREATE INDEX idx_vaults_user_id ON vaults(user_id);
CREATE INDEX idx_vault_entries_vault_id ON vault_entries(vault_id);
CREATE INDEX idx_vault_entries_user_id ON vault_entries(user_id);
CREATE INDEX idx_shared_entries_owner_id ON shared_entries(owner_id);
CREATE INDEX idx_shared_entries_shared_with_id ON shared_entries(shared_with_id);
