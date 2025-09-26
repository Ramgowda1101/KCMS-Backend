/**
 * Role definitions + permissions + scope
 *
 * Roles in the system:
 *  - student
 *  - club-core
 *  - club-coordinator
 *  - admin
 *
 * Permissions are strings of form "resource:action".
 * Scope values:
 *  - "self"      -> acts only on own resources
 *  - "club"      -> acts on resources of the user's own club(s)
 *  - "assigned"  -> acts on clubs/events assigned to them (coordinator)
 *  - "global"    -> system-wide
 */
const roles = {
  student: {
    scope: "self",
    permissions: [
      // Clubs
      "club:view",
      "club:join",
      "club:leave",

      // Events
      "event:view",
      "event:register",
      "event:unregister",

      // Recruitment
      "recruitment:view",
      "recruitment:apply",
    ],
  },

  "club-core": {
    scope: "club",
    permissions: [
      // Clubs
      "club:manage",           // manage their club
      "club:event-propose",

      // Events
      "event:create",
      "event:update",
      "event:view-registrations",

      // Recruitment
      "recruitment:create",
      "recruitment:review",
      "recruitment:export",
      "recruitment:view",
    ],
  },

  "club-coordinator": {
    scope: "assigned",
    permissions: [
      // Clubs
      "club:view",
      "club:approve",
      "club:manage",

      // Events
      "event:view",
      "event:approve",
      "event:manage",

      // Recruitment
      "recruitment:view",
      "recruitment:manage",
      "recruitment:approve",
    ],
  },

  admin: {
    scope: "global",
    permissions: [
      // Clubs
      "club:create",
      "club:delete",
      "club:manage",
      "club:approve",
      "club:archive",

      // Events
      "event:create",
      "event:update",
      "event:delete",
      "event:manage",
      "event:approve",
      "event:cancel",

      // Users
      "user:manage",
      "user:verify",
      "user:assign-role",
      "user:deactivate",

      // Recruitment
      "recruitment:create",
      "recruitment:delete",
      "recruitment:manage",
      "recruitment:approve",
      "recruitment:review",
      "recruitment:export",
      "recruitment:view",

      // Audit & Admin UI
      "audit:view",
      "admin:access",
    ],
  },
};

module.exports = roles;
