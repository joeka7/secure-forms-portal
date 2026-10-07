import { beforeEach, describe, expect, it } from "vitest";
import type { DB } from "@/lib/server/db";
import { createSessionRecord, resolveSession } from "@/lib/server/session-store";
import { submitForm } from "@/lib/server/submissions";
import { createUser, deleteUser, listUsers, updateUser } from "@/lib/server/users";
import type { SessionUser } from "@/lib/types";
import { categoryId, freshDb, insertUser } from "./helpers/db";

let db: DB;
let admin: SessionUser;
beforeEach(() => {
  db = freshDb();
  admin = insertUser(db, { role: "administrator", email: "admin@example.com", name: "Admin One" });
});

const input = (overrides: Record<string, unknown> = {}) => ({
  name: "New Person",
  email: "new.person@example.com",
  role: "user",
  status: "active",
  categoryIds: [categoryId(db, "facilities")],
  password: "a-long-enough-password",
  ...overrides,
});

describe("user management", () => {
  it("is reserved for administrators", async () => {
    const user = insertUser(db, { categories: ["facilities"] });
    expect(() => listUsers(user)).toThrow();
    await expect(createUser(user, input())).rejects.toThrow();
  });

  it("creates users with hashed passwords and case-insensitive unique emails", async () => {
    const result = await createUser(admin, input({ email: "  New.Person@Example.COM " }));
    expect(result.kind).toBe("ok");
    const row = db.prepare("SELECT email, password_hash FROM users WHERE email = 'new.person@example.com'").get() as { email: string; password_hash: string };
    expect(row.password_hash).toMatch(/^scrypt\$/);
    expect(row.password_hash).not.toContain("a-long-enough-password");

    const duplicate = await createUser(admin, input({ email: "NEW.PERSON@example.com" }));
    expect(duplicate).toMatchObject({ kind: "invalid", errors: { email: expect.stringMatching(/already/) } });
  });

  it("requires categories for users and ignores them for administrators", async () => {
    expect(await createUser(admin, input({ categoryIds: [] }))).toMatchObject({ kind: "invalid", errors: { categoryIds: expect.any(String) } });
    expect(await createUser(admin, input({ categoryIds: ["not-a-category"] }))).toMatchObject({ kind: "invalid" });
    const created = await createUser(admin, input({ role: "administrator" }));
    expect(created.kind === "ok" && created.user.categoryIds).toEqual([]);
  });

  it("prevents administrators from demoting or disabling themselves", async () => {
    insertUser(db, { role: "administrator", email: "second@example.com" });
    const demote = await updateUser(admin, admin.id, { ...input(), name: admin.name, email: admin.email, password: undefined });
    expect(demote).toMatchObject({ kind: "invalid", message: expect.stringMatching(/your own/) });
    const disable = await updateUser(admin, admin.id, { name: admin.name, email: admin.email, role: "administrator", status: "disabled" });
    expect(disable).toMatchObject({ kind: "invalid", message: expect.stringMatching(/your own/) });
  });

  it("always keeps at least one active administrator", async () => {
    const other = insertUser(db, { role: "administrator", email: "other@example.com" });
    // Demoting the other administrator is fine while this one remains...
    expect((await updateUser(admin, other.id, { name: "Other", email: other.email, role: "user", status: "active", categoryIds: [categoryId(db, "facilities")] })).kind).toBe("ok");
    // ...but once this is the only active administrator, no actor can disable, demote or remove it.
    const anotherActor: SessionUser = { ...admin, id: "another-administrator" };
    const disable = await updateUser(anotherActor, admin.id, { name: admin.name, email: admin.email, role: "administrator", status: "disabled" });
    expect(disable).toMatchObject({ kind: "invalid", message: expect.stringMatching(/active administrator/) });
    expect(deleteUser(anotherActor, admin.id)).toMatchObject({ kind: "blocked", message: expect.stringMatching(/active administrator/) });
  });

  it("signs a disabled user out immediately and keeps the admin's own session on a self password reset", async () => {
    const user = insertUser(db, { categories: ["facilities"], email: "worker@example.com" });
    const token = createSessionRecord(db, user.id);
    await updateUser(admin, user.id, { name: user.name, email: user.email, role: "user", status: "disabled", categoryIds: [categoryId(db, "facilities")] });
    expect(resolveSession(db, token)).toBeNull();

    const mine = createSessionRecord(db, admin.id);
    const elsewhere = createSessionRecord(db, admin.id);
    await updateUser(admin, admin.id, { name: admin.name, email: admin.email, role: "administrator", status: "active", password: "another-long-password" }, { currentSessionToken: mine });
    expect(resolveSession(db, mine)).not.toBeNull();
    expect(resolveSession(db, elsewhere)).toBeNull();
  });

  it("removes users without submissions and refuses users with submissions or yourself", async () => {
    const free = insertUser(db, { categories: ["facilities"] });
    const busy = insertUser(db, { categories: ["facilities"] });
    const ok = submitForm(busy, "facilities", "maintenance-request", {
      building: "main",
      room: "1.01",
      issueType: "cleaning",
      priority: "low",
      description: "Spilled coffee.",
      hazard: "no",
      contactPhone: "+1 555 0100",
    });
    expect(ok.kind).toBe("ok");
    expect(deleteUser(admin, free.id)).toEqual({ kind: "ok" });
    expect(deleteUser(admin, busy.id)).toMatchObject({ kind: "blocked", message: /1 submission/ });
    expect(deleteUser(admin, admin.id)).toMatchObject({ kind: "blocked", message: /your own/ });
    expect(deleteUser(admin, "00000000-0000-0000-0000-000000000000")).toEqual({ kind: "not_found" });
  });
});
