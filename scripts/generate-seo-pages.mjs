import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(join(root, "index.html"), "utf8");
const origin = "https://lablifehub.com";
const image = `${origin}/media/nevena-main.jpg`;

const pages = [
  {
    id: "about",
    path: "/about/",
    title: "About Dr. Nevena Jeremić - LabLifeHub",
    description:
      "Academic profile, research path, awards, expertise and collaborations of Dr. Nevena Jeremić.",
    breadcrumb: ["About"],
    about: "https://lablifehub.com/#person",
  },
  {
    id: "research",
    path: "/research/",
    title: "Research - LabLifeHub",
    description:
      "Research focus in pharmaceutical chemistry, redox biology, cardiometabolic science and preclinical models.",
    breadcrumb: ["Research"],
    about: "https://lablifehub.com/#person",
  },
  {
    id: "podcast",
    path: "/podcast/",
    title: "LabLifePodcast by Dr. Nevena Jeremić - LabLifeHub",
    description:
      "LabLifePodcast by Dr. Nevena Jeremić brings scientific conversations about research, careers, innovation, lab life and the real work behind better science.",
    breadcrumb: ["LabLifePodcast"],
    about: "https://lablifehub.com/podcast/#podcast",
  },
  {
    id: "guest",
    path: "/be-guest/",
    title: "Be a guest on LabLifePodcast - Dr. Nevena Jeremić",
    description:
      "Apply to be a LabLifePodcast guest with Dr. Nevena Jeremić by sharing your background, expertise, proposed topic, publications and professional links.",
    breadcrumb: ["Be a guest"],
    about: "https://lablifehub.com/be-guest/#service",
    service: {
      name: "LabLifePodcast guest application",
      serviceType: "Podcast guest application",
    },
  },
  {
    id: "academy",
    path: "/academy/",
    title: "LabLifeAcademy by Dr. Nevena Jeremić - Research Mentoring",
    description:
      "LabLifeAcademy by Dr. Nevena Jeremić offers research mentoring, individual retreats and workshops for study design, reproducibility and publication strategy.",
    breadcrumb: ["LabLifeAcademy"],
    about: "https://lablifehub.com/academy/#offers",
  },
  {
    id: "academy-one-day",
    path: "/academy/one-day-intensive-retreat/",
    title: "One-Day Intensive Research Retreat - LabLifeAcademy",
    description:
      "A 4-5 hour individual research mentoring retreat with Dr. Nevena Jeremić: project audit, study design corrections, reproducibility check and action plan. Price $350.",
    breadcrumb: ["LabLifeAcademy", "One-Day Intensive Retreat"],
    service: {
      name: "One-Day Intensive Retreat",
      serviceType: "Research mentoring retreat",
      price: "350",
      currency: "USD",
    },
  },
  {
    id: "academy-two-day",
    path: "/academy/two-day-premium-retreat/",
    title: "Two-Day Premium Research Retreat - LabLifeAcademy",
    description:
      "A two-day premium research mentoring retreat with Dr. Nevena Jeremić for deep project redesign, workflow optimization and publication strategy. Price $600.",
    breadcrumb: ["LabLifeAcademy", "Two-Day Premium Retreat"],
    service: {
      name: "Two-Day Premium Retreat",
      serviceType: "Research mentoring retreat",
      price: "600",
      currency: "USD",
    },
  },
  {
    id: "academy-follow-up",
    path: "/academy/follow-up-mentoring/",
    title: "Research Retreat + 30-Day Follow-Up Mentoring - LabLifeAcademy",
    description:
      "A premium LabLifeAcademy research mentoring package with Dr. Nevena Jeremić, including a retreat plus 30 days of follow-up and implementation support. Price $850.",
    breadcrumb: ["LabLifeAcademy", "Retreat + 30-Day Follow-Up Mentoring"],
    service: {
      name: "Retreat + 30-Day Follow-Up Mentoring",
      serviceType: "Research mentoring retreat with follow-up support",
      price: "850",
      currency: "USD",
    },
  },
  {
    id: "academy-workshop",
    path: "/academy/failure-in-science-workshop/",
    title: "Failure in Science Workshop - LabLifeAcademy by Dr. Nevena Jeremić",
    description:
      "Advanced LabLifeAcademy group workshop by Dr. Nevena Jeremić on failed experiments, reproducibility, bias reduction, documentation and better research design. Price $25 per topic per person.",
    breadcrumb: ["LabLifeAcademy", "Failure in Science Workshop"],
    service: {
      name: "Failure in Science Workshop",
      serviceType: "Scientific workshop",
      price: "25",
      currency: "USD",
    },
  },
  {
    id: "book",
    path: "/book/",
    title: "Book LabLifeAcademy Mentoring - Dr. Nevena Jeremić",
    description:
      "Book a LabLifeAcademy research mentoring retreat or workshop with Dr. Nevena Jeremić by choosing a service, preferred language and date.",
    breadcrumb: ["Book"],
  },
  {
    id: "reviews",
    path: "/reviews/",
    title: "Reviews - LabLifeHub",
    description:
      "Submit a verified testimonial about collaboration, lectures, mentoring or research support with Dr. Nevena Jeremić.",
    breadcrumb: ["Reviews"],
    robots: "noindex, follow, max-image-preview:large",
  },
  {
    id: "contact",
    path: "/contact/",
    title: "Contact - LabLifeHub",
    description:
      "Contact Dr. Nevena Jeremić for collaboration, lectures, podcast guesting, workshops or research mentorship.",
    breadcrumb: ["Contact"],
  },
];

