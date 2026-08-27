import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(join(root, "index.html"), "utf8");
const origin = "https://lablifehub.com";
const image = `${origin}/media/nevena-main.jpg`;
const lastmod = new Date().toISOString().slice(0, 10);

const pages = [
  {
    id: "home",
    path: "/",
    title: {
      en: "LabLifeHub - Dr. Nevena Jeremić | Podcast & Academy",
      sr: "LabLifeHub - dr Nevena Jeremić | Podkast i Akademija",
    },
    description: {
      en: "LabLifeHub by Dr. Nevena Jeremić connects LabLifePodcast, LabLifeAcademy, research mentoring, scientific workshops, reproducibility, study design and science communication.",
      sr: "LabLifeHub dr Nevene Jeremić povezuje LabLifePodcast, LabLifeAcademy, istraživačko mentorstvo, naučne radionice, reproduktivnost, dizajn studije i naučnu komunikaciju.",
    },
    breadcrumb: { en: [], sr: [] },
    about: "https://lablifehub.com/#person",
    priority: "1.0",
    changefreq: "weekly",
  },
  {
    id: "about",
    path: "/about/",
    title: {
      en: "About Dr. Nevena Jeremić - LabLifeHub",
      sr: "O dr Neveni Jeremić - LabLifeHub",
    },
    description: {
      en: "Academic profile, research path, awards, expertise and collaborations of Dr. Nevena Jeremić.",
      sr: "Akademski profil, istraživački put, priznanja, ekspertiza i saradnje dr Nevene Jeremić.",
    },
    breadcrumb: { en: ["About"], sr: ["O Neveni"] },
    about: "https://lablifehub.com/#person",
    priority: "0.8",
  },
  {
    id: "about-lablifehub",
    path: "/what-is-lablifehub/",
    title: {
      en: "What is LabLifeHub? - Science Communication, Podcast & Academy",
      sr: "Šta je LabLifeHub? - naučna komunikacija, podkast i akademija",
    },
    description: {
      en: "LabLifeHub by Dr. Nevena Jeremić is a science communication, LabLifePodcast and LabLifeAcademy platform for research mentoring, study design, reproducibility and better science.",
      sr: "LabLifeHub dr Nevene Jeremić je platforma za naučnu komunikaciju, LabLifePodcast i LabLifeAcademy, istraživačko mentorstvo, dizajn studije, reproduktivnost i bolju nauku.",
    },
    breadcrumb: { en: ["About", "What is LabLifeHub?"], sr: ["O meni", "Šta je LabLifeHub?"] },
    parentPath: "/about/",
    about: "https://lablifehub.com/#organization",
    priority: "0.9",
  },
  {
    id: "about-research-mentoring",
    path: "/research-mentoring/",
    title: {
      en: "Why Research Mentoring Matters - LabLifeAcademy by Dr. Nevena Jeremić",
      sr: "Zašto je istraživačko mentorstvo važno - LabLifeAcademy dr Nevene Jeremić",
    },
    description: {
      en: "Learn why research mentoring matters for PhD students, postdocs and early-career scientists: project audit, study design, reproducibility, workflow and publication strategy.",
      sr: "Saznajte zašto je istraživačko mentorstvo važno za doktorande, postdoktorande i mlade istraživače: procena projekta, dizajn studije, reproduktivnost, workflow i publikovanje.",
    },
    breadcrumb: { en: ["About", "Research mentoring"], sr: ["O meni", "Istraživačko mentorstvo"] },
    parentPath: "/about/",
    about: "https://lablifehub.com/academy/#offers",
    priority: "0.9",
  },
  {
    id: "about-why-experiments-fail",
    path: "/why-experiments-fail/",
    title: {
      en: "Why Experiments Fail - Reproducibility & Better Research Design",
      sr: "Zašto eksperimenti ne uspevaju - reproduktivnost i bolji dizajn istraživanja",
    },
    description: {
      en: "A LabLifeAcademy guide to why experiments fail, how failed experiments become data, and how reproducibility, documentation and bias reduction strengthen research.",
      sr: "LabLifeAcademy vodič o tome zašto eksperimenti ne uspevaju, kako neuspeh postaje podatak i kako reproduktivnost, dokumentacija i smanjenje pristrasnosti jačaju istraživanje.",
    },
    breadcrumb: { en: ["About", "Why experiments fail"], sr: ["O meni", "Zašto eksperimenti ne uspevaju"] },
    parentPath: "/about/",
    about: "https://lablifehub.com/academy/failure-in-science-workshop/#service",
    priority: "0.9",
  },
  {
    id: "research",
    path: "/research/",
    title: {
      en: "Research - LabLifeHub",
      sr: "Istraživanje - LabLifeHub",
    },
    description: {
      en: "Research focus in pharmaceutical chemistry, redox biology, cardiometabolic science and preclinical models.",
      sr: "Oblasti istraživanja u farmaceutskoj hemiji, redoks biologiji, kardiometaboličkoj nauci i pretkliničkim modelima.",
    },
    breadcrumb: { en: ["Research"], sr: ["Istraživanje"] },
    about: "https://lablifehub.com/#person",
    priority: "0.8",
  },
  {
    id: "podcast",
    path: "/podcast/",
    title: {
      en: "LabLifePodcast by Dr. Nevena Jeremić - LabLifeHub",
      sr: "LabLifePodcast dr Nevene Jeremić - LabLifeHub",
    },
    description: {
      en: "LabLifePodcast by Dr. Nevena Jeremić brings scientific conversations about research, careers, innovation, lab life and the real work behind better science.",
      sr: "LabLifePodcast dr Nevene Jeremić donosi naučne razgovore o istraživanju, karijeri, inovacijama, laboratorijskom životu i stvarnom radu iza bolje nauke.",
    },
    breadcrumb: { en: ["LabLifePodcast"], sr: ["LabLifePodcast"] },
    about: "https://lablifehub.com/podcast/#podcast",
    priority: "0.95",
    changefreq: "weekly",
  },
  {
    id: "guest",
    path: "/be-guest/",
    title: {
      en: "Be a guest on LabLifePodcast - Dr. Nevena Jeremić",
      sr: "Budite gost u LabLifePodcastu - dr Nevena Jeremić",
    },
    description: {
      en: "Apply to be a LabLifePodcast guest with Dr. Nevena Jeremić by sharing your background, expertise, proposed topic, publications and professional links.",
      sr: "Prijavite se za gosta u LabLifePodcastu sa dr Nevenom Jeremić kroz predstavljanje biografije, ekspertize, predložene teme, publikacija i profesionalnih linkova.",
    },
    breadcrumb: { en: ["Be a guest"], sr: ["Budite gost"] },
    about: "https://lablifehub.com/be-guest/#service",
    service: {
      name: { en: "LabLifePodcast guest application", sr: "Prijava za gosta u LabLifePodcastu" },
      serviceType: { en: "Podcast guest application", sr: "Prijava za gosta u podkastu" },
    },
    priority: "0.85",
  },
  {
    id: "academy",
    path: "/academy/",
    title: {
      en: "LabLifeAcademy by Dr. Nevena Jeremić - Research Mentoring",
      sr: "LabLifeAcademy dr Nevene Jeremić - istraživačko mentorstvo",
    },
    description: {
      en: "LabLifeAcademy by Dr. Nevena Jeremić offers research mentoring, individual retreats and workshops for study design, reproducibility and publication strategy.",
      sr: "LabLifeAcademy dr Nevene Jeremić nudi istraživačko mentorstvo, individualne programe i radionice za dizajn studije, reproduktivnost i strategiju publikovanja.",
    },
    breadcrumb: { en: ["LabLifeAcademy"], sr: ["LabLifeAcademy"] },
    about: "https://lablifehub.com/academy/#offers",
    priority: "0.95",
  },
  {
    id: "academy-one-day",
    path: "/academy/one-day-intensive-retreat/",
    title: {
      en: "One-Day Intensive Research Retreat - LabLifeAcademy",
      sr: "Jednodnevni intenzivni istraživački program - LabLifeAcademy",
    },
    description: {
      en: "A 4-5 hour individual research mentoring retreat with Dr. Nevena Jeremić: project audit, study design corrections, reproducibility check and action plan. Price $350.",
      sr: "Individualni istraživački mentoring program od 4-5 sati sa dr Nevenom Jeremić: procena projekta, korekcije dizajna studije, provera reproduktivnosti i akcioni plan. Cena $350.",
    },
    breadcrumb: { en: ["LabLifeAcademy", "One-Day Intensive Retreat"], sr: ["LabLifeAcademy", "Jednodnevni intenzivni program"] },
    service: {
      name: { en: "One-Day Intensive Retreat", sr: "Jednodnevni intenzivni program" },
      serviceType: { en: "Research mentoring retreat", sr: "Istraživački mentoring program" },
      price: "350",
      currency: "USD",
    },
    priority: "0.9",
  },
  {
    id: "academy-two-day",
    path: "/academy/two-day-premium-retreat/",
    title: {
      en: "Two-Day Premium Research Retreat - LabLifeAcademy",
      sr: "Dvodnevni premijum istraživački program - LabLifeAcademy",
    },
    description: {
      en: "A two-day premium research mentoring retreat with Dr. Nevena Jeremić for deep project redesign, workflow optimization and publication strategy. Price $600.",
      sr: "Dvodnevni premijum istraživački mentoring program sa dr Nevenom Jeremić za dubinski redizajn projekta, optimizaciju rada i strategiju publikovanja. Cena $600.",
    },
    breadcrumb: { en: ["LabLifeAcademy", "Two-Day Premium Retreat"], sr: ["LabLifeAcademy", "Dvodnevni premijum program"] },
    service: {
      name: { en: "Two-Day Premium Retreat", sr: "Dvodnevni premijum program" },
      serviceType: { en: "Research mentoring retreat", sr: "Istraživački mentoring program" },
      price: "600",
      currency: "USD",
    },
    priority: "0.9",
  },
  {
    id: "academy-follow-up",
    path: "/academy/follow-up-mentoring/",
    title: {
      en: "Research Retreat + 30-Day Follow-Up Mentoring - LabLifeAcademy",
      sr: "Istraživački program + 30 dana pratećeg mentorstva - LabLifeAcademy",
    },
    description: {
      en: "A premium LabLifeAcademy research mentoring package with Dr. Nevena Jeremić, including a retreat plus 30 days of follow-up and implementation support. Price $850.",
      sr: "Premijum LabLifeAcademy istraživački mentoring paket sa dr Nevenom Jeremić, uključujući program i 30 dana prateće podrške u implementaciji. Cena $850.",
    },
    breadcrumb: { en: ["LabLifeAcademy", "Retreat + 30-Day Follow-Up Mentoring"], sr: ["LabLifeAcademy", "Program + 30 dana pratećeg mentorstva"] },
    service: {
      name: { en: "Retreat + 30-Day Follow-Up Mentoring", sr: "Program + 30 dana pratećeg mentorstva" },
      serviceType: { en: "Research mentoring retreat with follow-up support", sr: "Istraživački mentoring program sa pratećom podrškom" },
      price: "850",
      currency: "USD",
    },
    priority: "0.9",
  },
  {
    id: "academy-workshop",
    path: "/academy/failure-in-science-workshop/",
    title: {
      en: "Failure in Science Workshop - LabLifeAcademy by Dr. Nevena Jeremić",
      sr: "Neuspeh u nauci radionica - LabLifeAcademy dr Nevene Jeremić",
    },
    description: {
      en: "Advanced LabLifeAcademy group workshop by Dr. Nevena Jeremić on failed experiments, reproducibility, bias reduction, documentation and better research design. Price $25 per topic per person.",
      sr: "Napredna LabLifeAcademy grupna radionica dr Nevene Jeremić o neuspelim eksperimentima, reproduktivnosti, smanjenju pristrasnosti, dokumentaciji i boljem dizajnu istraživanja. Cena $25 po temi po osobi.",
    },
    breadcrumb: { en: ["LabLifeAcademy", "Failure in Science Workshop"], sr: ["LabLifeAcademy", "Neuspeh u nauci radionica"] },
    service: {
      name: { en: "Failure in Science Workshop", sr: "Neuspeh u nauci radionica" },
      serviceType: { en: "Scientific workshop", sr: "Naučna radionica" },
      price: "25",
      currency: "USD",
    },
    priority: "0.9",
  },
  {
    id: "book",
    path: "/book/",
    title: {
      en: "Book LabLifeAcademy Mentoring - Dr. Nevena Jeremić",
      sr: "Zakažite LabLifeAcademy mentorstvo - dr Nevena Jeremić",
    },
    description: {
      en: "Book a LabLifeAcademy research mentoring retreat or workshop with Dr. Nevena Jeremić by choosing a service, preferred language and date.",
      sr: "Zakažite LabLifeAcademy istraživački program ili radionicu sa dr Nevenom Jeremić izborom usluge, jezika i željenog datuma.",
    },
    breadcrumb: { en: ["Book"], sr: ["Zakazivanje"] },
    priority: "0.8",
  },
  {
    id: "reviews",
    path: "/reviews/",
    title: {
      en: "Reviews - LabLifeHub",
      sr: "Recenzije - LabLifeHub",
    },
    description: {
      en: "Submit a verified testimonial about collaboration, lectures, mentoring or research support with Dr. Nevena Jeremić.",
      sr: "Pošaljite proverenu preporuku o saradnji, predavanjima, mentorstvu ili istraživačkoj podršci dr Nevene Jeremić.",
    },
    breadcrumb: { en: ["Reviews"], sr: ["Recenzije"] },
    robots: "noindex, follow, max-image-preview:large",
    sitemap: false,
  },
  {
    id: "contact",
    path: "/contact/",
    title: {
      en: "Contact - LabLifeHub",
      sr: "Kontakt - LabLifeHub",
    },
    description: {
      en: "Contact Dr. Nevena Jeremić for collaboration, lectures, podcast guesting, workshops or research mentorship.",
      sr: "Kontaktirajte dr Nevenu Jeremić za saradnju, predavanja, gostovanja u podkastu, radionice ili istraživačko mentorstvo.",
    },
    breadcrumb: { en: ["Contact"], sr: ["Kontakt"] },
    priority: "0.7",
  },
];

