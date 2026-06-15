import { execFile } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegPath from "ffmpeg-static";
import { chromium } from "playwright";

const execFileAsync = promisify(execFile);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const outputDirectory = path.join(projectRoot, "social");
const recordingDirectory = path.join(outputDirectory, ".recording");
const outputPath = path.join(outputDirectory, "touchline26-linkedin-demo.mp4");
const siteUrl =
  process.env.TOUCHLINE_SITE_URL ??
  "https://world-cup-command-center.jose-troche-coder.workers.dev";

await rm(recordingDirectory, { recursive: true, force: true });
await mkdir(recordingDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  colorScheme: "dark",
  reducedMotion: "no-preference",
  recordVideo: {
    dir: recordingDirectory,
    size: { width: 1280, height: 720 },
  },
});

await context.addInitScript(() => {
  localStorage.removeItem("touchline26:hide-intro");
});
const page = await context.newPage();

async function pause(duration = 1500) {
  await page.waitForTimeout(duration);
}

async function showCaption(title, detail) {
  await page.evaluate(
    ({ title, detail }) => {
      document.querySelector("#social-demo-caption")?.remove();
      const caption = document.createElement("aside");
      caption.id = "social-demo-caption";
      caption.innerHTML = `<strong>${title}</strong><span>${detail}</span>`;
      Object.assign(caption.style, {
        position: "fixed",
        right: "24px",
        bottom: "24px",
        zIndex: "9999",
        display: "flex",
        flexDirection: "column",
        gap: "3px",
        maxWidth: "330px",
        padding: "13px 16px",
        border: "1px solid rgba(217,255,67,.35)",
        borderRadius: "12px",
        color: "#f5f7f6",
        background: "rgba(7,16,13,.92)",
        boxShadow: "0 14px 45px rgba(0,0,0,.35)",
        fontFamily: "Manrope, system-ui, sans-serif",
        pointerEvents: "none",
        backdropFilter: "blur(14px)",
      });
      const heading = caption.querySelector("strong");
      const copy = caption.querySelector("span");
      Object.assign(heading.style, {
        color: "#d9ff43",
        fontSize: "12px",
        letterSpacing: ".06em",
        textTransform: "uppercase",
      });
      Object.assign(copy.style, {
        color: "#b7c1bd",
        fontSize: "11px",
      });
      document.body.append(caption);
    },
    { title, detail },
  );
}

async function selectNavigation(label) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.waitForTimeout(350);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
}

await page.goto(siteUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
await page.getByRole("heading", { name: /See the tournament/i }).waitFor();
await pause(1600);

await page.getByRole("button", { name: "Open match center" }).click();
await page.getByRole("heading", { name: /Every match/i }).waitFor();
await showCaption("Live match center", "Scores, result probabilities, and projected xG");
await pause(1900);
await page.evaluate(() => window.scrollTo({ top: 455, behavior: "smooth" }));
await pause(1500);

await selectNavigation("Advancement");
await showCaption("Qualification outlook", "700 simulations for every remaining group fixture");
await pause(1850);
const groupC = page.getByRole("button", { name: "C", exact: true });
if (await groupC.isVisible()) await groupC.click();
await pause(1100);

await selectNavigation("Bracket simulator");
await showCaption("Knockout scenarios", "Build the path yourself or run the team-strength model");
await pause(1350);
await page.getByRole("button", { name: "Run simulation" }).click();
await pause(1900);

await selectNavigation("Team comparison");
await showCaption("Team comparison", "Compare strengths and projected head-to-head advantage");
await pause(2300);

await page.evaluate(() => document.querySelector("#social-demo-caption")?.remove());
await pause(650);

const video = page.video();
await context.close();
await browser.close();

if (!video || !ffmpegPath) {
  throw new Error("Video capture or ffmpeg is unavailable.");
}

const rawVideoPath = await video.path();
await execFileAsync(ffmpegPath, [
  "-y",
  "-i",
  rawVideoPath,
  "-an",
  "-c:v",
  "libx264",
  "-preset",
  "medium",
  "-crf",
  "22",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "+faststart",
  outputPath,
]);

await rm(recordingDirectory, { recursive: true, force: true });
console.log(outputPath);
