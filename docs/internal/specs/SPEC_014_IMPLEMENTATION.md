# SPEC_014 Implementation Plan: Automated Quality Gatekeepers

> **Parent Spec:** [SPEC_014: Codebase Etiquette & Professionalization (V2)](./SPEC_014_CODE_ETIQUETTE_V2.md)
> **Focus:** Priority 1 - Automated Quality Gatekeepers
> **Status:** Complete

## 1. Overview
This document outlines the specific steps and tasks required to implement the automated quality gates defined in SPEC_014. These tools (Ruff, ESLint, Prettier, Husky, detect-secrets) replace manual enforcement with automated checks, ensuring code hygiene and security.

**Detected Environment:**
- Package Manager: **pnpm** (Locked via `pnpm-lock.yaml`)
- Python Structure: `python/` directory with `requirements.txt`

## 2. Implementation Tasks

### 2.1 Python Tooling (Ruff)
- [x] **Install Dependencies**: Create `python/requirements-dev.txt` with `ruff` and `detect-secrets`.
- [x] **Configuration**: Create `ruff.toml` in project root.
- [x] **Baseline**: Run formatter and linter on existing code.
    - `ruff format python/`
    - `ruff check python/ --fix`
- [x] **Verification**: Ensure no critical errors remain in `python/core` or `python/ipc_server.py`.

### 2.2 TypeScript/JS Tooling (ESLint & Prettier)
- [x] **Install Dependencies**: `pnpm add -D eslint prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin`.
- [x] **Configuration**:
    - Create `eslint.config.mjs` with strict TypeScript rules.
    - Create `.prettierrc` for consistent formatting.
- [x] **Scripts**: Add `lint` and `format` scripts to `package.json`.
- [x] **Baseline**: Run formatter and linter on existing code.
    - `pnpm run format`
    - `pnpm run lint`

### 2.3 Security (detect-secrets)
- [x] **Install**: Ensure `detect-secrets` is installed (via pip/requirements).
- [x] **Baseline**: Scan codebase and generate baseline file.
    - `detect-secrets scan --baseline .secrets.baseline`
- [x] **Audit**: Review `.secrets.baseline` to ensure no actual secrets are committed (mark false positives).
- [x] **Ignore**: Commit `.secrets.baseline` to git (Standard Practice).

### 2.4 Enforcement (Husky)
- [x] **Install**: `pnpm add -D husky lint-staged`
- [x] **Initialize**: `pnpm dlx husky-init` (creates `.husky/` dir)
- [x] **Configure Hooks**: Edit `.husky/pre-commit` to run lint-staged and security checks.
- [x] **Configure Staged Run**: Update `package.json` with `lint-staged` config.
- [x] **Test**: Attempt a commit to verify hooks run.

## 3. Configuration Details

### 3.1 Python: `ruff.toml`
```toml
[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W", "C90", "UP"]
ignore = ["E501"]

[tool.ruff.lint.per-file-ignores]
"__init__.py" = ["F401"]
```

### 3.2 TypeScript: `.eslintrc.json`
```json
{
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "./tsconfig.json"
  },
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/explicit-function-return-type": "off"
  }
}
```

### 3.3 TypeScript: `.prettierrc`
```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "printWidth": 100,
  "trailingComma": "es5"
}
```

### 3.4 Package.json Updates
**Dev Dependencies:**
```json
"devDependencies": {
  "eslint": "^8.x",
  "prettier": "^3.x",
  "@typescript-eslint/parser": "^6.x",
  "@typescript-eslint/eslint-plugin": "^6.x",
  "husky": "^9.x",
  "lint-staged": "^15.x"
}
```

**Scripts:**
```json
"scripts": {
  "lint": "eslint src/ --fix",
  "format": "prettier --write \"src/**/*.{ts,html,css}\""
}
```

**Lint Staged:**
```json
"lint-staged": {
  "*.{ts,js,json}": [
    "prettier --write",
    "eslint --fix"
  ],
  "*.py": [
    "ruff format",
    "ruff check --fix"
  ]
}
```

### 3.5 Husky Hook: `.husky/pre-commit`
```sh
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npx lint-staged
python -m ruff check python/
detect-secrets-hook --baseline .secrets.baseline
```

## 4. Execution Plan (Step-by-Step)

### Step 1: Python Setup
```powershell
# Create python/requirements-dev.txt
echo "ruff" > python/requirements-dev.txt
echo "detect-secrets" >> python/requirements-dev.txt
pip install -r python/requirements-dev.txt
# Create ruff.toml
python -m ruff format python/
python -m ruff check python/ --fix
```

### Step 2: TypeScript Setup
```powershell
pnpm add -D eslint prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin
# Create .eslintrc.json and .prettierrc
# Update package.json scripts
pnpm run format
pnpm run lint
```

### Step 3: Security Setup
```powershell
detect-secrets scan --baseline .secrets.baseline
# Audit .secrets.baseline content
```

### Step 4: Enforcement Setup

## 5. Detailed Implementation Checklist

This checklist tracks the granular progress of the quality gatekeeper implementation.

### Phase 1: Python Quality Gates (Ruff)
- [x] **Infrastructure**: Create `python/requirements-dev.txt` with `ruff` and `detect-secrets`.
- [x] **Installation**: Run `pip install -r python/requirements-dev.txt`.
- [x] **Configuration**: Create `ruff.toml` in the project root with the defined rules.
- [x] **Baseline Format**: Run `python -m ruff format python/`.
- [x] **Baseline Lint**: Run `python -m ruff check python/ --fix`.
- [x] **Verification**: Confirm `python/core/recorder.py` and `python/ipc_server.py` are lint-free.

### Phase 2: TypeScript/JS Quality Gates (ESLint & Prettier)
- [x] **Infrastructure**: Install dev dependencies: `pnpm add -D eslint prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin`.
- [x] **Config (ESLint)**: Create `eslint.config.mjs` with strict TypeScript rules.
- [x] **Config (Prettier)**: Create `.prettierrc` with project standards.
- [x] **Scripts**: Add `lint` and `format` scripts to `package.json`.
- [x] **Baseline Format**: Run `pnpm run format`.
- [x] **Baseline Lint**: Run `pnpm run lint`.
- [x] **Verification**: Ensure no critical ESLint errors remain in `src/`.

### Phase 3: Enforcement (Husky & lint-staged)
- [x] **Infrastructure**: Install `husky` and `lint-staged`.
- [x] **Init**: Run `pnpm dlx husky-init`.
- [x] **Config (lint-staged)**: Update `package.json` with the `lint-staged` configuration.
- [x] **Hook**: Update `.husky/pre-commit` to run `lint-staged`, `ruff`, and `detect-secrets`.
- [x] **Verification**: Perform a dummy commit to verify all gates trigger correctly.

### Phase 4: Project Standards & Security
- [x] **Metadata**: Create `LICENSE` (MIT) in the project root.
- [x] **Ownership**: Create `CODEOWNERS` file.
- [x] **Efficiency**: Create `.editorconfig` for cross-editor consistency.
- [x] **Templates**: Create `.env.example`.
- [x] **Security Baseline**: Run `detect-secrets scan --baseline .secrets.baseline`.
- [x] **Security Audit**: Review and audit `.secrets.baseline` for false positives.

### Phase 5: Documentation & Finalization
- [x] **Project Entry**: Update `README.md` to mention the new quality standards.
- [x] **Guidelines**: Create `CONTRIBUTING.md` referencing SPEC_014.
- [x] **History**: Initialize `CHANGELOG.md`.
- [x] **Final Pass**: Run `npm test` and verify all quality gates pass on the entire codebase.
