import home from '../builderblok/pages/home.json';

/* Placeholder until @builderblok/next renders the block tree. */
export default function Page() {
  return (
    <main style={{ fontFamily: 'system-ui', padding: '4rem 1.5rem', maxWidth: 720, margin: '0 auto' }}>
      <h1>{home.title}</h1>
      <p>This site is managed by BuilderBlok. Pages are stored in <code>builderblok/</code>.</p>
    </main>
  );
}
