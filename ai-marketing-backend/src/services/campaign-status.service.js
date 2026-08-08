const IORedis = require("ioredis");

const redis = new IORedis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
  maxRetriesPerRequest: null,
});

const STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  DECLINED: "declined",
  CANCELLED: "cancelled",
};

const getCampaignStatusKey = (campaignId) => `campaign:${campaignId}:status`;
const getCampaignDataKey = (campaignId) => `campaign:${campaignId}:data`;

const setCampaignStatus = async (campaignId, status) => {
  if (!campaignId) {
    throw new Error("campaignId is required");
  }

  if (!Object.values(STATUS).includes(status)) {
    throw new Error(`Invalid campaign status: ${status}`);
  }

  await redis.set(getCampaignStatusKey(campaignId), status);
  return status;
};

const getCampaignStatus = async (campaignId) => {
  if (!campaignId) {
    return null;
  }

  const status = await redis.get(getCampaignStatusKey(campaignId));
  return status || STATUS.PENDING;
};

const shouldProcessCampaign = async (campaignId) => {
  const status = await getCampaignStatus(campaignId);
  return status === STATUS.APPROVED;
};

const setCampaignData = async (campaignId, data) => {
  if (!campaignId) throw new Error('campaignId is required');
  await redis.set(getCampaignDataKey(campaignId), JSON.stringify(data));
};

const CAMPAIGN_HISTORY_KEY = 'campaign:history';

const addCampaignToHistory = async (campaignId) => {
  if (!campaignId) throw new Error('campaignId is required');

  await redis
    .multi()
    .lrem(CAMPAIGN_HISTORY_KEY, 0, campaignId)
    .lpush(CAMPAIGN_HISTORY_KEY, campaignId)
    .ltrim(CAMPAIGN_HISTORY_KEY, 0, 49)
    .exec();
};

const getCampaignHistoryIds = async () => {
  return redis.lrange(CAMPAIGN_HISTORY_KEY, 0, 49);
};

const removeCampaignFromHistory = async (campaignId) => {
  if (!campaignId) return;
  await redis.lrem(CAMPAIGN_HISTORY_KEY, 0, campaignId);
};

const getCampaignData = async (campaignId) => {
  if (!campaignId) return null;
  const raw = await redis.get(getCampaignDataKey(campaignId));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const deleteCampaignData = async (campaignId) => {
  if (!campaignId) return;
  await redis.del(getCampaignDataKey(campaignId));
};

module.exports = {
  redis,
  STATUS,
  setCampaignStatus,
  getCampaignStatus,
  shouldProcessCampaign,
  setCampaignData,
  getCampaignData,
  deleteCampaignData,
  addCampaignToHistory,
  getCampaignHistoryIds,
  removeCampaignFromHistory,
};
