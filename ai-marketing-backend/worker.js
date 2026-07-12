require("dotenv").config();

const { Worker } = require("bullmq");
const IORedis = require("ioredis");
const { sendToTelegram } = require("./src/utils/posting.utils.js");
const { shouldProcessCampaign } = require("./src/services/campaign-status.service");

const connection = new IORedis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
  maxRetriesPerRequest: null,
});
console.log("🟢 WORKER FILE LOADED");
console.log("TOKEN:", process.env.TELEGRAM_BOT_TOKEN ? "OK" : "MISSING");
console.log(
  "CHAT ID:",
  process.env.TELEGRAM_CHAT_ID ||
    process.env.TELEGRAM_GROUP_ID ||
    process.env.TELEGRAM_CHANNEL_ID
    ? "OK"
    : "MISSING"
);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const worker = new Worker(
  "campaignQueue",
  async (job) => {
    console.log("🚀 JOB RECEIVED:", {
      id: job.id,
      day: job.data?.day,
      hasBotToken: Boolean(job.data?.botToken) || Boolean(process.env.TELEGRAM_BOT_TOKEN),
      hasChatId:
        Boolean(job.data?.chatId) ||
        Boolean(process.env.TELEGRAM_CHAT_ID) ||
        Boolean(process.env.TELEGRAM_GROUP_ID) ||
        Boolean(process.env.TELEGRAM_CHANNEL_ID),
    });

    const { campaignId, day, message, botToken, chatId } = job.data;

    const allowed = await shouldProcessCampaign(campaignId);
    if (!allowed) {
      console.log(`⏭️ SKIPPED JOB ${job.id} for campaign ${campaignId} because status is not approved`);
      return;
    }

    if (!message || typeof message !== "string") {
      throw new Error(`Job ${job.id} (day ${day}) has no valid message`);
    }

    const text = `🚀 Day ${day || 1}\n\n${message}`;

    // Retry once on transient Telegram errors (e.g. 429 rate limit, 5xx)
    const maxAttempts = 3;
    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await sendToTelegram(text, botToken, chatId);
        console.log(`✅ SENT TO TELEGRAM (day ${day || 1}, attempt ${attempt})`);
        return;
      } catch (err) {
        lastErr = err;
        const status = err?.response?.status;
        const data = err?.response?.data;
        const description =
          data?.description || err?.message || err?.code || "unknown error";

        console.error(
          `❌ TELEGRAM ERROR (day ${day || 1}, attempt ${attempt}/${maxAttempts}): ` +
            `status=${status ?? "?"} ${description}`
        );

        const retriable =
          !status || status === 429 || (status >= 500 && status < 600);
        if (!retriable || attempt === maxAttempts) break;

        // exponential-ish backoff: 2s, 5s
        const backoff = attempt === 1 ? 2000 : 5000;
        console.log(`⏳ Retrying day ${day || 1} in ${backoff}ms...`);
        await sleep(backoff);
      }
    }

    // Throw so BullMQ marks the job as failed (and can retry per queue options)
    throw lastErr || new Error("Unknown telegram failure");
  },
  {
    connection,
    concurrency: 1, // one message at a time -> avoids Telegram per-second flood limits
  }
);

worker.on("failed", (job, err) => {
  console.error(
    `💥 JOB FAILED id=${job?.id} day=${job?.data?.day}: ${err?.message}`
  );
});

worker.on("completed", (job) => {
  console.log(`🏁 JOB COMPLETED id=${job.id} day=${job.data?.day}`);
});