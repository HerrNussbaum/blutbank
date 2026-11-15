CREATE TABLE card_roles (
 user_id CHAR(32) PRIMARY KEY,
 role VARCHAR(16) NOT NULL,
 FOREIGN KEY(user_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE card_published (
 card_id VARCHAR(32) PRIMARY KEY,
 body MEDIUMTEXT NOT NULL,
 revision INT NOT NULL,
 updated_at BIGINT NOT NULL
) ENGINE=InnoDB;
CREATE TABLE card_drafts (
 card_id VARCHAR(32) PRIMARY KEY,
 body MEDIUMTEXT NOT NULL,
 revision INT NOT NULL,
 base_revision INT NOT NULL,
 state VARCHAR(16) NOT NULL,
 author_id CHAR(32) NOT NULL,
 source_note TEXT NOT NULL,
 updated_at BIGINT NOT NULL,
 FOREIGN KEY(author_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE card_audit (
 id CHAR(32) PRIMARY KEY,
 card_id VARCHAR(32) NOT NULL,
 action VARCHAR(24) NOT NULL,
 actor_id CHAR(32) NOT NULL,
 before_body MEDIUMTEXT NOT NULL,
 after_body MEDIUMTEXT NOT NULL,
 note TEXT NOT NULL,
 created_at BIGINT NOT NULL,
 FOREIGN KEY(actor_id) REFERENCES users(id),
 INDEX card_audit_card(card_id,created_at)
) ENGINE=InnoDB;
