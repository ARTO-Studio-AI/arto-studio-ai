/* Datos del portafolio (ARTO Portafolio 2026, Notion), compartidos por /work y
 * la fila de prueba social de la home. Las imagenes viven en public/work como
 * WebP de 200 KB o menos (scripts/optimize-work-images.mjs, 11 sep 2026). */

// Portfolio data from ARTO Portafolio 2026 (Notion).
// This will eventually be fetched from Notion API at build time. Project
// names, client names, and one-paragraph project descriptions stay in
// their original language — they're brand-tied content, and the chrome
// (headings, stats labels, CTA) is the part the visitor reads first.
export interface WorkProject {
  slug: string;
  name: string;
  client: string;
  year: string;
  categories: string[];
  industry: string;
  location: string;
  tags: string[];
  description: string;
  image: string;
}

export const projects: WorkProject[] = [
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
    image: "/work/grupo-proeza-2025-1200.webp",
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
    image: "/work/gse-biomedical.webp",
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
    image: "/work/grupo-proeza-ecosystem.webp",
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
    image: "/work/poder-partners.webp",
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
    image: "/work/mr-fox.webp",
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
    image: "/work/kavak-showroom.webp",
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
    image: "/work/break-off.webp",
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
    image: "/work/grupo-proeza-2019.webp",
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
    image: "/work/niki-b.webp",
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
    image: "/work/vehement.webp",
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
    image: "/work/mezcal-inmortal.webp",
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
    image: "/work/muvop.webp",
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
    image: "/work/comnor.webp",
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
    image: "/work/loly-in-the-sky.webp",
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
    image: "/work/zirker.webp",
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
    image: "/work/celaya-brothers-gallery.webp",
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
    image: "/work/aisha-sufe.webp",
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
    image: "/work/mlab-metalsa.webp",
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
    image: "/work/galvasid.webp",
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
    image: "/work/basket.webp",
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
    image: "/work/julee.webp",
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
    image: "/work/tres-mas-dos.webp",
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
    image: "/work/lua.webp",
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
    image: "/work/load.webp",
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
    image: "/work/jetboards.webp",
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
    image: "/work/hagane.webp",
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
    image: "/work/florence.webp",
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
    image: "/work/tikaa.webp",
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
    image: "/work/the-misc-forest.webp",
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
    image: "/work/locker.webp",
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
    image: "/work/optime.webp",
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
    image: "/work/call-us-whatever.webp",
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
    image: "/work/distrito.webp",
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
    image: "/work/don-cortes.webp",
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
    image: "/work/maxis.webp",
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
    image: "/work/lvl.webp",
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
    image: "/work/blue-box.webp",
  },
];

/* Seis proyectos para la fila de prueba social de la home: clientes con nombre
 * reconocible y una imagen que aguanta en miniatura. Solo assets que ya existen. */
const PROOF_SLUGS = [
  "grupo-proeza-2025",
  "kavak-showroom",
  "comnor",
  "el-mural-mas-fino",
  "mlab-metalsa",
  "poder-partners",
];
export const PROOF_PROJECTS: WorkProject[] = PROOF_SLUGS.map((slug) => projects.find((p) => p.slug === slug)!).filter(Boolean);
