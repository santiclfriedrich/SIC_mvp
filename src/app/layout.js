import { Work_Sans, Geist_Mono } from "next/font/google";
import Providers from "./providers.jsx";
import { Header } from "../components/Header/Header.jsx";
import "./globals.css";

const workSans = Work_Sans({
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-work-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
        className={`${workSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  );
}
