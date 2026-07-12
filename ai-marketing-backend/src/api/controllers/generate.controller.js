const { callOpenClaw } = require("../../utils/openclaw.utils");

exports.generate = async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Missing prompt in request body" });
  }

  try {
    const result = await callOpenClaw(prompt);
    return res.json({ result });
  } catch (error) {
    if (error.status) {
      return res
        .status(error.status)
        .json({ error: error.message, details: error.details });
    }
    return res.status(500).json({ error: error.message });
  }
};
