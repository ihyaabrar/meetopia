/**
 * Skema Neon / PostgreSQL, dijalankan otomatis saat server mulai (idempoten).
 * Disimpan sebagai string TS agar ikut terbundel di Vercel Functions.
 */
export const SCHEMA_SQL = `
-- Skema Neon / PostgreSQL. Dijalankan otomatis saat server mulai (idempoten).
-- Catatan: posisi dan kehadiran TIDAK disimpan di sini (lihat Redis), agar Neon bisa tidur.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar JSONB NOT NULL,
  locale TEXT NOT NULL DEFAULT 'id',
  high_contrast BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified_at TIMESTAMPTZ,
  session_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Status kustom (teks + kapan otomatis dihapus).
ALTER TABLE users ADD COLUMN IF NOT EXISTS status_text TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status_expires_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS email_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, -- 'verify' | 'reset'
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id),
  recording_policy TEXT NOT NULL DEFAULT 'disabled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Ikon & deskripsi grup (ditambahkan setelah rilis awal; aman dijalankan berulang).
ALTER TABLE groups ADD COLUMN IF NOT EXISTS icon_color TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS icon_symbol TEXT NOT NULL DEFAULT 'initials';
ALTER TABLE groups ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'text',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS channels_group_idx ON channels(group_id);

CREATE TABLE IF NOT EXISTS memberships (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, group_id)
);
CREATE INDEX IF NOT EXISTS memberships_group_idx ON memberships(group_id);
-- Terakhir terlihat di ruangan grup ini (untuk "Terakhir online ...").
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS maps (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL UNIQUE REFERENCES groups(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  max_uses INTEGER,
  uses INTEGER NOT NULL DEFAULT 0,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invites_group_idx ON invites(group_id);
-- Kode undangan pendek (mis. K7Q2MX) untuk bergabung tanpa tautan.
ALTER TABLE invites ADD COLUMN IF NOT EXISTS code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS invites_code_idx ON invites(code) WHERE code IS NOT NULL;

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, -- 'channel' | 'dm'
  channel_id TEXT REFERENCES channels(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_channel_idx ON messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_dm_idx ON messages(group_id, kind, created_at DESC);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS notes_owner_idx ON notes(owner_user_id) WHERE owner_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS notes_group_idx ON notes(group_id) WHERE group_id IS NOT NULL;
`;
