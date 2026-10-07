import { describe, expect, it } from "vitest";
import { sectionProgress } from "@/lib/forms/progress";
import type { FormSchema } from "@/lib/forms/types";
import { emptyValue, isFieldRequired, sanitizeDraft, validateSubmission } from "@/lib/forms/validation";
import { operationsReview } from "@/lib/catalog/forms/operations-review";

const schema: FormSchema = {
  version: 1,
  sections: [
    {
      fields: [
        { name: "name", label: "Name", type: "text", required: true, maxLength: 10 },
        { name: "email", label: "Email", type: "email" },
        { name: "phone", label: "Phone", type: "tel" },
        { name: "count", label: "Count", type: "number", min: 1, max: 5, step: 1 },
        { name: "day", label: "Day", type: "date", min: "2026-01-01" },
        { name: "at", label: "At", type: "time" },
        { name: "when", label: "When", type: "datetime" },
        {
          name: "kind",
          label: "Kind",
          type: "radio",
          options: [
            { value: "a", label: "A" },
            { value: "other", label: "Other" },
          ],
        },
        { name: "kindOther", label: "Other kind", type: "text", requiredWhen: { field: "kind", values: ["other"], message: "Say which kind." } },
        {
          name: "tags",
          label: "Tags",
          type: "checkboxes",
          maxSelected: 2,
          options: [
            { value: "x", label: "X" },
            { value: "y", label: "Y" },
            { value: "z", label: "Z" },
          ],
        },
        { name: "agree", label: "Agree", type: "checkbox", required: true },
        { name: "sig", label: "Signature", type: "signature" },
      ],
    },
  ],
};

const valid = { name: "Ada", agree: true };

