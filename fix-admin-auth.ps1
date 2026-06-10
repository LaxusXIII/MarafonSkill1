$ErrorActionPreference = "Stop"

if (-not (Test-Path ".\index.html") -or -not (Test-Path ".\app.js") -or -not (Test-Path ".\styles.css")) {
  throw "Run this script from the root of the MarafonSkill repository."
}

$index = Get-Content ".\index.html" -Raw -Encoding UTF8
$index = $index -replace '<button class="side-nav__item" type="button" data-go="admin">Админ</button>', '<button class="side-nav__item" type="button" data-go="admin" id="admin-nav" hidden>Админ</button>'
Set-Content ".\index.html" $index -Encoding UTF8

$css = Get-Content ".\styles.css" -Raw -Encoding UTF8
if ($css -notmatch '\[hidden\]\s*\{') {
  $css = $css -replace "button,\r?\ninput,\r?\nselect \{\r?\n  font: inherit;\r?\n\}", "button,`r`ninput,`r`nselect {`r`n  font: inherit;`r`n}`r`n`r`n[hidden] {`r`n  display: none !important;`r`n}"
}
Set-Content ".\styles.css" $css -Encoding UTF8

$app = Get-Content ".\app.js" -Raw -Encoding UTF8

if ($app -notmatch 'const adminNav = document\.querySelector\("#admin-nav"\);') {
  $app = $app -replace 'const logoutButton = document\.querySelector\("#logout"\);', 'const logoutButton = document.querySelector("#logout");' + "`r`n" + 'const adminNav = document.querySelector("#admin-nav");'
}

if ($app -notmatch 'let isAdmin = false;') {
  $app = $app -replace 'let currentUser = null;\r?\nlet adminRunners = \[\];', 'let currentUser = null;' + "`r`n" + 'let isAdmin = false;' + "`r`n" + 'let adminRunners = [];'
}

if ($app -notmatch 'function setAdminVisible') {
  $adminFunctions = @'

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
'@
  $app = $app -replace 'async function loadRunners\(\) \{', $adminFunctions + "`r`nasync function loadRunners() {"
}

if ($app -notmatch 'name === "admin" && !isAdmin') {
  $app = $app -replace 'function showPage\(name\) \{\r?\n', 'function showPage(name) {' + "`r`n" + '  if (name === "admin" && !isAdmin) {' + "`r`n" + '    showNotice("Админ-панель доступна только администратору после входа через Google.");' + "`r`n" + '    name = "home";' + "`r`n" + '  }' + "`r`n`r`n"
}

if ($app -notmatch 'setAdminVisible\(false\);\r?\n    return;\r?\n  \}\r?\n\r?\n  if \(currentUser\)') {
  $app = $app -replace 'logoutButton\.hidden = true;\r?\n    return;\r?\n  \}\r?\n\r?\n  if \(currentUser\)', 'logoutButton.hidden = true;' + "`r`n" + '    setAdminVisible(false);' + "`r`n" + '    return;' + "`r`n" + '  }' + "`r`n`r`n" + '  if (currentUser)'
}

if ($app -notmatch 'setAdminVisible\(false\);\r?\n  \}\r?\n\}\r?\n\r?\nfunction setAdminVisible') {
  $app = $app -replace 'logoutButton\.hidden = true;\r?\n  \}\r?\n\}\r?\n\r?\nfunction setAdminVisible', 'logoutButton.hidden = true;' + "`r`n" + '    setAdminVisible(false);' + "`r`n" + '  }' + "`r`n" + '}' + "`r`n`r`n" + 'function setAdminVisible'
}

if ($app -notmatch 'if \(!isAdmin\) \{\r?\n    showNotice\("Админ-панель доступна') {
  $app = $app -replace 'async function renderAdmin\(\) \{\r?\n  if \(!adminTableBody\) return;\r?\n', 'async function renderAdmin() {' + "`r`n" + '  if (!adminTableBody) return;' + "`r`n`r`n" + '  if (!isAdmin) {' + "`r`n" + '    showNotice("Админ-панель доступна только администратору после входа через Google.");' + "`r`n" + '    showPage("home");' + "`r`n" + '    return;' + "`r`n" + '  }' + "`r`n"
}

if ($app -notmatch 'await refreshAdminAccess\(\);\r?\n\r?\n  supabaseClient\.auth') {
  $app = $app -replace 'currentUser = session\?\.user \|\| null;\r?\n  updateAuthUi\(\);\r?\n\r?\n  supabaseClient\.auth', 'currentUser = session?.user || null;' + "`r`n" + '  updateAuthUi();' + "`r`n" + '  await refreshAdminAccess();' + "`r`n`r`n" + '  supabaseClient.auth'
}

$app = $app -replace 'supabaseClient\.auth\.onAuthStateChange\(\(_event, sessionState\) => \{', 'supabaseClient.auth.onAuthStateChange(async (_event, sessionState) => {'

if ($app -notmatch 'await refreshAdminAccess\(\);\r?\n    renderParticipants\(\);') {
  $app = $app -replace 'currentUser = sessionState\?\.user \|\| null;\r?\n    updateAuthUi\(\);\r?\n    renderParticipants\(\);', 'currentUser = sessionState?.user || null;' + "`r`n" + '    updateAuthUi();' + "`r`n" + '    await refreshAdminAccess();' + "`r`n" + '    renderParticipants();'
}

Set-Content ".\app.js" $app -Encoding UTF8

if (Test-Path ".\build.js") {
  node .\build.js
}

Write-Host "Admin visibility fix applied. Now run: git add .; git commit -m 'Fix admin visibility and Telegram button'; git push"
