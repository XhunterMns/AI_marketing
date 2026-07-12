const stripCodeFences = (text) => {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
};

const campaignJsonToText = (value) => {
  if (!value || typeof value !== "object") return null;

  const lines = [];
  if (value.name) {
    lines.push(`Campaign: ${value.name}`);
    lines.push("");
  }

  if (Array.isArray(value.steps)) {
    for (const step of value.steps) {
      const day = step?.day ?? "";
      const message = step?.message ?? "";
      lines.push(`Day ${day}: ${message}`);
      lines.push("");
    }
  }

  return lines.length ? lines.join("\n").trim() : null;
};

const toPlainTextCampaign = (rawResponse) => {
  if (typeof rawResponse !== "string" || !rawResponse.trim()) {
    return rawResponse ?? "";
  }

  const cleaned = stripCodeFences(rawResponse);

  try {
    const parsed = JSON.parse(cleaned);
    const formatted = campaignJsonToText(parsed);
    if (formatted) return formatted;
  } catch {
    // Not JSON — return cleaned text as-is.
  }

  return cleaned;
};
function splitCampaignByDays(text) {
  const regex = /Day\s+(\d+):([\s\S]*?)(?=Day\s+\d+:|$)/g;

  const days = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    days.push({
      day: Number(match[1]),
      message: match[2].trim(),
    });
  }

  return days;
}

module.exports = { splitCampaignByDays };
module.exports = {
  splitCampaignByDays,
  toPlainTextCampaign,
};
