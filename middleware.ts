import { NextResponse, type NextRequest } from "next/server";
import { LOGIN_PATH, SESSION_COOKIE_NAME, isAppPath } from "@/lib/config";

/**
 * Edge middleware: security headers for every response and a fast first gate for protected routes.
 *
 * The gate only checks that a session cookie is present (there is no database at the edge). Every
 * page and API route validates the session and the user's permissions on the server itself.
 *
 * The Content-Security-Policy uses a per-request nonce. Next.js reads the nonce from the request's
 * CSP header and adds it to its own scripts, so no inline script without the nonce can run.
 */

const isDev = process.env.NODE_ENV !== "production";

function contentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // React's style attributes (e.g. progress bar widths) need inline styles; no inline scripts are allowed.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

function securityHeaders(csp: string): Record<string, string> {
  return {
    "Content-Security-Policy": csp,
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "X-Robots-Tag": "noindex, nofollow",
    // Pages contain user-specific data: never cache them in shared or browser caches.
    "Cache-Control": "no-store, max-age=0",
    ...(isDev ? {} : { "Strict-Transport-Security": "max-age=63072000; includeSubDomains" }),
  };
}

function isProtected(pathname: string) {
  if (pathname.startsWith("/api/")) return !pathname.startsWith("/api/auth/");
  return isAppPath(pathname);
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);
  const headers = securityHeaders(csp);
  const withHeaders = (response: NextResponse) => {
    for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
    return response;
  };

  if (isProtected(pathname) && !req.cookies.get(SESSION_COOKIE_NAME)?.value) {
    if (pathname.startsWith("/api/")) {
      return withHeaders(NextResponse.json({ error: "unauthenticated", message: "Please sign in to continue." }, { status: 401 }));
    }
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = LOGIN_PATH;
    loginUrl.search = `?next=${encodeURIComponent(pathname + search)}`;
    return withHeaders(NextResponse.redirect(loginUrl));
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("Content-Security-Policy", csp);
  requestHeaders.set("x-nonce", nonce);
  return withHeaders(NextResponse.next({ request: { headers: requestHeaders } }));
}

export const config = {
  matcher: [
    // Everything except static assets, which carry their own long-lived caching.
    { source: "/((?!_next/static|_next/image|favicon.ico|icon.svg).*)" },
  ],
};
