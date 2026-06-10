const fs = require("fs");

function read(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Run this from the repository root. Missing ${file}`);
  }
  return fs.readFileSync(file, "utf8");
}

function write(file, text) {
  fs.writeFileSync(file, text, "utf8");
}

let index = read("index.html");
index = index.replace(
  '<button class="side-nav__item" type="button" data-go="admin">Админ</button>',
  '<button class="side-nav__item" type="button" data-go="admin" id="admin-nav" hidden>Админ</button>'
);
write("index.html", index);

let css = read("styles.css");
if (!css.includes("[hidden]")) {
  css = css.replace(
    /button,\s*input,\s*select\s*\{\s*font:\s*inherit;\s*\}/,
    "button,\ninput,\nselect {\n  font: inherit;\n}\n\n[hidden] {\n  display: none !important;\n}"
  );
}
write("styles.css", css);

let app = read("app.js");

if (!app.includes('const adminNav = document.querySelector("#admin-nav");')) {
  app = app.replace(
    'const logoutButton = document.querySelector("#logout");',
    'const logoutButton = document.querySelector("#logout");\nconst adminNav = document.querySelector("#admin-nav");'
  );
}

if (!app.includes("let isAdmin = false;")) {
  app = app.replace(
    /let currentUser = null;\s*let adminRunners = \[\];/,
    "let currentUser = null;\nlet isAdmin = false;\nlet adminRunners = [];"
  );
}

if (!app.includes('name === "admin" && !isAdmin')) {
  app = app.replace(
    /function showPage\(name\) \{\s*/,
    'function showPage(name) {\n  if (name === "admin" && !isAdmin) {\n    showNotice("Админ-панель доступна только администратору после входа через Google.");\n    name = "home";\n  }\n\n'
  );
}

if (!app.includes("function setAdminVisible")) {
  const adminFunctions = `
function setAdminVisible(visible) {
  isAdmin = Boolean(visible);
  if (adminNav) {
    adminNav.hidden = !isAdmin;
  }

  const adminPage = document.querySelector('[data-page="admin"]');
  if (!isAdmin && adminPage?.classList.contains("is-active")) {
    showPage("home");
  }
}

async function refreshAdminAccess() {
  if (!supabaseClient || !currentUser?.email) {
    setAdminVisible(false);
    return;
  }

  const { data, error } = await supabaseClient
    .from("admin_users")
    .select("email")
    .eq("email", currentUser.email)
    .maybeSingle();

  if (error) {
    setAdminVisible(false);
    return;
  }

  setAdminVisible(Boolean(data));
}
`;
  app = app.replace("async function loadRunners() {", `${adminFunctions}\nasync function loadRunners() {`);
}

app = app.replace(
  /authStatus\.textContent = isSupabaseConfigured[\s\S]*?logoutButton\.hidden = true;\s*return;\s*\}/,
  (match) => match.includes("setAdminVisible(false);") ? match : match.replace("return;", "setAdminVisible(false);\n    return;")
);

app = app.replace(
  /logoutButton\.hidden = true;\s*\}\s*\}/,
  (match) => match.includes("setAdminVisible(false);") ? match : match.replace("logoutButton.hidden = true;", "logoutButton.hidden = true;\n    setAdminVisible(false);")
);

if (!app.includes('if (!isAdmin) {\n    showNotice("Админ-панель доступна')) {
  app = app.replace(
    /async function renderAdmin\(\) \{\s*if \(!adminTableBody\) return;\s*/,
    'async function renderAdmin() {\n  if (!adminTableBody) return;\n\n  if (!isAdmin) {\n    showNotice("Админ-панель доступна только администратору после входа через Google.");\n    showPage("home");\n    return;\n  }\n\n'
  );
}

if (!app.includes("await refreshAdminAccess();\n\n  supabaseClient.auth")) {
  app = app.replace(
    /currentUser = session\?\.user \|\| null;\s*updateAuthUi\(\);\s*supabaseClient\.auth/,
    "currentUser = session?.user || null;\n  updateAuthUi();\n  await refreshAdminAccess();\n\n  supabaseClient.auth"
  );
}

app = app.replace(
  "supabaseClient.auth.onAuthStateChange((_event, sessionState) => {",
  "supabaseClient.auth.onAuthStateChange(async (_event, sessionState) => {"
);

if (!app.includes("await refreshAdminAccess();\n    renderParticipants();")) {
  app = app.replace(
    /currentUser = sessionState\?\.user \|\| null;\s*updateAuthUi\(\);\s*renderParticipants\(\);/,
    "currentUser = sessionState?.user || null;\n    updateAuthUi();\n    await refreshAdminAccess();\n    renderParticipants();"
  );
}

write("app.js", app);

if (fs.existsSync("build.js")) {
  require("child_process").execFileSync("node", ["build.js"], { stdio: "inherit" });
}

console.log("Done. Admin is hidden until Google admin access is confirmed. Telegram button stays visible.");
