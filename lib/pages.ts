import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Interaction } from './interactions';

/** The shapes BuilderBlok commits into `builderblok/`. */
export type PageBlock = {
  id: string;
  type: string;
  props: Record<string, string | number | boolean>;
  /** breakpoints, plus hover / focus / active states that apply at every width */
  styles: Partial<Record<'desktop' | 'tablet' | 'mobile' | 'hover' | 'focus' | 'active', Record<string, string>>>;
  interactions?: Interaction[];
  children?: PageBlock[];
  /** collection blocks only: the rows BuilderBlok resolved at publish */
  items?: Record<string, string>[];
  /** language switchers only: this page in each published language */
  links?: { locale: string; label: string; href: string; current: boolean }[];
};

export type PageFile = {
  schemaVersion: number;
  name: string;
  slug: string;
  route: string;
  /** schema v2+ — older page files have neither, and render in the site's default language */
  locale?: string;
  dir?: 'ltr' | 'rtl';
  /** this page's route in every published language */
  alternates?: Record<string, string>;
  description: string | null;
  breakpoints: { tablet: number; mobile: number };
  blocks: PageBlock[];
  /** the page's hand-written CSS, applied after the blocks' own rules */
  customCss?: string;
  /** the page's hand-written script, run once the page has loaded */
  customJs?: string;
};

export type ManifestPage = {
  route: string;
  name: string;
  file: string;
  /** schema v2+ */
  locale?: string;
  alternates?: Record<string, string>;
};

type Manifest = {
  schemaVersion: number;
  /** schema v2+ — the languages the site is published in, the default first */
  defaultLocale?: string;
  locales?: string[];
  /** the live URL, for absolute canonical and hreflang links; null before hosting is set up */
  siteUrl?: string | null;
  pages: ManifestPage[];
};

const ROOT = path.join(process.cwd(), 'builderblok');

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(ROOT, file), 'utf8')) as T;
}

export async function readManifest() {
  return await readJson<Manifest>('site.json');
}

export async function listPages() {
  return (await readManifest()).pages;
}

/** `/` and `/pricing` style routes, matched against the manifest. */
export async function findPage(route: string): Promise<PageFile | null> {
  const entry = (await listPages()).find((page) => page.route === route);

  return entry ? await readJson<PageFile>(entry.file) : null;
}
