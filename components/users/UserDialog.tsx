"use client";

import { Check, CircleAlert, Copy, Eye, EyeOff, Info, KeyRound, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { PASSWORD_MIN_LENGTH } from "@/lib/config";
import { matchesQuery } from "@/lib/search";
import { USER_STATUS_LABELS, USER_STATUSES, type Category, type ManagedUser, type Role, type UserStatus } from "@/lib/types";
import { generatePassword } from "@/lib/users/generate-password";
import { validateUserInput, type UserFieldErrors } from "@/lib/users/validation";
import { cn } from "@/lib/utils";
import { alertError, buttonGhost, buttonPrimary, buttonSecondary, errorText, helpText, inputBase, inputError, labelText, selectBase } from "@/components/ui/classes";
import { Dialog, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { SearchField } from "@/components/ui/SearchField";

const ROLE_OPTIONS: Array<{ value: Role; title: string; description: string }> = [
  { value: "user", title: "User", description: "Access only to the categories assigned below." },
  { value: "administrator", title: "Administrator", description: "Every category and form, submissions and user management." },
];

/** Add or edit a user. The same validation runs here and on the server. */
export function UserDialog({
  mode,
  user,
  categories,
  isSelf,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  user?: ManagedUser;
  categories: Category[];
  isSelf: boolean;
  onClose: () => void;
  onSaved: (user: ManagedUser, mode: "create" | "edit") => void;
}) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<Role>(user?.role ?? "user");
  const [status, setStatus] = useState<UserStatus>(user?.status ?? "active");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(user?.categoryIds ?? []));
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [settingPassword, setSettingPassword] = useState(mode === "create");
  const [categoryQuery, setCategoryQuery] = useState("");
  const [errors, setErrors] = useState<UserFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const ids = useId();
  const fid = (k: string) => `${ids}-${k}`;

  const visibleCategories = useMemo(() => categories.filter((c) => matchesQuery(categoryQuery, c.name)), [categories, categoryQuery]);
  const demotingAdmin = mode === "edit" && user?.role === "administrator" && role === "user";

  const clearError = (key: keyof UserFieldErrors) => errors[key] && setErrors((e) => ({ ...e, [key]: undefined }));

  function toggleCategory(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    clearError("categoryIds");
  }

  function showErrors(next: UserFieldErrors, message?: string | null) {
    setErrors(next);
    setFormError(message ?? null);
    requestAnimationFrame(() => {
      const target = bodyRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-error-target], [role="alert"]');
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
      if (target && target.getAttribute("role") !== "alert") target.focus();
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const payload = {
      name,
      email,
      role,
      status,
      categoryIds: role === "user" ? Array.from(selected) : [],
      ...(settingPassword ? { password } : {}),
    };
    const check = validateUserInput(payload, mode === "create" ? "create" : "update");
    if (!check.ok) return showErrors(check.errors);

    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch(mode === "create" ? "/api/users" : `/api/users/${encodeURIComponent(user!.id)}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as { user?: ManagedUser; message?: string; fieldErrors?: UserFieldErrors };
      if (res.ok && body.user) return onSaved(body.user, mode);
      if (res.status === 422) {
        const fieldErrors = body.fieldErrors ?? {};
        showErrors(fieldErrors, Object.keys(fieldErrors).length ? null : body.message ?? "The changes could not be saved.");
      } else if (res.status === 401) showErrors({}, "Your session has expired. Please sign in again.");
      else if (res.status === 403) showErrors({}, "You don't have permission to manage users.");
      else if (res.status === 404) showErrors({}, "This user no longer exists.");
      else showErrors({}, body.message ?? "The changes could not be saved. Please try again.");
    } catch {
      showErrors({}, "We couldn't reach the server. Check your connection and try again.");
    }
    setSaving(false);
  }

  // A strong random password generated in the browser (Web Crypto), shown so it can be copied and
  // passed on. It is never stored here; it is only sent with this form and hashed by the server.
  function onGeneratePassword() {
    setPassword(generatePassword());
    setShowPassword(true);
    setCopied(false);
    clearError("password");
  }

  async function onCopyPassword() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. an insecure context): the visible password can still be selected.
    }
  }

  return (
    <Dialog
      size="lg"
      title={mode === "create" ? "Add user" : "Edit user"}
      subtitle={mode === "create" ? "Create an account and choose what it can access." : user?.email}
      onClose={onClose}
      busy={saving}
      initialFocus={nameRef}
    >
      <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
        <DialogBody bodyRef={bodyRef} className="space-y-7">
          {formError && (
            <div role="alert" className={alertError}>
              <CircleAlert className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              <p>{formError}</p>
            </div>
          )}

          <section className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor={fid("name")} className={cn(labelText, "mb-2")}>
                Name
              </label>
              <input
                ref={nameRef}
                id={fid("name")}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearError("name");
                }}
                autoComplete="off"
                disabled={saving}
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={errors.name ? fid("name-error") : undefined}
                className={cn(inputBase, errors.name && inputError)}
              />
              {errors.name && (
                <p id={fid("name-error")} className={errorText}>
                  {errors.name}
                </p>
              )}
            </div>
            <div>
              <label htmlFor={fid("email")} className={cn(labelText, "mb-2")}>
                Email
              </label>
              <input
                id={fid("email")}
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearError("email");
                }}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                disabled={saving}
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? fid("email-error") : undefined}
                className={cn(inputBase, errors.email && inputError)}
              />
              {errors.email && (
                <p id={fid("email-error")} className={errorText}>
                  {errors.email}
                </p>
              )}
            </div>
          </section>

          <section>
            {mode === "edit" && !settingPassword ? (
              <button type="button" onClick={() => setSettingPassword(true)} className={cn(buttonGhost, "-ml-3 min-h-[36px] px-3")}>
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                Reset password
              </button>
            ) : (
              <>
                {mode === "edit" && <p className="mb-3 text-sm text-muted">Set a new password. Leave it blank to keep the current one.</p>}
                <label htmlFor={fid("password")} className={cn(labelText, "mb-2")}>
                  {mode === "edit" ? "New password" : "Password"}
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative min-w-0 flex-1">
                    <input
                      id={fid("password")}
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setCopied(false);
                        clearError("password");
                      }}
                      autoComplete="new-password"
                      spellCheck={false}
                      disabled={saving}
                      aria-invalid={errors.password ? true : undefined}
                      aria-describedby={errors.password ? fid("password-error") : fid("password-help")}
                      className={cn(inputBase, "pr-[84px] font-mono text-[14px]", errors.password && inputError)}
                      data-testid="password-input"
                    />
                    <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center">
                      <button
                        type="button"
                        onClick={onCopyPassword}
                        disabled={!password || saving}
                        aria-label={copied ? "Password copied" : "Copy password"}
                        title={copied ? "Copied" : "Copy password"}
                        className="grid h-9 w-9 place-items-center rounded-md text-muted hover:bg-accent-soft hover:text-primary disabled:opacity-40"
                      >
                        {copied ? <Check className="h-4 w-4 text-success" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        aria-pressed={showPassword}
                        className="grid h-9 w-9 place-items-center rounded-md text-muted hover:bg-accent-soft hover:text-primary"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                      </button>
                    </div>
                  </div>
                  <button type="button" onClick={onGeneratePassword} disabled={saving} className={cn(buttonSecondary, "shrink-0 whitespace-nowrap")}>
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    Generate password
                  </button>
                </div>
                {errors.password ? (
                  <p id={fid("password-error")} className={errorText}>
                    {errors.password}
                  </p>
                ) : (
                  <p id={fid("password-help")} className={helpText}>
                    At least {PASSWORD_MIN_LENGTH} characters. Copy a generated password before saving: it won&apos;t be shown again.
                  </p>
                )}
              </>
            )}
          </section>

          <fieldset className="min-w-0">
            <legend className={cn(labelText, "mb-2.5")}>Role</legend>
            {isSelf && <p className="-mt-1 mb-2.5 text-[13px] text-muted">You can&apos;t change your own role.</p>}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {ROLE_OPTIONS.map((option) => {
                const checked = role === option.value;
                return (
                  <label
                    key={option.value}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors",
                      checked ? "border-accent/60 bg-accent-tint ring-1 ring-accent/30" : "border-line-strong hover:border-[#c9c4e2]",
                      (isSelf || saving) && "cursor-not-allowed opacity-70"
                    )}
                  >
                    <input
                      type="radio"
                      name={fid("role")}
                      value={option.value}
                      checked={checked}
                      disabled={isSelf || saving}
                      onChange={() => {
                        setRole(option.value);
                        clearError("categoryIds");
                      }}
                      className="mt-1 h-4 w-4 shrink-0 accent-accent"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-primary">{option.title}</span>
                      <span className="mt-0.5 block text-[13px] leading-snug text-muted">{option.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {mode === "edit" && (
            <div>
              <label htmlFor={fid("status")} className={cn(labelText, "mb-2")}>
                Status
              </label>
              <select
                id={fid("status")}
                value={status}
                onChange={(e) => setStatus(e.target.value as UserStatus)}
                disabled={isSelf || saving}
                aria-describedby={fid("status-help")}
                className={cn(selectBase, "sm:max-w-[240px]")}
              >
                {USER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {USER_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              <p id={fid("status-help")} className={helpText}>
                {isSelf ? "You can't disable your own account." : "Disabled users can't sign in and are signed out immediately."}
              </p>
            </div>
          )}

          {role === "administrator" ? (
            <div className="flex items-start gap-3 rounded-lg border border-accent/20 bg-accent-tint px-4 py-3.5 text-sm text-primary">
              <ShieldCheck className="mt-0.5 h-[18px] w-[18px] shrink-0 text-accent" aria-hidden="true" />
              <p>Administrators automatically have access to every category and form. No category assignment is needed.</p>
            </div>
          ) : (
            <fieldset className="min-w-0" aria-describedby={errors.categoryIds ? fid("cat-error") : undefined}>
              <legend className={cn(labelText, "mb-1")}>Category access</legend>
              <p className="mb-2.5 text-[13px] text-muted" aria-live="polite">
                {selected.size} of {categories.length} selected
              </p>
              {demotingAdmin && (
                <p className="mb-3 flex items-start gap-2 text-[13px] text-warning">
                  <Info className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
                  Assign at least one category: this user will lose access to everything else.
                </p>
              )}
              {categories.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">No categories exist yet.</p>
              ) : (
                <div className={cn("rounded-lg border", errors.categoryIds ? "border-danger" : "border-line-strong")}>
                  <div className="flex flex-col gap-2 border-b border-line-soft p-2.5 sm:flex-row sm:items-center">
                    {categories.length > 8 && (
                      <SearchField value={categoryQuery} onChange={setCategoryQuery} placeholder="Filter categories" label="Filter categories" className="flex-1" />
                    )}
                    <div className="flex gap-1 sm:ml-auto">
                      <button
                        type="button"
                        className={cn(buttonGhost, "min-h-[36px] px-3 text-[13px]")}
                        onClick={() => {
                          setSelected((prev) => new Set([...Array.from(prev), ...visibleCategories.map((c) => c.id)]));
                          clearError("categoryIds");
                        }}
                      >
                        Select all
                      </button>
                      <button type="button" className={cn(buttonGhost, "min-h-[36px] px-3 text-[13px]")} onClick={() => setSelected(new Set())}>
                        Clear
                      </button>
                    </div>
                  </div>
                  <ul className="grid max-h-[240px] grid-cols-1 gap-0.5 overflow-y-auto p-1.5 sm:grid-cols-2">
                    {visibleCategories.map((category) => {
                      const checked = selected.has(category.id);
                      return (
                        <li key={category.id}>
                          <label
                            className={cn(
                              "flex min-h-[40px] cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
                              checked ? "bg-accent-tint font-semibold text-primary" : "text-ink-soft hover:bg-surface-hover"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={saving}
                              onChange={() => toggleCategory(category.id)}
                              className="h-4 w-4 shrink-0 accent-accent"
                            />
                            <span className="min-w-0 truncate">{category.name}</span>
                          </label>
                        </li>
                      );
                    })}
                    {visibleCategories.length === 0 && <li className="col-span-full px-3 py-4 text-center text-sm text-muted">No categories match.</li>}
                  </ul>
                </div>
              )}
              {errors.categoryIds && (
                <p id={fid("cat-error")} className={errorText} data-error-target tabIndex={-1}>
                  {errors.categoryIds}
                </p>
              )}
            </fieldset>
          )}
        </DialogBody>

        <DialogFooter>
          <button type="button" onClick={onClose} disabled={saving} className={buttonSecondary}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={cn(buttonPrimary, "sm:min-w-[140px]")}>
            {saving && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {saving ? "Saving…" : mode === "create" ? "Create user" : "Save changes"}
          </button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
