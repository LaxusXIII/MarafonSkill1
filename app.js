const TELEGRAM_URL = "https://t.me/MarafonSkills_bot";

const pages = document.querySelectorAll(".page");
const navItems = document.querySelectorAll(".nav__item");
const adminNav = document.querySelector("#admin-nav");
const authStatus = document.querySelector("#auth-status");
const googleLoginButton = document.querySelector("#google-login");
const logoutButton = document.querySelector("#logout");
const countdown = document.querySelector("#countdown");

const runnerForm = document.querySelector("#runner-form");
const bmiForm = document.querySelector("#bmi-form");
const bmiValue = document.querySelector("#bmi-value");
const bmiCategory = document.querySelector("#bmi-category");

const participantsBody = document.querySelector("#participants-body");
const participantsEmpty = document.querySelector("#participants-empty");
const runnerCount = document.querySelector("#runner-count");
const refreshParticipants = document.querySelector("#refresh-participants");

const adminBody = document.querySelector("#admin-body");
const adminEmpty = document.querySelector("#admin-empty");
const adminCount = document.querySelector("#admin-count");
const adminRefresh = document.querySelector("#admin-refresh");
const adminSourceFilter = document.querySelector("#admin-source-filter");

const rawConfig = window.MARATHON_SUPABASE || {};
const config = {
  url: normalizeConfigValue(rawConfig.url),
  anonKey: normalizeConfigValue(rawConfig.anonKey),
};

const supabaseConfigured =
  Boolean(config.url && config.anonKey) &&
  !config.url.includes("PASTE_") &&
  !config.anonKey.includes("PASTE_");

const supabaseClient =
  supabaseConfigured && window.supabase
    ? window.supabase.createClient(config.url, config.anonKey)
    : null;

let currentUser = null;
let isAdmin = false;
let draftRunner = null;
let adminRows = [];

if (adminNav) adminNav.hidden = true;

function normalizeConfigValue(value) {
  return String(value || "").trim().replace(/^[A-Z0-9_]+\s*=\s*/, "");
}

function showPage(name) {
  if (name === "admin" && !isAdmin) {
    setAdminVisible(false);
    showNotice("Admin panel is available only for an admin Google account.");
    name = "home";
  }

  pages.forEach((page) => page.classList.toggle("is-active", page.dataset.page === name));
  navItems.forEach((item) => item.classList.toggle("is-active", item.dataset.pageTarget === name));
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (name === "participants") renderParticipants();
  if (name === "admin") renderAdmin();
}

function setAdminVisible(visible) {
  isAdmin = Boolean(visible);
  if (adminNav) adminNav.hidden = !isAdmin;
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

  setAdminVisible(true);
}

function updateAuthUi() {
  if (!supabaseClient) {
    authStatus.textContent = supabaseConfigured
      ? "Supabase library is not loaded"
      : "Supabase is not configured";
    googleLoginButton.hidden = false;
    logoutButton.hidden = true;
    setAdminVisible(false);
    return;
  }

  if (currentUser) {
    authStatus.textContent = currentUser.email || "Google account signed in";
    googleLoginButton.hidden = true;
    logoutButton.hidden = false;
  } else {
    authStatus.textContent = "Войдите через Google";
    googleLoginButton.hidden = false;
    logoutButton.hidden = true;
    setAdminVisible(false);
  }
}

async function signInWithGoogle() {
  if (!supabaseClient) {
    showNotice("Supabase is not configured.");
    return;
  }

  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) showNotice(`Google sign-in failed: ${error.message}`);
}

async function signOut() {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
}

async function loadRunners() {
  if (!supabaseClient) return [];
  const { data, error } = await supabaseClient
    .from("runners")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    showNotice(`Load failed: ${error.message}`);
    return [];
  }

  return data || [];
}

async function saveSiteRunner(runner) {
  if (!supabaseClient || !currentUser) {
    showNotice("Сначала войдите через Google.");
    return false;
  }

  const { error } = await supabaseClient.from("runners").insert({
    user_id: currentUser.id,
    first_name: runner.firstName,
    last_name: runner.lastName,
    age: Number(runner.age),
    gender: runner.gender,
    country: runner.country,
    distance: runner.distance,
    email: runner.email,
    bmi: Number(runner.bmi),
    bmi_category: runner.bmiCategory,
    source: "site",
  });

  if (error) {
    showNotice(`Save failed: ${error.message}`);
    return false;
  }

  return true;
}

async function deleteRunner(id) {
  if (!supabaseClient || !isAdmin) {
    showNotice("Admin access required.");
    return false;
  }

  const { error } = await supabaseClient.from("runners").delete().eq("id", id);
  if (error) {
    showNotice(`Delete failed: ${error.message}`);
    return false;
  }

  return true;
}

async function renderParticipants() {
  participantsBody.innerHTML = "";
  participantsEmpty.textContent = "Загрузка...";
  participantsEmpty.classList.add("is-visible");

  const runners = await loadRunners();
  participantsEmpty.textContent = "Пока нет зарегистрированных бегунов.";
  participantsEmpty.classList.toggle("is-visible", runners.length === 0);
  runnerCount.textContent = `${runners.length} ${decline(runners.length, "участник", "участника", "участников")}`;

  for (const runner of runners) {
    const row = document.createElement("tr");
    const source = runner.source || "site";
    row.innerHTML = `
      <td><strong>${escapeHtml(runner.first_name)} ${escapeHtml(runner.last_name)}</strong><br><span>${escapeHtml(runner.email)}, ${escapeHtml(runner.age)} лет</span></td>
      <td><span class="source-badge ${escapeHtml(source)}">${escapeHtml(source)}</span></td>
      <td>${escapeHtml(runner.country)}</td>
      <td>${escapeHtml(runner.distance)}</td>
      <td>${escapeHtml(runner.bmi)}<br><span>${escapeHtml(runner.bmi_category)}</span></td>
    `;
    participantsBody.append(row);
  }
}

