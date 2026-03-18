# neez Backend

Assessment engine for the neez app. Express/Node.js API with a deterministic decision tree and LLM entity extraction. This repo handles assessment only — auth, user data, sessions, and messages are managed by the frontend talking to Supabase directly.

## Prerequisites

- Node.js 20+
- npm

## Setup

```bash
npm install
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_ANON_KEY, and GEMINI_API_KEY
```

## Development

```bash
npm run dev
```

Server starts on `http://localhost:3000`. Health check at `GET /health`.

## Testing

```bash
npm test
```

Runs type check, compiles test sources, and executes all tests with the Node.js built-in test runner.

## Build

```bash
npm run build
npm start
```

## Docker

```bash
docker compose up --build
```

Or build the image directly:

```bash
docker build -t neez-backend .
docker run -p 3000:3000 --env-file .env neez-backend
```

## Supabase Migrations

Run the SQL files in `supabase/migrations/` in order in the Supabase Dashboard SQL Editor:

1. `001_create_tables.sql` — Creates `neez_users`, `neez_chat_sessions`, `neez_chat_messages`
2. `002_rls_policies.sql` — Row Level Security policies
3. `003_auth_trigger.sql` — Auto-creates `neez_users` row on signup

## Environment Variables

See `.env.example` for all variables. Required for production:

| Variable | Description |
|---|---|
| `PORT` | Server port (default: 3000) |
| `NODE_ENV` | `development`, `production`, or `test` |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |
| `GEMINI_API_KEY` | Google Gemini API key |
| `LLM_PROVIDER` | `gemini`, `anthropic`, or `openai` (default: gemini) |
| `LOG_LEVEL` | `error`, `warn`, `info`, or `debug` (default: info) |

## API Endpoints

- `POST /assess` — Assessment pipeline (auth required)
- `GET /tree/validate` — Decision tree validation utility
- `GET /health` — Health check
