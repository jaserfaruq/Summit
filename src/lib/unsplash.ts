const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

interface UnsplashPhoto {
  id: string;
  urls: {
    raw: string;
    full: string;
    regular: string; // 1080px wide
    small: string;
  };
  description: string | null;
  alt_description: string | null;
}

interface UnsplashSearchResponse {
  total: number;
  results: UnsplashPhoto[];
}

/**
 * Search Unsplash for a hero image of a mountain objective.
 * Returns a URL sized for a blurred background (1200px wide).
 *
 * Strategy:
 * 1. Search for the specific objective name (e.g., "Mont Blanc mountain").
 *    If Unsplash returns results, the top hit is usually high quality.
 * 2. If no results, fall back to a generic mountain landscape search.
 */
export async function fetchHeroImageUrl(objectiveName: string): Promise<string | null> {
  if (!UNSPLASH_ACCESS_KEY) {
    console.warn("UNSPLASH_ACCESS_KEY not set — skipping hero image");
    return null;
  }

  // Try specific search first
  const specificUrl = await searchUnsplash(`${objectiveName} mountain summit`, 1);
  if (specificUrl) return specificUrl;

  // Fall back to generic mountain
  const genericUrl = await searchUnsplash("mountain summit landscape", 1);
  return genericUrl;
}

async function searchUnsplash(query: string, perPage: number): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      query,
      per_page: String(perPage),
      orientation: "landscape",
      content_filter: "high",
    });

    const res = await fetch(
      `https://api.unsplash.com/search/photos?${params}`,
      {
        headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
        next: { revalidate: 86400 }, // cache for 24h
      }
    );

    if (!res.ok) {
      console.error(`Unsplash API error: ${res.status}`);
      return null;
    }

    const data: UnsplashSearchResponse = await res.json();
    if (data.results.length === 0) return null;

    // Use the raw URL with width parameter for optimal sizing
    // w=1200 is enough for a blurred background; q=80 keeps file size reasonable
    const photo = data.results[0];
    return `${photo.urls.raw}&w=1200&q=80&fit=crop`;
  } catch (error) {
    console.error("Unsplash search failed:", error);
    return null;
  }
}
