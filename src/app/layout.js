import { Geist, Geist_Mono, Sora } from "next/font/google";
import Providers from "./providers.jsx";
import { Header } from "../components/Header/Header.jsx";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const sora = Sora({
  weight: ["700", "800"],
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata = {
  title: "Comparación Proveedores · Argentina Color",
  description: "Buscá precios, stock y condiciones en todos tus proveedores desde un solo lugar.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${sora.variable} antialiased`}
      >
        <Providers>
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  );
}
