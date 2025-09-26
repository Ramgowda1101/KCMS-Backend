//src/services/audit.service.js

const AuditLog = require("../models/auditLog.model");

/**
 * Logs an audit entry
 * @param {Object} options
 * @param {ObjectId|string} options.actor - User ID or "system"
 * @param {String} options.action - What happened (e.g., "club:create")
 * @param {String} options.resourceType - Type of resource ("Club", "User", etc.)
 * @param {ObjectId} options.resourceId - The resource identifier
 * @param {Object} [options.before] - State before change
 * @param {Object} [options.after] - State after change
 * @param {String} [options.reason] - Context/reason for action
 */
async function logAudit({ actor, action, resourceType, resourceId, before, after, reason }) {
  try {
    // Normalize actor: allow system logs
    const actorValue = actor || "system";

    await AuditLog.create({
      actor: actorValue,
      action,
      resourceType,
      resourceId,
      before,
      after,
      reason,
    });
  } catch (err) {
    console.error("Audit log error:", err.message || err);
  }
}

module.exports = { logAudit };
