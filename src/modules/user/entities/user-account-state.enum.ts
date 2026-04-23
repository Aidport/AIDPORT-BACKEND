/** Account access for app users and agents (separate from agent onboarding `AgentStatus`). */
export enum UserAccountState {
  Active = 'active',
  Blocked = 'blocked',
  Suspended = 'suspended',
  /** Awaiting review / approval (e.g. new agent) — login blocked until set to `active` by admin. */
  Pending = 'pending',
}
