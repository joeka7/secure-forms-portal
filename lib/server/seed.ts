import "server-only";
import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { FormSchema } from "@/lib/forms/types";
import { validateSubmission } from "@/lib/forms/validation";
import { hashPasswordSync } from "@/lib/server/password";
import type { Role, UserStatus } from "@/lib/types";

/**
 * Fictional demo data for local development (PORTAL_SEED_DEMO=true). Every name, email address
 * (on the reserved example.com domain) and answer is invented. Sample submissions are validated
 * against the real form schemas, exactly like a submission from the browser.
 */

type DemoUser = { key: string; name: string; email: string; role: Role; status: UserStatus; categories: string[] };

export const DEMO_USERS: DemoUser[] = [
  { key: "admin", name: "Jordan Reyes", email: "admin@example.com", role: "administrator", status: "active", categories: [] },
  { key: "sam", name: "Sam Patel", email: "sam.patel@example.com", role: "user", status: "active", categories: ["it-requests", "facilities"] },
  { key: "taylor", name: "Taylor Kim", email: "taylor.kim@example.com", role: "user", status: "active", categories: ["human-resources", "operations"] },
  { key: "riley", name: "Riley Chen", email: "riley.chen@example.com", role: "user", status: "disabled", categories: ["facilities"] },
];

const DAY = 24 * 60 * 60 * 1000;

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const isoLocal = (ms: number) => new Date(ms).toISOString().slice(0, 16);

type DemoSubmission = { user: string; category: string; form: string; daysAgo: number; data: (now: number) => Record<string, unknown> };

const CHECKLIST_KEYS = [
  "safety_walk",
  "fire_test",
  "first_aid",
  "visitor_log",
  "badge_audit",
  "backup_test",
  "supplier_review",
  "maintenance_plan",
  "training",
  "continuity",
];

const DEMO_SUBMISSIONS: DemoSubmission[] = [
  {
    user: "riley",
    category: "facilities",
    form: "maintenance-request",
    daysAgo: 26,
    data: () => ({
      building: "warehouse",
      room: "Ground floor, loading bay 3",
      issueType: "electrical",
      priority: "high",
      description: "Two of the overhead lights above loading bay 3 flicker and switch off during the afternoon shift.",
      hazard: "no",
      accessFrom: "07:00",
      accessUntil: "15:00",
      contactPhone: "+1 555 0100",
    }),
  },
  {
    user: "sam",
    category: "it-requests",
    form: "equipment-request",
    daysAgo: 18,
    data: (now) => ({
      requesterName: "Sam Patel",
      requesterEmail: "sam.patel@example.com",
      department: "operations",
      equipmentType: "monitor",
      quantity: 2,
      neededBy: isoDay(now - 4 * DAY),
      justification: "Second screens for the two new dispatch desks so schedules and tickets can be viewed side by side.",
      policyAccepted: true,
    }),
  },
  {
    user: "sam",
    category: "facilities",
    form: "maintenance-request",
    daysAgo: 12,
    data: () => ({
      building: "main",
      room: "Level 2, Room 2.14",
      issueType: "hvac",
      priority: "medium",
      description: "The meeting room is noticeably warmer than the rest of the floor; the thermostat does not seem to respond.",
      hazard: "no",
      accessFrom: "09:00",
      accessUntil: "17:00",
      contactPhone: "+1 555 0101",
    }),
  },
  {
    user: "taylor",
    category: "human-resources",
    form: "leave-request",
    daysAgo: 9,
    data: (now) => ({
      employeeName: "Taylor Kim",
      employeeEmail: "taylor.kim@example.com",
      leaveType: "annual",
      firstDay: isoDay(now + 20 * DAY),
      lastDay: isoDay(now + 24 * DAY),
      workingDays: 5,
      cover: "Sam Patel",
      handoverNotes: "Weekly operations report drafts are in the shared folder.",
      declaration: true,
      signature: "Taylor Kim",
    }),
  },
  {
    user: "taylor",
    category: "operations",
    form: "incident-report",
    daysAgo: 6,
    data: (now) => ({
      occurredAt: isoLocal(now - 6 * DAY - 3 * 60 * 60 * 1000),
      location: "Warehouse, aisle 7",
      incidentType: "near_miss",
      severity: "minor",
      summary: "A pallet was left partly in the walkway after a delivery. A colleague noticed it before anyone tripped.",
      injuries: "no",
      people: [{ name: "Alex Rivera", role: "witness", statement: "Saw the pallet and moved the cones around it." }],
      immediateActions: "Pallet moved to the racking and the walkway re-marked.",
      managerNotified: true,
      reporterSignature: "Taylor Kim",
    }),
  },
  {
    user: "admin",
    category: "it-requests",
    form: "system-access-request",
    daysAgo: 4,
    data: (now) => ({
      employeeName: "Jordan Reyes",
      employeeId: "EMP-1001",
      managerEmail: "director@example.com",
      teamName: "Operations",
      systems: ["analytics", "ticketing"],
      accessLevel: "power",
      startAt: isoLocal(now - 3 * DAY),
      requesterSignature: "Jordan Reyes",
    }),
  },
  {
    user: "sam",
    category: "it-requests",
    form: "system-access-request",
    daysAgo: 2,
    data: (now) => ({
      employeeName: "Sam Patel",
      employeeId: "EMP-1042",
      managerEmail: "admin@example.com",
      systems: ["documents", "vpn"],
      accessLevel: "admin",
      startAt: isoLocal(now - DAY),
      endDate: isoDay(now + 60 * DAY),
      adminJustification: "Temporary administrator access to migrate the shared document library to the new folder structure.",
      requesterSignature: "Sam Patel",
    }),
  },
  {
    user: "taylor",
    category: "operations",
    form: "quarterly-operations-review",
    daysAgo: 1,
    data: (now) => ({
      site: "warehouse",
      quarter: "Q3",
      year: 2026,
      reviewLead: "Taylor Kim",
      reviewDate: isoLocal(now - 2 * DAY),
      overallStatus: "at_risk",
      headline: "Throughput recovered after the August staffing gap, but the backup restore test is overdue.",
      highlights: { h1: { text: "Zero lost-time incidents" }, h2: { text: "New dispatch desks in use" } },
      checklist: Object.fromEntries(
        CHECKLIST_KEYS.map((key, index) =>
          index === 5
            ? [key, { status: "N", explanation: "Restore test postponed; vendor window moved to next quarter." }]
            : [key, { status: index % 4 === 3 ? "P" : "M", evidence: `WH-Q3-${String(index + 1).padStart(2, "0")}` }]
        )
      ),
      questions: {
        staffing: { rating: "2", owner: "Taylor Kim", response: "Two vacancies were open for six weeks; agency cover was used." },
        service: { rating: "4" },
        risks: { rating: "3", response: "Backup testing is the main open risk." },
        improvements: { rating: "4", owner: "Sam Patel" },
      },
      openTickets: 18,
      resolutionHours: 20.5,
      incidents: 1,
      budgetVariance: -2.5,
      actions: [
        { action: "Book the backup restore test with the vendor.", owner: "Sam Patel", due: isoDay(now + 14 * DAY), priority: "P2", status: "open" },
      ],
      signoff: { prepared: { name: "Taylor Kim", signature: "Taylor Kim", signedAt: isoLocal(now - DAY) } },
      declaration: true,
    }),
  },
];

