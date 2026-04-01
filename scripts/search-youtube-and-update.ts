/**
 * Searches YouTube for remaining exercises and prints entries to add to exercise-demos.ts.
 * Reads existing results from /tmp/summit-youtube-results.json, searches only for
 * exercises in the "failed" list, merges results, and prints TypeScript entries.
 *
 * Run: npx tsx scripts/search-youtube-and-update.ts
 *
 * After running, copy the printed entries into src/lib/exercise-demos.ts
 * in the appropriate category sections.
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

const PREFERRED_CHANNELS = [
  "mountain tactical institute", "mti", "calisthenicmovement", "gmb fitness",
  "mark wildman", "jeff nippard", "hybrid calisthenics", "lattice training",
  "tom merrick", "yoga with adriene", "alan thrall", "athlean-x", "antranik",
  "movement for climbers", "power company climbing", "eric horst",
  "magnus midtbø", "bouldering bobat", "metolius climbing",
];

interface YouTubeSearchItem {
  id: { videoId: string };
  snippet: { title: string; channelTitle: string; description: string };
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

function cleanTitle(t: string): string {
  return t.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function scoreResult(item: YouTubeSearchItem, exerciseName: string): number {
  let score = 0;
  const title = item.snippet.title.toLowerCase();
  const channel = item.snippet.channelTitle.toLowerCase();
  const desc = item.snippet.description.toLowerCase();
  const exercise = exerciseName.toLowerCase();

  for (const preferred of PREFERRED_CHANNELS) {
    if (channel.includes(preferred)) { score += 30; break; }
  }

  const exerciseWords = exercise.split(/\s+/);
  const matchedWords = exerciseWords.filter((w) => title.includes(w));
  score += (matchedWords.length / exerciseWords.length) * 20;
  if (title.includes(exercise)) score += 15;

  const tutorialKeywords = ["tutorial", "how to", "technique", "form", "demo", "demonstration", "proper", "exercise guide", "movement", "explained"];
  for (const kw of tutorialKeywords) { if (title.includes(kw)) { score += 5; break; } }

  const penaltyKeywords = ["top 10", "top 5", "best exercises", "full workout", "routine", "challenge", "day in", "vlog", "transformation", "reaction"];
  for (const kw of penaltyKeywords) { if (title.includes(kw)) { score -= 10; break; } }

  if (desc.includes(exercise)) score += 5;
  return score;
}

async function searchExercise(exerciseName: string): Promise<VideoResult | null> {
  const query = `${exerciseName} exercise demonstration tutorial`;
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=5&q=${encodeURIComponent(query)}&key=${API_KEY}`;

  try {
    const raw = await httpsGet(url);
    const data = JSON.parse(raw);
    if (data.error) {
      console.error(`  API error for "${exerciseName}":`, data.error.message?.replace(/<[^>]*>/g, ''));
      return null;
    }
    const items: YouTubeSearchItem[] = data.items || [];
    if (items.length === 0) return null;

    const scored = items.map((item) => ({ item, score: scoreResult(item, exerciseName) }));
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    return {
      exerciseName,
      youtubeId: best.item.id.videoId,
      title: cleanTitle(best.item.snippet.title),
      channelName: best.item.snippet.channelTitle.trim(),
      score: best.score,
    };
  } catch (err) {
    console.error(`  Error searching "${exerciseName}":`, err instanceof Error ? err.message : err);
    return null;
  }
}

function escapeForTS(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function main() {
  const resultsPath = "/tmp/summit-youtube-results.json";
  if (!fs.existsSync(resultsPath)) {
    console.error("No existing results file found. Run search-youtube-demos.ts first.");
    process.exit(1);
  }

  const existing = JSON.parse(fs.readFileSync(resultsPath, "utf-8"));
  const results: VideoResult[] = existing.results || [];
  const toRetry: string[] = existing.failed || [];

  if (toRetry.length === 0) {
    console.log("No failed exercises to retry! All exercises have videos.");
    return;
  }

  console.log(`Searching ${toRetry.length} exercises...\n`);
  const newResults: VideoResult[] = [];
  const newFailed: string[] = [];
  const BATCH_SIZE = 3;
  const DELAY_MS = 1500;

  for (let i = 0; i < toRetry.length; i += BATCH_SIZE) {
    const batch = toRetry.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(toRetry.length / BATCH_SIZE);

    console.log(`Batch ${batchNum}/${totalBatches}: ${batch.join(", ")}`);
    const batchResults = await Promise.all(batch.map((name) => searchExercise(name)));

    for (let j = 0; j < batch.length; j++) {
      const result = batchResults[j];
      if (result) {
        results.push(result);
        newResults.push(result);
        console.log(`  ✓ ${batch[j]} → "${result.title}" by ${result.channelName}`);
      } else {
        newFailed.push(batch[j]);
        console.log(`  ✗ ${batch[j]} — no results`);
      }
    }

    // Save progress
    fs.writeFileSync(resultsPath, JSON.stringify({
      results,
      failed: newFailed.concat(toRetry.slice(i + BATCH_SIZE)),
      progress: { searched: results.length, total: results.length + toRetry.length - i - batch.length }
    }, null, 2));

    if (i + BATCH_SIZE < toRetry.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  // Final save
  fs.writeFileSync(resultsPath, JSON.stringify({ results, failed: newFailed, progress: { searched: results.length, total: results.length + newFailed.length } }, null, 2));

  console.log(`\n=== Results ===`);
  console.log(`New videos found: ${newResults.length}`);
  console.log(`Still failed: ${newFailed.length}`);

  if (newResults.length > 0) {
    console.log(`\n=== TypeScript entries to add to exercise-demos.ts ===\n`);

    // Group by category
    const categories: Record<string, VideoResult[]> = {
      "Climbing — Gym": [],
      "Climbing — Outdoor & Trad": [],
      "Alpine & Mountaineering Skills": [],
      "Flexibility & Mobility": [],
      "Warm-Up Drills": [],
      "Other": [],
    };

    const climbingGym = new Set(["volume bouldering","flash attempts","project sessions","lead climbing volume","top-rope laps","top-rope climbing","4x4s on boulders","4x4s on routes","pyramid sessions","arc training","campus board laddering","hangboard repeaters","hangboard dead hangs","max-weight dead hangs","lock-offs","frenchies","one-arm hang progressions","downclimbing gym routes","traversing on gym walls","system board projecting","linked boulder circuits","up-down-up sequences","onsight attempts"]);
    const climbingOutdoor = new Set(["crack climbing technique","hand crack climbing","finger crack climbing","fist crack climbing","off-width climbing","anchor building","lead fall practice","rappel practice","gear placement speed drills","clipping efficiency drills","route reading","multi-pitch mileage","mock leading on top rope","outdoor sport lead volume","sustained crack pitches"]);
    const alpine = new Set(["ice axe self-arrest","ice axe walking positions","crampon walking flat-footing","crampon walking front-pointing","ice tool swinging","crevasse rescue hauling systems","rope team travel","snow anchor building","rappelling on snow terrain","self-arrest practice"]);
    const flexibility = new Set(["deep lunge holds","hamstring stretches","thoracic spine rotation","ankle dorsiflexion wall test","ankle circles","ankle mobility drills","yoga flows","foam rolling","worlds greatest stretch","cat-cow stretch","inchworms","leg swings","hip circles","hip openers","quadruped rockbacks","thread the needle","figure-4 stretch","down-dog to up-dog flow","squat to stand","lunge with twist","standing toe touch","hip airplanes","dynamic hip swings","knee hugs","walking quad stretch","calf stretch","it band foam rolling"]);
    const warmup = new Set(["high knees","butt kicks","arm circles","arm swings","jumping jacks","a-skips","high knee march","strides","dynamic warm-up","walking knee lifts","heel walks","toe walks","inchworm walkouts","lateral shuffles","high skips"]);

    for (const r of newResults) {
      if (climbingGym.has(r.exerciseName)) categories["Climbing — Gym"].push(r);
      else if (climbingOutdoor.has(r.exerciseName)) categories["Climbing — Outdoor & Trad"].push(r);
      else if (alpine.has(r.exerciseName)) categories["Alpine & Mountaineering Skills"].push(r);
      else if (flexibility.has(r.exerciseName)) categories["Flexibility & Mobility"].push(r);
      else if (warmup.has(r.exerciseName)) categories["Warm-Up Drills"].push(r);
      else categories["Other"].push(r);
    }

    for (const [cat, items] of Object.entries(categories)) {
      if (items.length === 0) continue;
      console.log(`  // ── ${cat} ──`);
      for (const r of items) {
        console.log(`  '${escapeForTS(r.exerciseName)}': {`);
        console.log(`    youtubeId: '${r.youtubeId}',`);
        console.log(`    title: '${escapeForTS(r.title)}',`);
        console.log(`    channelName: '${escapeForTS(r.channelName)}',`);
        console.log(`  },`);
      }
    }
  }

  if (newFailed.length > 0) {
    console.log(`\nFailed exercises (no video found):`);
    newFailed.forEach((f) => console.log(`  - ${f}`));
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
