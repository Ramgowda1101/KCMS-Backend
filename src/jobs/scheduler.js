// src/jobs/scheduler.js
const cron = require("node-cron");
const Recruitment = require("../models/recruitment.model");
const { logAudit } = require("../services/audit.service");
const { sendNotification } = require("../utils/notifications");

/**
 * Scheduler job
 * Runs each minute and flips recruitment statuses:
 *  - scheduled => open (when startDate <= now)
 *  - open => closed (when endDate <= now)
 *
 * For each flipped recruitment, we write an audit entry and send a notification to club/core/admin.
 */

cron.schedule("* * * * *", async () => {
  const now = new Date();

  try {
    // Flip scheduled -> open
    const schedToOpen = await Recruitment.find({ status: "scheduled", startDate: { $lte: now } });
    for (const rec of schedToOpen) {
      const prev = { status: rec.status };
      rec.status = "open";
      await rec.save();

      // Audit: system actor = null or 'system'
      await logAudit({
        actor: null,
        action: "recruitment:status-change",
        resourceType: "Recruitment",
        resourceId: rec._id.toString(),
        before: prev,
        after: { status: "open" },
        reason: "Auto-open by scheduler",
      });

      // Notify club (best-effort)
      try {
        await sendNotification(`Recruitment for ${rec.role} is now OPEN`, { club: rec.club }, { channel: "in-app" });
      } catch (err) {
        console.error("Notification error (non-fatal):", err && err.message ? err.message : err);
      }
    }

    // Flip open -> closed
    const openToClosed = await Recruitment.find({ status: "open", endDate: { $lte: now } });
    for (const rec of openToClosed) {
      const prev = { status: rec.status };
      rec.status = "closed";
      await rec.save();

      await logAudit({
        actor: null,
        action: "recruitment:status-change",
        resourceType: "Recruitment",
        resourceId: rec._id.toString(),
        before: prev,
        after: { status: "closed" },
        reason: "Auto-close by scheduler",
      });

      try {
        await sendNotification(`Recruitment for ${rec.role} has CLOSED`, { club: rec.club }, { channel: "in-app" });
      } catch (err) {
        console.error("Notification error (non-fatal):", err && err.message ? err.message : err);
      }
    }
  } catch (err) {
    console.error("Recruitment scheduler error:", err && err.message ? err.message : err);
  }
});
