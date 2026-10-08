import type { MetadataRoute } from 'next';
import { readManifest } from '../lib/pages';
import { isExcluded, readSettings } from '../lib/settings';

/* written once at build time, like every page */
export const dynamic = 'force-static';

/**
 * Every page in every language, each listing its translations, so search
 * engines index them all. Needs the live URL — before hosting is set up the
 * manifest has none and the sitemap is empty. Site settings can turn it off,
 * or leave routes out; a site closed to search engines lists nothing.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [manifest, settings] = await Promise.all([readManifest(), readSettings()]);
  const base = manifest.siteUrl?.replace(/\/+$/, '');

  if (!base || !settings.indexing || !settings.sitemap.enabled) return [];

  return manifest.pages
    .filter((page) => !isExcluded(page.route, settings.sitemap.exclude))
    .map((page) => ({
      url: `${base}${page.route}`,
      ...(page.alternates
        ? {
            alternates: {
              languages: Object.fromEntries(
                Object.entries(page.alternates).map(([locale, route]) => [locale, `${base}${route}`]),
              ),
            },
          }
        : {}),
    }));
}
