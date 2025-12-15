# MIGRATION.md

## Project Overview

Alexo is a local dashboard app for Raspberry Pi Zero (3.5" 480x320 display), built with React, Vite, and React95. This document details the incremental migration from a frontend-only app to a local full-stack dashboard with a Node.js backend, routing, and real-time updates.

## Goals & Constraints
- **No SSR, Next.js, NestJS, databases, or cloud services**
- **No UI redesign**; preserve React95 look
- **No heavy dependencies, animations, or large bundles**
- **Strict 480x320 layout, no scrolling**
- **Backend: Node.js v14, Express, ws, single process, in-memory state**
- **Frontend: Vite + React, no dev server on Pi, pre-built assets only**

## Migration Steps

### 1. Project Structure Refactor
- Move all frontend code to `/frontend`.
- Create `/backend` with:
  - `src/`
  - `server.js`, `ws.js`, `state.js`, `package.json`
- Update configs/scripts for new paths.

### 2. Minimal Node.js Backend
- Express.js HTTP API:
  - `GET /api/state` — returns in-memory state
  - `POST /api/nfc` — updates state, broadcasts via WebSocket
- WebSocket endpoint at `/ws` (using `ws`)
- Global in-memory state object

### 3. Frontend Routing
- Add `react-router-dom`.
- Routes:
  - `/` — 24h clock, updates every minute
  - `/forecast` — weather dashboard (current implementation)
  - `/calendar` — static mock events for 7 days from today
  - `/message` — ephemeral messages (future step)
- Navigation: keyboard shortcuts and/or simple buttons, no animations

### 4. Mock Calendar Data
- `/calendar` route displays static events for 7 days (starting today)
- 24h time format
- Example event format:
  - `2025-12-15 09:00  Meeting with team`
  - `2025-12-16 14:30  Doctor appointment`

### 5. Keyboard Navigation
- Keyboard shortcuts for route navigation (arrows or number keys)
- Navigation works in kiosk/dev mode

### 6. Dev Scripts
- Separate scripts for frontend and backend dev servers
- Combined dev script (using `concurrently` or similar)

## Further Notes
- `/calendar` mock data is static, not randomized
- `/message` route reserved for future NFC-driven messages
- Google Calendar integration planned for `/calendar`
- All UI/UX fits 480x320, React95, no scrolling/animations

---

_Last updated: 2025-12-15_
