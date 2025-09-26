// src/queues/index.js
const { Queue, QueueScheduler } = require("bullmq");

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const PREFIX = process.env.BULLMQ_PREFIX || "kmit";

// Proper connection object
const connection = { url: REDIS_URL };

// Notification queue
const NOTIFICATION_QUEUE_NAME = process.env.BULLMQ_NOTIFICATION_QUEUE || "notifications";
const notificationQueueScheduler = new QueueScheduler(NOTIFICATION_QUEUE_NAME, {
  connection,
  prefix: PREFIX,
});
const notificationQueue = new Queue(NOTIFICATION_QUEUE_NAME, { connection, prefix: PREFIX });

// Export queue
const EXPORT_QUEUE_NAME = process.env.BULLMQ_EXPORT_QUEUE || "exports";
const exportQueueScheduler = new QueueScheduler(EXPORT_QUEUE_NAME, {
  connection,
  prefix: PREFIX,
});
const exportQueue = new Queue(EXPORT_QUEUE_NAME, { connection, prefix: PREFIX });

// Media queue
const MEDIA_QUEUE_NAME = process.env.BULLMQ_MEDIA_QUEUE || "media";
const mediaQueueScheduler = new QueueScheduler(MEDIA_QUEUE_NAME, {
  connection,
  prefix: PREFIX,
});
const mediaQueue = new Queue(MEDIA_QUEUE_NAME, { connection, prefix: PREFIX });

// Default job options
const defaultJobOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 1000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 604800, count: 1000 },
};

module.exports = {
  connection,
  PREFIX,
  notificationQueue,
  notificationQueueScheduler,
  NOTIFICATION_QUEUE_NAME,
  exportQueue,
  exportQueueScheduler,
  EXPORT_QUEUE_NAME,
  mediaQueue,
  mediaQueueScheduler,
  MEDIA_QUEUE_NAME,
  defaultJobOptions,
};