/** Create the demo users, assignments and sample submissions that do not exist yet. Idempotent. */
export function seedDemoData(db: Database.Database, password: string) {
  db.transaction(() => {
    const now = Date.now();
    const nowText = new Date(now).toISOString();
    const userIds = new Map<string, string>();
    for (const demo of DEMO_USERS) {
      const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(demo.email) as { id: string } | undefined;
      if (existing) {
        userIds.set(demo.key, existing.id);
        continue;
      }
      const id = randomUUID();
      // Spread creation dates so the Users page has realistic history.
      const createdAt = new Date(now - (40 - DEMO_USERS.indexOf(demo)) * DAY).toISOString();
      db.prepare(
        `INSERT INTO users (id, name, email, password_hash, role, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, demo.name, demo.email, hashPasswordSync(password), demo.role, demo.status, createdAt, nowText);
      for (const slug of demo.categories) {
        const category = db.prepare("SELECT id FROM categories WHERE slug = ?").get(slug) as { id: string } | undefined;
        if (category) {
          db.prepare("INSERT OR IGNORE INTO user_categories (user_id, category_id, created_at) VALUES (?, ?, ?)").run(id, category.id, createdAt);
        }
      }
      userIds.set(demo.key, id);
    }

    const { n } = db.prepare("SELECT COUNT(*) AS n FROM form_submissions").get() as { n: number };
    if (n > 0) return;

    for (const sample of DEMO_SUBMISSIONS) {
      const form = db
        .prepare(
          `SELECT f.id, f.category_id, f.current_version, v.schema
             FROM forms f
             JOIN categories c ON c.id = f.category_id
             JOIN form_versions v ON v.form_id = f.id AND v.version = f.current_version
            WHERE c.slug = ? AND f.slug = ?`
        )
        .get(sample.category, sample.form) as { id: string; category_id: string; current_version: number; schema: string } | undefined;
      const userId = userIds.get(sample.user);
      if (!form || !userId) continue;
      const result = validateSubmission(JSON.parse(form.schema) as FormSchema, sample.data(now));
      if (!result.ok) {
        throw new Error(`Demo submission for ${sample.form} is invalid: ${JSON.stringify(result.errors)}`);
      }
      // A fixed time of day per sample keeps the list readable.
      const submittedAt = new Date(now - sample.daysAgo * DAY - (DEMO_SUBMISSIONS.indexOf(sample) % 5) * 47 * 60 * 1000).toISOString();
      db.prepare(
        `INSERT INTO form_submissions (id, form_id, form_version, category_id, user_id, data, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(randomUUID(), form.id, form.current_version, form.category_id, userId, JSON.stringify(result.data), submittedAt);
    }
  }).immediate();
}
