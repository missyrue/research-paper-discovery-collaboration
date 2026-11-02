CREATE TABLE roles (
  role_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role_name VARCHAR(30) NOT NULL UNIQUE
);

CREATE TABLE users (
  user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role_id BIGINT NOT NULL REFERENCES roles(role_id),
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE papers (
  paper_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  abstract TEXT NOT NULL DEFAULT '',
  doi VARCHAR(255) UNIQUE,
  publication_year SMALLINT CHECK (publication_year BETWEEN 1000 AND 2200),
  venue TEXT,
  paper_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE authors (
  author_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  display_name TEXT NOT NULL UNIQUE
);

CREATE TABLE paper_authors (
  paper_id BIGINT NOT NULL REFERENCES papers(paper_id) ON DELETE CASCADE,
  author_id BIGINT NOT NULL REFERENCES authors(author_id),
  author_order SMALLINT NOT NULL CHECK (author_order > 0),
  PRIMARY KEY (paper_id, author_id), UNIQUE (paper_id, author_order)
);

CREATE TABLE user_interests (
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  PRIMARY KEY (user_id, topic)
);

CREATE TABLE collections (
  collection_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (owner_id, name)
);

CREATE TABLE bookmarks (
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  paper_id BIGINT NOT NULL REFERENCES papers(paper_id) ON DELETE CASCADE,
  collection_id BIGINT REFERENCES collections(collection_id) ON DELETE SET NULL,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, paper_id)
);

CREATE TABLE research_groups (
  group_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  created_by BIGINT NOT NULL REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE group_members (
  group_id BIGINT NOT NULL REFERENCES research_groups(group_id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  member_role VARCHAR(30) NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE discussions (
  discussion_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  paper_id BIGINT NOT NULL REFERENCES papers(paper_id) ON DELETE CASCADE,
  author_id BIGINT NOT NULL REFERENCES users(user_id),
  body TEXT NOT NULL CHECK (length(trim(body)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_papers_year ON papers(publication_year);
CREATE INDEX idx_discussions_paper_time ON discussions(paper_id, created_at DESC);
