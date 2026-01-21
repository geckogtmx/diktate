# Developer Quick Start

## Prerequisites
- **Python 3.11+**
- **Node.js 18+**
- **PNPM** (`npm install -g pnpm`)
- **Ollama** installed and running.

## Setup

1.  **Clone the repository**
    ```bash
    git clone https://github.com/your-repo/diktate.git
    cd diktate
    ```

2.  **Install Frontend Dependencies**
    ```bash
    pnpm install
    ```

3.  **Setup Python Backend**
    ```bash
    cd src
    python -m venv venv
    .\venv\Scripts\Activate
    pip install -r requirements.txt
    ```

4.  **Run Development Build**
    Return to the root directory and run:
    ```bash
    pnpm run dev
    ```

    This will start the Electron app and the Python backend automatically.
