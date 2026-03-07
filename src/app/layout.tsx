import type { Metadata } from "next";
import "./globals.css";
import RootLayoutWrapper from "@/components/RootLayoutWrapper";

export const metadata: Metadata = {
  title: "My Expenses",
  description: "Track your expenses easily",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <RootLayoutWrapper>{children}</RootLayoutWrapper>
      </body>
    </html>
  );
}
