const axios = require("axios");

async function sendToTelegram(message, botToken, chatId) {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  const resolvedChatId =
    chatId ||
    process.env.TELEGRAM_CHAT_ID ||
    process.env.TELEGRAM_GROUP_ID ||
    process.env.TELEGRAM_CHANNEL_ID;

  if (!token) {
    throw new Error("Missing Telegram bot token");
  }

  if (!resolvedChatId) {
    throw new Error("Missing Telegram channel/chat ID");
  }

  try {
    await axios.post(
      `https://api.telegram.org/bot${token}/sendMessage`,
      { chat_id: resolvedChatId, text: message },
      { timeout: 15000 }
    );
  } catch (err) {
    const status = err?.response?.status;
    const description =
      err?.response?.data?.description || err?.message || err?.code || "unknown";
    const wrapped = new Error(
      `Telegram send failed (status=${status ?? "?"}): ${description}`
    );
    wrapped.status = status;
    wrapped.response = err?.response;
    throw wrapped;
  }
}

module.exports = { sendToTelegram };
