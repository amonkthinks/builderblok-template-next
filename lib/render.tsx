import type { CSSProperties, ReactNode } from 'react';
import Script from 'next/script';
import type { PageBlock, PageFile } from './pages';
import { hiddenAtStart, hideUntilReady, runtimeInteractions, runtimeScript } from './interactions';

/**
 * Renders a BuilderBlok page the way the builder's canvas draws it.
 *
 * Styles cascade desktop → tablet → mobile like max-width media queries, so
 * desktop goes inline-free into a class and the smaller breakpoints become
 * `@media` rules — inline styles could not respond to the viewport.
 */
export function RenderPage({ page }: { page: PageFile }) {
  /* animations the builder's section presets refer to by name */
  const css: string[] = [KEYFRAMES];

  const walk = (blocks: PageBlock[]) =>
    blocks.forEach((block) => {
      css.push(rule(block, 'desktop'));
      block.children && walk(block.children);
    });

  walk(page.blocks);

  for (const bp of ['tablet', 'mobile'] as const) {
    const rules: string[] = [];
    const collect = (blocks: PageBlock[]) =>
      blocks.forEach((block) => {
        rules.push(rule(block, bp));
        block.children && collect(block.children);
      });
    collect(page.blocks);

    const body = rules.filter(Boolean).join('');
    if (body) css.push(`@media (max-width:${page.breakpoints[bp]}px){${body}}`);
  }

  const all: PageBlock[] = [];
  const flatten = (blocks: PageBlock[]) =>
    blocks.forEach((block) => {
      all.push(block);
      block.children && flatten(block.children);
    });
  flatten(page.blocks);

  /* hover / focus / pressed apply at every width, after the breakpoints they layer over */
  for (const block of all) {
    for (const [state, pseudo] of STATES) css.push(rule(block, state, pseudo));
  }

  const interactions = runtimeInteractions(all);
  css.push(hideUntilReady(hiddenAtStart(interactions)));

  return (
    <>
      {/* marks the page as scripted before anything paints, so an element that
          animates in is hidden from the start — without JS it simply shows */}
      {interactions.length > 0 && (
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('bb-js')" }} />
      )}
      <style dangerouslySetInnerHTML={{ __html: css.filter(Boolean).join('') }} />
      {/* after the block rules, so it wins at equal specificity; `<\/style` is
          the same CSS but cannot end the tag early */}
      {page.customCss && (
        <style dangerouslySetInnerHTML={{ __html: page.customCss.replace(/<\/style/gi, '<\\/style') }} />
      )}
      {page.blocks.map((block) => (
        <Block key={block.id} block={block} />
      ))}
      {interactions.length > 0 && (
        <Script id={`bb-ix-${page.slug}`} strategy="afterInteractive">
          {runtimeScript(interactions)}
        </Script>
      )}
      {/* its own function scope, so its declarations do not collide with anything global */}
      {page.customJs && (
        <Script id={`bb-js-${page.slug}`} strategy="afterInteractive">
          {`(function(){\n${page.customJs}\n})();`}
        </Script>
      )}
    </>
  );
}

const KEYFRAMES = '@keyframes bb-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}';

