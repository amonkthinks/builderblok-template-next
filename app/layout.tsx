import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import config from '../builderblok/config.json';
import { readSettings } from '../lib/settings';
import { BodyCode, GtmNoScript, gaHead, gtmHead, headElements } from '../lib/siteCode';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await readSettings();

  return {
    title: config.site.name,
    /* robots.txt's Disallow stops crawling; only noindex keeps a page out of results */
    ...(settings.indexing ? {} : { robots: { index: false, follow: false } }),
  };
}

/*
 * A static export has one root layout for every page, so `lang` here is only
 * the default. Each page sets its own `lang` / `dir` on <html> before first
 * paint (see LocaleScript) and on its wrapper, which is what screen readers
 * and the browser's text direction actually follow.
 *
 * It is also where the site-wide code from Site settings goes, so it is on
 * every page without being in any page file: Tag Manager or Analytics first,
 * then the hand-written head code, which can rely on them being there.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const { tracking, code } = await readSettings();

  return (
    <html lang={config.site.defaultLocale} suppressHydrationWarning>
      <head>
        {tracking.gtmId && gtmHead(tracking.gtmId)}
        {tracking.gaId && gaHead(tracking.gaId)}
        {headElements(code.head, 'bb-head')}
      </head>
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        {tracking.gtmId && <GtmNoScript gtmId={tracking.gtmId} />}
        <BodyCode html={code.bodyStart} id="bb-body-start" />
        {children}
        <BodyCode html={code.bodyEnd} id="bb-body-end" />
      </body>
    </html>
  );
}
