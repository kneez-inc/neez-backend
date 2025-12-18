# File, function, and block descriptions

This document explains the purpose of each file introduced in the Kneez assessment backend and clarifies what every exported function or major JSON block does.

## Root configuration

### `package.json`
- Declares the `neez-backend` package metadata and sets the project to ESM via `"type": "module"`.
- Scripts:
  - `build`: transpiles TypeScript from `src` to `dist` via `tsc`.
  - `start`: runs the compiled server output from `dist/server.js`.
  - `dev`: runs the TypeScript server directly with `ts-node/esm` for local development.
  - `lint`: type-checks the codebase without emitting output.
  - `test`: placeholder script emitting a message because no automated tests exist yet.

### `tsconfig.json`
- Targets modern Node with ES2020 modules/resolution, compiles from `src` to `dist`.
- Enables strict type-checking, JSON module resolution, and common safety flags while skipping lib checks and excluding `dist`/`node_modules`.

## Assessment domain and engine

### `src/assessment/types.ts`
- Defines the assessment domain types used throughout the backend:
  - `Condition`/`BranchRule` express branching logic (`always`, `equals`, `in`, `range`).
  - `Recommendation` describes actionable advice with optional `video_id`.
  - `BaseNode` plus specialized `QuestionNode`, `MovementTestNode`, and `AssessmentNode` capture the different node kinds in a tree.
  - `AssessmentTree` wraps metadata and a `nodes` map; `AssessmentNodeMap` is its index type.
  - `AnswerPayload` and `SessionState` describe the shape of incoming answers and persisted session progress/history.

### `src/assessment/engine/applyAnswer.ts`
- `applyAnswer(tree, state, answer)`:
  - Looks up the answered node, skips processing if the node is missing or already an assessment leaf.
  - Derives the appropriate storage key (`save_to` for questions or `metric_key` for movement tests).
  - Merges the answer into `state.answers` under that key, appends a timestamped history entry, and updates `updatedAt` while leaving other session fields intact.

### `src/assessment/engine/evaluateNode.ts`
- `evaluateCondition(condition, answers)`: evaluates the branching condition against the accumulated `answers`, supporting equality, membership, numeric ranges, and unconditional (`always`) matches.
- `pickNextNodeId(rules, answers)`: walks the array of branch rules in order and returns the first `next_node_id` whose condition passes, or `null` when no rule matches.

### `src/assessment/engine/getNextNode.ts`
- `getNextNodeId(tree, state, currentNodeId)`: retrieves the current node, returns `null` for missing/assessment nodes, otherwise delegates to `pickNextNodeId` to decide the next node based on stored answers.

### `src/assessment/index.ts`
- Utility hub for working with assessment trees and sessions:
  - `parseJsonFile(filePath)`: reads and parses JSON, stripping optional markdown code fences to support checked-in fenced JSON assets.
  - `hydrateNodeWithSource(node, baseDir)`: if a node declares a `source` path, loads that external JSON (e.g., the shared knee-region question) and merges it with any overrides on the referencing node, keeping local `next` rules when defined.
  - `loadAssessmentTree(version)`: loads a tree JSON by version, hydrates any sourced nodes, validates the entry node exists, and returns the assembled `AssessmentTree`.
  - `loadKneeRegionQuestion()`: convenience loader for the shared `knee_regions.json` question definition.
  - `createSession(tree)`: creates a fresh `SessionState` seeded with metadata, a generated `sessionId`, empty answers/history, and timestamps.
  - `progressSession(tree, session, answer)`: applies an answer to session state, determines the next node id, advances `currentNodeId` when possible, and returns both the updated session and the resolved next node (or `null` at the end of the flow).
  - `getNode(tree, nodeId)`: helper to fetch a node by id from the tree map.

## JSON schemas

### `src/assessment/schemas/assessmentTree.schema.json`
- JSON Schema describing valid assessment tree documents:
  - Requires tree metadata (`id`, `version`, `title`, `entry_node_id`) and a `nodes` object.
  - Defines condition shapes, branch rules, recommendation structure, and the three node types (question, movement_test, assessment), including required properties for each.

### `src/assessment/schemas/sessionState.schema.json`
- JSON Schema specifying persisted session state shape with required identifiers, answer map, history entries (with timestamps), and lifecycle timestamps (`startedAt`, `updatedAt`).

## Assessment tree assets

### `src/assessment/trees/v1/assessment_tree.json`
- Version 1 Kneez assessment flow:
  - Entry `q_knee_region` question is sourced from `knee_regions.json` to reuse the 16-region map; branches to squat or bridge tests based on region groupings, otherwise continues to duration.
  - Movement tests (`test_squat`, `test_hamstring_bridge`) capture symptom changes and route toward assessments or further questioning.
  - Symptom questions for duration and pain severity (`q_symptom_duration`, `q_pain_severity`) grade irritability before selecting a leaf.
  - Assessment leaves (`dx_*`) provide summaries, explanations, target `region_id`, optional confidence, and tailored recommendations for patellofemoral, patellar tendon, posterior chain, chronic overload, and irritability-graded overload presentations.

### `src/assessment/trees/v1/knee_regions.json`
- Shared question definition (stored with markdown fences) for localizing knee pain across 16 anatomical regions, including UI hints, descriptive synonyms, and structured options used by both tree versions.

### `src/assessment/trees/v1/README.md`
- Describes the v1 flow goals, entry node, separation of reusable knee-region data, and guidance for editing branches while keeping the region map stable.

### `src/assessment/trees/v2/assessment_tree.json`
- Version 2 beta flow:
  - Also starts with `q_knee_region` (sourced from v1 map) and routes patellar regions to a heel-elevated squat test, posterior regions to a bridge test, or directly to duration questions.
  - Movement/decision nodes (`test_decline_squat`, `test_hamstring_bridge`, `q_symptom_duration`) assess response to loading and chronicity.
  - Assessment leaves cover patellofemoral vs patellar tendon sensitivity, posterior chain symptoms, chronic overload, and general overload with concise recommendations suited for the beta iteration.

## HTTP routing and server

### `src/routes/assessment.ts`
- In-memory HTTP route handlers for assessment-related endpoints:
  - Caches loaded trees and stores sessions in maps for quick access.
  - `handleAssessmentRequest` interprets incoming requests:
    - `OPTIONS` preflight responds with permissive CORS headers.
    - `GET /assessment/knee-regions`: returns the shared knee-region question definition.
    - `GET /assessment/tree?version=`: returns a fully hydrated assessment tree, defaulting to v1.
    - `POST /assessment/start`: creates a new session for the requested tree version and returns the entry node.
    - `POST /assessment/next`: validates the session and answer, applies the answer, progresses the session, persists it, and responds with updated answers, the next node, and a completion flag when an assessment node is reached.
  - `sendJson`, `parseBody`, and `notFound` provide shared response and parsing utilities with basic error handling.

### `src/server.ts`
- Minimal Node HTTP server that delegates requests:
  - Serves `/health` for simple uptime checks.
  - For `/assessment` paths, forwards to `handleAssessmentRequest`.
  - Returns 404 JSON responses for unknown routes and logs the listening port at startup.
