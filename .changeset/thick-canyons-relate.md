---
"mobile": major
"@chat/services": minor
"@chat/redis": minor
"@chat/types": minor
"@chat/auth": minor
"@chat/db": minor
---

Enhanced mobile authentication and chat session management, and standardized monorepo build tooling across shared packages.

- Added mobile auth support improvements and session flow hardening.
- Added explicit build scripts/config for shared packages (auth, db, services, redis, types) to emit dist artifacts consistently.
- Improved repository cleanup scripts with safer artifact cleanup and full-reset options.
- Updated Turbo build outputs for better Next.js build caching behavior.
