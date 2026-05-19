import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Disclaimer } from "@/components/Disclaimer";

export const metadata: Metadata = {
  title: "Cooking Impulsively",
  description:
    "Adapt any internet recipe to the Impulse induction cooktop. Independent project, not affiliated with Impulse Labs.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
            <Link href="/" className="font-semibold text-impulse-700">
              Cooking Impulsively
            </Link>
            <nav className="text-sm text-stone-600 flex gap-4">
              <Link href="/new" className="hover:text-impulse-700">
                New card
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">
          <div className="mx-auto max-w-4xl px-4 py-8">{children}</div>
        </main>
        <footer className="border-t border-stone-200 bg-white">
          <div className="mx-auto max-w-4xl px-4 py-4">
            <Disclaimer compact />
          </div>
        </footer>
      </body>
    </html>
  );
}
