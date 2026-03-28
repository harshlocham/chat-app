---
"@chat/auth": patch
"@chat/db": patch
"@chat/redis": patch
"@chat/services": patch
"@chat/types": patch
---

Refactor CI/CD to use Changesets-native package tags for deployment

- Removed root `v*` tag creation logic from release workflow
- Updated deploy workflow to trigger on Changesets tags (`@chat/services@*`)
- Implemented strict tag parsing and validation
- Added package-specific deployment gating
- Improved Docker tagging and metadata extraction
- Enforced PAT usage for reliable workflow chaining