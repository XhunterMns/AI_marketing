const { callOpenClaw } = require("../../utils/openclaw.utils");

const stripCodeFences = (text) => {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
};

exports.competitorAnalysis = async (req, res) => {
  const { prompt, companyName, websiteUrl } = req.body;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Missing prompt in request body" });
  }

  const aiPrompt = `You are a senior marketing analyst and competitive intelligence expert.

Analyze the following competitor:
Company Name: ${companyName || "Not provided"}
Website: ${websiteUrl || "Not provided"}

Return ONLY valid JSON. No markdown. No code fences. No extra text.

{
  "summary": "string",
  "companyOverview": "string",
  "seoSummary": "string",
  "marketingStrategy": "string",
  "socialPresence": "string",
  "strengths": ["string"],
  "weaknesses": ["string"],
  "swot": {
    "strengths": ["string"],
    "weaknesses": ["string"],
    "opportunities": ["string"],
    "threats": ["string"]
  },
  "competitors": [
    { "name": "string", "strengths": ["string"], "weaknesses": ["string"] }
  ],
  "trends": [{ "title": "string", "importance": "high|medium|low" }],
  "recommendations": ["string"],
  "aiOpportunities": ["string"]
}

User request:
${prompt}`;

  try {
    const response = await callOpenClaw(aiPrompt);
    let result;

    try {
      result = JSON.parse(stripCodeFences(response));
    } catch {
      result = { summary: response, raw: response };
    }

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
