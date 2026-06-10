const fs = require("fs");
const path = require("path");

const root = __dirname;
const out = path.join(root, "public");
const entries = [
  "index.html",
  "styles.css",
  "app.js",
  "supabase-config.js",
  "vercel.json",
  "deploy-check.html",
  "assets",
  "auth",
  "callback",
];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const entry of entries) {
  const from = path.join(root, entry);
  const to = path.join(out, entry);
  if (!fs.existsSync(from)) continue;
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    fs.cpSync(from, to, { recursive: true });
  } else {
    fs.copyFileSync(from, to);
  }
}

console.log("MARAFON_CLEAN_BUILD: admin-telegram-sync");
