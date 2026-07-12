const express = require("express");
const cors = require("cors");
const config = require("./src/config/config");
const database = require("./src/database/db.config");

const app = express();

app.use(cors());
app.use(express.json());

if (database.url) {
  database.mongoose
    .connect(database.url, {})
    .then(() => {
      console.log("Connected to database");
    })
    .catch((err) => {
      console.log(err);
    });
}

app.get("/", (req, res) => {
  res.send("AI Marketing Backend is running 🚀");
});

require("./src/api/routes/routes")(app);

app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.path}` });
});

app.listen(config.PORT, () => {
  console.log(`Server running on http://localhost:${config.PORT}`);
});
