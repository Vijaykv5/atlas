import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atlas | Every place has a story",
  description:
    "Drop memories onto an interactive globe and anchor them permanently on Avalanche.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full bg-black text-white">{children}</body>
    </html>
  );
}
