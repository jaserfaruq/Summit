/**
 * Batch YouTube search for exercise demo videos.
 * Uses YouTube Data API v3 to find the best demo video for each exercise.
 * Run: npx tsx scripts/search-youtube-demos.ts
 *
 * Reads exercises from /tmp/summit-exercises-need-videos.json
 * Writes results to /tmp/summit-youtube-results.json
 */

import * as fs from "fs";
import * as path from "path";
import * as https from "https";

// Load .env.local
const envPath = path.resolve(__dirname, "../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const value = trimmed.slice(eqIdx + 1).trim();
  if (!process.env[key]) process.env[key] = value;
}

const API_KEY = process.env.YOUTUBE_API_KEY;
if (!API_KEY) {
  console.error("YOUTUBE_API_KEY not found in .env.local");
  process.exit(1);
}

// Preferred channels for quality demos
const PREFERRED_CHANNELS = [
  "mountain tactical institute",
  "mti",
  "calisthenicmovement",
  "gmb fitness",
  "mark wildman",
  "jeff nippard",
  "hybrid calisthenics",
  "lattice training",
  "tom merrick",
  "yoga with adriene",
  "alan thrall",
  "athlean-x",
  "antranik",
  "movement for climbers",
  "power company climbing",
  "eric horst",
  "magnus midtbø",
  "bouldering bobat",
  "metolius climbing",
];

interface YouTubeSearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    description: string;
  };
}

interface VideoResult {
  exerciseName: string;
  youtubeId: string;
  title: string;
  channelName: string;
  score: number;
}

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk: string) => (data += chunk));
      res.on("end", () => resolve(data));
      res.on("error", reject);
    }).on("error", reject);
  });
}

function scoreResult(
  item: YouTubeSearchItem,
  exerciseName: string
): number {
  let score = 0;
  const title = item.snippet.title.toLowerCase();
  const channel = item.snippet.channelTitle.toLowerCase();
  const desc = item.snippet.description.toLowerCase();
  const exercise = exerciseName.toLowerCase();

  // Channel preference
  for (const preferred of PREFERRED_CHANNELS) {
    if (channel.includes(preferred)) {
      score += 30;
      break;
    }
  }

  // Title contains exercise name (full or partial match)
  const exerciseWords = exercise.split(/\s+/);
  const matchedWords = exerciseWords.filter((w) => title.includes(w));
  score += (matchedWords.length / exerciseWords.length) * 20;

  // Exact exercise name in title
  if (title.includes(exercise)) score += 15;

  // Tutorial/demo/how-to keywords in title
  const tutorialKeywords = [
    "tutorial",
    "how to",
    "technique",
    "form",
    "demo",
    "demonstration",
    "proper",
    "exercise guide",
    "movement",
    "explained",
  ];
  for (const kw of tutorialKeywords) {
    if (title.includes(kw)) {
      score += 5;
      break;
    }
  }

  // Penalize compilations and listicles
  const penaltyKeywords = [
    "top 10",
    "top 5",
    "best exercises",
    "full workout",
    "routine",
    "challenge",
    "day in",
    "vlog",
    "transformation",
    "reaction",
  ];
  for (const kw of penaltyKeywords) {
    if (title.includes(kw)) {
      score -= 10;
      break;
    }
  }

  // Bonus for short descriptions mentioning the exercise (focused video)
  if (desc.includes(exercise)) score += 5;

  return score;
}

async function searchExercise(
  exerciseName: string
): Promise<VideoResult | null> {
  const query = `${exerciseName} exercise demonstration tutorial`;
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=5&q=${encodeURIComponent(query)}&key=${API_KEY}`;

  try {
    const raw = await httpsGet(url);
    const data = JSON.parse(raw);

    if (data.error) {
      console.error(`  API error for "${exerciseName}":`, data.error.message);
      return null;
    }

    const items: YouTubeSearchItem[] = data.items || [];
    if (items.length === 0) return null;

    // Score and rank results
    const scored = items.map((item) => ({
      item,
      score: scoreResult(item, exerciseName),
    }));
    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];
    return {
      exerciseName,
      youtubeId: best.item.id.videoId,
      title: best.item.snippet.title,
      channelName: best.item.snippet.channelTitle,
      score: best.score,
    };
  } catch (err) {
    console.error(
      `  Error searching "${exerciseName}":`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

async function main() {
  // Read exercise list
  const inputPath = "/tmp/summit-exercises-need-videos.json";
  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const input = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
  const exercises: string[] = input.exercises;

  // Filter out exercises that already have curated videos
  const alreadyCurated = new Set([
    "step-ups",
    "pull-ups",
    "push-ups",
    "squats",
    "deadlifts",
    "lunges",
    "dead hangs",
    "farmer carries",
    "planks",
    "leg blasters",
    "turkish get-ups",
    "hip flexor stretches",
    "pigeon pose",
    "deep squat hold",
  ]);

  const toSearch = exercises.filter((e) => !alreadyCurated.has(e));
  console.log(`Total exercises: ${exercises.length}`);
  console.log(`Already curated: ${alreadyCurated.size}`);
  console.log(`Need to search: ${toSearch.length}`);
  console.log("");

  const results: VideoResult[] = [];
  const failed: string[] = [];
  let quotaUsed = 0;

  // Process in batches of 5 with delays to stay within quota
  const BATCH_SIZE = 5;
  const DELAY_MS = 500; // 500ms between batches

  for (let i = 0; i < toSearch.length; i += BATCH_SIZE) {
    const batch = toSearch.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(toSearch.length / BATCH_SIZE);

    console.log(
      `Batch ${batchNum}/${totalBatches}: ${batch.join(", ")}`
    );

    const batchResults = await Promise.all(
      batch.map((name) => searchExercise(name))
    );

    for (let j = 0; j < batch.length; j++) {
      const result = batchResults[j];
      if (result) {
        results.push(result);
        console.log(
          `  ✓ ${batch[j]} → "${result.title}" by ${result.channelName} (score: ${result.score})`
        );
      } else {
        failed.push(batch[j]);
        console.log(`  ✗ ${batch[j]} — no results`);
      }
    }

    quotaUsed += batch.length * 100; // Each search costs ~100 quota units

    // Save progress after each batch
    const outputPath = "/tmp/summit-youtube-results.json";
    fs.writeFileSync(
      outputPath,
      JSON.stringify(
        {
          results,
          failed,
          progress: {
            searched: i + batch.length,
            total: toSearch.length,
            quotaUsed,
          },
        },
        null,
        2
      )
    );

    // Rate limit delay
    if (i + BATCH_SIZE < toSearch.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`\n=== Done ===`);
  console.log(`Found videos: ${results.length}`);
  console.log(`Failed: ${failed.length}`);
  console.log(`Quota used: ~${quotaUsed} units (daily limit: 10,000)`);
  console.log(`Results: /tmp/summit-youtube-results.json`);

  if (failed.length > 0) {
    console.log(`\nFailed exercises:`);
    failed.forEach((f) => console.log(`  - ${f}`));
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
