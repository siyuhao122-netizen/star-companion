# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

星伴 (Star Companion) — an ASD (autism spectrum disorder) screening and early-intervention platform for children aged 2-6. Parents register, add children, complete screening questionnaires (M-CHAT-R, CAST), play therapeutic mini-games (name reaction, pointing, voice), and receive AI-generated analysis reports.

## Backend

**Stack**: Python Flask 3.0 + SQLAlchemy + MySQL (star_companion database)

### Run the backend

```bash
pip install -r backend/requirements.txt
python backend/app.py    # Flask dev server on port 5000
```

### Architecture

**App factory** in `backend/app.py` — `create_app()` initializes Flask, SQLAlchemy, Bcrypt, CORS, and registers blueprints. Tables are auto-created via `db.create_all()` on first request.

**Blueprint routing** (all under `/api/`):

| Blueprint | Prefix | Purpose |
|-----------|--------|---------|
| `auth_bp` | `/api/auth` | User registration, login, email verification (QQ SMTP) |
| `child_bp` | `/api/child` | Child profile CRUD, active child switching |
| `games_bp` | `/api/games` | Submit game results + get recommendations for homepage |
| `survey_bp` | `/api/survey` | Retrieve questionnaire items (M-CHAT-R 20 items, CAST 37 items) and submit raw results |
| `treehole_bp` | `/api/treehole` | Anonymous support-message board with AI auto-reply |
| `ai_bp` | `/api/ai` | AI-powered survey analysis, scale recommendation by child age |
| `point_game_ai_bp` | `/api/point-game-ai` | Per-session and trend AI analysis for pointing game |
| `name_reaction_ai_bp` | `/api/name-reaction-ai` | Per-session and trend AI analysis for name-reaction game |
| `voice_game_ai_bp` | `/api/voice-game-ai` | Per-session and trend AI analysis for voice game |
| `voice_speech_bp` | `/api/voice` | Speech recognition (Aliyun ASR), audio processing (webm→WAV→PCM) |

**AI integration**: Three model endpoints are configured in `config.py`:
- **BAILIAN (qwen-turbo)**: survey analysis, treehole replies, name-reaction AI, voice-game AI
- **POINT_GAME_AI (qwen3-8b fine-tuned)**: pointing game single-session + trend analysis
- **Aliyun ASR**: voice-game speech recognition

The `AITokenUsage` model tracks all AI consumption by child and record type.

**Database**: 10 models defined in `backend/models.py` — User, EmailVerification, Child, NameReactionRecord, PointGameRecord, VoiceGameRecord, SurveyResult, TreeholeMessage, DailyRecommendation, AITokenUsage. Refer to `database/star_companion.sql` for the DDL schema.

### Notable patterns

- Games `routes/games.py` handles data submission only; AI analysis for the same games lives in separate `*_ai.py` routes. The games route auto-triggers AI on name-reaction submission.
- All AI analysis results are cached on the record (`ai_analysis` column) — subsequent requests return cached results without re-calling the model.
- The voice game receives webm audio via multipart form upload, converts to WAV (16kHz mono) via pydub, strips silence, then sends PCM to Aliyun ASR. Falls back to volume-based detection if ASR fails.

## Frontend

**Stack**: Vanilla HTML + CSS + JS, no framework or bundler. Served via Live Server (VS Code extension) on port 5501.

- `index.html` — splash screen, entry point
- `pages/sign-inANDsign-up.html` — combined login/register
- `pages/peopleHome.html` — main dashboard (child list, game entries)
- `pages/touchGame.html` (pointing), `pages/askName.html` (name reaction), `pages/voice.html` (voice) — the three games
- `pages/survey-select.html`, `pages/askQuestions.html` — questionnaire flow
- `pages/dataLook.html`, `pages/dataAnalys.html` — data dashboard and analysis views
- `pages/seniorHole.html` — treehole community
- `pages/mainPart.html`, `pages/forgetPassword.html` — navigation hub, password reset

Each HTML page has a corresponding `js/*.js` and `css/*.css` with matching filename.

**Frontend ↔ Backend**: JS files make `fetch()` calls to `http://localhost:5000/api/*`. User ID and child ID are passed in request bodies (not JWT/sessions).

## CORS

Configured in `config.py` for ports 5500 and 8000, plus wildcard fallback.

## NPM dependency

`lightweight-expression-detector` (used for facial expression detection in the name-reaction game, loaded via CDN in practice — check `js/askName.js` for actual usage).
