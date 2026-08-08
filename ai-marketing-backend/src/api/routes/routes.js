module.exports = (app) => {
  const router = require("express").Router();
  const generateController = require("../controllers/generate.controller");
  const campaignController = require("../controllers/campaign.controller");
  const analysisController = require("../controllers/analysis.controller");
  const metaController = require("../controllers/meta");
  const postingController = require("../controllers/posting.controller");

  router.post("/generate", generateController.generate);
  router.post("/generate-campaign", campaignController.generateCampaign);
  router.post("/campaigns/:campaignId/approve", campaignController.approveCampaign);
  router.post("/campaigns/:campaignId/decline", campaignController.declineCampaign);
  router.post("/campaigns/:campaignId/cancel", campaignController.cancelCampaign);
  router.get("/campaigns/history", campaignController.getCampaignHistory);
  router.delete("/campaigns/history/:campaignId", campaignController.deleteCampaignHistoryItem);
  router.post("/competitor-analysis", analysisController.competitorAnalysis);
  router.post("/meta/post", metaController.postToMeta);
  router.post("/telegram/send", postingController.sendPostToTelegram);

  app.use("/api", router);
  app.post("/generate", generateController.generate);
  app.post("/generate-campaign", campaignController.generateCampaign);
  app.post("/campaigns/:campaignId/approve", campaignController.approveCampaign);
  app.post("/campaigns/:campaignId/decline", campaignController.declineCampaign);
  app.post("/campaigns/:campaignId/cancel", campaignController.cancelCampaign);
  app.get("/campaigns/history", campaignController.getCampaignHistory);
  app.delete("/campaigns/history/:campaignId", campaignController.deleteCampaignHistoryItem);
  app.post("/competitor-analysis", analysisController.competitorAnalysis);
  app.post("/meta/post", metaController.postToMeta); //facebook page ama lmochkla yelzm bussniss verification
  app.post("/telegram/send", postingController.sendPostToTelegram);
};
