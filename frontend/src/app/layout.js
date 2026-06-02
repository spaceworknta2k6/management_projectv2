import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geist = Geist({
  variable: '--font-geist',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata = {
  title: 'Episteme — Quản lý Đồ án Tốt nghiệp',
  description: 'Hệ thống quản lý đồ án tốt nghiệp dành cho Đại học Bách Khoa Hà Nội',
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi" className={`${geist.variable} ${geistMono.variable}`}>
      <body>
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
            `
          }}
        />
        {children}
      </body>
    </html>
  );
}
