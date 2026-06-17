import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Carvis",
  description: "AI co-pilot for Canvas LMS — command your academic trajectory.",
  manifest: "/manifest.webmanifest",
  themeColor: "#060911",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
