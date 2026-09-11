import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { localeOf, pageMetadata } from "@/lib/seo";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata("work", localeOf(locale));
}

// Portfolio data from ARTO Portafolio 2026 (Notion).
// This will eventually be fetched from Notion API at build time. Project
// names, client names, and one-paragraph project descriptions stay in
// their original language — they're brand-tied content, and the chrome
// (headings, stats labels, CTA) is the part the visitor reads first.
const projects = [
  {
    slug: "grupo-proeza-2025",
    name: "Zano Fresh",
    client: "Grupo Proeza",
    year: "2025",
    categories: ["Branding", "Web Development"],
    industry: "Industrial",
    location: "Monterrey, MX",
    tags: ["Corporativo", "B2B", "Digital", "Identidad Visual"],
    description:
      "Branding and web development for Grupo Proeza. Strengthened the brand system and translated it into a clear, responsive web experience that communicates the group's platform and business units.",
    image: "/work/grupo-proeza-2025.gif",
  },
  {
    slug: "gse-biomedical",
    name: "GSE Biomedical",
    client: "Kolab Ventures",
    year: "2024",
    categories: ["Branding"],
    industry: "Salud",
    location: "Hermosillo, MX",
    tags: ["Corporativo", "Identidad Visual", "Estrategia"],
    description:
      "Brand identity for GSE Biomedical in the health and medical technology sector. Created a clear, professional visual identity to build recognition and credibility in a specialized market.",
    image: "/work/gse-biomedical.jpg",
  },
  {
    slug: "grupo-proeza-ecosystem",
    name: "ZANO",
    client: "Grupo Proeza",
    year: "2023",
    categories: ["Branding", "Brand Ecosystem"],
    industry: "Industrial",
    location: "Monterrey, MX",
    tags: ["Corporativo", "B2B", "Identidad Visual", "Estrategia", "Digital"],
    description:
      "Brand ecosystem for Grupo Proeza. Structured a consistent brand system across business units and channels, creating visual clarity and narrative coherence.",
    image: "/work/grupo-proeza-ecosystem.gif",
  },
  {
    slug: "poder-partners",
    name: "Poder Partners",
    client: "Poder Partners",
    year: "2022",
    categories: ["Branding"],
    industry: "Finanzas",
    location: "New York, US",
    tags: ["Corporativo", "Identidad Visual"],
    description:
      "Branding for a technology investment vehicle. Built a contemporary, sophisticated visual identity that communicates vision, solidity, and purpose.",
    image: "/work/poder-partners.jpg",
  },
  {
    slug: "mr-fox",
    name: "Mr. Fox",
    client: "Mr. Fox",
    year: "2021",
    categories: ["UI Design", "Shopify Development"],
    industry: "Retail",
    location: "Mexico City, MX",
    tags: ["Digital", "Retail"],
    description:
      "UI design and Shopify development focused on clarity and conversion. Created a stable, scalable e-commerce platform that elevated user experience.",
    image: "/work/mr-fox.jpg",
  },
  {
    slug: "kavak-showroom",
    name: "Kavak Showroom",
    client: "Kavak",
    year: "2019",
    categories: ["Brand Strategy", "Branding"],
    industry: "Automotriz",
    location: "Mexico City, MX",
    tags: ["Corporativo", "Retail"],
    description:
      "Brand strategy and showroom experience for Kavak. Developed narrative, visual cues, and a coherent physical experience for customers and visitors.",
    image: "/work/kavak-showroom.jpg",
  },
  {
    slug: "break-off",
    name: "Break Off",
    client: "Break Off",
    year: "2019",
    categories: ["Branding", "Website", "Brand Strategy"],
    industry: "Servicios",
    location: "UK, Hong Kong & US",
    tags: ["Digital", "Identidad Visual"],
    description:
      "Full brand ecosystem — strategy, visual identity, and web platform — for a global digital services company. Built to compete across multiple markets.",
    image: "/work/break-off.jpg",
  },
  {
    slug: "el-mural-mas-fino",
    name: "El Mural Mas Fino",
    client: "Cerveza Corona",
    year: "2019",
    categories: ["Branding", "Mural"],
    industry: "Alimentos",
    location: "Ciudad de Mexico",
    tags: ["Alimentos", "Identidad Visual", "Corporativo", "Retail"],
    description:
      "Monumental mural designed by Pedro Friedeberg for Cerveza Corona. Art, brand, and public space merged into a memorable urban experience.",
    image: "/work/el-mural-mas-fino.webp",
  },
  {
    slug: "grupo-proeza-2019",
    name: "Grupo Proeza",
    client: "Grupo Proeza",
    year: "2019",
    categories: ["Branding", "Web Development", "Video Production"],
    industry: "Industrial",
    location: "Monterrey, MX",
    tags: ["Corporativo", "B2B", "Digital"],
    description:
      "Comprehensive brand, web, and video project. Strengthened the group's visibility and communication of its purpose and business units.",
    image: "/work/grupo-proeza-2019.png",
  },
  {
    slug: "niki-b",
    name: "Niki B",
    client: "Niki Baratta",
    year: "2019",
    categories: ["Branding", "UI Design", "Shopify Development"],
    industry: "Retail",
    location: "New York, US",
    tags: ["Digital", "Retail"],
    description:
      "Brand identity and Shopify e-commerce for a New York retail brand. Created a cohesive digital presence with a focus on usability and aesthetics.",
    image: "/work/niki-b.jpg",
  },
  {
    slug: "vehement",
    name: "Vehement",
    client: "Vehement",
    year: "2019",
    categories: ["Naming", "Branding"],
    industry: "Technology",
    location: "Texas, US",
    tags: ["Identidad Visual"],
    description:
      "Naming and brand identity. Defined the name and built a clear, consistent visual system ready to scale across touchpoints.",
    image: "/work/vehement.png",
  },
  {
    slug: "mezcal-inmortal",
    name: "Mezcal Inmortal",
    client: "Mezcal Inmortal",
    year: "2018",
    categories: ["Branding", "Illustration"],
    industry: "Alimentos",
    location: "Mexico City, MX",
    tags: ["Alimentos", "Identidad Visual"],
    description:
      "Branding and illustration for an artisanal mezcal brand. Distinctive visual language that communicates tradition and character in a competitive market.",
    image: "/work/mezcal-inmortal.jpg",
  },
  {
    slug: "muvop",
    name: "MUVOP",
    client: "MUVOP",
    year: "2018",
    categories: ["Branding", "Product Design"],
    industry: "Finanzas",
    location: "Mexico",
    tags: ["Corporativo", "Identidad Visual"],
    description:
      "Branding and product design for a financial institution empowering women through credit access and financial education.",
    image: "/work/muvop.png",
  },
  {
    slug: "comnor",
    name: "COMNOR",
    client: "Sigma Alimentos",
    year: "2018",
    categories: ["Brand Strategy", "Brand Redesign"],
    industry: "Alimentos",
    location: "Monterrey, MX",
    tags: ["Alimentos", "Corporativo", "Identidad Visual", "Estrategia"],
    description:
      "Brand strategy and redesign for Sigma Alimentos' meat cuts brand. Consumer segmentation, simplified identity, and improved shelf clarity.",
    image: "/work/comnor.jpg",
  },
  {
    slug: "loly-in-the-sky",
    name: "Loly in the Sky",
    client: "Loly in the Sky",
    year: "2018",
    categories: ["UI Design", "Shopify Development"],
    industry: "Retail",
    location: "Monterrey, MX",
    tags: ["Digital", "Retail"],
    description:
      "UI/UX redesign and Shopify store for a beloved Mexican shoe brand. Translated the physical brand personality into a digital shopping experience.",
    image: "/work/loly-in-the-sky.png",
  },
  {
    slug: "zirker",
    name: "Zirker",
    client: "Zirker",
    year: "2018",
    categories: ["Branding", "Product Design"],
    industry: "Technology",
    location: "Monterrey, MX",
    tags: ["Identidad Visual"],
    description:
      "Branding and product design for Zirker. Defined a clear identity and design language for the product, ensuring consistency and scalability across touchpoints.",
    image: "/work/zirker.gif",
  },
  {
    slug: "celaya-brothers-gallery",
    name: "Celaya Brothers Gallery",
    client: "Celaya Brothers Gallery",
    year: "2017",
    categories: ["Web Development"],
    industry: "Servicios",
    location: "Mexico City, MX",
    tags: ["Digital"],
    description:
      "Web development for a contemporary art gallery. Clean architecture and elegant navigation optimized for exhibitions and artist profiles.",
    image: "/work/celaya-brothers-gallery.jpg",
  },
  {
    slug: "aisha-sufe",
    name: "Aisha Sufe",
    client: "Aisha Sufe",
    year: "2017",
    categories: ["Branding", "Web Development"],
    industry: "Retail",
    location: "Monterrey, MX",
    tags: ["Digital", "Retail"],
    description:
      "Branding and e-commerce for a creative art and products brand. Built a digital platform to grow the offering and reach new audiences.",
    image: "/work/aisha-sufe.jpg",
  },
  {
    slug: "mlab-metalsa",
    name: "MLab",
    client: "Metalsa",
    year: "2016",
    categories: ["Branding", "UI Design"],
    industry: "Industrial",
    location: "Monterrey, MX",
    tags: ["Corporativo", "Industrial", "B2B", "Digital"],
    description:
      "Branding and UI system for Metalsa's innovation lab. Created a distinctive tech-forward identity with coherent interface language.",
    image: "/work/mlab-metalsa.jpg",
  },
  {
    slug: "galvasid",
    name: "GALVASID",
    client: "GALVASID",
    year: "2016",
    categories: ["Logo Re-design", "Brand Strategy"],
    industry: "Industrial",
    location: "Monterrey, MX",
    tags: ["Industrial", "B2B", "Corporativo", "Identidad Visual", "Estrategia"],
    description:
      "Logo redesign and brand strategy for an industrial company. Refreshed identity with strategic guidelines for market positioning.",
    image: "/work/galvasid.jpg",
  },
  {
    slug: "basket",
    name: "Basket",
    client: "Basket",
    year: "2016",
    categories: ["Branding", "Web Development"],
    industry: "Alimentos",
    location: "Monterrey, MX",
    tags: ["Alimentos", "Retail", "Digital", "Packaging"],
    description:
      "Branding and web development for an artisanal gift basket brand. Clear customization experience aligned with the handcrafted proposition.",
    image: "/work/basket.jpg",
  },
  {
    slug: "julee",
    name: "Julee",
    client: "Julee",
    year: "2016",
    categories: ["Naming", "Branding", "UI Design", "Product Design"],
    industry: "Retail",
    location: "Monterrey, MX",
    tags: ["Digital", "Retail", "Identidad Visual"],
    description:
      "Full brand creation — naming, identity, UI, and product design. Built a distinctive and coherent visual system for retail growth.",
    image: "/work/julee.jpg",
  },
  {
    slug: "tres-mas-dos",
    name: "Tres Más Dos",
    client: "Tres Más Dos",
    year: "2016",
    categories: ["Branding", "UI Design", "Web Development"],
    industry: "Servicios",
    location: "Monterrey, MX",
    tags: ["Digital", "Identidad Visual"],
    description:
      "Branding, UI design, and web development. Built a coherent digital presence optimized for communication and value proposition.",
    image: "/work/tres-mas-dos.png",
  },
  {
    slug: "lua-luz-en-arquitectura",
    name: "LUA Luz en Arquitectura",
    client: "LUA",
    year: "2016",
    categories: ["UI Design", "Web Development"],
    industry: "Servicios",
    location: "Mexico City, MX",
    tags: ["Digital"],
    description:
      "UI design and web development for a lighting architecture studio. Clean interface and elegant navigation for portfolio and services showcase.",
    image: "/work/lua.jpg",
  },
  {
    slug: "load",
    name: "Load",
    client: "Load",
    year: "2016",
    categories: ["Branding", "UI Design", "Web Development"],
    industry: "Technology",
    location: "Monterrey, MX",
    tags: ["Digital", "Identidad Visual"],
    description:
      "Integrated branding, interface design, and web development. Built a consistent brand identity and clear digital experience.",
    image: "/work/load.jpg",
  },
  {
    slug: "jetboards",
    name: "Jetboards",
    client: "Jetboards",
    year: "2016",
    categories: ["Branding", "Web Development"],
    industry: "Technology",
    location: "Monterrey, MX",
    tags: ["Digital", "Identidad Visual"],
    description:
      "Brand identity and web platform for a technology company. Strengthened digital presence with clear brand communication.",
    image: "/work/jetboards.jpg",
  },
  {
    slug: "hagane",
    name: "Hagane",
    client: "Hagane",
    year: "2016",
    categories: ["Branding"],
    industry: "Industrial",
    location: "Monterrey, MX",
    tags: ["Industrial", "B2B", "Corporativo", "Identidad Visual"],
    description:
      "Brand identity for an industrial company. Created a solid visual system to strengthen market positioning and recognition.",
    image: "/work/hagane.jpg",
  },
  {
    slug: "florence",
    name: "Florence",
    client: "Florence",
    year: "2016",
    categories: ["Branding"],
    industry: "Servicios",
    location: "Monterrey, MX",
    tags: ["Corporativo", "Identidad Visual"],
    description:
      "Complete brand identity to establish a strong, distinctive market presence in Monterrey's services sector.",
    image: "/work/florence.jpg",
  },
  {
    slug: "tikaa",
    name: "Tikaa",
    client: "Tikaa",
    year: "2015",
    categories: ["Branding", "Packaging"],
    industry: "Alimentos",
    location: "Monterrey, MX",
    tags: ["Packaging", "Identidad Visual"],
    description:
      "Branding and packaging for an organic products brand. Coherent visual identity and clear shelf language communicating trust and quality.",
    image: "/work/tikaa.png",
  },
  {
    slug: "the-misc-forest",
    name: "The Misc Forest",
    client: "The Misc Forest",
    year: "2015",
    categories: ["Branding", "UI Design", "Web Development"],
    industry: "Servicios",
    location: "Monterrey, MX",
    tags: ["Digital", "Identidad Visual"],
    description:
      "Integrated branding, UI design, and web development. Built a solid visual identity and coherent digital experience across touchpoints.",
    image: "/work/the-misc-forest.jpg",
  },
  {
    slug: "locker",
    name: "Locker",
    client: "Locker",
    year: "2015",
    categories: ["Branding", "UI Design", "Web Development"],
    industry: "Technology",
    location: "Monterrey, MX",
    tags: ["Digital", "Identidad Visual"],
    description:
      "Branding, interface design, and web development for a technology platform. Consistent brand identity and improved digital user experience.",
    image: "/work/locker.jpg",
  },
  {
    slug: "optime",
    name: "Optime",
    client: "Optime",
    year: "2015",
    categories: ["Branding", "Web Development"],
    industry: "Industrial",
    location: "Monterrey, MX",
    tags: ["Corporativo", "Identidad Visual", "Digital", "B2B"],
    description:
      "Branding and web development for an industrial company. Distinctive and consistent presence, ready to scale with new applications.",
    image: "/work/optime.jpg",
  },
  {
    slug: "call-us-whatever",
    name: "Call Us Whatever",
    client: "Call Us Whatever",
    year: "2014",
    categories: ["Branding", "UI Design", "Web Development"],
    industry: "Retail",
    location: "Monterrey, MX",
    tags: ["Identidad Visual", "Digital"],
    description:
      "Branding, UI, and web development for a Monterrey fashion and lifestyle brand. Unified identity and digital experience.",
    image: "/work/call-us-whatever.jpg",
  },
  {
    slug: "distrito",
    name: "Distrito",
    client: "Distrito",
    year: "2014",
    categories: ["Branding"],
    industry: "Servicios",
    location: "Monterrey, MX",
    tags: ["Identidad Visual"],
    description:
      "Brand identity for Monterrey's innovation and entrepreneurship ecosystem initiative. Clear communication of community purpose.",
    image: "/work/distrito.jpg",
  },
  {
    slug: "don-cortes",
    name: "Don Cortes",
    client: "Don Cortes",
    year: "2014",
    categories: ["Branding", "Web Development"],
    industry: "Retail",
    location: "Monterrey, MX",
    tags: ["Digital", "Retail"],
    description:
      "Branding and online store for a men's accessories brand. Optimized shopping experience aligned with brand identity.",
    image: "/work/don-cortes.jpg",
  },
  {
    slug: "maxis",
    name: "Maxis",
    client: "Maxis",
    year: "2014",
    categories: ["Branding", "UI Design", "Online Store", "Web Development"],
    industry: "Retail",
    location: "Monterrey, MX",
    tags: ["Digital", "Retail", "Identidad Visual"],
    description:
      "Integrated branding, UI design, and e-commerce development. Coherent digital experience aligned with brand identity to drive online conversion.",
    image: "/work/maxis.jpg",
  },
  {
    slug: "lvl-projects",
    name: "LVL",
    client: "LVL Projects",
    year: "2014",
    categories: ["Branding", "Web Development"],
    industry: "Industrial",
    location: "Monterrey, MX",
    tags: ["Digital", "Identidad Visual", "Corporativo", "B2B"],
    description:
      "Brand identity and web platform for an industrial projects company. Improved visibility and streamlined client interaction.",
    image: "/work/lvl.jpg",
  },
  {
    slug: "blue-box",
    name: "Blue Box",
    client: "Blue Box",
    year: "2014",
    categories: ["Branding"],
    industry: "Servicios",
    location: "Monterrey, MX",
    tags: ["Identidad Visual"],
    description:
      "Brand identity standardization. Clear and consistent visual system across physical and digital touchpoints.",
    image: "/work/blue-box.jpg",
  },
];

