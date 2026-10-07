"use client";

import { CircleAlert, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { alertError, buttonPrimary, errorText, inputBase, inputError, labelText } from "@/components/ui/classes";

type FieldErrors = { email?: string; password?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setFormError(null);
    const errors: FieldErrors = {};
    if (!email.trim()) errors.email = "Enter your email address.";
    else if (!EMAIL_RE.test(email.trim())) errors.email = "Enter a valid email address.";
    if (!password) errors.password = "Enter your password.";
    setFieldErrors(errors);
    if (errors.email) return emailRef.current?.focus();
    if (errors.password) return passwordRef.current?.focus();

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, next }),
      });
      const body = (await res.json().catch(() => ({}))) as { redirectTo?: string; message?: string };
      if (res.ok) {
        // A full navigation renders the app fresh with the new session.
        window.location.assign(body.redirectTo ?? "/forms");
        return;
      }
      if (res.status === 401) {
        setFormError("The email or password is incorrect.");
        setPassword("");
        passwordRef.current?.focus();
      } else if ([400, 403, 429].includes(res.status)) {
        setFormError(body.message ?? "Unable to sign in.");
      } else {
        setFormError("Something went wrong on our side. Please try again in a moment.");
      }
    } catch {
      setFormError("We couldn't reach the server. Check your connection and try again.");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5" aria-busy={loading}>
      {formError && (
        <div role="alert" className={alertError}>
          <CircleAlert className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          <p>{formError}</p>
        </div>
      )}

      <div>
        <label htmlFor="login-email" className={cn(labelText, "mb-2")}>
          Email
        </label>
        <input
          ref={emailRef}
          id="login-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined }));
          }}
          disabled={loading}
          placeholder="name@example.com"
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
          className={cn(inputBase, "min-h-[48px]", fieldErrors.email && inputError)}
        />
        {fieldErrors.email && (
          <p id="login-email-error" className={errorText}>
            {fieldErrors.email}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="login-password" className={cn(labelText, "mb-2")}>
          Password
        </label>
        <div className="relative">
          <input
            ref={passwordRef}
            id="login-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined }));
            }}
            disabled={loading}
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
            className={cn(inputBase, "min-h-[48px] pr-12", fieldErrors.password && inputError)}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-muted transition-colors hover:bg-accent-soft hover:text-primary"
          >
            {showPassword ? <EyeOff className="h-[18px] w-[18px]" aria-hidden="true" /> : <Eye className="h-[18px] w-[18px]" aria-hidden="true" />}
          </button>
        </div>
        {fieldErrors.password && (
          <p id="login-password-error" className={errorText}>
            {fieldErrors.password}
          </p>
        )}
      </div>

      <button type="submit" disabled={loading} className={cn(buttonPrimary, "min-h-[48px] w-full text-[15px]")}>
        {loading && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
