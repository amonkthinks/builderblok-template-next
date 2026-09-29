import type { CSSProperties, ReactNode } from 'react';
import type { PageBlock, PageFile } from './pages';

/**
 * Renders a BuilderBlok page the way the builder's canvas draws it.
 *
 * Styles cascade desktop → tablet → mobile like max-width media queries, so
 * desktop goes inline-free into a class and the smaller breakpoints become
 * `@media` rules — inline styles could not respond to the viewport.
 */
export function RenderPage({ page }: { page: PageFile }) {
  const css: string[] = [];

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

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css.filter(Boolean).join('') }} />
      {page.blocks.map((block) => (
        <Block key={block.id} block={block} />
      ))}
    </>
  );
}

const cls = (block: PageBlock) => `bb-${block.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;

/** camelCase → kebab-case, and nothing that could close the style tag. */
function rule(block: PageBlock, bp: 'desktop' | 'tablet' | 'mobile'): string {
  const styles = block.styles?.[bp];
  if (!styles) return '';

  const decls = Object.entries(styles)
    .filter(([, value]) => value !== '' && !/[<>{};]/.test(String(value)))
    .map(([key, value]) => `${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:${value}`)
    .join(';');

  return decls ? `.${cls(block)}{${decls}}` : '';
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
  const common = { className: cls(block), id: props.htmlId ? str(props.htmlId) : undefined };

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
    /* collections render from a live data source, which the static site does not have yet */
    case 'collection':
      return null;
    default:
      return null;
  }
}

function embedUrl(url: string) {
  const youtube = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
  if (youtube) return `https://www.youtube.com/embed/${youtube[1]}`;

  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;

  return null;
}
