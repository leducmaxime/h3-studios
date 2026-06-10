export interface InstagramChild {
  id: string;
  media_type: string;
  media_url: string;
  thumbnail_url?: string;
}

export interface InstagramPost {
  id: string;
  caption: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url: string;
  permalink: string;
  thumbnail_url?: string;
  timestamp: string;
  children?: InstagramChild[];
}

export interface InstagramFeed {
  data: InstagramPost[];
  last_updated: string;
}

const RSS_APP_FEED_URL = "https://rss.app/feeds/wpmloa9fZdyyGMag.xml";

async function fetchMediaPosts(accessToken: string): Promise<InstagramPost[]> {
  const response = await fetch(
    `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp&limit=51&access_token=${accessToken}`,
    { cf: { cacheTtl: 3600 } }
  );

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Instagram API error: ${response.status} ${errorData}`);
  }

  const data = await response.json() as {
    data: Array<{
      id: string;
      caption: string;
      media_type: string;
      media_url: string;
      permalink: string;
      thumbnail_url?: string;
      timestamp: string;
    }>;
  };

  const posts: InstagramPost[] = [];

  for (const item of data.data || []) {
    let mediaUrl = item.media_url;
    let thumbnailUrl = item.thumbnail_url;
    let children: InstagramChild[] | undefined;

    if (item.media_type === "CAROUSEL_ALBUM") {
      try {
        const childrenResponse = await fetch(
          `https://graph.instagram.com/${item.id}/children?fields=id,media_type,media_url,thumbnail_url&access_token=${accessToken}`,
          { cf: { cacheTtl: 3600 } }
        );

        if (childrenResponse.ok) {
          const childrenData = await childrenResponse.json() as {
            data: InstagramChild[];
          };

          if (childrenData.data && childrenData.data.length > 0) {
            children = childrenData.data;
            const firstChild = childrenData.data[0];
            mediaUrl = firstChild.media_url;
            if (firstChild.thumbnail_url) {
              thumbnailUrl = firstChild.thumbnail_url;
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch carousel children:", err);
      }
    }

    posts.push({
      id: item.id,
      caption: item.caption || "",
      media_type: item.media_type as "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM",
      media_url: mediaUrl,
      permalink: item.permalink,
      thumbnail_url: thumbnailUrl,
      timestamp: item.timestamp,
      children,
    });
  }

  return posts;
}

