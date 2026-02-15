-- H3 Studios - Google Reviews Cache
-- Stores Google Places API reviews with sync metadata

-- Google reviews cache
CREATE TABLE IF NOT EXISTS google_reviews (
  id TEXT PRIMARY KEY,
  google_review_id TEXT UNIQUE NOT NULL,
  author_name TEXT NOT NULL,
  author_photo_url TEXT,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  text TEXT,
  text_original TEXT,
  relative_time TEXT,
  publish_time TEXT,
  google_maps_uri TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Settings for sync metadata
-- Will use existing settings table with key 'google_reviews_sync'
-- Value will be JSON: { "lastSync": "2026-01-15T...", "totalReviews": 5, "averageRating": 5.0 }

CREATE INDEX IF NOT EXISTS idx_google_reviews_rating ON google_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_google_reviews_publish_time ON google_reviews(publish_time);
