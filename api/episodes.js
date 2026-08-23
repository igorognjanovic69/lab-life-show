// Vercel Serverless Function - returns LabLifePodcast YouTube episodes as JSON.
//
// The site uses YouTube's public channel RSS feed, so new videos appear
// automatically without a YouTube API key.
//
// Optional Vercel environment variables:
//   YOUTUBE_CHANNEL_ID / YT_CHANNEL_ID = channel ID that starts with "UC..."
//   YOUTUBE_HANDLE / YT_HANDLE         = handle without "@", used only if no ID exists

const DEFAULT_CHANNEL_ID = "UCHKwJh6VHC2lowDCH4w347A";
const DEFAULT_HANDLE = "lablifepodcast";
const DEFAULT_LIMIT = 12;

function queryValue(req, key) {
  try {
    const origin = `https://${req.headers.host || "lablifehub.com"}`;
    return new URL(req.url, origin).searchParams.get(key);
  } catch (_) {
    return null;
  }
}

function decodeXml(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

function tagValue(block, tagName) {
  const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = block.match(re);
  return match ? decodeXml(match[1]) : "";
}

function attrValue(block, tagName, attrName) {
  const re = new RegExp(`<${tagName}[^>]*\\s${attrName}=["']([^"']+)["'][^>]*>`, "i");
  const match = block.match(re);
  return match ? decodeXml(match[1]) : "";
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "Accept": "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      "User-Agent": "LabLifeHub/1.0 (+https://lablifehub.com)",
    },
  });

  if (!response.ok) {
    throw new Error(`YouTube responded with ${response.status}`);
  }

  return response.text();
}

async function resolveChannelId() {
  const configured =
    (process.env.YOUTUBE_CHANNEL_ID || process.env.YT_CHANNEL_ID || "").trim();

  if (configured) {
    return { channelId: configured, source: "env" };
  }

  if (DEFAULT_CHANNEL_ID) {
    return { channelId: DEFAULT_CHANNEL_ID, source: "default" };
  }

  const handle = (process.env.YOUTUBE_HANDLE || process.env.YT_HANDLE || DEFAULT_HANDLE)
    .replace(/^@/, "")
    .trim();

  const html = await fetchText(`https://www.youtube.com/@${encodeURIComponent(handle)}`);
  const match =
    html.match(/"channelId":"(UC[0-9A-Za-z_-]{20,})"/) ||
    html.match(/"externalId":"(UC[0-9A-Za-z_-]{20,})"/) ||
    html.match(/\/channel\/(UC[0-9A-Za-z_-]{20,})/);

  if (!match) {
    throw new Error(`Could not resolve YouTube channel for @${handle}`);
  }

  return { channelId: match[1], source: `handle:${handle}` };
}

function parseFeed(xml, limit) {
  return [...String(xml || "").matchAll(/<entry\b[\s\S]*?<\/entry>/gi)]
    .map(([entry]) => {
      const id =
        tagValue(entry, "yt:videoId") ||
        tagValue(entry, "id").replace(/^yt:video:/, "");

      if (!/^[0-9A-Za-z_-]{6,}$/.test(id)) return null;

      return {
        id,
        title: tagValue(entry, "title") || tagValue(entry, "media:title"),
        description: tagValue(entry, "media:description"),
        publishedAt: tagValue(entry, "published") || tagValue(entry, "updated"),
        thumbnail:
          attrValue(entry, "media:thumbnail", "url") ||
          `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        url: attrValue(entry, "link", "href") || `https://www.youtube.com/watch?v=${id}`,
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, limit);
}

module.exports = async (req, res) => {
  const requestedLimit = Number(queryValue(req, "limit"));
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 50)
    : DEFAULT_LIMIT;
  const debug = queryValue(req, "debug") === "1";

  try {
    const { channelId, source } = await resolveChannelId();
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
    const xml = await fetchText(feedUrl);
    const episodes = parseFeed(xml, limit);

    res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");
    return res.status(200).json({
      configured: true,
      source: "youtube-rss",
      channelId,
      resolvedFrom: source,
      episodes,
    });
  } catch (error) {
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    return res.status(200).json({
      configured: true,
      source: "youtube-rss",
      error: debug ? String(error && error.message ? error.message : error) : "youtube_feed_unavailable",
      episodes: [],
    });
  }
};
