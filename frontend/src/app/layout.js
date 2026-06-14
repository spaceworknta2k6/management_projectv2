import { Be_Vietnam_Pro, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const beVietnamPro = Be_Vietnam_Pro({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin', 'vietnamese'],
  variable: '--font-be-vietnam',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata = {
  title: 'Karl - Quản lý Đồ án Tốt nghiệp',
  description: 'Hệ thống quản lý đồ án tốt nghiệp dành cho Trường Đại học Phenikaa',
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi" className={`${beVietnamPro.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const observer = new MutationObserver((mutations) => {
                  for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                      if (node.tagName === 'NEXTJS-PORTAL') {
                        node.remove();
                      }
                    }
                  }
                });
                observer.observe(document.documentElement, { childList: true, subtree: true });
                window.addEventListener('DOMContentLoaded', () => {
                  document.querySelectorAll('nextjs-portal').forEach(el => el.remove());
                });
              })();
            `,
          }}
        />
        {children}
      </body>
    </html>
  );
}
