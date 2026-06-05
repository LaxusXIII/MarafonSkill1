const fs = require("fs");
const path = require("path");

const root = __dirname;
const out = path.join(root, "public");
const files = ["index.html", "styles.css", "app.js", "supabase-config.js"];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const file of files) {
  fs.copyFileSync(path.join(root, file), path.join(out, file));
}

fs.cpSync(path.join(root, "assets"), path.join(out, "assets"), { recursive: true });
