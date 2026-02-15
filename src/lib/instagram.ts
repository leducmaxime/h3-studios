export interface InstagramPost {
  id: string;
  caption: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url: string;
  permalink: string;
  thumbnail_url?: string;
  timestamp: string;
}

export interface InstagramFeed {
  data: InstagramPost[];
  last_updated: string;
}

const INSTAGRAM_GRAPH_URL = "https://graph.instagram.com";

export async function fetchInstagramFeed(accessToken: string): Promise<InstagramPost[]> {
  const fields = "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp";
  const url = `${INSTAGRAM_GRAPH_URL}/me/media?fields=${fields}&access_token=${accessToken}&limit=12`;

  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json() as any;
    throw new Error(`Instagram API error: ${error?.error?.message || response.statusText}`);
  }

  const json = await response.json() as { data: InstagramPost[] };
  return json.data;
}

export async function refreshInstagramToken(accessToken: string): Promise<string> {
  const url = `${INSTAGRAM_GRAPH_URL}/refresh_access_token?grant_type=ig_refresh_token&access_token=${accessToken}`;

  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json() as any;
    throw new Error(`Instagram token refresh error: ${error?.error?.message || response.statusText}`);
  }

  const json = await response.json() as { access_token: string };
  return json.access_token;
}

export async function syncInstagram(db: D1Database): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const tokenSetting = await db
      .prepare("SELECT value FROM settings WHERE key = ?")
      .bind("instagram_access_token")
      .first<{ value: string }>();

    if (!tokenSetting?.value) {
      return { success: false, error: "No Instagram access token configured" };
    }

    const currentToken = tokenSetting.value;
    const posts = await fetchInstagramFeed(currentToken);

    let newToken = currentToken;
    try {
      newToken = await refreshInstagramToken(currentToken);
    } catch (e) {
      console.error("Failed to refresh Instagram token, keeping current one:", e);
    }

    await db.batch([
      db.prepare("INSERT OR REPLACE INTO settings (id, key, value, updated_at) VALUES (?, ?, ?, datetime('now'))")
        .bind("instagram-token", "instagram_access_token", newToken),
      db.prepare("INSERT OR REPLACE INTO settings (id, key, value, updated_at) VALUES (?, ?, ?, datetime('now'))")
        .bind("instagram-feed", "instagram_feed_cache", JSON.stringify({
          data: posts,
          last_updated: new Date().toISOString()
        }))
    ]);

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
