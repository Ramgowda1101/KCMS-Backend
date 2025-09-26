// src/services/scan.service.js
const NodeClam = require("clamscan");

let clamscanInstance = null;

/**
 * Initialize ClamAV scanner.
 * Call init() at app startup (or worker startup). Throws if not available.
 */
async function init() {
  if (clamscanInstance) return clamscanInstance;
  const clamscan = await new NodeClam().init({
    removeInfected: false,
    clamdscan: {
      host: process.env.CLAMAV_HOST || "127.0.0.1",
      port: process.env.CLAMAV_PORT ? parseInt(process.env.CLAMAV_PORT, 10) : 3310,
      timeout: 60000,
    },
    debugMode: false,
  });
  clamscanInstance = clamscan;
  return clamscanInstance;
}

/**
 * Scan a local file path using ClamAV
 * Returns { isInfected: boolean, viruses: [] }
 */
async function scanFile(filePath) {
  if (!clamscanInstance) {
    throw new Error("ClamAV not initialized");
  }
  // isInfected returns { isInfected, viruses }
  const { isInfected, viruses } = await clamscanInstance.isInfected(filePath);
  return { isInfected, viruses: viruses || [] };
}

module.exports = { init, scanFile, };