async function parseInstagramPosts(data: { data: Array<{ id: string; caption: string; media_type: string; media_url: string; permalink: string; thumbnail_url?: string; timestamp: string }> }, accessToken: string): Promise<InstagramPost[]> {
  const posts: InstagramPost[] = [];

  for (const item of data.data || []) {
    let mediaUrl = item.media_url;
    let thumbnailUrl = item.thumbnail_url;
    let children: InstagramChild[] | undefined;

    if (item.media_type === "CAROUSEL_ALBUM") {
      try {
        const childrenResponse = await fetch(
          `https://graph.instagram.com/${item.id}/children?fields=id,media_type,media_url,thumbnail_url&access_token=${accessToken}`,
          { cf: { cacheTtl: 3600 } }
        );

        if (childrenResponse.ok) {
          const childrenData = await childrenResponse.json() as {
            data: InstagramChild[];
          };

          if (childrenData.data && childrenData.data.length > 0) {
            children = childrenData.data;
            const firstChild = childrenData.data[0];
            mediaUrl = firstChild.media_url;
            if (firstChild.thumbnail_url) {
              thumbnailUrl = firstChild.thumbnail_url;
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch carousel children:", err);
      }
    }

    posts.push({
      id: item.id,
      caption: item.caption || "",
      media_type: item.media_type as "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM",
      media_url: mediaUrl,
      permalink: item.permalink,
      thumbnail_url: thumbnailUrl,
      timestamp: item.timestamp,
      children,
    });
  }

  return posts;
}

async function fetchTaggedPosts(accessToken: string): Promise<InstagramPost[]> {
  try {
    const response = await fetch(
      `https://graph.instagram.com/me/tags?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp&limit=50&access_token=${accessToken}`,
      { cf: { cacheTtl: 3600 } }
    );

    if (!response.ok) {
      console.error("Instagram tags API error:", response.status, await response.text());
      return [];
    }

    const data = await response.json() as {
      data: Array<{
        id: string;
        caption: string;
        media_type: string;
        media_url: string;
        permalink: string;
        thumbnail_url?: string;
        timestamp: string;
      }>;
    };

    return parseInstagramPosts(data, accessToken);
  } catch (err) {
    console.error("Failed to fetch tagged posts:", err);
    return [];
  }
}

export async function fetchInstagramFeedFromAPI(accessToken: string): Promise<InstagramPost[]> {
  const [ownPosts, taggedPosts] = await Promise.all([
    fetchMediaPosts(accessToken),
    fetchTaggedPosts(accessToken),
  ]);

  // Combine and remove duplicates by id
  const seen = new Set<string>();
  const combined: InstagramPost[] = [];

  for (const post of [...ownPosts, ...taggedPosts]) {
    if (!seen.has(post.id)) {
      seen.add(post.id);
      combined.push(post);
    }
  }

  // Sort by timestamp descending (newest first)
  combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return combined;
}

export async function fetchInstagramFeedFromRSS(): Promise<InstagramPost[]> {
  const response = await fetch(RSS_APP_FEED_URL, {
    cf: { cacheTtl: 3600 }
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`RSS feed error (${response.status}): ${body || response.statusText}. Configurez un token Instagram dans l'admin pour éviter ce fallback.`);
  }

  const xmlText = await response.text();
  const posts = parseRSSFeed(xmlText);
  return posts;
}

function parseRSSFeed(xmlText: string): InstagramPost[] {
  const items = xmlText.match(/<item>[\s\S]*?<\/item>/g) || [];

  const posts: InstagramPost[] = [];

  items.slice(0, 12).forEach((itemXml) => {
    const titleMatch = itemXml.match(/<title>\s*<!\[CDATA\[(.*?)\]\]>\s*<\/title>/);
    const title = titleMatch ? titleMatch[1] : (itemXml.match(/<title>(.*?)<\/title>/)?.[1] || "");

    const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
    const link = linkMatch ? linkMatch[1] : "";

    const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);
    const pubDate = pubDateMatch ? pubDateMatch[1] : "";

    const guidMatch = itemXml.match(/<guid[^>]*>(.*?)<\/guid>/);
    const guid = guidMatch ? guidMatch[1] : "";

    let mediaUrl = "";

    const mediaContentMatch = itemXml.match(/<media:content[^>]*url="([^"]+)"/);
    if (mediaContentMatch) {
      mediaUrl = mediaContentMatch[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"');
    }

    if (!mediaUrl) {
      const imgMatch = itemXml.match(/<img[^>]+src="([^"]+)"/);
      if (imgMatch) {
        mediaUrl = imgMatch[1]
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"');
      }
    }

    const mediaType = itemXml.includes('medium="video"') || title.toLowerCase().includes("reel")
      ? "VIDEO"
      : "IMAGE";

    posts.push({
      id: guid || link,
      caption: title,
      media_type: mediaType as "IMAGE" | "VIDEO",
      media_url: mediaUrl,
      permalink: link,
      thumbnail_url: mediaUrl,
      timestamp: new Date(pubDate).toISOString(),
    });
  });

  return posts;
}

export async function syncInstagram(db: D1Database, accessToken?: string): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const posts = accessToken
      ? await fetchInstagramFeedFromAPI(accessToken)
      : await fetchInstagramFeedFromRSS();

    await db.prepare(
      "INSERT OR REPLACE INTO settings (id, key, value, updated_at) VALUES (?, ?, ?, datetime('now'))"
    ).bind("instagram-feed", "instagram_feed_cache", JSON.stringify({
      data: posts,
      last_updated: new Date().toISOString()
    })).run();

    return { success: true, count: posts.length };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error during Instagram sync"
    };
  }
}

export async function getCachedInstagramFeed(db: D1Database): Promise<InstagramPost[]> {
  const cache = await db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .bind("instagram_feed_cache")
    .first<{ value: string }>();

  if (!cache?.value) return [];

  try {
    const feed = JSON.parse(cache.value) as InstagramFeed;
    return feed.data;
  } catch {
    return [];
  }
}
