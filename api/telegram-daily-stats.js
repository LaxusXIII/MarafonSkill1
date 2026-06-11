function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
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

async function getCount(query = "") {
  const url = `${process.env.SUPABASE_URL}/rest/v1/runners?select=id${query}`;
  const response = await fetch(url, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: "count=exact",
      Range: "0-0",
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase error ${response.status}: ${await response.text()}`);
  }

  return response.headers.get("content-range")?.split("/").pop() || "0";
}

module.exports = async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    return json(res, 405, { error: "Method not allowed" });
  }

  const expectedSecret = process.env.TELEGRAM_STATS_SECRET;
  if (expectedSecret && req.headers.authorization !== `Bearer ${expectedSecret}`) {
    return json(res, 401, { error: "Unauthorized" });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return json(res, 500, { error: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required" });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const total = await getCount();
    const todayCount = await getCount(`&created_at=gte.${encodeURIComponent(today.toISOString())}`);
    await sendTelegram(`<b>Ежедневная статистика Marathon Skills</b>\n\nВсего участников: <b>${total}</b>\nЗа сегодня: <b>${todayCount}</b>`);
    return json(res, 200, { ok: true, total, today: todayCount });
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
};
