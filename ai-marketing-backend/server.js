const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const mongoose = require("mongoose");
const Campaign = require("./models/Campaign");
const campaignQueue = require("./queue"); // 👈 مهم

const app = express();

app.use(cors());
app.use(express.json());

/* ---------------- ROOT ---------------- */
app.get("/", (req, res) => {
  res.send("AI Marketing Backend is running 🚀");
});

/* ---------------- AI GENERATE (simple) ---------------- */
app.post("/generate", async (req, res) => {
  const { prompt } = req.body;

  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3",
        prompt,
        stream: false
      }),
    });

    const data = await response.json();

    res.json({
      result: data.response
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ---------------- GENERATE CAMPAIGN ---------------- */
const generateCampaignHandler = async (req, res) => {
  const { prompt } = req.body;

const aiPrompt = `
You are a professional marketing strategist.

Create a marketing campaign.

Return ONLY valid JSON.

Do not use markdown.
Do not use \`\`\`json.
Do not explain anything.

Format:

{
  "name": "Campaign Name",
  "steps": [
    {
      "day": 1,
      "message": "Marketing action"
    },
    {
      "day": 2,
      "message": "Marketing action"
    }
  ]
}

Campaign request:
${prompt}
`;

  const response = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "minimax-m3:cloud",
      prompt: aiPrompt,
      stream: false
    }),
  });

  const data = await response.json();

  const campaignData = JSON.parse(data.response);

  const campaign = await Campaign.create({
    name: campaignData.name,
    prompt,
    steps: campaignData.steps,
  });

  res.json(campaign);
};

app.post("/generate-campaign", generateCampaignHandler);
app.post("/api/generate-campaign", generateCampaignHandler);


/* ---------------- ACTIVATE CAMPAIGN ---------------- */
app.post("/activate-campaign", async (req, res) => {
  const { campaignId } = req.body;

  const campaign = await Campaign.findById(campaignId);

  let jobs = [];

  for (let step of campaign.steps) {
    const job = await campaignQueue.add(
      "campaign-step",
      {
        campaignId,
        message: step.message,
      },
      {
        delay: step.day * 10000 // 👈 test faster
      }
    );

    jobs.push({
      jobId: job.id,
      day: step.day
    });
  }

  campaign.status = "active";
  await campaign.save();

  res.json({
    message: "Campaign activated",
    jobs
  });
});

/* ---------------- CANCEL CAMPAIGN ---------------- */
app.post("/cancel-campaign", async (req, res) => {
  const { campaignId } = req.body;

  const jobs = await campaignQueue.getJobs();

  for (let job of jobs) {
    if (job.data.campaignId === campaignId) {
      await job.remove();
    }
  }

  await Campaign.findByIdAndUpdate(campaignId, {
    status: "cancelled"
  });

  res.json({
    message: "Campaign cancelled"
  });
});

console.log('Server init:', { cwd: process.cwd(), file: __filename });
console.log('Router object:', typeof app.router);
if (app.router) {
  console.log('Router keys:', Object.keys(app.router));
  console.log('Router stack length:', app.router.stack?.length);
}
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});