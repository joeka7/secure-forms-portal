"use client";

import { Check, ChevronDown, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { matchesQuery } from "@/lib/search";
import { cn } from "@/lib/utils";
import { inputBase } from "@/components/ui/classes";

export type ComboOption = { value: string; label: string; /** Secondary text, also searched. */ detail?: string };

export const filterLabel = "mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.06em] text-muted";

/**
 * A select that can be searched by typing (ARIA 1.2 combobox with a listbox popup), for option
 * lists too long for a plain dropdown. The first option ("All …") clears the selection.
 */
export function FilterCombobox({
  label,
  allLabel,
  options,
  value,
  onChange,
}: {
  label: string;
  allLabel: string;
  options: ComboOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const selected = options.find((o) => o.value === value);
  const list = useMemo<ComboOption[]>(() => [{ value: "", label: allLabel }, ...options.filter((o) => matchesQuery(query, o.label, o.detail))], [options, query, allLabel]);

  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function openList() {
    setQuery("");
    setActive(Math.max(0, [{ value: "" }, ...options].findIndex((o) => o.value === value)));
    setOpen(true);
  }

  function choose(option: ComboOption) {
    setOpen(false);
    setQuery("");
    if (option.value !== value) onChange(option.value);
  }

  return (
    <div className="relative min-w-0">
      <label htmlFor={`${id}-input`} className={filterLabel}>
        {label}
      </label>
      <div className="relative">
        <input
          id={`${id}-input`}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && list[active] ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          value={open ? query : selected?.label ?? ""}
          placeholder={open ? `Search ${label.toLowerCase()}…` : allLabel}
          onFocus={openList}
          onClick={() => !open && openList()}
          onBlur={() => setOpen(false)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              if (!open) openList();
              else setActive((i) => Math.min(i + 1, list.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && open) {
              e.preventDefault();
              if (list[active]) choose(list[active]);
            } else if (e.key === "Escape" && open) {
              e.preventDefault();
              setOpen(false);
              setQuery("");
            }
          }}
          className={cn(inputBase, "min-h-[42px] py-2 pr-16 text-sm placeholder:text-ink-soft", selected && !open && "font-medium")}
        />
        {selected && !open ? (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={`Clear ${label} filter`}
            className="absolute right-8 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-accent-soft hover:text-primary"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      </div>
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-line-strong bg-surface py-1 shadow-popover"
        >
          {list.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value || "__all"}
                id={`${id}-opt-${index}`}
                data-index={index}
                role="option"
                aria-selected={isSelected}
                // Keep focus in the input so its blur handler doesn't close the list before the click.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(option)}
                onMouseMove={() => setActive(index)}
                className={cn(
                  "flex cursor-pointer items-start gap-2 px-3 py-2 text-sm",
                  index === active ? "bg-accent-soft text-primary" : "text-ink-soft",
                  index === 0 && "border-b border-line-soft font-medium"
                )}
              >
                <Check className={cn("mt-0.5 h-3.5 w-3.5 shrink-0 text-accent", !isSelected && "invisible")} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block break-words">{option.label}</span>
                  {option.detail && <span className="block truncate text-[12px] text-muted">{option.detail}</span>}
                </span>
              </li>
            );
          })}
          {list.length === 1 && (
            <li className="px-3 py-2 text-sm italic text-muted" role="presentation">
              No matches
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
