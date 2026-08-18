// Vercel Serverless Function - returns recent public Instagram posts.
//
// This uses Instagram's public web profile endpoint, without plugins or tokens.
// It can be rate-limited or changed by Instagram, so the front-end keeps a
// local curated fallback from the first LabLifeHub post.

const USERNAME = "lablife.hub";
const IG_APP_ID = "936619743392459";

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

module.exports = async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit || "6", 10) || 6, 1), 6);
  const url =
    "https://www.instagram.com/api/v1/users/web_profile_info/?username=" +
    encodeURIComponent(USERNAME);

  try {
    const r = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.instagram.com/" + USERNAME + "/",
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
      const detail = await r.text();
      return res.status(502).json({ ok: false, configured: false, detail, posts: [] });
    }

    const data = await r.json();
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
      profileUrl: "https://www.instagram.com/" + USERNAME + "/",
      posts,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, configured: false, error: String(e), posts: [] });
  }
};
