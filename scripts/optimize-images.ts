/**
 * Image optimization script using sharp.
 * Converts oversized images to WebP at appropriate dimensions.
 * Run: npx tsx scripts/optimize-images.ts
 */
import sharp from "sharp";
import { existsSync, readdirSync, renameSync, statSync, unlinkSync } from "fs";
import { basename, extname } from "path";

const PUBLIC = "public/images";

interface Task {
  input: string;
  output: string;
  width?: number;
  height?: number;
  quality: number;
  description: string;
}

const tasks: Task[] = [
  // Logo: 192×192 (2x the 96px splash display)
  {
    input: `${PUBLIC}/logo.png`,
    output: `${PUBLIC}/logo.webp`,
    width: 192,
    height: 192,
    quality: 85,
    description: "Logo (192×192, 2x retina)",
  },
  // Hero: 1344×880 (2x the 672px max display, preserving aspect ratio ~1.53)
  {
    input: `${PUBLIC}/home/hero.png`,
    output: `${PUBLIC}/home/hero.webp`,
    width: 1344,
    quality: 80,
    description: "Hero homepage (1344px, 2x retina)",
  },
];

// OG image: regenerate at 1200×630, keep as PNG for social media.
// Write to temp file first to avoid sharp same-file error.
const ogInput = `${PUBLIC}/opengraph.png`;
const ogTemp = `${PUBLIC}/opengraph-tmp.png`;
tasks.push({
  input: ogInput,
  output: ogTemp,
  width: 1200,
  height: 630,
  quality: 85,
  description: "Open Graph (1200×630, PNG for social media)",
});

// Studio photos: 1200×675 (2x the ~576px display, 16:9 aspect)
const studiosDir = `${PUBLIC}/studios`;
if (existsSync(studiosDir)) {
  for (const file of readdirSync(studiosDir)) {
    if (/\.(jpg|jpeg)$/i.test(file)) {
      tasks.push({
        input: `${studiosDir}/${file}`,
        output: `${studiosDir}/${basename(file, extname(file))}.webp`,
        width: 1200,
        height: 675,
        quality: 78,
        description: `Studio photo: ${file} (1200×675)`,
      });
    }
  }
}

// Team portraits: 800×1000 (2x the ~384px display, 4:5 aspect)
const aboutDir = `${PUBLIC}/about`;
if (existsSync(aboutDir)) {
  for (const file of readdirSync(aboutDir)) {
    if (/\.png$/i.test(file)) {
      tasks.push({
        input: `${aboutDir}/${file}`,
        output: `${aboutDir}/${basename(file, extname(file))}.webp`,
        width: 800,
        height: 1000,
        quality: 80,
        description: `Team portrait: ${file} (800×1000)`,
      });
    }
  }
}

async function main() {
  console.log(`🔧 Optimizing ${tasks.length} images...\n`);

  let totalBefore = 0;
  let totalAfter = 0;

  for (const task of tasks) {
    const inputStats = statSync(task.input);
    totalBefore += inputStats.size;

    const pipeline = sharp(task.input);

    if (task.width || task.height) {
      pipeline.resize(task.width, task.height, {
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    if (task.output.endsWith(".webp")) {
      pipeline.webp({ quality: task.quality });
    } else if (task.output.endsWith(".png")) {
      pipeline.png({ quality: task.quality, compressionLevel: 9 });
    }

    await pipeline.toFile(task.output);

    const outputStats = statSync(task.output);
    totalAfter += outputStats.size;

    const reduction = (((inputStats.size - outputStats.size) / inputStats.size) * 100).toFixed(1);
    console.log(
      `  ✅ ${task.description}: ${(inputStats.size / 1024).toFixed(0)}KB → ${(outputStats.size / 1024).toFixed(0)}KB (${reduction}%)`,
    );
  }

  // Post-process: replace OG image with regenerated version
  if (existsSync(ogTemp)) {
    unlinkSync(ogInput);
    renameSync(ogTemp, ogInput);
    console.log(`\n  🔄 Replaced opengraph.png with 1200×630 version`);
  }

  console.log(`\n📊 Total: ${(totalBefore / 1024).toFixed(0)}KB → ${(totalAfter / 1024).toFixed(0)}KB (${(((totalBefore - totalAfter) / totalBefore) * 100).toFixed(1)}% reduction)`);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
