import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { findPage, listPages } from '../../lib/pages';
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

  return page ? { title: page.name, description: page.description ?? undefined } : {};
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const route = routeOf((await params).slug);
  const page = await findPage(route);

  if (page) return <RenderPage page={page} />;

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
