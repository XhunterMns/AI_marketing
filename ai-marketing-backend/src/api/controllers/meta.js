const axios = require("axios");
const { callOpenClaw } = require("../../utils/openclaw.utils");

const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v25.0";

function normalizeMetaResponse(data) {
  return {
    id: data?.id,
    postId: data?.post_id || data?.id,
    raw: data,
  };
}

async function getOpenClawMetaPlan({ message, pageId }) {
  const prompt = `
Use the OpenClaw skill meta-graph-ai.

Prepare a Meta Graph API page feed publish plan for this request.
Do not publish anything.
Do not ask for or include access tokens.
Return only compact JSON with:
{
  "skill": "meta-graph-ai",
  "target": "page-feed-post",
  "pageId": "string",
  "messagePreview": "string",
  "endpoint": "string"
}

Page ID: ${pageId}
Message: ${message}
`;

  return callOpenClaw(prompt);
}

exports.postToMeta = async (req, res) => {
  const { message, pageId, accessToken, useOpenClaw = true } = req.body || {};

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Missing message in request body" });
  }

  if (!pageId || typeof pageId !== "string") {
    return res.status(400).json({ error: "Missing pageId in request body" });
  }

  if (!accessToken || typeof accessToken !== "string") {
    return res.status(400).json({ error: "Missing accessToken in request body" });
  }

  let openClawPlan = null;
  let openClawWarning = null;

  if (useOpenClaw) {
    try {
      openClawPlan = await getOpenClawMetaPlan({ message, pageId });
    } catch (error) {
      openClawWarning = error.details || error.message;
    }
  }

  try {
    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/feed`;
    const response = await axios.post(
      url,
      null,
      {
        params: {
          message,
          access_token: accessToken,
        },
        timeout: 30000,
      }
    );

    return res.status(201).json({
      success: true,
      result: normalizeMetaResponse(response.data),
      openClawPlan,
      openClawWarning,
    });
  } catch (error) {
    const status = error.response?.status || 500;
    const details = error.response?.data || error.message;

    return res.status(status).json({
      success: false,
      error: "Meta Graph API post failed",
      details,
      openClawPlan,
      openClawWarning,
    });
  }
};
