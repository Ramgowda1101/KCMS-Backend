// src/services/storage.service.js
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { pipeline } = require("stream/promises");
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const Media = require("../models/media.model");
const { mediaQueue, defaultJobOptions } = require("../queues");
const mongoose = require("mongoose");

const UPLOAD_DIR = path.join(__dirname, "../../uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// S3 / MinIO configuration (optional)
const S3_ENABLED = !!(process.env.S3_ENDPOINT && process.env.S3_BUCKET && process.env.S3_KEY && process.env.S3_SECRET);
let s3Client = null;
if (S3_ENABLED) {
  s3Client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.S3_KEY,
      secretAccessKey: process.env.S3_SECRET,
    },
    forcePathStyle: true, // for MinIO
  });
}

/**
 * Compute SHA256 hex for buffer
 */
function computeHash(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Upload buffer to local disk and return storage info
 */
async function uploadToLocal(buffer, filename) {
  const hash = computeHash(buffer);
  const ext = path.extname(filename) || "";
  const storageName = `${hash}${ext}`;
  const storagePath = path.join(UPLOAD_DIR, storageName);
  await fs.promises.writeFile(storagePath, buffer, { mode: 0o600 });
  const url = `/uploads/${storageName}`; // dev: serve statically via express.static('/uploads')
  return { storageType: "local", storageKey: storagePath, url, hash };
}

/**
 * Upload buffer to S3-compatible storage (MinIO)
 */
async function uploadToS3(buffer, filename) {
  if (!s3Client) throw new Error("S3 client not configured");
  const hash = computeHash(buffer);
  const ext = path.extname(filename) || "";
  const key = `${hash}${ext}`;
  const params = {
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: undefined, // optional, caller may set
  };
  await s3Client.send(new PutObjectCommand(params));
  // Construct URL (best-effort: use S3_PUBLIC_URL if provided, else endpoint + bucket)
  const publicBase = process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT;
  const url = `${publicBase.replace(/\/$/, "")}/${process.env.S3_BUCKET}/${key}`;
  return { storageType: "s3", storageKey: key, url, hash };
}

/**
 * Save an uploaded file buffer (called by controllers)
 * options = { originalName, buffer, mimetype, size, relatedEntity, relatedId, uploadedBy }
 */
async function saveBuffer(options = {}) {
  const {
    originalName,
    buffer,
    mimetype,
    size,
    relatedEntity = null,
    relatedId = null,
    uploadedBy,
  } = options;

  if (!buffer || !Buffer.isBuffer(buffer)) throw new Error("Invalid file buffer");
  if (!uploadedBy) throw new Error("uploadedBy is required");

  // Persist file in storage (S3 or local)
  let storageInfo;
  if (S3_ENABLED) {
    storageInfo = await uploadToS3(buffer, originalName);
  } else {
    storageInfo = await uploadToLocal(buffer, originalName);
  }

  // Create Media doc
  const doc = await Media.create({
    filename: originalName,
    mimetype,
    size,
    hash: storageInfo.hash,
    storageKey: storageInfo.storageKey,
    storageType: storageInfo.storageType,
    url: storageInfo.url,
    uploadedBy: mongoose.Types.ObjectId(uploadedBy),
    status: "pending", // will be updated after scan
    relatedEntity,
    relatedId: relatedId ? mongoose.Types.ObjectId(relatedId) : null,
  });

  // enqueue job for scanning: job payload includes storage info for worker
  await mediaQueue.add(
    "scanMedia",
    {
      mediaId: doc._id.toString(),
      storageType: storageInfo.storageType,
      storageKey: storageInfo.storageKey,
    },
    Object.assign({}, defaultJobOptions)
  );

  return doc;
}

/**
 * Download S3 object to a local temp file (used in worker)
 */
async function downloadS3ToTemp(key) {
  if (!s3Client) throw new Error("S3 client not configured");
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "media-"));
  const tmpPath = path.join(tmpDir, path.basename(key));
  const command = new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key });
  const data = await s3Client.send(command);
  // data.Body is a stream in v3
  const bodyStream = data.Body;
  await pipeline(bodyStream, fs.createWriteStream(tmpPath, { mode: 0o600 }));
  return tmpPath;
}

module.exports = {
  saveBuffer,
  downloadS3ToTemp,
  S3_ENABLED,
};
