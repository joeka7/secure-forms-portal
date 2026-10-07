import { describe, expect, it } from "vitest";
import { seedDemoData, DEMO_USERS } from "@/lib/server/seed";
import { freshDb } from "./helpers/db";

describe("demo seed", () => {
  it("creates fictional users, assignments and valid sample submissions, idempotently", () => {
    const db = freshDb();
    seedDemoData(db, "demo-password-123");
    seedDemoData(db, "demo-password-123");
    expect(db.prepare("SELECT COUNT(*) AS n FROM users").get()).toEqual({ n: DEMO_USERS.length });
    const submissions = (db.prepare("SELECT COUNT(*) AS n FROM form_submissions").get() as { n: number }).n;
    expect(submissions).toBeGreaterThanOrEqual(6);
    const emails = (db.prepare("SELECT email FROM users").all() as Array<{ email: string }>).map((r) => r.email);
    for (const email of emails) expect(email).toMatch(/@example\.com$/);
    expect(db.prepare("SELECT status FROM users WHERE email = 'riley.chen@example.com'").get()).toEqual({ status: "disabled" });
  });
});
