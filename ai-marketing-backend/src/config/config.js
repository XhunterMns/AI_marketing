require("dotenv").config();

const config = {
  PORT: process.env.PORT || 3000,
  DB_URL: process.env.DATABASE_URL,
  OPENCLAW_GATEWAY_URL:
    process.env.OPENCLAW_GATEWAY_URL || "http://127.0.0.1:18789",
  OPENCLAW_GATEWAY_TOKEN: process.env.OPENCLAW_GATEWAY_TOKEN || "",
  OPENCLAW_MODEL: process.env.OPENCLAW_MODEL || "openclaw",
};

module.exports = config;
