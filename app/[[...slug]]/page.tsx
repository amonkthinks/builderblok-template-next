import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { findPage, listPages, readManifest } from '../../lib/pages';
import { RenderPage } from '../../lib/render';

type Params = { slug?: string[] };

const routeOf = (slug?: string[]) => `/${(slug ?? []).join('/')}`;

/* every page in the manifest is built ahead of time; nothing else exists */
export const dynamicParams = false;

export async function generateStaticParams(): Promise<Params[]> {
  const pages = await listPages();

  /* an empty site still needs one param, or the build has no pages at all */
  if (!pages.length) return [{ slug: [] }];

  return pages.map((page) => ({ slug: page.route.split('/').filter(Boolean) }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const page = await findPage(routeOf((await params).slug));

  if (!page) return {};

  const manifest = await readManifest();

  /* hreflang links tell search engines which URL is which language, so each
     visitor is sent to their own; x-default is the page in the default language */
  const languages = page.alternates
    ? {
        ...page.alternates,
        ...(manifest.defaultLocale && page.alternates[manifest.defaultLocale]
          ? { 'x-default': page.alternates[manifest.defaultLocale]! }
          : {}),
      }
    : undefined;

  return {
    title: page.name,
    description: page.description ?? undefined,
    ...(manifest.siteUrl ? { metadataBase: new URL(manifest.siteUrl) } : {}),
    alternates: { canonical: page.route, ...(languages ? { languages } : {}) },
    ...(page.locale ? { openGraph: { locale: page.locale.replace('-', '_') } } : {}),
  };
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const route = routeOf((await params).slug);
  const page = await findPage(route);

  if (page) {
    return (
      <>
        {page.locale && <LocaleScript locale={page.locale} dir={page.dir ?? 'ltr'} />}

        <div lang={page.locale} dir={page.dir}>
          <RenderPage page={page} />
        </div>
      </>
    );
  }

  /* a fresh site before its first publish */
  if (route === '/') {
    return (
      <main style={{ fontFamily: 'system-ui', padding: '4rem 1.5rem', maxWidth: 720, margin: '0 auto' }}>
        <h1>Nothing published yet</h1>
        <p>Build a page in BuilderBlok and press Publish — it will appear here.</p>
      </main>
    );
  }

  notFound();
}

/** Sets <html lang/dir> for this page before it paints — the root layout cannot vary per page. */
function LocaleScript({ locale, dir }: { locale: string; dir: 'ltr' | 'rtl' }) {
  const code = `document.documentElement.lang=${JSON.stringify(locale)};document.documentElement.dir=${JSON.stringify(dir)};`;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
