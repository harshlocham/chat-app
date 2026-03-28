---
"@chat/auth": patch
"@chat/db": patch
"@chat/redis": patch
"@chat/services": patch
"@chat/types": patch
---

Fix release workflow to create root version tags for deploy trigger

- **release.yml**: Add step to create root repository version tag (v*) based on highest package version
- **deploy.yml compatibility**: Root v* tags now enable proper deployment workflow triggering
- This resolves the issue where release workflow created only package-scoped tags but deploy workflow needed root tags