async function renderAdmin() {
  if (!isAdmin) {
    setAdminVisible(false);
    showNotice("Admin panel is available only for an admin Google account.");
    showPage("home");
    return;
  }

  adminBody.innerHTML = "";
  adminEmpty.textContent = "Загрузка...";
  adminEmpty.classList.add("is-visible");
  adminRows = await loadRunners();
  drawAdminRows();
}

function drawAdminRows() {
  const source = adminSourceFilter.value;
  const rows = source === "all"
    ? adminRows
    : adminRows.filter((runner) => (runner.source || "site") === source);

  adminBody.innerHTML = "";
  adminEmpty.textContent = "Записей нет.";
  adminEmpty.classList.toggle("is-visible", rows.length === 0);
  adminCount.textContent = `${rows.length} ${decline(rows.length, "запись", "записи", "записей")}`;

  for (const runner of rows) {
    const sourceName = runner.source || "site";
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHtml(runner.first_name)} ${escapeHtml(runner.last_name)}</strong><br><span>${escapeHtml(runner.email)}, ${escapeHtml(runner.country)}</span></td>
      <td><span class="source-badge ${escapeHtml(sourceName)}">${escapeHtml(sourceName)}</span></td>
      <td>${escapeHtml(runner.distance)}</td>
      <td>${escapeHtml(runner.bmi)}<br><span>${escapeHtml(runner.bmi_category)}</span></td>
      <td>${formatDate(runner.created_at)}</td>
      <td><button class="danger-button" type="button" data-delete-runner="${escapeHtml(runner.id)}">Удалить</button></td>
    `;
    adminBody.append(row);
  }
}

function calculateBmi() {
  const height = Number(bmiForm.elements.height.value) / 100;
  const weight = Number(bmiForm.elements.weight.value);

  if (!height || !weight) {
    bmiValue.textContent = "0.0";
    bmiCategory.textContent = "Введите рост и вес";
    return null;
  }

  const value = weight / (height * height);
  let category = "Норма";
  if (value < 18.5) category = "Недостаточный вес";
  if (value >= 25) category = "Избыточный вес";
  if (value >= 30) category = "Ожирение";

  bmiValue.textContent = value.toFixed(1);
  bmiCategory.textContent = category;
  return { value: value.toFixed(1), category };
}

function updateCountdown() {
  const now = new Date();
  let target = new Date(now.getFullYear(), 5, 15, 9, 0, 0);
  if (target <= now) target = new Date(now.getFullYear() + 1, 5, 15, 9, 0, 0);
  const seconds = Math.max(0, Math.floor((target - now) / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const sec = seconds % 60;
  countdown.textContent = `${days} д ${pad(hours)}:${pad(minutes)}:${pad(sec)}`;
}

function showNotice(message) {
  let notice = document.querySelector("#app-notice");
  const activePage = document.querySelector(".page.is-active");

  if (!notice) {
    notice = document.createElement("div");
    notice.id = "app-notice";
    notice.className = "notice";
  }

  notice.textContent = message;
  activePage.prepend(notice);
}

function decline(number, one, few, many) {
  const mod10 = number % 10;
  const mod100 = number % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ru-RU");
}

function pad(value) {
  return String(value).padStart(2, "0");
}

document.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-runner]");
  if (deleteButton) {
    if (confirm("Удалить эту запись?")) {
      deleteRunner(deleteButton.dataset.deleteRunner).then((deleted) => {
        if (deleted) renderAdmin();
      });
    }
    return;
  }

  const target = event.target.closest("[data-page-target]");
  if (target) showPage(target.dataset.pageTarget);
});

googleLoginButton.addEventListener("click", signInWithGoogle);
logoutButton.addEventListener("click", signOut);
refreshParticipants.addEventListener("click", renderParticipants);
adminRefresh.addEventListener("click", renderAdmin);
adminSourceFilter.addEventListener("change", drawAdminRows);
bmiForm.addEventListener("input", calculateBmi);

runnerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!currentUser) {
    showNotice("Сначала войдите через Google.");
    return;
  }

  draftRunner = Object.fromEntries(new FormData(runnerForm).entries());
  showPage("bmi");
});

bmiForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const bmi = calculateBmi();
  if (!draftRunner || !bmi) return;

  const saved = await saveSiteRunner({
    ...draftRunner,
    bmi: bmi.value,
    bmiCategory: bmi.category,
  });

  if (!saved) return;
  draftRunner = null;
  runnerForm.reset();
  bmiForm.reset();
  calculateBmi();
  showPage("participants");
});

async function boot() {
  updateCountdown();
  calculateBmi();
  setInterval(updateCountdown, 1000);

  if (!supabaseClient) {
    updateAuthUi();
    showNotice(supabaseConfigured ? "Supabase library is not loaded." : "Supabase is not configured.");
    renderParticipants();
    return;
  }

  const { data } = await supabaseClient.auth.getSession();
  currentUser = data.session?.user || null;
  updateAuthUi();
  await refreshAdminAccess();
  renderParticipants();

  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user || null;
    updateAuthUi();
    await refreshAdminAccess();
    renderParticipants();
    if (document.querySelector('[data-page="admin"]').classList.contains("is-active")) {
      renderAdmin();
    }
  });
}

boot();

