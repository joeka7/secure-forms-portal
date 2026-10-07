import "server-only";
import Database from "better-sqlite3";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { catalog as defaultCatalog } from "@/lib/catalog/demo-catalog";
import type { CatalogCategory } from "@/lib/catalog/types";
import { assertValidSchema } from "@/lib/forms/schema-check";
import { migrate } from "@/lib/server/migrations";
import { hashPasswordSync } from "@/lib/server/password";
import { seedDemoData } from "@/lib/server/seed";
import { bootstrapAdminSettings, databasePath, demoSeedSettings } from "@/lib/server/settings";

/**
 * SQLite storage (better-sqlite3). All access goes through the service modules in this folder, which
 * use prepared statements and transactions, so pages and components never touch SQL.
 */

export type DB = Database.Database;

export const nowIso = () => new Date().toISOString();

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/**
 * Upsert catalog categories and forms by slug, and record a new form version whenever a form's
 * schema changes. Never deletes anything: retired entries are marked `status: "inactive"` so
 * historical submissions keep their references.
 */
export function syncCatalog(db: DB, catalog: CatalogCategory[]) {
  // Validate everything before writing anything.
  for (const category of catalog) {
    for (const form of category.forms) assertValidSchema(form.schema, `Form "${category.slug}/${form.slug}"`);
  }

  const findCategory = db.prepare("SELECT * FROM categories WHERE slug = ?");
  const insertCategory = db.prepare(
    `INSERT INTO categories (id, slug, name, description, icon, sort_order, status, created_at, updated_at)
     VALUES (@id, @slug, @name, @description, @icon, @sortOrder, @status, @now, @now)`
  );
  const updateCategory = db.prepare(
    `UPDATE categories SET name = @name, description = @description, icon = @icon, sort_order = @sortOrder,
            status = @status, updated_at = @now
      WHERE id = @id`
  );
  const findForm = db.prepare("SELECT * FROM forms WHERE category_id = ? AND slug = ?");
  const insertForm = db.prepare(
    `INSERT INTO forms (id, category_id, slug, name, description, status, sort_order, current_version, created_at, updated_at)
     VALUES (@id, @categoryId, @slug, @name, @description, @status, @sortOrder, 1, @now, @now)`
  );
  const updateForm = db.prepare(
    `UPDATE forms SET name = @name, description = @description, status = @status, sort_order = @sortOrder,
            current_version = @version, updated_at = @now
      WHERE id = @id`
  );
  const currentVersion = db.prepare("SELECT schema_hash FROM form_versions WHERE form_id = ? AND version = ?");
  const insertVersion = db.prepare(
    "INSERT INTO form_versions (form_id, version, schema, schema_hash, created_at) VALUES (?, ?, ?, ?, ?)"
  );

  db.transaction(() => {
    const now = nowIso();
    catalog.forEach((category, categoryIndex) => {
      const categoryRow = {
        slug: category.slug,
        name: category.name,
        description: category.description,
        icon: category.icon,
        sortOrder: categoryIndex,
        status: category.status ?? "active",
        now,
      };
      const existing = findCategory.get(category.slug) as Record<string, unknown> | undefined;
      let categoryId: string;
      if (!existing) {
        categoryId = randomUUID();
        insertCategory.run({ ...categoryRow, id: categoryId });
      } else {
        categoryId = existing.id as string;
        const changed =
          existing.name !== categoryRow.name ||
          existing.description !== categoryRow.description ||
          existing.icon !== categoryRow.icon ||
          existing.sort_order !== categoryRow.sortOrder ||
          existing.status !== categoryRow.status;
        if (changed) updateCategory.run({ ...categoryRow, id: categoryId });
      }

      category.forms.forEach((form, formIndex) => {
        const schema = JSON.stringify(form.schema);
        const hash = sha256(schema);
        const formRow = {
          categoryId,
          slug: form.slug,
          name: form.name,
          description: form.description,
          status: form.status ?? "active",
          sortOrder: formIndex,
          now,
        };
        const existingForm = findForm.get(categoryId, form.slug) as Record<string, unknown> | undefined;
        if (!existingForm) {
          const id = randomUUID();
          insertForm.run({ ...formRow, id });
          insertVersion.run(id, 1, schema, hash, now);
          return;
        }
        let version = existingForm.current_version as number;
        const stored = currentVersion.get(existingForm.id, version) as { schema_hash: string } | undefined;
        if (stored?.schema_hash !== hash) {
          version += 1;
          insertVersion.run(existingForm.id, version, schema, hash, now);
        }
        const changed =
          version !== existingForm.current_version ||
          existingForm.name !== formRow.name ||
          existingForm.description !== formRow.description ||
          existingForm.status !== formRow.status ||
          existingForm.sort_order !== formRow.sortOrder;
        if (changed) updateForm.run({ ...formRow, id: existingForm.id, version });
      });
    });
  }).immediate();
}

/** Create the first administrator from environment variables, only while no administrator exists. */
function bootstrapAdministrator(db: DB) {
  const settings = bootstrapAdminSettings();
  if (!settings) return;
  db.transaction(() => {
    if (db.prepare("SELECT 1 FROM users WHERE role = 'administrator' LIMIT 1").get()) return;
    if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(settings.email)) return;
    const now = nowIso();
    db.prepare(
      `INSERT INTO users (id, name, email, password_hash, role, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'administrator', 'active', ?, ?)`
    ).run(randomUUID(), settings.name, settings.email, hashPasswordSync(settings.password), now, now);
    console.info("[secure-forms-portal] Bootstrap administrator created.");
  }).immediate();
}

export type OpenOptions = {
  file?: string;
  catalog?: CatalogCategory[];
  /** Skip environment-driven bootstrap and demo seeding (tests). */
  skipSeed?: boolean;
};

export function openDatabase(options: OpenOptions = {}): DB {
  const file = options.file ?? databasePath();
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");
  migrate(db);
  syncCatalog(db, options.catalog ?? defaultCatalog);
  if (!options.skipSeed) {
    bootstrapAdministrator(db);
    const demo = demoSeedSettings();
    if (demo) seedDemoData(db, demo.password);
  }
  return db;
}

const globalForDb = globalThis as unknown as { __secureFormsDb?: DB };

/** Lazily opened, process-wide connection (kept on globalThis so dev hot reloads reuse it). */
export function getDb(): DB {
  globalForDb.__secureFormsDb ??= openDatabase();
  return globalForDb.__secureFormsDb;
}

/** Tests: replace the process-wide connection. */
export function setDbForTests(db: DB | null) {
  const previous = globalForDb.__secureFormsDb;
  if (previous && previous !== db) previous.close();
  globalForDb.__secureFormsDb = db ?? undefined;
}
