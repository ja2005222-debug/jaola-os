import './globals.css';

export const metadata = { title: 'delev', description: 'مبني بواسطة JAOLA OS' };

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
