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
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: String(item.content).slice(0, 1200) }],
    }));
}

function readGeminiText(payload) {
  return (payload.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text || "")
    .join("\n")
    .trim();
}

function buildSystemInstruction() {
  return [
    "Ты онлайн-консультант Marathon Skills.",
    "Отвечай по-русски, коротко и практично.",
    "Помогай с регистрацией, BMI, дистанциями 42.2 км, 21.1 км и 10 км, подготовкой к марафону и работой сайта.",
    "Не выдумывай персональные медицинские рекомендации; при рисках советуй обратиться к врачу.",
  ].join(" ");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json(res, 500, { error: "GEMINI_API_KEY is required" });
  }

  const question = String(req.body?.message || "").trim();
  if (!question) {
    return json(res, 400, { error: "Message is required" });
  }

  const contents = normalizeHistory(req.body?.history);
  contents.push({
    role: "user",
    parts: [{ text: question.slice(0, 1600) }],
  });

  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: buildSystemInstruction() }],
        },
        contents,
        generationConfig: {
          maxOutputTokens: 500,
          temperature: 0.4,
        },
      }),
    });

    const payload = await response.json().catch(async () => ({ error: await response.text() }));
    if (!response.ok) {
      return json(res, response.status, { error: payload.error || payload });
    }

    const answer = readGeminiText(payload) || "Не получилось сформировать ответ. Попробуйте спросить иначе.";
    return json(res, 200, { answer });
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
};
