---
"@chat/auth": patch
"@chat/db": patch
"@chat/redis": patch
"@chat/services": patch
"@chat/types": patch
---

Refactor CI/CD to use Changesets-native package tags for deployment

- Removed root `v*` tag creation logic from release workflow
- Updated deploy workflow to trigger on Changesets tags (`@chat/*@*`)
- Implemented strict tag parsing and validation for package-scoped releases
- Added package-specific deployment gating (services only)
- Improved Docker image tagging using extracted package + version metadata
- Enforced use of PAT for reliable workflow chaining and GHCR authentication
- Ensures deterministic, scalable monorepo release and deployment pipeline