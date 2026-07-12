const { sendToTelegram } = require("../../utils/posting.utils");

exports.sendPostToTelegram = async (req, res) => {
  const { message, botToken, channelId } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Missing message in request body" });
  }

  if (!botToken || !channelId) {
    return res.status(400).json({
      error: "botToken and channelId are required in request body",
    });
  }

  try {
    await sendToTelegram(message, botToken, channelId);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data,
    });
  }
};
