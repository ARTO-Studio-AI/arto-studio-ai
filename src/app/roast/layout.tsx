import type { Metadata } from "next";

export const metadata: Metadata = {
  // v2 (2026-10-06): en espanol (mercado principal) y sin la frase de "Fortune 500",
  // que no esta respaldada. La pagina cambia a ingles con ?lang=en.
  title: "Brand Roast: análisis honesto de tu marca, gratis | ARTO Studio AI",
  description:
    "Leemos tu sitio y calificamos tu marca en Estrategia, Creatividad, Narrativa y Digital con la metodología de ARTO, agencia de marca desde 2009. Gratis, sin registro. Also in English.",
  openGraph: {
    title: "Brand Roast: ¿qué tan fuerte es tu marca, de verdad?",
    description:
      "Tu marca, calificada sin rodeos en Estrategia, Creatividad, Narrativa y Digital con la metodología de ARTO. Gratis.",
    type: "website",
    images: [
      {
        url: "/roast/og?brand=Your+Brand&score=5.2&s=6&c=4&n=5&d=4",
        width: 1200,
        height: 630,
        alt: "ARTO Brand Roast — Free Brand Analysis",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Brand Roast: ¿qué tan fuerte es tu marca, de verdad?",
    description: "Tu marca, calificada sin rodeos con la metodología de ARTO. Gratis.",
    images: ["/roast/og?brand=Your+Brand&score=5.2&s=6&c=4&n=5&d=4"],
  },
};

export default function RoastLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