function escapeAttr(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function replaceMeta(html, selector, attrName, attrValue, content) {
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

function pageSchema(page, url) {
  const breadcrumbs = ["Home", ...(page.breadcrumb || [])];
  const graph = [
    {
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      url,
      name: page.title,
      description: page.description,
      isPartOf: { "@id": `${origin}/#website` },
      about: { "@id": page.about || `${origin}/#organization` },
      publisher: { "@id": `${origin}/#organization` },
      primaryImageOfPage: {
        "@type": "ImageObject",
        url: image,
        width: 1664,
        height: 1800,
      },
      inLanguage: ["en", "sr"],
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumb`,
      itemListElement: breadcrumbs.map((name, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name,
        item: index === 0 ? `${origin}/` : index === breadcrumbs.length - 1 ? url : `${origin}/academy/`,
      })),
    },
  ];

  if (page.service) {
    const service = {
      "@type": "Service",
      "@id": `${url}#service`,
      name: page.service.name,
      serviceType: page.service.serviceType,
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

function injectPageSchema(html, page, url) {
  return html.replace("</head>", `  ${pageSchema(page, url)}\n</head>`);
}

for (const page of pages) {
  const url = new URL(page.path, origin).href;
  let html = source;
  html = html.replace(/<title>.*?<\/title>/s, `<title>${escapeAttr(page.title)}</title>`);
  html = html.replace(
    /<link rel="canonical" href="[^"]+" \/>/,
    `<link rel="canonical" href="${url}" />`,
  );
  html = replaceMeta(html, "description", "name", "description", page.description);
  html = replaceMeta(
    html,
    "robots",
    "name",
    "robots",
    page.robots || "index, follow, max-image-preview:large",
  );
  html = replaceMeta(html, "og:title", "property", "og:title", page.title);
  html = replaceMeta(html, "og:description", "property", "og:description", page.description);
  html = replaceMeta(html, "og:url", "property", "og:url", url);
  html = replaceMeta(html, "og:image", "property", "og:image", image);
  html = replaceMeta(html, "twitter:title", "name", "twitter:title", page.title);
  html = replaceMeta(html, "twitter:description", "name", "twitter:description", page.description);
  html = replaceMeta(html, "twitter:image", "name", "twitter:image", image);
  html = setPageActive(html, page.id);
  html = injectPageSchema(html, page, url);

  const output = join(root, page.path.replace(/^\/|\/$/g, ""), "index.html");
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, html);
  console.log(`generated ${page.path}`);
}
