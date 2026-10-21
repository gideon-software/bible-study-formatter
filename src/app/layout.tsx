import type { Metadata } from "next";
import React from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bible Study Formatter | Gideon Software Solutions",
  description:
    "Generate beautifully formatted Google Docs of Scripture for Bible studies, sermon prep, and personal journals.",
  keywords: ["Bible", "Scripture", "Formatter", "Google Docs", "ESV", "Study"],
  icons: {
    icon: "https://storage.googleapis.com/bible-study-formatter/images/png/bsf-32x32.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  );
}
