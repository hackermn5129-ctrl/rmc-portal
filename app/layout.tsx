import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import "@fontsource/noto-nastaliq-urdu/400.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "RMC Portal",
  description: "Rashid Minhas Higher Secondary School Chichawatni: student, parent, teacher and admin portal",
};

export const viewport: Viewport = { themeColor: "#F1F4F7", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col">{children}</div>
      </body>
    </html>
  );
}
