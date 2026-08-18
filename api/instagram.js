// Vercel Serverless Function - returns recent public Instagram posts.
//
// This uses Instagram's public web profile endpoint, without plugins or tokens.
// It can be rate-limited or changed by Instagram, so the front-end keeps a
// local curated fallback from the first LabLifeHub post.

const USERNAME = "lablife.hub";
const IG_APP_ID = "936619743392459";
const PROFILE_URL = "https://www.instagram.com/" + USERNAME + "/";
const API_HOSTS = ["https://www.instagram.com", "https://i.instagram.com"];
const GRAPH_TOKEN = process.env.IG_ACCESS_TOKEN || process.env.INSTAGRAM_ACCESS_TOKEN;

function cleanCaption(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function mapNode(node) {
  const caption =
    node.edge_media_to_caption &&
    node.edge_media_to_caption.edges &&
    node.edge_media_to_caption.edges[0] &&
    node.edge_media_to_caption.edges[0].node
      ? node.edge_media_to_caption.edges[0].node.text
      : "";
  const children =
    node.edge_sidecar_to_children && Array.isArray(node.edge_sidecar_to_children.edges)
      ? node.edge_sidecar_to_children.edges.map((edge) => {
          const child = edge.node || {};
          return {
            image: child.thumbnail_src || child.display_url || "",
            isVideo: Boolean(child.is_video),
          };
        })
      : [];

  return {
    shortcode: node.shortcode,
    url: "https://www.instagram.com/p/" + node.shortcode + "/",
    image: node.thumbnail_src || node.display_url || "",
    isVideo: Boolean(node.is_video),
    caption: cleanCaption(caption),
    children,
  };
}

function shortcodeFromPermalink(permalink) {
  const match = String(permalink || "").match(/instagram\.com\/(?:p|reel)\/([^/]+)/);
  return match ? match[1] : "";
}

function mapGraphMedia(item) {
  const mediaType = item.media_type || "";
  const image = mediaType === "VIDEO" ? item.thumbnail_url || item.media_url || "" : item.media_url || "";
  return {
    shortcode: shortcodeFromPermalink(item.permalink) || item.id,
    url: item.permalink || PROFILE_URL,
    image,
    isVideo: mediaType === "VIDEO",
    caption: cleanCaption(item.caption),
    timestamp: item.timestamp || "",
    children: [],
  };
}

async function fetchGraphPosts(limit) {
  const url =
    "https://graph.instagram.com/me/media" +
    "?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp" +
    "&limit=" +
    encodeURIComponent(String(limit)) +
    "&access_token=" +
    encodeURIComponent(GRAPH_TOKEN);

  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) {
    return {
      ok: false,
      source: "graph",
      upstreamStatus: r.status,
      detail: (await r.text()).slice(0, 500),
    };
  }

  const data = await r.json();
  return {
    ok: true,
    source: "graph",
    posts: Array.isArray(data.data) ? data.data.map(mapGraphMedia).filter((post) => post.image) : [],
  };
}

async function fetchProfile(host) {
  const url =
    host + "/api/v1/users/web_profile_info/?username=" + encodeURIComponent(USERNAME);

  const r = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: PROFILE_URL,
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      "x-asbd-id": "129477",
      "x-ig-app-id": IG_APP_ID,
    },
  });

  if (!r.ok) {
    return {
      ok: false,
      upstreamStatus: r.status,
      upstreamHost: host,
      detail: (await r.text()).slice(0, 500),
    };
  }

  return { ok: true, upstreamHost: host, data: await r.json() };
}

module.exports = async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit || "6", 10) || 6, 1), 6);

  try {
    if (GRAPH_TOKEN) {
      const graph = await fetchGraphPosts(limit);
      if (graph.ok) {
        res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=86400");
        return res.status(200).json({
          ok: true,
          configured: true,
          source: "graph",
          username: USERNAME,
          profileUrl: PROFILE_URL,
          posts: graph.posts,
        });
      }

      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=1800");
      return res.status(200).json({
        ok: false,
        configured: true,
        source: "graph",
        upstream: graph,
        posts: [],
      });
    }

    let result = null;
    for (const host of API_HOSTS) {
      result = await fetchProfile(host);
      if (result.ok) break;
    }

    if (!result || !result.ok) {
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=1800");
      return res.status(200).json({
        ok: false,
        configured: false,
        upstream: result || null,
        posts: [],
      });
    }

    const data = result.data;
    const user = data && data.data && data.data.user;
    const edges =
      user &&
      user.edge_owner_to_timeline_media &&
      Array.isArray(user.edge_owner_to_timeline_media.edges)
        ? user.edge_owner_to_timeline_media.edges
        : [];
    const posts = edges.slice(0, limit).map((edge) => mapNode(edge.node || {}));

    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=86400");
    return res.status(200).json({
      ok: true,
      configured: true,
      username: USERNAME,
      profileUrl: PROFILE_URL,
      upstreamHost: result.upstreamHost,
      posts,
    });
  } catch (e) {
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=1800");
    return res.status(200).json({ ok: false, configured: false, error: String(e), posts: [] });
  }
};
