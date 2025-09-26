// src/services/notification.service.js
const { notificationQueue, exportQueue, defaultJobOptions } = require("../queues/index");
const Notification = require("../models/notification.model");
const User = require("../models/user.model");
const Club = require("../models/club.model");
const mongoose = require("mongoose");

/**
 * Resolve recipients into explicit user IDs when possible.
 * Accepts:
 *  - "all"
 *  - userId string
 *  - array of userId strings
 *  - { user: id }
 *  - { users: [ids] }
 *  - { club: clubId } -> resolves to club.coreMembers
 */
async function resolveRecipients(recipients) {
  if (!recipients) return [];

  if (recipients === "all") return []; // meta: don't expand here

  if (typeof recipients === "string" && /^[0-9a-fA-F]{24}$/.test(recipients)) {
    const u = await User.findById(recipients).select("_id");
    return u ? [u._id.toString()] : [];
  }

  if (Array.isArray(recipients)) {
    const ids = recipients.filter((r) => typeof r === "string" && /^[0-9a-fA-F]{24}$/.test(r));
    const users = await User.find({ _id: { $in: ids } }).select("_id");
    return users.map((u) => u._id.toString());
  }

  if (typeof recipients === "object") {
    if (recipients.user) return resolveRecipients(recipients.user);
    if (recipients.users) return resolveRecipients(recipients.users);
    if (recipients.club && /^[0-9a-fA-F]{24}$/.test(recipients.club)) {
      const club = await Club.findById(recipients.club).select("coreMembers");
      if (!club) return [];
      return (club.coreMembers || []).map((m) => m.toString());
    }
  }

  return []; // unresolved -> treat as meta at DB level
}

/**
 * Enqueue an in-app/email notification.
 * - If recipients can be resolved to specific user IDs, create per-user Notification and enqueue job for each.
 * - If recipients unresolved (e.g., "all" or complex filter), create a meta Notification and enqueue a single job which the worker will expand.
 *
 * options: {
 *   channel: 'in-app'|'email'|'push'|'sms',
 *   title,
 *   message,
 *   data,
 *   recipients,
 *   createdBy,
 *   delayMs
 * }
 */
async function enqueueNotification(options = {}) {
  const {
    channel = "in-app",
    title = "Notification",
    message = "",
    data = {},
    recipients = "all",
    createdBy = null,
    delayMs = 0,
  } = options;

  const resolvedIds = await resolveRecipients(recipients);

  const created = [];

  if (Array.isArray(resolvedIds) && resolvedIds.length > 0) {
    // create per-user notifications and enqueue one job per notification
    for (const uid of resolvedIds) {
      const doc = await Notification.create({
        recipient: mongoose.Types.ObjectId(uid),
        recipientMeta: null,
        channel,
        title,
        message,
        data,
        createdBy: createdBy ? mongoose.Types.ObjectId(createdBy) : null,
        status: "pending",
      });

      // add to queue with job payload referencing notification id
      const job = await notificationQueue.add(
        "sendNotification",
        { notificationId: doc._id.toString() },
        Object.assign({}, defaultJobOptions, delayMs ? { delay: delayMs } : {})
      );

      // store jobId for tracing
      doc.jobId = job.id ? job.id.toString() : null;
      await doc.save();

      created.push(doc);
    }

    return created;
  }

  // unresolved / meta: create meta notification and enqueue a job that will expand recipients
  const metaDoc = await Notification.create({
    recipient: null,
    recipientMeta: recipients,
    channel,
    title,
    message,
    data,
    createdBy: createdBy ? mongoose.Types.ObjectId(createdBy) : null,
    status: "pending",
  });

  const job = await notificationQueue.add(
    "sendNotification",
    { notificationId: metaDoc._id.toString() },
    Object.assign({}, defaultJobOptions, delayMs ? { delay: delayMs } : {})
  );

  metaDoc.jobId = job.id ? job.id.toString() : null;
  await metaDoc.save();

  created.push(metaDoc);
  return created;
}

/**
 * Enqueue an export job (CSV generation, etc.)
 * payload: { type: 'recruitmentApplicants', recruitmentId, requestedBy, options }
 */
async function enqueueExportJob(payload = {}) {
  const job = await exportQueue.add("exportJob", payload, Object.assign({}, defaultJobOptions, { removeOnComplete: true }));
  return job;
}

module.exports = {
  enqueueNotification,
  enqueueExportJob,
  resolveRecipients,
};
