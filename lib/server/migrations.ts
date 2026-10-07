import "server-only";
import type Database from "better-sqlite3";

/**
 * Versioned schema migrations, applied in order and recorded in SQLite's `user_version`.
 * Never edit a released migration: append a new one.
 */
export const MIGRATIONS: Array<{ name: string; sql: string }> = [
  {
    name: "initial schema",
    sql: `
      CREATE TABLE users (
        id            TEXT PRIMARY KEY,
        name          TEXT NOT NULL,
        email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        role          TEXT NOT NULL CHECK (role IN ('administrator', 'user')),
        status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL
      );

      CREATE TABLE categories (
        id          TEXT PRIMARY KEY,
        slug        TEXT NOT NULL UNIQUE,
        name        TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        icon        TEXT NOT NULL DEFAULT '',
        sort_order  INTEGER NOT NULL DEFAULT 0,
        status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      CREATE TABLE user_categories (
        user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        created_at  TEXT NOT NULL,
        PRIMARY KEY (user_id, category_id)
      );
      CREATE INDEX idx_user_categories_category ON user_categories(category_id);

      CREATE TABLE forms (
        id              TEXT PRIMARY KEY,
        category_id     TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
        slug            TEXT NOT NULL,
        name            TEXT NOT NULL,
        description     TEXT NOT NULL DEFAULT '',
        status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
        sort_order      INTEGER NOT NULL DEFAULT 0,
        current_version INTEGER NOT NULL DEFAULT 1,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        UNIQUE (category_id, slug)
      );

      -- Every distinct schema a form has had. Submissions reference the version they were validated
      -- against, so they always render with the exact questions the person answered.
      CREATE TABLE form_versions (
        form_id     TEXT NOT NULL REFERENCES forms(id) ON DELETE RESTRICT,
        version     INTEGER NOT NULL,
        schema      TEXT NOT NULL,
        schema_hash TEXT NOT NULL,
        created_at  TEXT NOT NULL,
        PRIMARY KEY (form_id, version)
      );

      CREATE TABLE form_submissions (
        id           TEXT PRIMARY KEY,
        form_id      TEXT NOT NULL REFERENCES forms(id) ON DELETE RESTRICT,
        form_version INTEGER NOT NULL,
        category_id  TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
        user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        data         TEXT NOT NULL,
        submitted_at TEXT NOT NULL,
        FOREIGN KEY (form_id, form_version) REFERENCES form_versions(form_id, version) ON DELETE RESTRICT
      );
      CREATE INDEX idx_submissions_submitted ON form_submissions(submitted_at);
      CREATE INDEX idx_submissions_form ON form_submissions(form_id, submitted_at);
      CREATE INDEX idx_submissions_category ON form_submissions(category_id, submitted_at);
      CREATE INDEX idx_submissions_user ON form_submissions(user_id, submitted_at);

      -- One saved draft per user and form.
      CREATE TABLE form_drafts (
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        form_id    TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
        data       TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, form_id)
      );

      -- The id is the SHA-256 of the session token; the token itself only ever exists in the cookie.
      CREATE TABLE sessions (
        id           TEXT PRIMARY KEY,
        user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at   INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL,
        expires_at   INTEGER NOT NULL
      );
      CREATE INDEX idx_sessions_user ON sessions(user_id);
      CREATE INDEX idx_sessions_expires ON sessions(expires_at);

      -- Fixed-window counters for login throttling, shared by every process using this database.
      CREATE TABLE rate_limits (
        key      TEXT PRIMARY KEY,
        count    INTEGER NOT NULL,
        reset_at INTEGER NOT NULL
      );
      CREATE INDEX idx_rate_limits_reset ON rate_limits(reset_at);
    `,
  },
];

/** Apply pending migrations. Each runs in an IMMEDIATE transaction, so concurrent processes serialise. */
export function migrate(db: Database.Database) {
  for (;;) {
    const applied = db
      .transaction(() => {
        const current = db.pragma("user_version", { simple: true }) as number;
        if (current >= MIGRATIONS.length) return false;
        db.exec(MIGRATIONS[current].sql);
        db.pragma(`user_version = ${current + 1}`);
        return true;
      })
      .immediate();
    if (!applied) return;
  }
}
