CREATE TABLE users (
 id CHAR(32) PRIMARY KEY,
 email VARCHAR(254) NOT NULL UNIQUE,
 created_at BIGINT NOT NULL
) ENGINE=InnoDB;
CREATE TABLE login_tokens (
 token_hash CHAR(64) PRIMARY KEY,
 email VARCHAR(254) NOT NULL,
 expires_at BIGINT NOT NULL
) ENGINE=InnoDB;
CREATE TABLE decks (
 id VARCHAR(80) PRIMARY KEY,
 user_id CHAR(32) NOT NULL,
 body MEDIUMTEXT NOT NULL,
 revision INT NOT NULL DEFAULT 1,
 share_token CHAR(64) NULL UNIQUE,
 updated_at BIGINT NOT NULL,
 FOREIGN KEY(user_id) REFERENCES users(id),
 INDEX decks_owner (user_id)
) ENGINE=InnoDB;
CREATE TABLE rate_limits (
 bucket CHAR(64) PRIMARY KEY,
 hits INT NOT NULL,
 expires_at BIGINT NOT NULL
) ENGINE=InnoDB;
