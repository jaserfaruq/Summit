const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

interface UnsplashSearchResponse {
  total: number;
  results: {
    urls: { raw: string };
  }[];
}

/**
 * Fetch a hero image URL for a mountain objective.
 *
 * Strategy (in order):
 * 1. If UNSPLASH_ACCESS_KEY is set, search Unsplash for the specific objective.
 * 2. Fall back to an inline SVG mountain scene (always available, no API key needed).
 *
 * The SVG fallback is designed to look good when rendered with CSS blur
 * as a background — it produces a mountain silhouette with sky gradient.
 */
export async function fetchHeroImageUrl(objectiveName: string): Promise<string> {
  if (UNSPLASH_ACCESS_KEY) {
    // Try specific objective search
    const specificUrl = await searchUnsplash(`${objectiveName} mountain summit`, 1);
    if (specificUrl) return specificUrl;

    // Try generic mountain
    const genericUrl = await searchUnsplash("mountain summit landscape", 1);
    if (genericUrl) return genericUrl;
  }

  // SVG fallback — always works, no API key needed
  return buildMountainSvgDataUri();
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
        next: { revalidate: 86400 },
      }
    );

    if (!res.ok) {
      console.error(`Unsplash API error: ${res.status}`);
      return null;
    }

    const data: UnsplashSearchResponse = await res.json();
    if (data.results.length === 0) return null;

    const photo = data.results[0];
    return `${photo.urls.raw}&w=1200&q=80&fit=crop`;
  } catch (error) {
    console.error("Unsplash search failed:", error);
    return null;
  }
}

/**
 * Generate a mountain landscape SVG as a data URI.
 * Produces a scenic mountain silhouette with sky gradient that
 * looks natural when rendered with CSS blur on the plan page.
 */
function buildMountainSvgDataUri(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a1a2e"/>
      <stop offset="40%" stop-color="#16213e"/>
      <stop offset="70%" stop-color="#1b4d3e"/>
      <stop offset="100%" stop-color="#0f3d3e"/>
    </linearGradient>
    <linearGradient id="glow" x1="0.5" y1="0" x2="0.5" y2="1">
      <stop offset="0%" stop-color="#d4782f" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#d4782f" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="mtn1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2a3a30"/>
      <stop offset="100%" stop-color="#1a2a20"/>
    </linearGradient>
    <linearGradient id="mtn2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1f2f25"/>
      <stop offset="100%" stop-color="#0f1f15"/>
    </linearGradient>
    <linearGradient id="snow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e8e8e8" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#c0c0c0" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="400" fill="url(#sky)"/>
  <ellipse cx="600" cy="120" rx="300" ry="60" fill="url(#glow)"/>
  <polygon points="0,400 150,180 300,280 500,120 650,220 800,160 950,240 1050,140 1200,250 1200,400" fill="url(#mtn1)" opacity="0.7"/>
  <polygon points="500,120 520,130 540,125 500,120" fill="url(#snow)"/>
  <polygon points="800,160 825,172 845,168 800,160" fill="url(#snow)"/>
  <polygon points="1050,140 1075,155 1090,150 1050,140" fill="url(#snow)"/>
  <polygon points="0,400 100,250 250,320 400,200 550,300 700,230 850,290 1000,210 1100,280 1200,220 1200,400" fill="url(#mtn2)"/>
</svg>`;

  const encoded = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${encoded}`;
}
