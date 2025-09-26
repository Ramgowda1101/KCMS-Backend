// src/jobs/workers/media.worker.js
const { Worker } = require("bullmq");
const { connection, MEDIA_QUEUE_NAME, defaultJobOptions } = require("../../queues");
const Media = require("../../models/media.model");
const { logAudit } = require("../../services/audit.service");
const { scanFile, init: initScanner } = require("../../services/scan.service");
const { downloadS3ToTemp } = require("../../services/storage.service");
const fs = require("fs").promises;
const path = require("path");

// Worker processor (real scan)
async function processor(job) {
  const { mediaId, storageType, storageKey } = job.data;
  if (!mediaId) throw new Error("Missing mediaId in job payload");

  const media = await Media.findById(mediaId);
  if (!media) throw new Error(`Media doc not found: ${mediaId}`);

  // Ensure the scanner is initialized
  await initScanner();

  // Determine local path to scan
  let localPath = null;
  let tempToRemove = null;

  if (storageType === "local") {
    // storageKey already is local path
    localPath = media.storageKey;
  } else if (storageType === "s3") {
    // download to temp
    const tmpFile = await downloadS3ToTemp(storageKey);
    localPath = tmpFile;
    tempToRemove = tmpFile;
  } else {
    throw new Error("Unsupported storageType for scanning");
  }

  try {
    const result = await scanFile(localPath);
    if (result.isInfected) {
      media.status = "rejected";
      media.scanResult = (result.viruses || []).join(", ");
      media.scannedAt = new Date();
      await media.save();

      await logAudit({
        actor: "system",
        action: "media:rejected",
        resourceType: "Media",
        resourceId: media._id.toString(),
        reason: `Malware detected: ${media.scanResult}`,
      });

      throw new Error(`Malware detected: ${media.scanResult}`);
    }

    // passed
    media.status = "scanned";
    media.scanResult = (result.viruses || []).join(", ");
    media.scannedAt = new Date();
    await media.save();

    await logAudit({
      actor: "system",
      action: "media:scanned",
      resourceType: "Media",
      resourceId: media._id.toString(),
      after: { status: media.status },
    });

    return { status: "scanned" };
  } finally {
    // cleanup temp file if any
    if (tempToRemove) {
      try {
        await fs.unlink(tempToRemove);
        const dir = path.dirname(tempToRemove);
        // attempt to remove temp dir if empty
        await fs.rmdir(dir).catch(() => {});
      } catch (err) {
        // swallow cleanup errors
      }
    }
  }
}

// Initialize worker instance
const mediaWorker = new Worker(
  MEDIA_QUEUE_NAME,
  processor,
  { connection, prefix: process.env.BULLMQ_PREFIX || "kmit", ...defaultJobOptions }
);

// Attach listeners for audit logging on fail/complete
mediaWorker.on("failed", async (job, err) => {
  if (job && job.data && job.data.mediaId) {
    await logAudit({
      actor: "system",
      action: "media:scan_failed",
      resourceType: "Media",
      resourceId: job.data.mediaId,
      reason: err ? err.message : "unknown",
    });
  }
});

module.exports = mediaWorker;
