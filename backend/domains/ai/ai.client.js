const getApiKey = () => {
  return process.env.GEMINI_API_KEY;
};

const getModelName = () => {
  const apiKey = getApiKey();
  if (apiKey && apiKey.startsWith("sk-or-")) {
    return "google/gemini-2.5-pro";
  }
  return "gemini-2.5-flash";
};

const callGemini = async (prompt, fileData = null) => {
  const apiKey = getApiKey();
  const isOpenRouter = apiKey && apiKey.startsWith("sk-or-");

  let url;
  let headers = {
    "Content-Type": "application/json",
  };
  let payload;

  if (isOpenRouter) {
    url = "https://openrouter.ai/api/v1/chat/completions";
    headers["Authorization"] = `Bearer ${apiKey}`;
    headers["HTTP-Referer"] = "http://localhost:3000";
    headers["X-Title"] = "Karl Management System";

    const content = [{ type: "text", text: prompt }];
    if (fileData) {
      content.push({
        type: "image_url",
        image_url: {
          url: `data:${fileData.mimeType};base64,${fileData.data}`
        }
      });
    }

    payload = {
      model: "google/gemini-2.5-pro",
      messages: [{ role: "user", content }],
      response_format: { type: "json_object" },
    };
  } else {
    const model = "gemini-2.5-flash";
    url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    headers["x-goog-api-key"] = apiKey;

    const parts = [{ text: prompt }];
    if (fileData) {
      parts.unshift({
        inlineData: {
          mimeType: fileData.mimeType,
          data: fileData.data
        }
      });
    }

    payload = {
      contents: [
        {
          parts,
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
      },
    };
  }

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(90000),
    });
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      throw new Error(
        "Yêu cầu tới AI API bị quá thời gian chờ (Timeout 90 giây).",
      );
    }
    throw err;
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI API Error (HTTP ${res.status}): ${errText}`);
  }

  const result = await res.json();

  let text = "";
  if (isOpenRouter) {
    if (!result.choices || !result.choices[0] || !result.choices[0].message) {
      throw new Error(`OpenRouter Invalid Response: ${JSON.stringify(result)}`);
    }
    text = result.choices[0].message.content;
  } else {
    if (
      !result.candidates ||
      !result.candidates[0] ||
      !result.candidates[0].content
    ) {
      throw new Error(`Gemini Invalid Response: ${JSON.stringify(result)}`);
    }
    text = result.candidates[0].content.parts[0].text;
  }

  try {
    let cleanedText = text.trim();
    if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.replace(/^```[a-zA-Z0-9]*\s*/, "").replace(/\s*```$/, "").trim();
    }
    return JSON.parse(cleanedText);
  } catch (parseErr) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (innerErr) {
        throw parseErr;
      }
    }
    throw parseErr;
  }
};

const callAIChat = async (messages) => {
  const apiKey = getApiKey();
  const isOpenRouter = apiKey && apiKey.startsWith("sk-or-");

  let url;
  let headers = { "Content-Type": "application/json" };
  let payload;

  if (isOpenRouter) {
    url = "https://openrouter.ai/api/v1/chat/completions";
    headers["Authorization"] = `Bearer ${apiKey}`;
    headers["HTTP-Referer"] = "http://localhost:3000";
    headers["X-Title"] = "Karl Management System";
    payload = { model: "google/gemini-2.5-pro", messages };
  } else {
    const model = "gemini-2.5-flash";
    url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    headers["x-goog-api-key"] = apiKey;

    const systemMsg = messages.find((m) => m.role === "system");
    const conversationMsgs = messages.filter((m) => m.role !== "system");
    payload = {
      ...(systemMsg && {
        systemInstruction: { parts: [{ text: systemMsg.content }] },
      }),
      contents: conversationMsgs.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
    };
  }

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(90000),
    });
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      throw new Error(
        "Cuộc hội thoại với AI bị quá thời gian chờ (Timeout 90 giây).",
      );
    }
    throw err;
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI Chat Error (HTTP ${res.status}): ${errText}`);
  }

  const result = await res.json();
  if (isOpenRouter) {
    if (!result.choices?.[0]?.message?.content)
      throw new Error(`OpenRouter invalid response: ${JSON.stringify(result)}`);
    return result.choices[0].message.content;
  } else {
    if (!result.candidates?.[0]?.content?.parts?.[0]?.text)
      throw new Error(`Gemini invalid response: ${JSON.stringify(result)}`);
    return result.candidates[0].content.parts[0].text;
  }
};

const getEmbedding = async (text) => {
  const apiKey = getApiKey();
  if (apiKey && apiKey.startsWith("sk-or-")) {
    return null;
  }
  const model = "gemini-embedding-2";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`;

  const payload = {
    content: {
      parts: [{ text }],
    },
  };

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      throw new Error(
        "Yêu cầu trích xuất Vector hóa (Embedding) bị quá thời gian chờ (Timeout 30 giây).",
      );
    }
    throw err;
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini Embedding Error (HTTP ${res.status}): ${errText}`);
  }

  const result = await res.json();
  return result.embedding.values;
};

module.exports = {
  getApiKey,
  getModelName,
  callGemini,
  callAIChat,
  getEmbedding,
};
