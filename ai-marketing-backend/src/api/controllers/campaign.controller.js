const { callOpenClaw } = require("../../utils/openclaw.utils");
const campaignQueue = require("../../../queue");
const { setCampaignStatus, STATUS } = require("../../services/campaign-status.service");
const crypto = require('crypto');

const stripCodeFences = (text) => {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
};

const buildCampaignPrompt = (body) => {
  const {
    prompt,
    businessName,
    businessDescription,
    industry,
    targetAudience,
    goal,
    tone,
    language,
    platform,
    campaignType,
    duration,
    budget,
  } = body;

  return `You are a senior marketing strategist. Create a comprehensive marketing campaign.

Business Name: ${businessName || "N/A"}
Business Description: ${businessDescription || "N/A"}
Industry: ${industry || "N/A"}
Target Audience: ${targetAudience || "N/A"}
Campaign Goal: ${goal || "N/A"}
Tone: ${tone || "Professional"}
Language: ${language || "English"}
Platform: ${platform || "Multi-channel"}
Campaign Type: ${campaignType || "Brand Awareness"}
Duration: ${duration || "14 days"}
Budget: ${budget || "Not specified"}

Return ONLY valid JSON with this exact schema:
{
  "title": "string",
  "overview": "string",
  "strategy": "string",
  "socialPosts": [{"platform": "string", "content": "string", "day": 1}],
  "emailCampaign": "string",
  "hashtags": ["string"],
  "contentCalendar": [{"day": 1, "action": "string"}],
  "cta": "string",
  "imageSuggestions": ["string"],
  "kpis": [{"metric": "string", "target": "string"}]
}

User campaign description:
${prompt}`;
};

const formatForTelegram = (result) => {
  if (typeof result === "string") return result;
  const lines = [];
  if (result.title) lines.push(`📢 ${result.title}`, "");
  if (result.overview) lines.push(result.overview, "");
  if (result.strategy) lines.push("📋 Strategy:", result.strategy, "");
  if (Array.isArray(result.socialPosts)) {
    lines.push("📱 Social Posts:");
    result.socialPosts.forEach((p, i) => lines.push(`${i + 1}. ${p.content}`));
    lines.push("");
  }
  if (result.cta) lines.push("🎯 CTA:", result.cta);
  return lines.join("\n").trim();
};

const createCampaignJobs = async ({ campaignId, jobs, botToken, chatId }) => {
  if (!campaignId) throw new Error('campaignId is required');

  const msPerDay = 24 * 60 * 60 * 1000;

  return Promise.all(
    jobs.map(async (job) => {
      const dayNumber = Number(job.day) || 1;
      const delayMs = Math.max(dayNumber - 1, 0) * msPerDay;

      const queued = await campaignQueue.add(
        'campaign-step',
        {
          campaignId,
          day: dayNumber,
          message: job.message,
          botToken,
          chatId,
        },
        { delay: delayMs }
      );

      return { id: queued.id, day: dayNumber }
    })
  );
};

const { setCampaignData, getCampaignData, deleteCampaignData } = require('../../services/campaign-status.service');

exports.generateCampaign = async (req, res) => {
  const { prompt, telegram } = req.body;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Missing prompt in request body" });
  }

  const aiPrompt = buildCampaignPrompt(req.body);

  try {
    const response = await callOpenClaw(aiPrompt);
    let result;

    try {
      result = JSON.parse(stripCodeFences(response));
    } catch {
      result = { title: "Generated Campaign", overview: response, raw: response };
    }

    // Persist generated campaign in Redis and return campaignId to frontend
    const campaignId = crypto.randomUUID();

    await setCampaignStatus(campaignId, STATUS.PENDING);
    await setCampaignData(campaignId, { result, telegram });

    return res.json({ result, campaignId });
  } catch (error) {
    if (error.status) {
      return res
        .status(error.status)
        .json({ error: error.message, details: error.details });
    }
    return res.status(500).json({ error: error.message });
  }
};

exports.approveCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;
    await setCampaignStatus(campaignId, STATUS.APPROVED);

    // when approving, read the campaign data and enqueue jobs
    const data = await getCampaignData(campaignId);
    if (!data || !data.result) {
      return res.status(404).json({ error: 'Campaign data not found' });
    }

    const result = data.result;

    // collect jobs from all parts (socialPosts, contentCalendar, email, overview)
    const jobs = [];

    if (Array.isArray(result.socialPosts)) {
      result.socialPosts.forEach((p, i) => {
        if (p?.content) jobs.push({ day: p.day || i + 1, message: p.content });
      });
    }

    if (Array.isArray(result.contentCalendar)) {
      result.contentCalendar.forEach((c) => {
        if (c?.action) jobs.push({ day: c.day || 1, message: c.action });
      });
    }

    if (result.emailCampaign) {
      jobs.push({ day: 1, message: result.emailCampaign });
    }

    if (jobs.length === 0 && result) {
      jobs.push({ day: 1, message: formatForTelegram(result) });
    }

    const botToken = (data?.telegram?.botToken) || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = (data?.telegram?.channelId) || process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHANNEL_ID;

    const queuedJobs = await createCampaignJobs({ campaignId, jobs, botToken, chatId });

    return res.json({ success: true, campaignId, status: STATUS.APPROVED, jobs: queuedJobs });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

exports.declineCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;
    await setCampaignStatus(campaignId, STATUS.DECLINED);
    return res.json({ success: true, campaignId, status: STATUS.DECLINED });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

exports.cancelCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;
    await setCampaignStatus(campaignId, STATUS.CANCELLED);
    return res.json({ success: true, campaignId, status: STATUS.CANCELLED });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};
