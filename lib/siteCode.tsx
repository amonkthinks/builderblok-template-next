import { createElement, type ReactNode } from 'react';

/**
 * Hand-written HTML for `<head>`, as React elements.
 *
 * A static export has no hook for pasting a string into `<head>`, so the few
 * tags that belong there — meta, link, base, title, script, style, noscript —
 * are read out of it and rendered one by one. They are server-rendered into
 * the HTML file, so a `<script>` runs as the browser parses it, and a
 * verification `<meta>` is there for crawlers that never run JavaScript.
 * Anything else (stray text, `<div>`s) has no place in `<head>` and is dropped.
 */
const VOID = new Set(['meta', 'link', 'base']);
const PAIRED = new Set(['script', 'style', 'noscript', 'title']);

/* HTML attribute → React prop, for the ones that differ */
const PROPS: Record<string, string> = {
  class: 'className',
  charset: 'charSet',
  'http-equiv': 'httpEquiv',
  crossorigin: 'crossOrigin',
  referrerpolicy: 'referrerPolicy',
  nomodule: 'noModule',
  fetchpriority: 'fetchPriority',
  imagesrcset: 'imageSrcSet',
  imagesizes: 'imageSizes',
};

/* attributes that are on/off; any other bare attribute (`crossorigin`) means its empty value */
const BOOLEAN = new Set(['async', 'defer', 'nomodule', 'disabled']);

const TAG = /<(\w+)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*\/?>/g;
const ATTR = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

function attributes(source: string): Record<string, string | boolean> {
  const props: Record<string, string | boolean> = {};

  for (const [, name, double, single, bare] of source.matchAll(ATTR)) {
    const key = name!.toLowerCase();

    props[PROPS[key] ?? key] = double ?? single ?? bare ?? (BOOLEAN.has(key) ? true : '');
  }

  return props;
}

export function headElements(html: string | null, keyPrefix: string): ReactNode[] {
  if (!html?.trim()) return [];

  /* comments can hold a whole commented-out snippet; they must not be parsed */
  const source = html.replace(/<!--[\s\S]*?-->/g, '');
  const elements: ReactNode[] = [];

  TAG.lastIndex = 0;

  for (let match = TAG.exec(source); match; match = TAG.exec(source)) {
    const tag = match[1]!.toLowerCase();
    const props = { ...attributes(match[2] ?? ''), key: `${keyPrefix}-${elements.length}` };

    if (VOID.has(tag)) {
      elements.push(createElement(tag, props));
      continue;
    }

    if (!PAIRED.has(tag)) continue;

    const close = source.toLowerCase().indexOf(`</${tag}`, TAG.lastIndex);
    const inner = close === -1 ? '' : source.slice(TAG.lastIndex, close);

    if (close !== -1) TAG.lastIndex = source.indexOf('>', close) + 1 || source.length;

    elements.push(
      tag === 'title'
        ? createElement('title', props, inner)
        : createElement(tag, { ...props, ...(inner.trim() ? { dangerouslySetInnerHTML: { __html: inner } } : {}) }),
    );
  }

  return elements;
}

/**
 * Hand-written HTML for the start or end of `<body>`. Any markup is allowed
 * here (a chat widget's container, a noscript pixel), so it is written as-is
 * inside a wrapper that takes no space in the layout.
 */
export function BodyCode({ html, id }: { html: string | null; id: string }) {
  if (!html?.trim()) return null;

  return <div id={id} style={{ display: 'contents' }} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Google's own Tag Manager snippet: the loader for `<head>`… */
export function gtmHead(gtmId: string) {
  const id = JSON.stringify(gtmId);

  return (
    <script
      key="bb-gtm"
      dangerouslySetInnerHTML={{
        __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${id});`,
      }}
    />
  );
}

/** …and the fallback right after `<body>` opens, for visitors without JavaScript. */
export function GtmNoScript({ gtmId }: { gtmId: string }) {
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(gtmId)}`}
        height="0"
        width="0"
        style={{ display: 'none', visibility: 'hidden' }}
      />
    </noscript>
  );
}

/** Google Analytics 4 through gtag.js. */
export function gaHead(gaId: string) {
  return [
    <script key="bb-ga-src" async src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`} />,
    <script
      key="bb-ga"
      dangerouslySetInnerHTML={{
        __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(gaId)});`,
      }}
    />,
  ];
}
