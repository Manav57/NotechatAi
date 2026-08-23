-- Initial schema for NotesChatAI
-- Run with: wrangler d1 execute noteschatai-db --file=migrations/0001_initial.sql

-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  password_hash TEXT,
  image TEXT,
  plan TEXT DEFAULT 'free' NOT NULL,
  settings TEXT,
  email_verified INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX users_email_idx ON users(email);

-- Sessions table
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX sessions_user_id_idx ON sessions(user_id);
CREATE INDEX sessions_token_idx ON sessions(token);

-- Accounts table (for OAuth)
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at INTEGER,
  refresh_token_expires_at INTEGER,
  scope TEXT,
  password TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX accounts_user_id_idx ON accounts(user_id);

-- Verifications table
CREATE TABLE verifications (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX verifications_identifier_idx ON verifications(identifier);

-- Documents table
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  original_file_key TEXT,
  extracted_text_key TEXT,
  metadata TEXT,
  status TEXT DEFAULT 'processing' NOT NULL,
  chunk_count INTEGER DEFAULT 0,
  token_count INTEGER DEFAULT 0,
  error TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX documents_user_id_idx ON documents(user_id);
CREATE INDEX documents_status_idx ON documents(status);

-- Conversations table
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  model TEXT,
  system_prompt TEXT,
  summary TEXT,
  summary_embedding TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX conversations_user_id_idx ON conversations(user_id);

-- Messages table
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  citations TEXT,
  model TEXT,
  tokens_used INTEGER,
  latency_ms INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX messages_conversation_id_idx ON messages(conversation_id);

-- Audio overviews table
CREATE TABLE audio_overviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_ids TEXT NOT NULL,
  title TEXT,
  status TEXT DEFAULT 'generating' NOT NULL,
  audio_file_key TEXT,
  transcript_key TEXT,
  chapters TEXT,
  duration_seconds INTEGER,
  voice_config TEXT,
  error TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX audio_overviews_user_id_idx ON audio_overviews(user_id);
CREATE INDEX audio_overviews_status_idx ON audio_overviews(status);

-- Mind maps table
CREATE TABLE mind_maps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_ids TEXT NOT NULL,
  nodes TEXT NOT NULL,
  edges TEXT NOT NULL,
  clusters TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX mind_maps_user_id_idx ON mind_maps(user_id);

-- Flashcards table
CREATE TABLE flashcards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_ids TEXT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  type TEXT NOT NULL,
  difficulty INTEGER DEFAULT 0,
  stability INTEGER DEFAULT 0,
  due_date INTEGER,
  last_reviewed INTEGER,
  review_count INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX flashcards_user_id_idx ON flashcards(user_id);
CREATE INDEX flashcards_due_date_idx ON flashcards(due_date);

-- Quizzes table
CREATE TABLE quizzes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_ids TEXT,
  questions TEXT NOT NULL,
  score INTEGER,
  total_questions INTEGER,
  time_spent_ms INTEGER,
  completed_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX quizzes_user_id_idx ON quizzes(user_id);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_users_timestamp 
AFTER UPDATE ON users
BEGIN
  UPDATE users SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER update_documents_timestamp 
AFTER UPDATE ON documents
BEGIN
  UPDATE documents SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER update_conversations_timestamp 
AFTER UPDATE ON conversations
BEGIN
  UPDATE conversations SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER update_audio_overviews_timestamp 
AFTER UPDATE ON audio_overviews
BEGIN
  UPDATE audio_overviews SET updated_at = unixepoch() WHERE id = NEW.id;
END;