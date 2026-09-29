import { readFile } from 'node:fs/promises';
import path from 'node:path';

/** The shapes BuilderBlok commits into `builderblok/`. */
export type PageBlock = {
  id: string;
  type: string;
  props: Record<string, string | number | boolean>;
  styles: Partial<Record<'desktop' | 'tablet' | 'mobile', Record<string, string>>>;
  children?: PageBlock[];
  /** collection blocks only: the rows BuilderBlok resolved at publish */
  items?: Record<string, string>[];
};

export type PageFile = {
  schemaVersion: number;
  name: string;
  slug: string;
  route: string;
  description: string | null;
  breakpoints: { tablet: number; mobile: number };
  blocks: PageBlock[];
};

type Manifest = { schemaVersion: number; pages: { route: string; name: string; file: string }[] };

const ROOT = path.join(process.cwd(), 'builderblok');

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(ROOT, file), 'utf8')) as T;
}

export async function listPages() {
  return (await readJson<Manifest>('site.json')).pages;
}

/** `/` and `/pricing` style routes, matched against the manifest. */
export async function findPage(route: string): Promise<PageFile | null> {
  const entry = (await listPages()).find((page) => page.route === route);

  return entry ? await readJson<PageFile>(entry.file) : null;
}