const standalonePages = [
  { loc: `${origin}/privacy/`, changefreq: "yearly", priority: "0.3" },
  { loc: `${origin}/terms/`, changefreq: "yearly", priority: "0.3" },
];

function valueFor(value, lang) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value[lang] || value.en || "";
  return value || "";
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeText(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function extractI18n() {
  const match = source.match(/const I18N = ([\s\S]*?)\n\s*let lang =/);
  if (!match) throw new Error("Could not extract I18N object from index.html");
  const sandbox = {};
  const objectSource = match[1].trim().replace(/;\s*$/, "");
  vm.runInNewContext(`globalThis.I18N = ${objectSource};`, sandbox);
  return sandbox.I18N;
}

const I18N = extractI18n();

function localizedPath(path, lang) {
  if (lang === "en") return path;
  return path === "/" ? "/sr/" : `/sr${path}`;
}

function localizedUrl(page, lang) {
  return new URL(localizedPath(page.path, lang), origin).href;
}

function stripExistingHreflang(html) {
  return html.replace(/^\s*<link rel="alternate" hreflang="[^"]+" href="[^"]+" \/>\n?/gm, "");
}

function hreflangTags(page) {
  const enUrl = localizedUrl(page, "en");
  const srUrl = localizedUrl(page, "sr");
  return [
    `<link rel="alternate" hreflang="en" href="${enUrl}" />`,
    `<link rel="alternate" hreflang="sr" href="${srUrl}" />`,
    `<link rel="alternate" hreflang="x-default" href="${enUrl}" />`,
  ].join("\n  ");
}

function injectHreflang(html, page) {
  html = stripExistingHreflang(html);
  return html.replace(
    /(<link rel="canonical" href="[^"]+" \/>)/,
    `$1\n  ${hreflangTags(page)}`,
  );
}

function replaceMeta(html, attrName, attrValue, content) {
  const escaped = escapeAttr(content);
  const pattern = new RegExp(
    `<meta([^>]+${attrName}=["']${attrValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*)>`,
    "i",
  );
  return html.replace(pattern, (match) => {
    if (/content=["'][^"']*["']/.test(match)) {
      return match.replace(/content=["'][^"']*["']/, `content="${escaped}"`);
    }
    return match.replace(/\s*\/?>$/, ` content="${escaped}" />`);
  });
}

function setPageActive(html, id) {
  return html
    .replace('<section id="page-home" class="page active">', '<section id="page-home" class="page">')
    .replace(`id="page-${id}" class="page`, `id="page-${id}" class="page active`);
}

function localizeStaticHtml(html, lang) {
  if (lang !== "sr") return html;
  const translations = I18N.sr || {};
  html = html.replace(/<html lang="en">/, '<html lang="sr">');
  html = html.replace(
    /(<([a-z0-9]+)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/gi,
    (match, open, tag, key, inner, close) => {
      const translated = translations[key];
      return typeof translated === "string" ? `${open}${escapeText(translated)}${close}` : match;
    },
  );
  html = html.replace(
    /(<[^>]*\bdata-i18n-placeholder="([^"]+)"[^>]*\bplaceholder=")([^"]*)(")/gi,
    (match, start, key, oldValue, end) => {
      const translated = translations[key];
      return typeof translated === "string" ? `${start}${escapeAttr(translated)}${end}` : match;
    },
  );
  return localizeInternalLinks(html);
}

function localizeInternalLinks(html) {
  const paths = pages.map((page) => page.path).filter((path) => path !== "/");
  for (const path of paths) {
    const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    html = html.replace(new RegExp(`(<a\\b[^>]*\\shref=")${escaped}(")`, "g"), `$1/sr${path}$2`);
  }
  return html.replace(/(<a\b[^>]*\shref=")\/(")/g, '$1/sr/$2');
}

function breadcrumbItemUrl(page, index, breadcrumbs, lang) {
  if (index === 0) return new URL(localizedPath("/", lang), origin).href;
  if (index === breadcrumbs.length - 1) return localizedUrl(page, lang);
  return new URL(localizedPath(page.parentPath || "/academy/", lang), origin).href;
}

function pageSchema(page, lang) {
  const url = localizedUrl(page, lang);
  const breadcrumbs = [lang === "sr" ? "Početna" : "Home", ...(page.breadcrumb?.[lang] || [])];
  const graph = [
    {
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      url,
      name: valueFor(page.title, lang),
      description: valueFor(page.description, lang),
      isPartOf: { "@id": `${origin}/#website` },
      about: { "@id": page.about || `${origin}/#organization` },
      publisher: { "@id": `${origin}/#organization` },
      primaryImageOfPage: {
        "@type": "ImageObject",
        url: image,
        width: 1664,
        height: 1800,
      },
      inLanguage: lang,
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumb`,
      itemListElement: breadcrumbs.map((name, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name,
        item: breadcrumbItemUrl(page, index, breadcrumbs, lang),
      })),
    },
  ];

  if (page.service) {
    const service = {
      "@type": "Service",
      "@id": `${url}#service`,
      name: valueFor(page.service.name, lang),
      serviceType: valueFor(page.service.serviceType, lang),
      url,
      provider: { "@id": `${origin}/#person` },
      areaServed: "Worldwide",
      availableLanguage: ["English", "Serbian"],
    };

    if (page.service.price) {
      service.offers = {
        "@type": "Offer",
        price: page.service.price,
        priceCurrency: page.service.currency || "USD",
        availability: "https://schema.org/InStock",
        url,
      };
    }

    graph.push(service);
  }

  return `<script type="application/ld+json" data-page-schema>\n${JSON.stringify(
    { "@context": "https://schema.org", "@graph": graph },
    null,
    2,
  )}\n</script>`;
}

function injectPageSchema(html, page, lang) {
  return html.replace("</head>", `  ${pageSchema(page, lang)}\n</head>`);
}

function renderPage(page, lang) {
  const url = localizedUrl(page, lang);
  const title = valueFor(page.title, lang);
  const description = valueFor(page.description, lang);
  let html = source;

  html = localizeStaticHtml(html, lang);
  html = html.replace(/<title>.*?<\/title>/s, `<title>${escapeAttr(title)}</title>`);
  html = html.replace(
    /<link rel="canonical" href="[^"]+" \/>/,
    `<link rel="canonical" href="${url}" />`,
  );
  html = injectHreflang(html, page);
  html = replaceMeta(html, "name", "description", description);
  html = replaceMeta(html, "name", "robots", page.robots || "index, follow, max-image-preview:large");
  html = replaceMeta(html, "property", "og:title", title);
  html = replaceMeta(html, "property", "og:description", description);
  html = replaceMeta(html, "property", "og:url", url);
  html = replaceMeta(html, "property", "og:image", image);
  html = replaceMeta(html, "property", "og:locale", lang === "sr" ? "sr_RS" : "en_US");
  html = replaceMeta(html, "property", "og:locale:alternate", lang === "sr" ? "en_US" : "sr_RS");
  html = replaceMeta(html, "name", "twitter:title", title);
  html = replaceMeta(html, "name", "twitter:description", description);
  html = replaceMeta(html, "name", "twitter:image", image);
  html = setPageActive(html, page.id);
  html = injectPageSchema(html, page, lang);
  return html;
}

