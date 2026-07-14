import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "temporary screenshots");

const CHROME_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

function findChrome() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error("No local Chrome/Edge executable found.");
}

const args = process.argv.slice(2);
const url = args.find((a) => a.startsWith("http")) || "http://localhost:3000";
const flags = args.filter((a) => a.startsWith("--"));
const label = args.find((a) => !a.startsWith("http") && !a.startsWith("--"));
const isMobile = flags.includes("--mobile");

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function nextIndex() {
  const files = fs.existsSync(OUT_DIR) ? fs.readdirSync(OUT_DIR) : [];
  const nums = files
    .map((f) => f.match(/^screenshot-(\d+)/))
    .filter(Boolean)
    .map((m) => parseInt(m[1], 10));
  return nums.length ? Math.max(...nums) + 1 : 1;
}

const browser = await puppeteer.launch({
  executablePath: findChrome(),
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

try {
  const page = await browser.newPage();

  if (isMobile) {
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    );
  } else {
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  }

  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 500));

  // Scroll through the full page so scroll-triggered reveal animations fire
  await page.evaluate(async () => {
    const distance = 400;
    const delay = 60;
    let total = 0;
    const height = document.body.scrollHeight;
    while (total < height) {
      window.scrollBy(0, distance);
      total += distance;
      await new Promise((r) => setTimeout(r, delay));
    }
    window.scrollTo(0, 0);
  });
  await new Promise((r) => setTimeout(r, 700));

  const idx = nextIndex();
  const suffix = [label, isMobile ? "mobile" : null].filter(Boolean).join("-");
  const filename = `screenshot-${idx}${suffix ? "-" + suffix : ""}.png`;
  const filePath = path.join(OUT_DIR, filename);

  await page.screenshot({ path: filePath, fullPage: true });
  console.log("Saved: " + filePath);
} finally {
  await browser.close();
}
