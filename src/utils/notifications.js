// src/utils/notifications.js
const { enqueueNotification } = require("../services/notification.service");

/**
 * sendNotification(message, recipients, options)
 * - recipients: string | array | object
 * - options: { channel: 'email'|'in-app'|'push', title, data, createdBy }
 *
 * This wrapper returns a Promise resolving to created notification docs.
 */
const sendNotification = async (message, recipients = "all", options = {}) => {
  const title = options.title || message;
  const data = options.templateVars || options.data || {};
  try {
    const docs = await enqueueNotification(title, recipients, {
      channel: options.channel || "in-app",
      data,
      createdBy: options.createdBy || null,
    });
    return docs;
  } catch (err) {
    console.error("sendNotification error:", err && err.message ? err.message : err);
    return null;
  }
};

module.exports = { sendNotification };
