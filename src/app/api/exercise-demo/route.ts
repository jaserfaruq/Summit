import { NextRequest, NextResponse } from "next/server";

interface YouTubeSearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: {
      medium: { url: string };
    };
  };
}

interface YouTubeSearchResponse {
  items?: YouTubeSearchItem[];
}

interface ExerciseDemoResult {
  videoId: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");

  if (!q) {
    return NextResponse.json(
      { error: "Missing query parameter" },
      { status: 400 }
    );
  }

  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ results: [] });
  }

  const searchQuery = `${q} exercise demonstration`;

  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "3",
    q: searchQuery,
    videoEmbeddable: "true",
    safeSearch: "strict",
    key: apiKey,
  });

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params}`,
      { next: { revalidate: 86400 } }
    );

    if (!res.ok) {
      console.error(`YouTube API error: ${res.status}`);
      return NextResponse.json({ results: [] });
    }

    const data: YouTubeSearchResponse = await res.json();

    if (!data.items || data.items.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const results: ExerciseDemoResult[] = data.items.map((item) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelName: item.snippet.channelTitle,
      thumbnailUrl: item.snippet.thumbnails.medium.url,
    }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error("YouTube search failed:", error);
    return NextResponse.json({ results: [] });
  }
}