function outputFileFor(path) {
  const clean = path.replace(/^\/|\/$/g, "");
  return clean ? join(root, clean, "index.html") : join(root, "index.html");
}

function writePage(path, html) {
  const output = outputFileFor(path);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, html);
  console.log(`generated ${path}`);
}

function sitemapAlternateLinks(page) {
  const enUrl = localizedUrl(page, "en");
  const srUrl = localizedUrl(page, "sr");
  return [
    `    <xhtml:link rel="alternate" hreflang="en" href="${enUrl}" />`,
    `    <xhtml:link rel="alternate" hreflang="sr" href="${srUrl}" />`,
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${enUrl}" />`,
  ].join("\n");
}

function sitemapUrl(loc, changefreq, priority, alternates = "") {
  return [
    "  <url>",
    `    <loc>${loc}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    alternates,
    "  </url>",
  ].filter(Boolean).join("\n");
}

function writeSitemap() {
  const entries = [];
  for (const page of pages.filter((item) => item.sitemap !== false)) {
    const changefreq = page.changefreq || "monthly";
    const priority = page.priority || "0.8";
    const alternates = sitemapAlternateLinks(page);
    entries.push(sitemapUrl(localizedUrl(page, "en"), changefreq, priority, alternates));
    entries.push(sitemapUrl(localizedUrl(page, "sr"), changefreq, priority, alternates));
  }
  for (const page of standalonePages) {
    entries.push(sitemapUrl(page.loc, page.changefreq, page.priority));
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n  xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join("\n")}\n</urlset>\n`;
  writeFileSync(join(root, "sitemap.xml"), sitemap);
  console.log("generated /sitemap.xml");
}

for (const page of pages) {
  if (page.path !== "/") writePage(page.path, renderPage(page, "en"));
  writePage(localizedPath(page.path, "sr"), renderPage(page, "sr"));
}

writeSitemap();
