import "./globals.css";

export const metadata = {
  title: "CashBox Cloud",
  description: "Tolan company cashbox and inventory management",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
