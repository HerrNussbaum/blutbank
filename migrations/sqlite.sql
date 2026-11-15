-- Empty schema only; no accounts, sessions, decks or drafts.
CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT UNIQUE,created_at INTEGER);
CREATE TABLE card_roles(user_id TEXT PRIMARY KEY,role TEXT);
CREATE TABLE login_tokens(token_hash TEXT PRIMARY KEY,email TEXT,expires_at INTEGER);
CREATE TABLE decks(id TEXT PRIMARY KEY,user_id TEXT,body TEXT,revision INTEGER DEFAULT 1,share_token TEXT UNIQUE,updated_at INTEGER);
CREATE TABLE rate_limits(bucket TEXT PRIMARY KEY,hits INTEGER,expires_at INTEGER);
CREATE TABLE card_published(card_id TEXT PRIMARY KEY,body TEXT,revision INTEGER,updated_at INTEGER);
CREATE TABLE card_drafts(card_id TEXT PRIMARY KEY,body TEXT,revision INTEGER,base_revision INTEGER,state TEXT,author_id TEXT,source_note TEXT,updated_at INTEGER);
CREATE TABLE card_audit(id TEXT PRIMARY KEY,card_id TEXT,action TEXT,actor_id TEXT,before_body TEXT,after_body TEXT,note TEXT,created_at INTEGER);
