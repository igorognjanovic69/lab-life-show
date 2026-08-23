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
  },
  {
    id: "research",
    path: "/research/",
    title: "Research - LabLifeHub",
    description:
      "Research focus in pharmaceutical chemistry, redox biology, cardiometabolic science and preclinical models.",
  },
  {
    id: "podcast",
    path: "/podcast/",
    title: "LabLifePodcast - LabLifeHub",
    description:
      "Scientific conversations that bring clarity to research, careers, innovation and the real life behind science.",
  },
  {
    id: "guest",
    path: "/be-guest/",
    title: "Be a guest on LabLifePodcast - LabLifeHub",
    description:
      "Apply to be a LabLifePodcast guest by sharing your background, expertise, proposed topic, publications and professional links.",
  },
  {
    id: "academy",
    path: "/academy/",
    title: "LabLifeAcademy - Research Mentoring and Workshops",
    description:
      "LabLifeAcademy offers individual research retreats, mentoring and workshops for stronger study design, reproducibility and publishing.",
  },
  {
    id: "academy-one-day",
    path: "/academy/one-day-intensive-retreat/",
    title: "One-Day Intensive Retreat - LabLifeAcademy",
    description:
      "A 4-5 hour individual research retreat with project audit, study design corrections, reproducibility check and action plan. Price $350.",
  },
  {
    id: "academy-two-day",
    path: "/academy/two-day-premium-retreat/",
    title: "Two-Day Premium Retreat - LabLifeAcademy",
    description:
      "A two-day premium research retreat for deep project redesign, workflow optimization and publication strategy. Price $600.",
  },
  {
    id: "academy-follow-up",
    path: "/academy/follow-up-mentoring/",
    title: "Retreat + 30-Day Follow-Up Mentoring - LabLifeAcademy",
    description:
      "A premium research retreat package with 30 days of structured follow-up mentoring and implementation support. Price $850.",
  },
  {
    id: "academy-workshop",
    path: "/academy/failure-in-science-workshop/",
    title: "Failure in Science Workshop - LabLifeAcademy",
    description:
      "Advanced group workshop on failed experiments, reproducibility, bias reduction, documentation and better research design. Price $25 per topic per person.",
  },
  {
    id: "book",
    path: "/book/",
    title: "Book a LabLifeAcademy Offer - LabLifeHub",
    description:
      "Choose a research retreat or workshop, select a date and send a booking request to Dr. Nevena Jeremić.",
  },
  {
    id: "reviews",
    path: "/reviews/",
    title: "Reviews - LabLifeHub",
    description:
      "Submit a verified testimonial about collaboration, lectures, mentoring or research support with Dr. Nevena Jeremić.",
  },
  {
    id: "contact",
    path: "/contact/",
    title: "Contact - LabLifeHub",
    description:
      "Contact Dr. Nevena Jeremić for collaboration, lectures, podcast guesting, workshops or research mentorship.",
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

for (const page of pages) {
  const url = new URL(page.path, origin).href;
  let html = source;
  html = html.replace(/<title>.*?<\/title>/s, `<title>${escapeAttr(page.title)}</title>`);
  html = html.replace(
    /<link rel="canonical" href="[^"]+" \/>/,
    `<link rel="canonical" href="${url}" />`,
  );
  html = replaceMeta(html, "description", "name", "description", page.description);
  html = replaceMeta(html, "og:title", "property", "og:title", page.title);
  html = replaceMeta(html, "og:description", "property", "og:description", page.description);
  html = replaceMeta(html, "og:url", "property", "og:url", url);
  html = replaceMeta(html, "og:image", "property", "og:image", image);
  html = replaceMeta(html, "twitter:title", "name", "twitter:title", page.title);
  html = replaceMeta(html, "twitter:description", "name", "twitter:description", page.description);
  html = replaceMeta(html, "twitter:image", "name", "twitter:image", image);
  html = setPageActive(html, page.id);

  const output = join(root, page.path.replace(/^\/|\/$/g, ""), "index.html");
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, html);
  console.log(`generated ${page.path}`);
}
