/**
 * Role definitions + permissions + scope
 *
 * Scope levels:
 *   "self"      → can only manage their own data
 *   "club"      → can manage within their own club
 *   "assigned"  → can manage assigned clubs/events
 *   "global"    → can manage across the whole system
 */

const roles = {
  student: {
    scope: "self",
    permissions: [
      // General
      "club:view",
      "event:view",

      // Club participation
      "club:join",
      "club:leave",

      // Event participation
      "event:register",
      "event:unregister",
    ],
  },

  "club-core": {
    scope: "club", // limited to their own club
    permissions: [
      "club:manage",       // edit/update their club
      "club:event-propose",
      "event:create",
      "event:update",
    ],
  },

  "club-coordinator": {
    scope: "assigned", // clubs/events assigned to them
    permissions: [
      "club:view",
      "club:approve",     // approve membership requests
      "event:view",
      "event:approve",    // approve events
      "event:manage",
    ],
  },

  admin: {
    scope: "global", // system-wide
    permissions: [
      // Clubs
      "club:create",
      "club:delete",
      "club:manage",
      "club:approve",

      // Events
      "event:create",
      "event:delete",
      "event:manage",
      "event:approve",

      // Users
      "user:manage",
      "user:verify",
      "user:assign-role",
    ],
  },
};

module.exports = roles;
