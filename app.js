const pages = document.querySelectorAll(".page");
const runnerForm = document.querySelector("#runner-form");
const bmiForm = document.querySelector("#bmi-form");
const bmiValue = document.querySelector("#bmi-value");
const bmiCategory = document.querySelector("#bmi-category");
const tableBody = document.querySelector("#participants-table tbody");
const emptyState = document.querySelector("#empty-state");
const runnerCount = document.querySelector("#runner-count");
const clearButton = document.querySelector("#clear-list");
const countdown = document.querySelector("#countdown");
const navItems = document.querySelectorAll(".side-nav__item");
const authStatus = document.querySelector("#auth-status");
const googleLoginButton = document.querySelector("#google-login");
const logoutButton = document.querySelector("#logout");
const adminNav = document.querySelector("#admin-nav");
const adminTableBody = document.querySelector("#admin-table tbody");
const adminEmpty = document.querySelector("#admin-empty");
const adminCount = document.querySelector("#admin-count");
const adminRefresh = document.querySelector("#admin-refresh");
const adminSourceFilter = document.querySelector("#admin-source-filter");

const rawConfig = window.MARATHON_SUPABASE || {};
const config = {
  url: normalizeConfigValue(rawConfig.url),
  anonKey: normalizeConfigValue(rawConfig.anonKey),
};
const isSupabaseConfigured =
  Boolean(config.url && config.anonKey) &&
  !config.url.includes("PASTE_") &&
  !config.anonKey.includes("PASTE_");

const supabaseLibraryLoaded = Boolean(window.supabase);
const supabaseClient =
  isSupabaseConfigured && supabaseLibraryLoaded
    ? window.supabase.createClient(config.url, config.anonKey)
    : null;

let draftRunner = null;
let currentUser = null;
let isAdmin = false;
let adminRunners = [];

function normalizeConfigValue(value) {
  return String(value || "").trim().replace(/^[A-Z0-9_]+\s*=\s*/, "");
}

function showPage(name) {
  if (name === "admin" && !isAdmin) {
    showNotice("?????-?????? ???????? ?????? ?????????????? ????? ????? ????? Google.");
    name = "home";
  }

pages.forEach((page) => page.classList.toggle("is-active", page.dataset.page === name));
  navItems.forEach((item) => item.classList.toggle("is-active", item.dataset.go === name));
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (name === "participants") {
    renderParticipants();
  }

  if (name === "admin") {
    renderAdmin();
  }
}

function getNextMarathonDate(now = new Date()) {
  const year = now.getFullYear();
  let target = new Date(year, 5, 15, 9, 0, 0);
  if (target <= now) {
    target = new Date(year + 1, 5, 15, 9, 0, 0);
  }
  return target;
}

