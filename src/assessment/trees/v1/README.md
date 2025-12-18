# Kneez assessment tree (v1)

- **Entry node**: `q_knee_region` (hydrated from `knee_regions.json`)
- **Goal**: Start with precise region mapping, run a simple movement test, and land on an initial assessment plus recommendations.
- **Why `knee_regions.json` is separate**: it holds the 16-region map used across trees. The tree file references it via the `source` property on `q_knee_region` so we can reuse the same domain model without copying the large option list.

## Flow summary
1. Ask for the primary knee region (cards + free text supported in the knee region map).
2. Route to a relevant movement test (squat for anterior/patellar regions, bridge for posterior regions, otherwise duration).
3. Check symptom duration and severity to decide irritability level.
4. Land on an assessment node with summary, explanation, region id, and targeted recommendations.

## Adding or editing branches
- Update `assessment_tree.json` for logic changes.
- Keep `knee_regions.json` unchanged; if a new version of the region map is needed, add a new file and point the `source` field to it.
- Run `npm run lint` to type-check once TypeScript dependencies are installed locally.
