import { randomUUID } from "node:crypto";
import type { CatalogCategory } from "@/lib/catalog/types";
import { openDatabase, setDbForTests, type DB } from "@/lib/server/db";
import { hashPasswordSync } from "@/lib/server/password";
import type { Role, SessionUser, UserStatus } from "@/lib/types";

export const TEST_PASSWORD = "correct-horse-battery";
let passwordHash: string | null = null;

/** A fresh in-memory database with the given (default: demo) catalog, installed as the app's connection. */
export function freshDb(catalog?: CatalogCategory[]): DB {
  const db = openDatabase({ file: ":memory:", skipSeed: true, catalog });
  setDbForTests(db);
  return db;
}

export function categoryId(db: DB, slug: string) {
  return (db.prepare("SELECT id FROM categories WHERE slug = ?").get(slug) as { id: string }).id;
}

/** Insert a user directly and return it as the session would see it. */
export function insertUser(
  db: DB,
  options: { name?: string; email?: string; role?: Role; status?: UserStatus; categories?: string[] } = {}
): SessionUser {
  passwordHash ??= hashPasswordSync(TEST_PASSWORD);
  const id = randomUUID();
  const now = new Date().toISOString();
  const role = options.role ?? "user";
  const email = (options.email ?? `${id.slice(0, 8)}@example.com`).toLowerCase();
  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, options.name ?? "Test User", email, passwordHash, role, options.status ?? "active", now, now);
  const categoryIds = (options.categories ?? []).map((slug) => categoryId(db, slug));
  for (const cid of categoryIds) db.prepare("INSERT INTO user_categories (user_id, category_id, created_at) VALUES (?, ?, ?)").run(id, cid, now);
  return { id, name: options.name ?? "Test User", email, role, status: options.status ?? "active", categoryIds: role === "user" ? categoryIds : [] };
}
