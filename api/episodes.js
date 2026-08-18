// Vercel Serverless Function - returns LabLifePodcast YouTube episodes as JSON.
//
// Set these in Vercel → Project → Settings → Environment Variables:
//   YT_API_KEY     = YouTube Data API v3 key (Google Cloud Console, free)
//   YT_CHANNEL_ID  = the channel ID (starts with "UC...")
//
// Until both are set, this returns { configured:false, episodes:[] }
// and the site shows placeholder cards.

module.exports = async (req, res) => {
  const apiKey = process.env.YT_API_KEY;
  const channelId = process.env.YT_CHANNEL_ID;

  if (!apiKey || !channelId) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ configured: false, episodes: [] });
  }

  // A channel's "uploads" playlist ID is the channel ID with "UC" -> "UU".
  const uploadsId = "UU" + channelId.slice(2);
  const url =
    "https://www.googleapis.com/youtube/v3/playlistItems" +
    "?part=snippet&maxResults=50" +
    "&playlistId=" + encodeURIComponent(uploadsId) +
    "&key=" + encodeURIComponent(apiKey);

  try {
    const r = await fetch(url);
    if (!r.ok) {
      const detail = await r.text();
      return res
        .status(502)
        .json({ configured: true, error: "YouTube API error", detail, episodes: [] });
    }

    const data = await r.json();
    const episodes = (data.items || [])
      .filter(
        (it) =>
          it.snippet &&
          it.snippet.resourceId &&
          it.snippet.resourceId.videoId &&
          it.snippet.title !== "Private video" &&
          it.snippet.title !== "Deleted video"
      )
      .map((it) => {
        const s = it.snippet;
        const th = s.thumbnails || {};
        const thumb =
          (th.maxres || th.high || th.medium || th.default || {}).url || "";
        return {
          id: s.resourceId.videoId,
          title: s.title,
          description: s.description,
          publishedAt: s.publishedAt,
          thumbnail: thumb,
        };
      })
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    // Cache at Vercel's edge for 1h, serve stale up to 1 day while revalidating.
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).json({ configured: true, episodes });
  } catch (e) {
    return res.status(500).json({ configured: true, error: String(e), episodes: [] });
  }
};
