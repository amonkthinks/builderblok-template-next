import type { ReactNode } from 'react';
import config from '../builderblok/config.json';

export const metadata = { title: config.site.name };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={config.site.defaultLocale}>
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>{children}</body>
    </html>
  );
}
