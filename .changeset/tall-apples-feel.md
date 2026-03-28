---
"@chat/auth": major
"@chat/db": minor
---

Migrate authentication to JWT with stronger session controls and security hardening.

- Replace legacy auth flow with access/refresh JWT tokens and server-backed session validation.
- Add tokenVersion-based global session invalidation for emergency token revocation.
- Harden login, refresh, logout, and logout-all flows with stricter validation and invalidation behavior.
- Update user schema for mixed provider accounts, including OAuth-only users with optional password.
- Apply OAuth/provider-linking and auth-route security hardening to close identified edge cases.
