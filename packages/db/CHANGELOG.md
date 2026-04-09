# @chat/db

## 1.2.0

### Minor Changes

- 3215a80: Enhanced mobile authentication and chat session management, and standardized monorepo build tooling across shared packages.

  - Added mobile auth support improvements and session flow hardening.
  - Added explicit build scripts/config for shared packages (auth, db, services, redis, types) to emit dist artifacts consistently.
  - Improved repository cleanup scripts with safer artifact cleanup and full-reset options.
  - Updated Turbo build outputs for better Next.js build caching behavior.

## 1.1.3

### Patch Changes

- 86f8cfe: Refactor CI/CD to use Changesets-native package tags for deployment

  - Removed root `v*` tag creation logic from release workflow
  - Updated deploy workflow to trigger on Changesets tags (`@chat/services@*`)
  - Implemented strict tag parsing and validation
  - Added package-specific deployment gating
  - Improved Docker tagging and metadata extraction
  - Enforced PAT usage for reliable workflow chaining

## 1.1.2

### Patch Changes

- 86f8cfe: Fix release workflow to create root version tags for deploy trigger

  - **release.yml**: Add step to create root repository version tag (v\*) based on highest package version
  - **deploy.yml compatibility**: Root v\* tags now enable proper deployment workflow triggering
  - This resolves the issue where release workflow created only package-scoped tags but deploy workflow needed root tags

## 1.1.1

### Patch Changes

- 3b307d2: Fix CI/CD release and deployment pipeline configuration

  - **release.yml**: Fix publish step to actually create git tags using `npx changeset tag` instead of echo fallback
  - **release.yml**: Add robust token fallback (`CHANGESETS_GITHUB_TOKEN || GITHUB_TOKEN`) for private repo releases
  - **deploy.yml**: Relax actor gate to allow repository owner to trigger deployments from token-based releases
  - **deploy.yml**: Add comprehensive deployment provenance validation (semver format, commit ancestry, GitHub Release verification)
  - **deploy.yml**: Add timeout configurations and improve error handling for staging/production builds

  These fixes ensure the automated release pipeline correctly creates version tags and the deployment workflow is properly triggered, enabling end-to-end CI/CD automation for the monorepo.

## 1.1.0

### Minor Changes

- c5b8b6c: Migrate authentication to JWT with stronger session controls and security hardening.

  - Replace legacy auth flow with access/refresh JWT tokens and server-backed session validation.
  - Add tokenVersion-based global session invalidation for emergency token revocation.
  - Harden login, refresh, logout, and logout-all flows with stricter validation and invalidation behavior.
  - Update user schema for mixed provider accounts, including OAuth-only users with optional password.
  - Apply OAuth/provider-linking and auth-route security hardening to close identified edge cases.