// Get unique categories and years for filters
const allCategories = [...new Set(projects.flatMap((p) => p.categories))].sort();
const allYears = [...new Set(projects.map((p) => p.year))]
  .filter((y) => y !== "Por definir")
  .sort()
  .reverse();

export default async function WorkPage({ params }: PageProps) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam as Locale;
  const t = getDictionary(locale).work;
  const lp = (p: string) => `/${locale}${p.startsWith("/") ? p : "/" + p}`;

  return (
    <>
      {/* Header */}
      <section className="border-b border-zinc-200">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <p className="mb-2 text-sm font-medium uppercase tracking-widest text-zinc-400">
            {t.eyebrow}
          </p>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{t.h1}</h1>
          <p className="mt-4 max-w-xl text-lg text-zinc-500">{t.sub}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {allYears.map((year) => (
              <span
                key={year}
                className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-500"
              >
                {year}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-zinc-200 bg-zinc-50">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <div>
              <p className="text-3xl font-bold">{projects.length}+</p>
              <p className="mt-1 text-sm text-zinc-500">{t.stat_projects}</p>
            </div>
            <div>
              <p className="text-3xl font-bold">
                {new Set(projects.map((p) => p.client)).size}+
              </p>
              <p className="mt-1 text-sm text-zinc-500">{t.stat_clients}</p>
            </div>
            <div>
              <p className="text-3xl font-bold">
                {allYears.length > 1
                  ? `${allYears[allYears.length - 1]}–${allYears[0]}`
                  : allYears[0]}
              </p>
              <p className="mt-1 text-sm text-zinc-500">{t.stat_years}</p>
            </div>
            <div>
              <p className="text-3xl font-bold">
                {new Set(projects.map((p) => p.industry)).size}
              </p>
              <p className="mt-1 text-sm text-zinc-500">{t.stat_industries}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Project Grid */}
      <section>
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <div className="grid gap-8 md:grid-cols-2">
            {projects.map((project) => (
              <article
                key={project.slug}
                className="group overflow-hidden rounded-2xl border border-zinc-200 transition-all hover:border-zinc-400 hover:shadow-sm"
              >
                {project.image ? (
                  <div className="aspect-[16/10] overflow-hidden bg-zinc-100">
                    <img
                      src={project.image}
                      alt={project.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="aspect-[16/10] flex items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-800">
                    <span className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-700 select-none">
                      {project.name}
                    </span>
                  </div>
                )}
                <div className="p-6">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-400">
                      {project.year}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {project.location}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold tracking-tight group-hover:text-zinc-600 transition-colors">
                    {project.name}
                  </h2>
                  <p className="mt-1 text-sm font-medium text-zinc-500">
                    {project.client}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-500 line-clamp-3">
                    {project.description}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {project.categories.slice(0, 3).map((cat) => (
                      <span
                        key={cat}
                        className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-zinc-200 bg-zinc-900 text-white">
        <div className="mx-auto max-w-6xl px-6 py-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight">{t.cta_h2}</h2>
          <p className="mt-4 text-lg text-zinc-400">{t.cta_body}</p>
          <Link
            href={lp("/pricing")}
            className="mt-8 inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-base font-medium text-zinc-900 transition-colors hover:bg-zinc-100"
          >
            {t.cta_button}
          </Link>
        </div>
      </section>

    </>
  );
}
