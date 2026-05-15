import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lab Milvus",
  description: "Búsqueda semántica sobre ordenanzas municipales",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={geist.className}>
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6">
          <span className="font-semibold text-blue-700 text-lg">Lab Milvus</span>
          <Link href="/" className="text-sm text-gray-700 hover:text-blue-700 transition-colors">
            Dashboard
          </Link>
          <Link href="/search" className="text-sm text-gray-700 hover:text-blue-700 transition-colors">
            Buscar
          </Link>
          <Link href="/upload" className="text-sm text-gray-700 hover:text-blue-700 transition-colors">
            Subir PDF
          </Link>
          <Link href="/chat" className="text-sm font-medium text-blue-700 hover:text-blue-800 transition-colors">
            Chat ✦
          </Link>
        </nav>
        <main className="max-w-4xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
