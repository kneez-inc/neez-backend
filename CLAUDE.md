# neez Backend - Claude Code Instructions

## Overview

Assessment engine for the neez app. Express/Node.js API with decision tree and LLM entity extraction. **This repo handles assessment ONLY.** Auth, user data, sessions, and messages are handled by the frontend talking to Supabase directly.

## Hard Architectural Constraints (NON-NEGOTIABLE)

1. Movement modifications MUST come from the decision tree JSON exclusively. The LLM must NEVER generate, invent, or improvise recommendations. If the tree has no path for the given entities, call `suggestAlternatives()` — never fabricate a recommendation.
2. The LLM is ONLY for: entity extraction (including normalization into controlled vocabulary), clarification language, conversational wrapper text, and suggesting alternative activities when the tree has no coverage. No diagnosis, no recommendation selection, no clinical reasoning.
3. Traversal MUST be deterministic. Same entities = same results. Always. No randomness, no probabilistic branching.

## LLM Strategy

- **Primary LLM**: Gemini (`gemini-2.0-flash` via `@google/generative-ai` SDK)
- Code MUST be **LLM-agnostic** via the `LLMAdapter` interface in `src/engine/llm-adapter.ts`
- Factory: `createLLMAdapter(provider, apiKey)`. Provider set via `LLM_PROVIDER` env var.
- **NO synonym map.** The LLM normalizes during extraction. The system prompt includes the full controlled vocabulary from `src/types/controlled-vocabulary.ts`.
- When adding a new LLM provider, implement the `LLMAdapter` interface and add it to the factory. No other code should need to change.

## No-Coverage Handling

When the decision tree has no path for the user's extracted entities:

1. `traverseTree()` returns `null`
2. State machine sets status to `'no_coverage'`
3. State machine calls `suggestAlternatives()` on the LLM adapter
4. `suggestAlternatives()` receives the extracted entities AND the list of activities the tree covers (from `getAvailableActivities()`)
5. The LLM generates a friendly message suggesting related activities
6. If the user responds with a covered activity, the flow re-extracts and traverses normally

## Scope of This Repo

**Included:**

- `POST /assess` — the assessment pipeline (entity extraction → tree traversal → recommendation)
- `GET /tree/validate` — decision tree validation utility
- Auth middleware — JWT validation only (confirms the user is authenticated)

**NOT included (handled by frontend + Supabase):**

- Auth routes (signup, signin, password reset)
- User CRUD
- Session management
- Message storage

## Git Branching

- All work happens on the `develop` branch. Never commit directly to main.
- Push to develop. Create a pull request from develop to main for review before merging.
- Commit messages follow conventional format: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`

## TypeScript Policy

- Strict mode. Zod for all runtime validation.
- When iterating fast on a new feature, `as any` with a `// TODO: type this properly` comment is acceptable. Fix before merging to main.
- No untyped `any` without a TODO comment.

## Windows Development

- Use `cross-env` for environment variables in npm scripts
- Use `path.join()` for file paths
- No bash-specific syntax in npm scripts
- Test that all scripts work in PowerShell

## Naming Convention

- "neez" (all lowercase) throughout code, comments, docs
- "Neez" only at start of sentence
- "Kneez" only in legal/incorporation contexts

## API Response Format

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": { "code": "ERROR_CODE", "message": "Human-readable message" } }
```

## File Structure

```
neez-backend/
  src/
    config.ts              # Zod-validated env config
    server.ts              # Express app setup
    index.ts               # Entry point
    logger.ts              # Winston structured logging
    routes/
      assess.ts            # POST /assess
      tree.ts              # GET /tree/validate
    engine/
      traversal.ts         # Decision tree traversal (deterministic)
      llm-adapter.ts       # LLM-agnostic interface + Gemini implementation
      state-machine.ts     # Conversation state management
    middleware/
      auth.ts              # Supabase JWT validation via auth.getUser()
      rate-limit.ts        # 30 req/min per-user rate limiter
    db/
      client.ts            # Supabase client init (singleton)
      users.ts             # neez_users CRUD
      sessions.ts          # neez_chat_sessions CRUD
      messages.ts          # neez_chat_messages CRUD
    types/
      entities.ts          # Extracted entity types + Zod schemas
      messages.ts          # Conversation message types
      api.ts               # Request/response types
      decision-tree.ts     # Tree structure types + Zod schema
      database.ts          # Supabase table types + Zod schemas + AppError
      controlled-vocabulary.ts  # Valid entity values (single source of truth)
    decision-tree/
      sample-tree.json     # Dev/test tree (Jabari provides production tree)
  tests/
  supabase/
    migrations/            # SQL migration files (run manually in Supabase dashboard)
  Dockerfile               # Multi-stage Node 20 Alpine build
  docker-compose.yml       # Local dev container
```

## Key paths

- `src/index.ts` — entry point
- `src/server.ts` — Express app setup
- `src/config.ts` — Zod-validated env config
- `src/routes/assess.ts` — POST /assess (primary endpoint)
- `src/routes/tree.ts` — GET /tree/validate
- `src/engine/traversal.ts` — deterministic tree traversal
- `src/engine/state-machine.ts` — session lifecycle + tree loading
- `src/engine/llm-adapter.ts` — LLM interface (Gemini implementation)
- `src/middleware/auth.ts` — Supabase JWT validation via auth.getUser()
- `src/middleware/rate-limit.ts` — 30 req/min per-user rate limiter
- `src/db/client.ts` — Supabase client singleton
- `src/db/users.ts`, `sessions.ts`, `messages.ts` — typed CRUD with AppError wrapping
- `src/types/database.ts` — Supabase table types + Zod schemas
- `src/decision-tree/` — tree JSON files

## Commands

- `npm run dev` — start dev server with ts-node
- `npm run build` — compile TypeScript
- `npm start` — run compiled output
- `npm test` — lint + run tests

## Schema Source of Truth

- Supabase table types are generated from the live schema
- Frontend: run `npx supabase gen types typescript --project-id wiqvfnbfmhtzdpfwasyd > src/types/supabase.ts` to regenerate
- Never hand-write Supabase column names — always reference src/types/supabase.ts
- Backend session IDs come from Supabase — the in-memory Map is a cache only

## Agent Usage

- Make extensive use of agents (subagents) for research, exploration, search, and multi-step tasks.
- Prefer delegating to agents over doing work inline to keep the main context window small and reduce token usage.
- Run multiple agents in parallel when tasks are independent.
- Use the Explore agent for codebase search and discovery. Use general-purpose agents for complex multi-step work.

## Key Technical Decisions

- **LLM**: gemini-2.0-flash (entity extraction + normalization, no diagnosis)
- **Logging**: Winston structured JSON — every decision step logged
- **Decision tree**: Production tree from Jabari. Use sample-tree.json for dev.
- **Controlled vocabulary**: Single source of truth in `controlled-vocabulary.ts` — feeds both the LLM system prompt and Zod validation schemas
