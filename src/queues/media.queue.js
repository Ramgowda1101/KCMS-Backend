// src/queues/media.queue.js
const { Queue } = require("bullmq");
const { redisConnection } = require("../config/redis");

const mediaQueue = new Queue("media", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 }, // retry with backoff
    removeOnFail: false,
  },
});

module.exports = { mediaQueue };
