export interface GoogleReview {
  id: string;
  google_review_id: string;
  author_name: string;
  author_photo_url: string | null;
  rating: number;
  text: string | null;
  text_original: string | null;
  relative_time: string | null;
  publish_time: string | null;
  google_maps_uri: string | null;
  created_at: string;
}

export interface GoogleReviewsSyncData {
  lastSync: string;
  totalReviews: number;
  averageRating: number;
}

interface GoogleApiReview {
  name: string;
  rating: number;
  text?: { text: string; languageCode: string };
  originalText?: { text: string; languageCode: string };
  relativePublishTimeDescription?: string;
  publishTime?: string;
  authorAttribution?: {
    displayName: string;
    photoUri?: string;
    uri?: string;
  };
  googleMapsUri?: string;
}

const PLACE_ID = "ChIJi9IayzcL5kcRKCQIsydm0kA";

export async function fetchGoogleReviews(apiKey: string): Promise<{
  reviews: GoogleApiReview[];
  rating: number;
  userRatingCount: number;
}> {
  const response = await fetch(
    `https://places.googleapis.com/v1/places/${PLACE_ID}?languageCode=fr`,
    {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "reviews,rating,userRatingCount",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Google API error: ${response.status}`);
  }

  const data = await response.json() as { reviews?: GoogleApiReview[]; rating?: number; userRatingCount?: number };
  return {
    reviews: data.reviews || [],
    rating: data.rating || 0,
    userRatingCount: data.userRatingCount || 0,
  };
}

export async function getStoredReviews(db: D1Database): Promise<GoogleReview[]> {
  const result = await db
    .prepare("SELECT * FROM google_reviews ORDER BY publish_time DESC")
    .all<GoogleReview>();
  return result.results;
}

export async function getReviewsSyncData(db: D1Database): Promise<GoogleReviewsSyncData | null> {
  const setting = await db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .bind("google_reviews_sync")
    .first<{ value: string }>();

  if (!setting) return null;

  try {
    return JSON.parse(setting.value) as GoogleReviewsSyncData;
  } catch {
    return null;
  }
}

export async function syncReviewsToDatabase(
  db: D1Database,
  reviews: GoogleApiReview[],
  averageRating: number,
  totalReviews: number
): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM google_reviews"),
    ...reviews.map((review) => {
      const reviewId = review.name?.split("/").pop() || crypto.randomUUID();
      return db
        .prepare(
          `INSERT INTO google_reviews (
            id, google_review_id, author_name, author_photo_url, rating,
            text, text_original, relative_time, publish_time, google_maps_uri, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        )
        .bind(
          `rev-${crypto.randomUUID().slice(0, 8)}`,
          reviewId,
          review.authorAttribution?.displayName || "Anonyme",
          review.authorAttribution?.photoUri || null,
          review.rating,
          review.text?.text || null,
          review.originalText?.text || null,
          review.relativePublishTimeDescription || null,
          review.publishTime || null,
          review.googleMapsUri || null
        );
    }),
    db
      .prepare(
        `INSERT OR REPLACE INTO settings (id, key, value, updated_at)
         VALUES ('google-reviews-sync', 'google_reviews_sync', ?, datetime('now'))`
      )
      .bind(
        JSON.stringify({
          lastSync: new Date().toISOString(),
          totalReviews,
          averageRating,
        } as GoogleReviewsSyncData)
      ),
  ]);
}

export async function syncGoogleReviews(
  db: D1Database,
  apiKey: string
): Promise<{ success: boolean; reviewsCount: number; averageRating: number; totalReviews: number; error?: string }> {
  try {
    const { reviews, rating, userRatingCount } = await fetchGoogleReviews(apiKey);

    await syncReviewsToDatabase(db, reviews, rating, userRatingCount || reviews.length);

    return {
      success: true,
      reviewsCount: reviews.length,
      averageRating: rating,
      totalReviews: userRatingCount || reviews.length,
    };
  } catch (error) {
    return {
      success: false,
      reviewsCount: 0,
      averageRating: 0,
      totalReviews: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
