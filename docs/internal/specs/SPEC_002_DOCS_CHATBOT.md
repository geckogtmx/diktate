# Specification: dIKtate Neural Help (Offline RAG)

> **Status:** DRAFT v0.3
> **Feature:** Offline Documentation Chatbot + Web Support Bot
> **Target Version:** v0.4.0 (App) / Web Launch

---

## 1. Overview

Integrating an intelligent "Chat with Docs" feature into **both**:
1.  **The dIKtate App:** 100% Offline, Local RAG.
2.  **The Website (`sitex`):** Online Support Bot (Cloud API).

### Core Philosophy
- **Unified Knowledge:** Both bots answer from the exact same source documents.
- **Environment-Aware:** 
    - App = Zero Privacy Compromise (Local Ollama).
    - Web = Broad Accessibility (Cloud API).

---

## 2. Technical Architecture

### A. The Stack (Dual Path)

| Feature | **Local App (Offline)** | **Web Site (Online)** |
| :--- | :--- | :--- |
| **LLM** | `gemma3:4b` (via Local Ollama) | **Gemini Flash 1.5** (via Google AI Studio API) |
| **Embeddings** | `nomic-embed-text` (Local) | `text-embedding-004` (Google API) |
| **Vector Store** | **SQLite** (Local file) | **Pinecone** / **Supabase** (Cloud) |
| **Orchestrator** | Python Backend | Vercel Edge Functions |

### B. Shared Data Flow

1.  **Source of Truth:** The repository (`docs/*.md`, `sitex/*.html`).
2.  **Build Step:**
    - **Path A (Local):** App scans files on startup, updates local SQLite.
    - **Path B (Web):** GitHub Action triggers on push -> Embeds docs via API -> Updates Cloud Vector DB.

---

## 3. Implementation Details (Local)

### 3.1. Database Schema (SQLite)

```sql
CREATE TABLE IF NOT EXISTS knowledge_base (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    chunk_index INTEGER,
    content TEXT NOT NULL,
    embedding BLOB NOT NULL, -- Serialized numpy array
    file_hash TEXT NOT NULL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3.2. Context Windows & RAG
- **Projected User Docs:** Installation, Troubleshooting, User Guide (~20k tokens).
- **Projected Dev Docs:** specs, architecture, IPC patterns (~20k tokens).
- **Total Estimated Size:** ~40,000+ tokens.
- **Verdict:** **RAG is Mandatory.**
    - **Chunk Size:** 1024 characters (~256 tokens).
    - **Retrieval:** Top 3-5 chunks.

### 3.3. New IPC Channels
- `help:query(text)` -> Returns stream of markdown.
- `help:reindex()` -> Force manual rebuild.

---

## 4. User Experience

### App Interface
- **Help Tab:** Clean chat interface in Settings.
- **Quick Ask:** "Ask about this error" button on error toasts.

### Web Interface
- **Support Widget:** Floating bubble on `dikta.me`.
- **Docs Assistant:** Embedded "Ask AI" bar in the Documentation portal.

---

## 5. Development Phases

### Phase 1: The Engine (Python)
1.  Implement strict RAG pipeline in Python.
2.  Setup SQLite + Numpy vector math.
3.  Verify specialized System Prompt for "Help Desk" persona.

### Phase 2: Web Sync (CI/CD)
1.  Create `scripts/sync_docs_to_cloud.py`.
2.  Setup GitHub Action to run this on `push to main`.
3.  **Note:** Requires Google AI Studio API Key in GitHub Secrets.

---

## 6. Dependencies
- **App:** `beautifulsoup4`, `numpy`.
- **Web:** Vercel SDK, Pinecone/Supabase client.

