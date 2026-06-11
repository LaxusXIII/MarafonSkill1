function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function getRunner(payload) {
  return payload.record || payload.new || payload.new_record || payload.data?.record || {};
}

function getOldRunner(payload) {
  return payload.old_record || payload.old || payload.data?.old_record || {};
}

function eventName(payload) {
  return String(payload.type || payload.eventType || payload.event || "change").toUpperCase();
}

function runnerName(runner) {
  const name = [runner.first_name, runner.last_name].filter(Boolean).join(" ").trim();
  return name || "Без имени";
}

function field(value, fallback = "-") {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

function buildMessage(payload) {
  const event = eventName(payload);
  const runner = getRunner(payload);
  const oldRunner = getOldRunner(payload);
  const source = field(runner.source || oldRunner.source);
  const name = event === "DELETE" ? runnerName(oldRunner) : runnerName(runner);
  const email = field(runner.email || oldRunner.email);
  const distance = field(runner.distance || oldRunner.distance);
  const country = field(runner.country || oldRunner.country);
  const bmi = field(runner.bmi || oldRunner.bmi);

  const title = {
    INSERT: "Новая регистрация",
    UPDATE: "Изменение участника",
    DELETE: "Удаление участника",
  }[event] || "Изменение в базе";

  return [
    `<b>${title}</b>`,
    "",
    `Участник: <b>${escapeHtml(name)}</b>`,
    `Источник: ${escapeHtml(source)}`,
    `Email: ${escapeHtml(email)}`,
    `Страна: ${escapeHtml(country)}`,
    `Дистанция: ${escapeHtml(distance)}`,
    `BMI: ${escapeHtml(bmi)}`,
  ].join("\n");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) {
    throw new Error("TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID are required");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram error ${response.status}: ${body}`);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret && req.headers["x-webhook-secret"] !== expectedSecret) {
    return json(res, 401, { error: "Unauthorized" });
  }

  try {
    await sendTelegram(buildMessage(req.body || {}));
    return json(res, 200, { ok: true });
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
};
