# Contributing to dIKtate

Thank you for your interest in improving dIKtate! This project adheres to strict code quality standards to ensure stability, privacy, and performance.

## 🛠️ Development Setup

1.  **Install Node.js & pnpm**: Ensure you have Node 20+ and pnpm installed.
2.  **Install Python**: Python 3.11 is required.
3.  **Install Dependencies**:
    ```bash
    pnpm install
    pip install -r python/requirements-dev.txt
    ```

## 🛡️ Quality Gatekeepers

We use automated tooling to enforce code quality. These checks run automatically via **Husky** pre-commit hooks.

### 🐍 Python (Backend)
*   **Tool**: [Ruff](https://docs.astral.sh/ruff/)
*   **Standards**: PEP 8, sorted imports, complexity checks (C90), and modern syntax (py311).
*   **Commands**:
    ```bash
    ruff format python/    # Auto-format code
    ruff check python/     # Check for lint errors
    ```

### 📘 TypeScript/Electron (Frontend)
*   **Tools**: [ESLint](https://eslint.org/) (v9 Flat Config) & [Prettier](https://prettier.io/)
*   **Standards**: Strict TypeScript, consistent formatting, no legacy `require()`.
*   **Commands**:
    ```bash
    pnpm run format      # Prettier format
    pnpm run lint        # ESLint check
    ```

### 🔒 Security
*   **Tool**: `detect-secrets`
*   **Policy**: No hardcoded secrets (API keys, tokens) allowed in the codebase.
*   **Baseline**: If you introduce a false positive, update the baseline:
    ```bash
    detect-secrets scan --baseline .secrets.baseline
    ```

## 📦 Commit Standards

*   All commits must pass the pre-commit hooks.
*   Use conventional commit messages (e.g., `feat:`, `fix:`, `chore:`).
