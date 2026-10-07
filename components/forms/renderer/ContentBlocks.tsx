import { Info, TriangleAlert } from "lucide-react";
import type { ContentBlock } from "@/lib/forms/types";
import { cn } from "@/lib/utils";

const blockTitle = "mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted";

function Callout({ block }: { block: Extract<ContentBlock, { kind: "callout" }> }) {
  const tone = block.tone ?? "info";
  const Icon = tone === "warning" ? TriangleAlert : Info;
  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border px-4 py-3.5 text-sm leading-relaxed",
        tone === "warning" && "border-warning-border bg-warning-soft text-[#5c4410]",
        tone === "info" && "border-accent/15 bg-accent-tint text-ink-soft",
        tone === "neutral" && "border-line bg-surface-subtle text-ink-soft"
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone === "warning" ? "text-[#a16a12]" : "text-accent")} aria-hidden="true" strokeWidth={2} />
      <div className="min-w-0">
        {block.title && <p className="mb-1 text-xs font-semibold uppercase tracking-[0.08em]">{block.title}</p>}
        <p className="whitespace-pre-line">{block.text}</p>
      </div>
    </div>
  );
}

/** Read-only content of a section: paragraphs, callouts, lists, reference tables and facts. */
export function ContentBlocks({ blocks }: { blocks?: ContentBlock[] }) {
  if (!blocks?.length) return null;
  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        switch (block.kind) {
          case "paragraph":
            return (
              <p key={index} className="text-sm leading-relaxed text-muted">
                {block.text}
              </p>
            );
          case "callout":
            return <Callout key={index} block={block} />;
          case "list": {
            const List = block.ordered ? "ol" : "ul";
            return (
              <div key={index}>
                {block.title && <p className={blockTitle}>{block.title}</p>}
                <List
                  className={cn(
                    "space-y-1.5 pl-5 text-sm leading-relaxed text-ink-soft",
                    block.ordered ? "list-decimal marker:font-semibold marker:text-accent" : "list-disc marker:text-accent"
                  )}
                >
                  {block.items.map((item, i) => (
                    <li key={i} className="pl-1">
                      {item}
                    </li>
                  ))}
                </List>
              </div>
            );
          }
          case "table":
            return (
              <div key={index}>
                {block.title && <p className={blockTitle}>{block.title}</p>}
                {/* Focusable so keyboard users can scroll it when it overflows on small screens. */}
                <div className="overflow-x-auto rounded-lg border border-line" tabIndex={0} role="region" aria-label={block.title ?? "Reference table"}>
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="bg-primary text-white">
                        {block.columns.map((c) => (
                          <th key={c} scope="col" className="px-3.5 py-2 text-xs font-semibold">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-soft">
                      {block.rows.map((row, r) => (
                        <tr key={r} className="even:bg-surface-subtle">
                          {row.map((cell, c) => (
                            <td key={c} className={cn("px-3.5 py-2 align-top", c === 0 ? "whitespace-nowrap font-semibold text-primary" : "text-ink-soft")}>
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          case "facts":
            return (
              <div key={index}>
                {block.title && <p className={blockTitle}>{block.title}</p>}
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border border-line bg-surface-subtle px-4 py-3.5 sm:grid-cols-2 lg:grid-cols-4">
                  {block.items.map((item) => (
                    <div key={item.label} className="min-w-0">
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{item.label}</dt>
                      <dd className="mt-0.5 break-words text-sm font-medium text-primary">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
        }
      })}
    </div>
  );
}