describe("validateSubmission", () => {
  it("accepts a minimal valid submission and normalises values", () => {
    const result = validateSubmission(schema, { ...valid, name: "  Ada  ", count: "3", tags: ["y", "x"] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.name).toBe("Ada");
    expect(result.data.count).toBe(3);
    // Checkbox selections are stored in option order.
    expect(result.data.tags).toEqual(["x", "y"]);
    expect(result.data.email).toBeNull();
  });

  it("discards unknown keys", () => {
    const result = validateSubmission(schema, { ...valid, role: "administrator", userId: "someone-else", __proto__: { polluted: true } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.data)).not.toContain("role");
    expect(Object.keys(result.data)).not.toContain("userId");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("enforces required fields, including a checkbox that must be ticked", () => {
    const result = validateSubmission(schema, {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.name).toBe("Name is required.");
    expect(result.errors.agree).toMatch(/confirm/);
  });

  it.each([
    ["name", "far too long a name", /10 characters or fewer/],
    ["email", "not-an-email", /valid email/],
    ["phone", "call me", /valid phone/],
    ["count", "2.5", /whole number/],
    ["count", "9", /at most 5/],
    ["count", "abc", /must be a number/],
    ["day", "2026-02-30", /valid date/],
    ["day", "2025-12-31", /on or after/],
    ["at", "25:00", /valid time/],
    ["when", "2026-01-01 10:00", /valid date and time/],
    ["kind", "unknown", /valid option/],
    ["tags", ["x", "y", "z"], /no more than 2/],
    ["tags", ["nope"], /valid options/],
    ["sig", "1", /full name/],
    ["name", ["array"], /invalid/],
  ])("rejects %s = %j", (field, value, message) => {
    const result = validateSubmission(schema, { ...valid, [field]: value });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[field]).toMatch(message);
  });

  it("applies conditional requirements only when the condition holds", () => {
    expect(validateSubmission(schema, { ...valid, kind: "a" }).ok).toBe(true);
    const result = validateSubmission(schema, { ...valid, kind: "other" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.kindOther).toBe("Say which kind.");
    expect(validateSubmission(schema, { ...valid, kind: "other", kindOther: "Special" }).ok).toBe(true);
    expect(isFieldRequired(schema.sections[0].fields[8], { kind: "other" })).toBe(true);
  });

  it("phrases a missing answer to a question naturally", () => {
    const question: FormSchema = { version: 1, sections: [{ fields: [{ name: "q", label: "Was anyone injured?", type: "text", required: true }] }] };
    const result = validateSubmission(question, {});
    expect(!result.ok && result.errors.q).toBe('Answer "Was anyone injured?"');
  });

  it("only accepts a real boolean for checkboxes", () => {
    const result = validateSubmission(schema, { ...valid, agree: "true" });
    expect(result.ok).toBe(false);
  });
});

describe("tables and repeaters (quarterly operations review)", () => {
  const review = operationsReview.schema;

  it("requires table cells by column, by condition and by row", () => {
    const result = validateSubmission(review, {
      checklist: { safety_walk: { status: "M" }, fire_test: { status: "N" }, first_aid: { status: "NA", explanation: "No kits on site." } },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Status required on every row.
    expect(result.errors["checklist.visitor_log.status"]).toBeDefined();
    // Evidence required for M, explanation for N; satisfied for NA.
    expect(result.errors["checklist.safety_walk.evidence"]).toBe("Operational checklist – 1: Add the evidence reference.");
    expect(result.errors["checklist.fire_test.explanation"]).toMatch(/Explain why/);
    expect(result.errors["checklist.first_aid.explanation"]).toBeUndefined();
    // Row-level requirement: only the "prepared by" sign-off row is required.
    expect(result.errors["signoff.prepared.name"]).toBeDefined();
    expect(result.errors["signoff.reviewed.name"]).toBeUndefined();
    // Only the first highlight is required.
    expect(result.errors["highlights.h1.text"]).toBeDefined();
    expect(result.errors["highlights.h2.text"]).toBeUndefined();
  });

  it("makes the action register required by another section's answer", () => {
    const onTrack = validateSubmission(review, { overallStatus: "on_track" });
    const atRisk = validateSubmission(review, { overallStatus: "at_risk" });
    expect(!onTrack.ok && onTrack.errors.actions).toBeFalsy();
    expect(!atRisk.ok && atRisk.errors.actions).toMatch(/at least one action/);
  });

  it("validates register rows, ignores blank rows and keeps generated identifiers stable", () => {
    const result = validateSubmission(review, {
      actions: [{}, { action: "Fix the gate", owner: "Sam", due: "2026-11-01", priority: "P2" }, { action: "Half done" }, {}],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors["actions.2.owner"]).toBe("ACT-03: Owner is required.");
    expect(result.errors["actions.1.owner"]).toBeUndefined();
    expect(result.errors["actions.0.action"]).toBeUndefined();

    const draft = sanitizeDraft(review, { actions: [{}, { action: "Fix the gate", owner: "Sam" }, {}] });
    expect(draft.actions).toEqual([{}, { id: "ACT-02", action: "Fix the gate", owner: "Sam" }]);
  });

  it("drops unknown rows and columns from tables", () => {
    const draft = sanitizeDraft(review, { checklist: { safety_walk: { status: "M", injected: "x" }, not_a_row: { status: "M" } } });
    expect(draft.checklist).toEqual({ safety_walk: { status: "M" } });
  });

  it("counts required items for progress, including conditional cells", () => {
    const section = review.sections.find((s) => s.id === "checklist")!;
    const before = sectionProgress(section, { checklist: {} });
    expect(before).toEqual({ done: 0, total: 10 });
    const after = sectionProgress(section, { checklist: { safety_walk: { status: "M" } } });
    expect(after).toEqual({ done: 1, total: 11 });
  });
});

describe("drafts", () => {
  it("never fails, keeps raw typed values and drops invalid choices", () => {
    const draft = sanitizeDraft(schema, { name: "x".repeat(20), count: "2.5", kind: "not-an-option", extra: "dropped" });
    expect(draft.name).toBe("x".repeat(20));
    expect(draft.count).toBe("2.5");
    expect(draft.kind).toBeUndefined();
    expect(draft).not.toHaveProperty("extra");
  });

  it("creates initial repeater rows", () => {
    const actions = operationsReview.schema.sections.flatMap((s) => s.fields).find((f) => f.name === "actions")!;
    expect(emptyValue(actions)).toEqual([{}, {}]);
  });
});
