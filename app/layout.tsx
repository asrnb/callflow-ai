import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ContentFlow AI",
    template: "%s | ContentFlow AI"
  },
  description: "A production-oriented SaaS MVP for asynchronous AI content generation."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
