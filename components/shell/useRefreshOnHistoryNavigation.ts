"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Pages whose server-rendered data can change while the person is elsewhere: the catalog (category
 * access can change), submissions and users. The fill page is excluded because it re-reads its
 * draft itself, and the preview page because a form's definition doesn't change at runtime.
 */
const REFRESH_ON_RETURN = /^\/(?:forms(?:\/[^/]+)?|submissions(?:\/[^/]+)?|users)\/?$/;

export function shouldRefreshOnReturn(pathname: string) {
  return REFRESH_ON_RETURN.test(pathname);
}

/**
 * Browser back/forward restores a page from Next.js's client Router Cache without asking the
 * server, so it can show data that changed since (another person's submission, a revoked
 * category). After such a history navigation to a page in the list above, re-fetch its data.
 *
 * Client-side link navigation is covered separately by `staleTimes.dynamic = 0` (next.config.mjs).
 */
export function useRefreshOnHistoryNavigation() {
  const router = useRouter();
  useEffect(() => {
    const onPopState = () => {
      // Run after Next.js has handled the same event and restored the page.
      window.setTimeout(() => {
        const { pathname, search } = window.location;
        // A same-URL navigation fetches this page's current data (staleTimes.dynamic = 0) without
        // clearing the cache of other pages, unlike router.refresh().
        if (shouldRefreshOnReturn(pathname)) router.replace(pathname + search, { scroll: false });
      }, 0);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [router]);
}
