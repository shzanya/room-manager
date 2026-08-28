import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Logger } from "@room-manager/logger";
import type { GuildId } from "@room-manager/shared";

/** Every permission action the bot recognises. */
export type PermissionAction =
  | "createRoom"
  | "manageRoom"
  | "whitelist"
  | "mute"
  | "settings";

/** The four role groups every guild can define. */
export type RoleGroup =
  | "administrators"
  | "moderators"
  | "members"
  | "restricted";

/**
 * A per-action allow / deny rule set.
 * Each side can reference both logical groups *and* raw Discord role IDs.
 *
 * Resolution: deny always wins over allow.
 */
export interface ActionPolicy {
  allowGroups: RoleGroup[];
  allowRoles: string[];
  denyGroups: RoleGroup[];
  denyRoles: string[];
}

/** Role group → Discord role ID mapping. */
export interface RoleGroups {
  administrators: string[];
  moderators: string[];
  members: string[];
  restricted: string[];
}

/** Complete per-guild role configuration. */
export interface RolePolicyConfig {
  groups: RoleGroups;
  policies: Record<PermissionAction, ActionPolicy>;
  /** Role granted/revoked for in-room mute. */
  muteRoleId: string | null;
  /** Roles that bypass all policy checks (admin/owner). */
  adminRoles: string[];
}

type StoreFile = Record<string, Partial<RolePolicyConfig>>;

const EMPTY_POLICY: ActionPolicy = {
  allowGroups: [],
  allowRoles: [],
  denyGroups: [],
  denyRoles: [],
};

const DEFAULTS: RolePolicyConfig = {
  groups: {
    administrators: [],
    moderators: [],
    members: [],
    restricted: [],
  },
  policies: {
    createRoom: { ...EMPTY_POLICY },
    manageRoom: { ...EMPTY_POLICY },
    whitelist: { ...EMPTY_POLICY },
    mute: { ...EMPTY_POLICY },
    settings: { ...EMPTY_POLICY },
  },
  muteRoleId: null,
  adminRoles: [],
};

/**
 * Per-guild role-policy store at `data/role-policy.json`.
 *
 * Resolution order (deny always wins):
 * 1. Admin roles → bypass all checks (auto-granted)
 * 2. Explicit deny role
 * 3. Explicit allow role
 * 4. Deny group membership
 * 5. Allow group membership
 * 6. Default → deny
 */
export class RolePolicyService {
  private store: StoreFile = {};
  private readonly storeFile: string;

  constructor(private readonly logger: Logger) {
    const dataDir = join(process.cwd(), "..", "..", "data");
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    this.storeFile = join(dataDir, "role-policy.json");
    this.load();
  }

  // ── persistence ────────────────────────────────────────────────────

  private load(): void {
    try {
      if (existsSync(this.storeFile)) {
        this.store = JSON.parse(readFileSync(this.storeFile, "utf8"));
      }
    } catch {
      this.store = {};
    }
  }

  private save(): void {
    try {
      writeFileSync(this.storeFile, JSON.stringify(this.store));
    } catch (e) {
      this.logger.warn("Failed to save role-policy store", e);
    }
  }

  // ── getters / setters ──────────────────────────────────────────────

  getConfig(guildId: GuildId): RolePolicyConfig {
    return structuredClone({ ...DEFAULTS, ...this.store[guildId] });
  }

  setConfig(guildId: GuildId, patch: Partial<RolePolicyConfig>): void {
    this.store[guildId] = { ...this.getConfig(guildId), ...patch };
    this.save();
  }

  /** Set allow/deny arrays for a single action. */
  setPolicy(
    guildId: GuildId,
    action: PermissionAction,
    patch: Partial<ActionPolicy>,
  ): void {
    const cfg = this.getConfig(guildId);
    cfg.policies[action] = { ...cfg.policies[action], ...patch };
    this.setConfig(guildId, cfg);
  }

