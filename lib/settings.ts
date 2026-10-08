import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * `builderblok/settings.json` — what BuilderBlok's Site settings publish:
 * tracking, code on every page, and sitemap rules. robots.txt and redirects
 * are plain files in `public/`, so they need nothing here.
 */
export type SiteSettings = {
  schemaVersion: number;
  tracking: { gtmId: string | null; gaId: string | null };
  code: { head: string | null; bodyStart: string | null; bodyEnd: string | null };
  /** false adds a site-wide noindex */
  indexing: boolean;
  sitemap: { enabled: boolean; exclude: string[] };
};

const DEFAULTS: SiteSettings = {
  schemaVersion: 1,
  tracking: { gtmId: null, gaId: null },
  code: { head: null, bodyStart: null, bodyEnd: null },
  indexing: true,
  sitemap: { enabled: true, exclude: [] },
};

/** A site that never published settings has no file — it gets the defaults. */
export async function readSettings(): Promise<SiteSettings> {
  try {
    const raw = JSON.parse(await readFile(path.join(process.cwd(), 'builderblok', 'settings.json'), 'utf8'));

    return {
      ...DEFAULTS,
      ...raw,
      tracking: { ...DEFAULTS.tracking, ...raw.tracking },
      code: { ...DEFAULTS.code, ...raw.code },
      sitemap: { ...DEFAULTS.sitemap, ...raw.sitemap },
    };
  } catch {
    return DEFAULTS;
  }
}

/**
 * `/admin` matches itself; `/blog/*` matches `/blog` and everything under it;
 * `/blog*` is a plain prefix, so it takes `/blogroll` too.
 */
export function isExcluded(route: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    if (pattern.endsWith('/*')) {
      const dir = pattern.slice(0, -2);

      return route === (dir || '/') || route.startsWith(`${dir}/`);
    }

    return pattern.endsWith('*') ? route.startsWith(pattern.slice(0, -1)) : route === pattern;
  });
}
