# Auth Service — Contract

Pluggable identity. `AUTH_ADAPTER`: `single-user` (default) | `local-db` | `oidc` (Phase 3).

```ts
authenticate(headers) -> Principal            // API key → JWT → single-user fallback
registerUser(email, password, name?) -> Principal   // local-db only
loginUser(email, password) -> Principal
signAccessToken(p) / signRefreshToken(p) / verifyToken(tok, 'access'|'refresh')
generateApiKey() -> {token: 'smj_<prefix>_<secret>', prefix, hash}  // hash stored, token shown once
assertSameOrg(principal, rowOrgId)            // throws ForbiddenError(403)
assertRoleAtLeast(principal, minRole)         // viewer < member < admin < owner
ensureSeed() -> {userId, orgId}               // idempotent; single-user boot
```

Every request principal carries `{userId, orgId, role, scopes, via}` — `orgId`
is the tenancy key all other services filter on.
