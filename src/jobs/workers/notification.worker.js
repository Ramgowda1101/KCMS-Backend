// src/jobs/workers/notification.worker.js
const { Worker } = require("bullmq");
const { notificationQueue, PREFIX } = require("../../queues/index");
const Notification = require("../../models/notification.model");
const User = require("../../models/user.model");
const Club = require("../../models/club.model");
const { sendMailIfConfigured } = require("../../utils/mail.util");

const REDIS_URL = process.env.REDIS_URL || process.env.REDIS_HOST || "redis://127.0.0.1:6379";

const worker = new Worker(
  notificationQueue.name,
  async (job) => {
    const { notificationId } = job.data;
    if (!notificationId) throw new Error("Missing notificationId");

    const n = await Notification.findById(notificationId);
    if (!n) throw new Error(`Notification ${notificationId} not found`);

    // If notification is per-recipient:
    if (n.recipient) {
      // deliver to single user
      const user = await User.findById(n.recipient).select("email name");
      const recipientEmail = user && user.email ? user.email : null;

      try {
        if ((n.channel === "email" || n.channel === "push" || n.channel === "sms") && recipientEmail) {
          // Send email (mail.util handles no-SMTP fallback)
          await sendMailIfConfigured({ to: recipientEmail, subject: n.title, text: n.message });
        }

        // Mark as sent
        n.status = "sent";
        n.sentAt = new Date();
        n.attempts = (n.attempts || 0) + 1;
        n.error = "";
        await n.save();
        return { status: "sent", notificationId };
      } catch (err) {
        n.attempts = (n.attempts || 0) + 1;
        n.error = (err && err.message) || String(err);
        if (n.attempts >= 5) n.status = "failed";
        await n.save();
        throw err;
      }
    }

    // It's a meta notification: expand recipients and fan-out
    const meta = n.recipientMeta || {};
    let resolvedIds = [];

    if (meta === "all" || (meta.type && meta.type === "all")) {
      const users = await User.find({}).select("_id");
      resolvedIds = users.map((u) => u._id.toString());
    } else if (meta.type === "club" && meta.id) {
      const club = await Club.findById(meta.id).select("coreMembers");
      if (club && club.coreMembers && club.coreMembers.length) {
        resolvedIds = club.coreMembers.map((m) => m.toString());
      }
    }

    if (!resolvedIds.length) {
      // nothing to send: mark as failed
      n.status = "failed";
      n.error = "No recipients resolved for meta notification";
      n.attempts = (n.attempts || 0) + 1;
      await n.save();
      return { status: "no-recipients", notificationId };
    }

    // Fan-out: create per-user notifications and enqueue jobs
    for (const uid of resolvedIds) {
      const child = await Notification.create({
        recipient: uid,
        recipientMeta: null,
        channel: n.channel,
        title: n.title,
        message: n.message,
        data: n.data,
        createdBy: n.createdBy,
        status: "pending",
      });

      await notificationQueue.add(
        "sendNotification",
        { notificationId: child._id.toString() },
        { attempts: 5, backoff: { type: "exponential", delay: 1000 }, removeOnComplete: true }
      );
    }

    // mark meta as processed
    n.status = "sent";
    n.sentAt = new Date();
    await n.save();
    return { status: "fanout", count: resolvedIds.length };
  },
  {
    connection: notificationQueue.opts.connection,
    prefix: notificationQueue.opts.prefix,
  }
);

worker.on("completed", (job) => {
  console.log(`✅ Notification job completed: ${job.id}`);
});
worker.on("failed", (job, err) => {
  console.error(`❌ Notification job failed: ${job.id} -> ${err.message || err}`);
});

module.exports = worker;
