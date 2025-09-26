// src/queues/notification.queue.js
const { Queue, QueueScheduler } = require("bullmq");

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const QUEUE_NAME = process.env.BULLMQ_NOTIFICATION_QUEUE || "notifications";
const BULL_PREFIX = process.env.BULLMQ_PREFIX || "kmit";

/**
 * Create a QueueScheduler to enable delayed jobs, retries and stalled-job recovery.
 * Keep one scheduler instance per queue in your app.
 */
const queueScheduler = new QueueScheduler(QUEUE_NAME, {
  connection: { url: REDIS_URL },
  prefix: BULL_PREFIX,
});

/**
 * The Queue object used to add jobs.
 */
const queue = new Queue(QUEUE_NAME, {
  connection: { url: REDIS_URL },
  prefix: BULL_PREFIX,
});

/**
 * Default job options for notification sending
 */
const defaultJobOptions = {
  attempts: 5,
  backoff: {
    type: "exponential",
    delay: 1000, // initial delay 1s, exponential thereafter
  },
  removeOnComplete: { age: 3600, count: 1000 }, // keep some history
  removeOnFail: { age: 604800, count: 1000 }, // keep failed logs up to a week
};

module.exports = { queue, queueScheduler, defaultJobOptions, QUEUE_NAME };
