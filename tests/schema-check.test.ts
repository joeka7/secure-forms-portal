import { describe, expect, it } from "vitest";
import { catalog } from "@/lib/catalog/demo-catalog";
import { assertValidSchema } from "@/lib/forms/schema-check";
import type { FormSchema } from "@/lib/forms/types";

describe("assertValidSchema", () => {
  it("accepts every form in the demo catalog", () => {
    for (const category of catalog) {
      for (const form of category.forms) expect(() => assertValidSchema(form.schema, form.slug)).not.toThrow();
    }
  });

  it("covers every field type and content block across the demo catalog", () => {
    const fields = catalog.flatMap((c) => c.forms.flatMap((f) => f.schema.sections.flatMap((s) => s.fields)));
    const types = new Set(fields.map((f) => f.type));
    for (const type of ["text", "email", "tel", "textarea", "signature", "number", "date", "time", "datetime", "select", "radio", "checkboxes", "checkbox", "table", "repeater"]) {
      expect(types, type).toContain(type);
    }
    const blocks = new Set(catalog.flatMap((c) => c.forms.flatMap((f) => f.schema.sections.flatMap((s) => [...(s.content ?? []), ...(s.footer ?? [])].map((b) => b.kind)))));
    for (const kind of ["paragraph", "callout", "list", "table", "facts"]) expect(blocks, kind).toContain(kind);
  });

  const broken = (fields: FormSchema["sections"][number]["fields"]): FormSchema => ({ version: 1, sections: [{ fields }] });

  it.each<[string, FormSchema, RegExp]>([
    ["duplicate names", broken([{ name: "a", label: "A", type: "text" }, { name: "a", label: "A2", type: "text" }]), /duplicate field name/],
    ["invalid names", broken([{ name: "1bad", label: "Bad", type: "text" }]), /invalid field name/],
    ["choices without options", broken([{ name: "c", label: "C", type: "select", options: [] }]), /no options/],
    [
      "conditions on unknown fields",
      broken([{ name: "a", label: "A", type: "text", requiredWhen: { field: "missing", values: ["x"] } }]),
      /unknown field/,
    ],
    [
      "conditions on non-choice fields",
      broken([
        { name: "t", label: "T", type: "text" },
        { name: "a", label: "A", type: "text", requiredWhen: { field: "t", values: ["x"] } },
      ]),
      /select, radio or checkboxes/,
    ],
    [
      "column conditions with unknown values",
      broken([
        {
          name: "tbl",
          label: "Table",
          type: "table",
          rows: [{ key: "r1", label: "1" }],
          columns: [
            { key: "s", label: "S", input: { type: "select", options: [{ value: "y", label: "Y" }] } },
            { key: "n", label: "N", input: { type: "text" }, requiredWhen: { column: "s", values: ["nope"] } },
          ],
        },
      ]),
      /unknown values/,
    ],
    ["oversized registers", broken([{ name: "r", label: "R", type: "repeater", maxRows: 500, columns: [{ key: "a", label: "A", input: { type: "text" } }] }]), /maxRows/],
    ["empty forms", { version: 1, sections: [{ fields: [] }] }, /no fields/],
  ])("rejects %s", (_, schema, message) => {
    expect(() => assertValidSchema(schema, "test")).toThrow(message);
  });
});
