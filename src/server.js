// src/server.js
require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");

// Load background jobs (scheduler, workers)
require("./jobs/scheduler"); // ✅ recruitment status flips, future jobs

// start in-process workers only when enabled
if (process.env.START_WORKERS_IN_PROCESS === "true") {
  // notification worker
  require('./jobs/workers/notification.worker');
  // other workers can be required similarly
  console.log("Workers started in-process");
}


const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectDB(process.env.MONGO_URI);

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1);
  }
})();
