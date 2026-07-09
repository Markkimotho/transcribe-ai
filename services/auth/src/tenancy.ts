// The single tenancy-enforcement helper. Every service that reads a row
// with an org_id runs it through here before returning data.
import type { Principal } from '@semaje/schemas'

export class ForbiddenError extends Error {
  status = 403
  constructor(msg = 'Forbidden: resource belongs to another organization') { super(msg) }
}

export function assertSameOrg(principal: Principal, rowOrgId: string): void {
  if (!rowOrgId || principal.orgId !== rowOrgId) throw new ForbiddenError()
}

/** Role gate: viewer < member < admin < owner. */
const RANK: Record<string, number> = { viewer: 0, member: 1, admin: 2, owner: 3 }
export function assertRoleAtLeast(principal: Principal, minRole: string): void {
  if ((RANK[principal.role] ?? -1) < (RANK[minRole] ?? 99)) {
    throw new ForbiddenError(`Requires role ${minRole} or higher`)
  }
}