const cls = (block: PageBlock) => `bb-${block.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;

/** The element's own class plus the ones set in the builder, for the page's custom CSS. */
const classes = (block: PageBlock) =>
  [cls(block), ...str(block.props.className).split(/\s+/).filter((name) => /^-?[_a-zA-Z][\w-]*$/.test(name))].join(' ');

const STATES = [
  ['hover', ':hover'],
  ['focus', ':focus'],
  ['active', ':active'],
] as const;

type StyleKey = 'desktop' | 'tablet' | 'mobile' | (typeof STATES)[number][0];

/** camelCase → kebab-case, and nothing that could close the style tag. */
function rule(block: PageBlock, key: StyleKey, pseudo = ''): string {
  const styles = block.styles?.[key];
  if (!styles) return '';

  const decls = Object.entries(styles)
    .filter(([, value]) => value !== '' && !/[<>{};]/.test(String(value)))
    .map(([key, value]) => `${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:${value}`)
    .join(';');

  return decls ? `.${cls(block)}${pseudo}{${decls}}` : '';
}

const str = (value: unknown) => (value === undefined || value === null ? '' : String(value));

/** Only http(s), mailto, tel and relative links — never `javascript:`. */
const safeHref = (value: unknown) => {
  const href = str(value).trim();
  return /^(https?:|mailto:|tel:|\/|#)/i.test(href) ? href : '#';
};

function Block({ block }: { block: PageBlock }): ReactNode {
  const { props } = block;
  const children = block.children?.map((child) => <Block key={child.id} block={child} />);
  const common = { className: classes(block), id: props.htmlId ? str(props.htmlId) : undefined };

  switch (block.type) {
    case 'section':
      return <section {...common}>{children}</section>;
    case 'container':
    case 'div':
    case 'grid':
      return <div {...common}>{children}</div>;
    case 'heading': {
      const level = /^h[1-6]$/.test(str(props.level)) ? str(props.level) : 'h2';
      const Tag = level as 'h2';
      return <Tag {...common}>{str(props.text)}</Tag>;
    }
    case 'paragraph':
      return <p {...common} style={{ whiteSpace: 'pre-line' }}>{str(props.text)}</p>;
    case 'link':
    case 'button':
      return (
        <a
          {...common}
          href={safeHref(props.href)}
          {...(props.newTab ? { target: '_blank', rel: 'noreferrer' } : {})}
        >
          {str(props.text)}
        </a>
      );
    case 'image':
      return props.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img {...common} src={str(props.src)} alt={str(props.alt)} />
      ) : null;
    case 'video': {
      const src = embedUrl(str(props.url));
      return src ? (
        <div {...common} style={{ position: 'relative' } as CSSProperties}>
          <iframe src={src} title="Video" allowFullScreen style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} />
        </div>
      ) : null;
    }
    case 'divider':
      return <hr {...common} />;
    case 'languages':
      return (
        <nav {...common} aria-label="Language">
          {(block.links ?? []).map((link) => (
            <a
              key={link.locale}
              href={link.href}
              hrefLang={link.locale}
              lang={link.locale}
              aria-current={link.current ? 'page' : undefined}
              style={{ color: 'inherit', fontWeight: link.current ? 600 : 400, textDecoration: link.current ? 'none' : 'underline' }}
            >
              {link.label}
            </a>
          ))}
        </nav>
      );
    case 'collection':
      return <Collection {...common} items={block.items ?? []} />;
    default:
      return null;
  }
}

const TITLE_KEY = /(^|_)(title|heading|headline|name|question)$/i;
const IMAGE_URL = /^https?:\/\/\S+\.(png|jpe?g|gif|webp|avif|svg)(\?\S*)?$/i;
const LINK_URL = /^(https?:\/\/|\/)\S*$/;

/**
 * A collection's rows as a list of cards. Each row is key → value from the
 * content store: the title-like key becomes the card heading, an image URL
 * its picture, a URL a link, and everything else a line of text.
 */
function Collection({ items, className, id }: { items: Record<string, string>[]; className: string; id?: string }) {
  if (!items.length) return null;

  return (
    <div className={className} id={id} style={{ display: 'grid', gap: '16px' }}>
      {items.map((row, index) => {
        const entries = Object.entries(row);
        const title = entries.find(([key]) => TITLE_KEY.test(key));
        const image = entries.find(([, value]) => IMAGE_URL.test(value));
        const rest = entries.filter((entry) => entry !== title && entry !== image);

        return (
          <article key={index} style={{ padding: '20px', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
            {image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image[1]} alt={title?.[1] ?? ''} style={{ width: '100%', borderRadius: '8px', marginBottom: '12px' }} />
            )}
            {title && <h3 style={{ margin: '0 0 8px', fontSize: '18px' }}>{title[1]}</h3>}
            {rest.map(([key, value]) =>
              LINK_URL.test(value) ? (
                <a key={key} href={safeHref(value)} style={{ display: 'block', marginTop: '4px' }}>{key.replace(/_/g, ' ')}</a>
              ) : (
                <p key={key} style={{ margin: '0 0 6px', whiteSpace: 'pre-line' }}>{value}</p>
              ),
            )}
          </article>
        );
      })}
    </div>
  );
}

function embedUrl(url: string) {
  const youtube = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
  if (youtube) return `https://www.youtube.com/embed/${youtube[1]}`;

  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;

  return null;
}
