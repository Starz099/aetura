# Aetura

AI-assisted workflow mapping, recording, and editing for product demos.

## What It Is

Aetura is a desktop-first app that helps you turn a URL and intent into a demo flow.
It combines:

- A Python engine that explores pages and drafts step-by-step actions
- A Tauri shell for desktop integration and local video workflows
- A React editor for preview, timeline edits, and export settings

## Features

- Generate demo scripts from a starting URL and user intent
- Resume and extend approved scripts without starting over
- Replay approved steps and record video output locally
- Tune recording quality with FPS, viewport size, and output preset
- Browse recorded demos in a local library
- Open recordings in an editor with timeline controls and zoom effects
- Export edited demos with selectable format, resolution, and frame rate
- Configure Grok API keys and default export directory in app settings

## Project Structure

- `engine/` FastAPI backend, automation workflows, browser + AI orchestration
- `frontend/` React + Vite UI for mapping, recordings, editor, and settings
- `src-tauri/` Rust/Tauri desktop host and native integrations

## Run Locally

### Install

```bash
pnpm install
```

### Start Engine

```bash
cd engine
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
./venv/bin/uvicorn main:app --reload
```

### Start Desktop App

From project root in a separate terminal:

```bash
pnpm run dev:ui
```

### Start Both Together

From project root:

```bash
pnpm run dev
```

## Tests

Run all configured tests from project root:

```bash
pnpm test
```

## API Summary

- `POST /explore` draft a new script
- `POST /explore/resume` continue from approved steps
- `POST /record` record a demo video from approved steps
- `GET /library` list local recordings
