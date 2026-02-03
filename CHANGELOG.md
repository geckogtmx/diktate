# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Project**: Implementing Phase 1-4 Quality Gatekeepers.
- **Python**: Integrated `ruff` for ultra-fast linting and formatting.
- **TypeScript**: Migrated to ESLint v9 Flat Config and Prettier.
- **Workflow**: Added `husky` and `lint-staged` for pre-commit enforcement.
- **Standards**: Added `LICENSE`, `CODEOWNERS`, and `CONTRIBUTING.md`.

### Changed
- Refactored `src/main.ts` to remove legacy `require()` calls.
- Refactored `pythonManager.ts` to use safer async/await patterns.
- Standardized project-wide formatting (tabs, quotes, line lengths).

### Security
- Added `detect-secrets` baseline to prevent credential leaks.
