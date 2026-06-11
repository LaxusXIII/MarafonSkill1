function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((item) => item && ["user", "assistant"].includes(item.role) && item.content)
    .slice(-8)
    .map((item) => ({
      role: item.role,
      content: String(item.content).slice(0, 1200),
    }));
}

function readOutputText(payload) {
  if (payload.output_text) return payload.output_text;
  const parts = [];
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) parts.push(content.text);
      if (content.type === "text" && content.text) parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json(res, 500, { error: "OPENAI_API_KEY is required" });
  }

  const question = String(req.body?.message || "").trim();
  if (!question) {
    return json(res, 400, { error: "Message is required" });
  }

  const messages = normalizeHistory(req.body?.history);
  messages.push({ role: "user", content: question.slice(0, 1600) });

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.2",
        instructions:
          "Ты онлайн-консультант Marathon Skills. Отвечай по-русски, коротко и практично. Помогай с регистрацией, BMI, дистанциями 42.2 км, 21.1 км и 10 км, подготовкой к марафону и работой сайта. Не выдумывай персональные медицинские рекомендации; при рисках советуй обратиться к врачу.",
        input: messages,
        max_output_tokens: 500,
      }),
    });

    if (!response.ok) {
      return json(res, response.status, { error: await response.text() });
    }

    const payload = await response.json();
    const answer = readOutputText(payload) || "Не получилось сформировать ответ. Попробуйте спросить иначе.";
    return json(res, 200, { answer });
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
};
