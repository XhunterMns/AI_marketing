const axios = require("axios");
const config = require("../config/config");

const CHAT_COMPLETIONS_PATH = "/v1/chat/completions";

function resolveOpenClawUrl(value) {
  const raw = (value || "http://127.0.0.1:18789").replace(/\/+$/, "");
  return raw.endsWith(CHAT_COMPLETIONS_PATH)
    ? raw
    : `${raw}${CHAT_COMPLETIONS_PATH}`;
}

const URL = resolveOpenClawUrl(config.OPENCLAW_GATEWAY_URL);
const TOKEN = config.OPENCLAW_GATEWAY_TOKEN || "";
const MODEL = config.OPENCLAW_MODEL || "openclaw";

async function callOpenClaw(prompt) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;

  console.log("URL:", URL);
  console.log("TOKEN being sent:", TOKEN ? TOKEN.slice(0, 10) + "..." : "EMPTY");
  console.log("Headers:", headers);

  try {
    console.log("⏳ Calling OpenClaw gateway (this may take up to 2 minutes for complex requests)...");
    const resp = await axios.post(
      URL,
      {
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        stream: false,
      },
      {
        headers,
        timeout: 120000, // 2 minutes - allow slow model processing
      }
    );

    console.log("✅ OpenClaw response received");
    const data = resp.data;
    const content = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? data?.text;
    if (typeof content !== "string") {
      throw new Error("OpenClaw returned an unexpected response format");
    }

    return content;
  } catch (err) {
    console.log("❌ OpenClaw request failed");
    console.log("RAW ERROR:", err.message);
    console.log("HAS RESPONSE:", !!err.response);
    console.log("ERROR CODE:", err.code);

    const error = new Error("OpenClaw gateway error");
    if (err.code === "ECONNABORTED") {
      error.details = `Gateway timeout: request exceeded 2 minutes. Model may be overloaded or processing very complex input.`;
    } else if (err.response) {
      error.status = err.response.status;
      try {
        error.details = typeof err.response.data === "string"
          ? err.response.data
          : JSON.stringify(err.response.data);
      } catch (e) {
        error.details = String(err.response.data);
      }
    } else {
      error.details = err.message;
    }
    throw error;
  }
}

module.exports = { callOpenClaw, resolveOpenClawUrl };