function updateCountdown() {
  const diff = getNextMarathonDate() - new Date();
  const totalSeconds = Math.max(0, Math.floor(diff / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  countdown.textContent = `${days} д ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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

async function getSession() {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    showNotice(`Ошибка авторизации: ${error.message}`);
    return null;
  }
  return data.session;
}

async function signInWithGoogle() {
  if (!supabaseClient) {
    showNotice("Вставьте Supabase URL и anon key в supabase-config.js.");
    return;
  }

  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: getRedirectUrl(),
    },
  });

  if (error) {
    showNotice(`Не удалось открыть Google-вход: ${error.message}`);
  }
}

async function signOut() {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
}

function getRedirectUrl() {
  return `${window.location.origin}/auth/callback`;
}

function updateAuthUi() {
  if (!supabaseClient) {
    authStatus.textContent = isSupabaseConfigured
      ? "Библиотека Supabase не загрузилась"
      : "Supabase не настроен";
    googleLoginButton.disabled = false;
    googleLoginButton.hidden = false;
    logoutButton.hidden = true;
    setAdminVisible(false);
    return;
  }

  if (currentUser) {
    authStatus.textContent = currentUser.email || "Вы вошли через Google";
    googleLoginButton.hidden = true;
    logoutButton.hidden = false;
  } else {
    authStatus.textContent = "Войдите через Google";
    googleLoginButton.hidden = false;
    googleLoginButton.disabled = false;
    logoutButton.hidden = true;
    setAdminVisible(false);
  }
}


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

async function loadRunners() {
  if (!supabaseClient) return [];

  const { data, error } = await supabaseClient
    .from("runners")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    showNotice(`Не удалось загрузить участников: ${error.message}`);
    return [];
  }

  return data || [];
}

async function deleteRunner(id) {
  if (!supabaseClient || !currentUser) {
    showNotice("Для удаления записей войдите через Google.");
    return false;
  }

  const { error } = await supabaseClient.from("runners").delete().eq("id", id);
  if (error) {
    showNotice(`Не удалось удалить запись: ${error.message}`);
    return false;
  }

  return true;
}

async function saveRunner(runner) {
  if (!supabaseClient || !currentUser) {
    showNotice("Чтобы сохранить участника, войдите через Google.");
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
    showNotice(`Не удалось сохранить участника: ${error.message}`);
    return false;
  }

  return true;
}

async function clearOwnRunners() {
  if (!supabaseClient || !currentUser) {
    showNotice("Чтобы очистить свои записи, войдите через Google.");
    return;
  }

  const { error } = await supabaseClient.from("runners").delete().eq("user_id", currentUser.id);
  if (error) {
    showNotice(`Не удалось очистить список: ${error.message}`);
    return;
  }

  renderParticipants();
}

async function renderParticipants() {
  tableBody.innerHTML = "";
  emptyState.textContent = currentUser
    ? "Пока нет зарегистрированных бегунов."
    : "Пока нет зарегистрированных бегунов.";

  const runners = await loadRunners();
  emptyState.classList.toggle("is-visible", runners.length === 0);
  runnerCount.textContent = `${runners.length} ${decline(runners.length, "участник", "участника", "участников")}`;

  for (const runner of runners) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHtml(runner.first_name)} ${escapeHtml(runner.last_name)}</strong><br><span>${escapeHtml(runner.email)}, ${escapeHtml(runner.age)} лет</span></td>
      <td>${escapeHtml(runner.country)}</td>
      <td>${escapeHtml(runner.distance)}</td>
      <td>${escapeHtml(runner.bmi)}</td>
      <td>${escapeHtml(runner.bmi_category)}</td>
    `;
    tableBody.append(row);
  }
}

async function renderAdmin() {
  if (!adminTableBody) return;

  if (!isAdmin) {
    showNotice("?????-?????? ???????? ?????? ?????????????? ????? ????? ????? Google.");
    showPage("home");
    return;
  }

adminTableBody.innerHTML = "";
  adminEmpty.textContent = "Загружаю записи...";
  adminEmpty.classList.add("is-visible");
  adminRunners = await loadRunners();
  drawAdminRows();
}

function drawAdminRows() {
  const source = adminSourceFilter.value;
  const rows = source === "all"
    ? adminRunners
    : adminRunners.filter((runner) => (runner.source || "site") === source);

  adminTableBody.innerHTML = "";
  adminEmpty.classList.toggle("is-visible", rows.length === 0);
  adminEmpty.textContent = "Записей нет.";
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
    adminTableBody.append(row);
  }
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
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

document.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-runner]");
  if (deleteButton) {
    const id = deleteButton.dataset.deleteRunner;
    if (confirm("Удалить эту запись?")) {
      deleteRunner(id).then((deleted) => {
        if (deleted) renderAdmin();
      });
    }
    return;
  }

  const button = event.target.closest("[data-go]");
  if (button) {
    showPage(button.dataset.go);
  }
});

if (adminRefresh) {
  adminRefresh.addEventListener("click", renderAdmin);
}

if (adminSourceFilter) {
  adminSourceFilter.addEventListener("change", drawAdminRows);
}

googleLoginButton.addEventListener("click", signInWithGoogle);
logoutButton.addEventListener("click", signOut);

runnerForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!currentUser) {
    showNotice("Сначала войдите через Google, затем продолжите регистрацию.");
    return;
  }

  draftRunner = Object.fromEntries(new FormData(runnerForm).entries());
  showPage("bmi");
});

bmiForm.addEventListener("input", calculateBmi);

bmiForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const bmi = calculateBmi();
  if (!draftRunner || !bmi) return;

  const saved = await saveRunner({
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

clearButton.addEventListener("click", clearOwnRunners);

async function boot() {
  if (!supabaseClient) {
    showNotice(
      isSupabaseConfigured
        ? "Не загрузилась библиотека Supabase. Проверьте доступ к CDN jsdelivr или подключите библиотеку локально."
        : "Подключите Supabase в файле supabase-config.js, затем настройте Google provider в Supabase."
    );
    updateAuthUi();
    renderParticipants();
    return;
  }

  const session = await getSession();
  currentUser = session?.user || null;
  updateAuthUi();
  await refreshAdminAccess();

  supabaseClient.auth.onAuthStateChange(async (_event, sessionState) => {
    currentUser = sessionState?.user || null;
    updateAuthUi();
    await refreshAdminAccess();
    renderParticipants();
    if (document.querySelector('[data-page="admin"]').classList.contains("is-active")) {
      renderAdmin();
    }
  });

  renderParticipants();
}

updateCountdown();
calculateBmi();
setInterval(updateCountdown, 1000);
boot();