  /** Replace all groups at once. */
  setGroups(guildId: GuildId, groups: RoleGroups): void {
    const cfg = this.getConfig(guildId);
    cfg.groups = groups;
    this.setConfig(guildId, cfg);
  }

  /** Add a role to a group. */
  addGroupRole(guildId: GuildId, group: RoleGroup, roleId: string): void {
    const cfg = this.getConfig(guildId);
    if (!cfg.groups[group].includes(roleId)) {
      cfg.groups[group].push(roleId);
      this.setConfig(guildId, cfg);
    }
  }

  /** Remove a role from a group. */
  removeGroupRole(guildId: GuildId, group: RoleGroup, roleId: string): void {
    const cfg = this.getConfig(guildId);
    const idx = cfg.groups[group].indexOf(roleId);
    if (idx !== -1) {
      cfg.groups[group].splice(idx, 1);
      this.setConfig(guildId, cfg);
    }
  }

  setMuteRoleId(guildId: GuildId, roleId: string | null): void {
    const cfg = this.getConfig(guildId);
    cfg.muteRoleId = roleId;
    this.setConfig(guildId, cfg);
  }

  setAdminRoles(guildId: GuildId, roleIds: string[]): void {
    const cfg = this.getConfig(guildId);
    cfg.adminRoles = roleIds;
    this.setConfig(guildId, cfg);
  }

  // ── resolution ─────────────────────────────────────────────────────

  /**
   * Does `roleIds` intersect `groupRoleIds`?
   * Either array may contain raw IDs or be empty.
   */
  private matchesAny(memberRoleIds: string[], targetIds: string[]): boolean {
    return targetIds.some((id) => memberRoleIds.includes(id));
  }

  /**
   * Resolve whether a guild member may perform `action`.
   *
   * @param memberRoleIds  IDs of the member's Discord roles.
   * @param action         The permission action to evaluate.
   * @param guildId        Guild identifier.
   * @returns `true` when allowed, `false` when denied.
   */
  can(
    memberRoleIds: string[],
    action: PermissionAction,
    guildId: GuildId,
  ): boolean {
    const cfg = this.getConfig(guildId);

    // 1) Admin bypass
    if (cfg.adminRoles.length > 0) {
      if (this.matchesAny(memberRoleIds, cfg.adminRoles)) {
        return true;
      }
    }

    const policy = cfg.policies[action];
    const groups = cfg.groups;

    // 2) Expand group references into concrete role IDs
    const expandedDenyRoles = [
      ...policy.denyRoles,
      ...policy.denyGroups.flatMap((g) => groups[g] ?? []),
    ];
    const expandedAllowRoles = [
      ...policy.allowRoles,
      ...policy.allowGroups.flatMap((g) => groups[g] ?? []),
    ];

    // 3) Deny wins over allow
    if (this.matchesAny(memberRoleIds, expandedDenyRoles)) {
      return false;
    }
    if (this.matchesAny(memberRoleIds, expandedAllowRoles)) {
      return true;
    }

    // 4) Default → deny
    return false;
  }

  /** Shorthand: can this member create rooms? */
  canCreateRoom(memberRoleIds: string[], guildId: GuildId): boolean {
    return this.can(memberRoleIds, "createRoom", guildId);
  }

  /** Shorthand: can this member manage rooms (moderator)? */
  canManageRoom(memberRoleIds: string[], guildId: GuildId): boolean {
    return this.can(memberRoleIds, "manageRoom", guildId);
  }

  /** Shorthand: can this member use mute controls? */
  canMute(memberRoleIds: string[], guildId: GuildId): boolean {
    return this.can(memberRoleIds, "mute", guildId);
  }

  /** Shorthand: can this member use whitelist controls? */
  canWhitelist(memberRoleIds: string[], guildId: GuildId): boolean {
    return this.can(memberRoleIds, "whitelist", guildId);
  }

  /** Shorthand: can this member access bot settings? */
  canAccessSettings(memberRoleIds: string[], guildId: GuildId): boolean {
    return this.can(memberRoleIds, "settings", guildId);
  }
}
