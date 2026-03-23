/**
 * Integration tests for the full assessment flow.
 *
 * Uses an inline tree whose condition values match the MockLLMAdapter's
 * keyword extraction, giving deterministic end-to-end coverage:
 *
 *   Mock maps: "squatting" -> squatting_bodyweight, "kneecap" -> patella,
 *   "inner knee" -> anteromedial_tibial_plateau, "running" -> running_level,
 *   "cycling" -> cycling (not in tree -> no_coverage)
 *
 *   Tree branches: squatting_bodyweight|running_level -> patella|anteromedial_tibial_plateau -> assessment
 */
import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import {
  createSession,
  processMessage,
  processFeedback,
  resetState,
} from '../src/engine/state-machine.js';
import { MockLLMAdapter } from '../src/engine/llm-adapter.js';
import type { AssessmentTree } from '../src/types/decision-tree.js';

const llm = new MockLLMAdapter();

// Inline tree aligned with MockLLMAdapter keyword outputs
const tree: AssessmentTree = {
  id: 'integration_test',
  version: '1.0.0',
  title: 'Integration Test Tree',
  entry_node_id: 'q_activity',
  nodes: {
    q_activity: {
      id: 'q_activity',
      type: 'question',
      prompt: 'Which activity causes pain?',
      answer_type: 'choice',
      save_to: 'triggering_activity',
      next: [
        { condition: { type: 'equals', key: 'triggering_activity', value: 'squatting_bodyweight' }, next_node_id: 'q_location_squat' },
        { condition: { type: 'equals', key: 'triggering_activity', value: 'running_level' }, next_node_id: 'q_location_run' },
      ],
    },
    q_location_squat: {
      id: 'q_location_squat',
      type: 'question',
      prompt: 'Where on the knee?',
      answer_type: 'choice',
      save_to: 'symptom_location',
      next: [
        { condition: { type: 'equals', key: 'symptom_location', value: 'patella' }, next_node_id: 'dx_squat_anterior' },
        { condition: { type: 'equals', key: 'symptom_location', value: 'anteromedial_tibial_plateau' }, next_node_id: 'dx_squat_medial' },
      ],
    },
    q_location_run: {
      id: 'q_location_run',
      type: 'question',
      prompt: 'Where on the knee?',
      answer_type: 'choice',
      save_to: 'symptom_location',
      next: [
        { condition: { type: 'equals', key: 'symptom_location', value: 'patella' }, next_node_id: 'dx_run_anterior' },
        { condition: { type: 'equals', key: 'symptom_location', value: 'anteromedial_tibial_plateau' }, next_node_id: 'dx_run_medial' },
      ],
    },
    dx_squat_anterior: {
      id: 'dx_squat_anterior',
      type: 'assessment',
      summary: 'Anterior squat pain',
      explanation: 'Patellofemoral overload during squatting',
      region_id: 'patella',
      recommendations: [
        { id: 'mod_1', title: 'Box squat to parallel', type: 'movement_mod', description: 'Limit depth with a box' },
        { id: 'mod_2', title: 'Heel-elevated squat', type: 'movement_mod', description: 'Place heels on a wedge' },
        { id: 'mod_3', title: 'Tempo eccentric squat', type: 'movement_mod', description: '3-second lowering phase' },
      ],
    },
    dx_squat_medial: {
      id: 'dx_squat_medial',
      type: 'assessment',
      summary: 'Medial squat pain',
      explanation: 'Valgus stress during squatting',
      region_id: 'anteromedial_tibial_plateau',
      recommendations: [
        { id: 'mod_4', title: 'Band-resisted squat', type: 'movement_mod', description: 'Mini-band above knees' },
        { id: 'mod_5', title: 'Narrow stance squat', type: 'movement_mod', description: 'Hip-width stance' },
      ],
    },
    dx_run_anterior: {
      id: 'dx_run_anterior',
      type: 'assessment',
      summary: 'Anterior running pain',
      explanation: 'Runners knee',
      region_id: 'patella',
      recommendations: [
        { id: 'mod_6', title: 'Cadence increase', type: 'movement_mod', description: 'Increase steps per minute by 5-10%' },
      ],
    },
    dx_run_medial: {
      id: 'dx_run_medial',
      type: 'assessment',
      summary: 'Medial running pain',
      explanation: 'Pes anserine irritation',
      region_id: 'anteromedial_tibial_plateau',
      recommendations: [
        { id: 'mod_7', title: 'Shorten stride', type: 'movement_mod', description: 'Reduce stride length' },
        { id: 'mod_8', title: 'Midfoot strike cue', type: 'movement_mod', description: 'Land under your center of mass' },
      ],
    },
  },
};

describe('Integration: full assessment flows', () => {
  beforeEach(() => {
    resetState();
  });

  // ---------------------------------------------------------------------------
  // Flow 1: Initial message -> clarification -> recommendation
  // ---------------------------------------------------------------------------
  describe('Flow 1: message -> clarification -> recommendation', () => {
    it('gathers entities across two messages then recommends', async () => {
      const state = createSession('test');

      // Message 1: provides activity but no location
      const r1 = await processMessage(state, 'Pain when squatting', tree, llm, []);
      assert.equal(r1.state.status, 'gathering');
      assert.equal(r1.state.entities.triggering_activity, 'squatting_bodyweight');
      assert.equal(r1.state.entities.symptom_location, null);
      assert.ok(r1.reply.includes('where exactly the pain is'), 'clarification should mention missing entity in friendly language');
      assert.equal(r1.modification, undefined);

      // Message 2: provides location
      const r2 = await processMessage(r1.state, 'On my kneecap', tree, llm, []);
      assert.equal(r2.state.status, 'recommending');
      assert.equal(r2.state.entities.triggering_activity, 'squatting_bodyweight');
      assert.equal(r2.state.entities.symptom_location, 'patella');
      assert.ok(r2.modification);
      assert.equal(r2.modification.id, 'mod_1');
      assert.equal(r2.modification.title, 'Box squat to parallel');
      assert.equal(r2.state.servedModifications, 1);
      assert.deepEqual(r2.state.currentNodePath, ['q_activity', 'q_location_squat', 'dx_squat_anterior']);
    });

    it('reaches recommendation in a single message when all entities present', async () => {
      const state = createSession('test');

      const result = await processMessage(
        state,
        'My left knee has sharp pain on the kneecap when squatting',
        tree,
        llm,
        [],
      );
      assert.equal(result.state.status, 'recommending');
      assert.equal(result.state.entities.symptom_side, 'left');
      assert.equal(result.state.entities.triggering_activity, 'squatting_bodyweight');
      assert.equal(result.state.entities.symptom_location, 'patella');
      assert.equal(result.state.entities.symptom_description, 'sharp');
      assert.ok(result.modification);
      assert.equal(result.modification.id, 'mod_1');
    });

    it('works with running + inner knee path', async () => {
      const state = createSession('test');

      const r1 = await processMessage(state, 'Pain when running on the inner knee', tree, llm, []);
      assert.equal(r1.state.status, 'recommending');
      assert.equal(r1.state.entities.triggering_activity, 'running_level');
      assert.equal(r1.state.entities.symptom_location, 'anteromedial_tibial_plateau');
      assert.ok(r1.modification);
      assert.equal(r1.modification.id, 'mod_7');
      assert.equal(r1.modification.title, 'Shorten stride');
    });

    it('preserves side and description through multi-message gathering', async () => {
      const state = createSession('test');

      const r1 = await processMessage(state, 'Sharp pain in my right knee', tree, llm, []);
      assert.equal(r1.state.status, 'gathering');
      assert.equal(r1.state.entities.symptom_side, 'right');
      assert.equal(r1.state.entities.symptom_description, 'sharp');

      const r2 = await processMessage(r1.state, 'When squatting', tree, llm, []);
      assert.equal(r2.state.status, 'gathering');
      assert.equal(r2.state.entities.symptom_side, 'right');
      assert.equal(r2.state.entities.symptom_description, 'sharp');
      assert.equal(r2.state.entities.triggering_activity, 'squatting_bodyweight');

      const r3 = await processMessage(r2.state, 'On my kneecap', tree, llm, []);
      assert.equal(r3.state.status, 'recommending');
      assert.equal(r3.state.entities.symptom_side, 'right');
      assert.equal(r3.state.entities.symptom_description, 'sharp');
      assert.equal(r3.state.entities.triggering_activity, 'squatting_bodyweight');
      assert.equal(r3.state.entities.symptom_location, 'patella');
      assert.ok(r3.modification);
    });
  });

  // ---------------------------------------------------------------------------
  // Flow 2: Low feedback -> next modification
  // ---------------------------------------------------------------------------
  describe('Flow 2: low feedback serves next modification', () => {
    it('serves modifications in order on low ratings', async () => {
      const state = createSession('test');

      // Get to recommending (squatting + kneecap -> 3 mods)
      const r1 = await processMessage(state, 'Kneecap pain when squatting', tree, llm, []);
      assert.equal(r1.state.status, 'recommending');
      assert.equal(r1.modification!.id, 'mod_1');
      assert.equal(r1.state.servedModifications, 1);
      assert.equal(r1.state.modifications.length, 3);

      // Low rating -> second modification
      const r2 = await processFeedback(r1.state, 2, llm, []);
      assert.equal(r2.state.status, 'recommending');
      assert.ok(r2.modification);
      assert.equal(r2.modification.id, 'mod_2');
      assert.equal(r2.modification.title, 'Heel-elevated squat');
      assert.equal(r2.state.servedModifications, 2);
      assert.equal(r2.state.consecutiveLowRatings, 1);

      // Low rating -> third modification
      const r3 = await processFeedback(r2.state, 1, llm, []);
      assert.equal(r3.state.status, 'recommending');
      assert.ok(r3.modification);
      assert.equal(r3.modification.id, 'mod_3');
      assert.equal(r3.modification.title, 'Tempo eccentric squat');
      assert.equal(r3.state.servedModifications, 3);
      assert.equal(r3.state.consecutiveLowRatings, 2);
    });

    it('closes when all modifications exhausted with low ratings', async () => {
      const state = createSession('test');

      // Get to recommending (running + kneecap -> 1 mod only)
      const r1 = await processMessage(state, 'Kneecap pain when running', tree, llm, []);
      assert.equal(r1.state.status, 'recommending');
      assert.equal(r1.modification!.id, 'mod_6');
      assert.equal(r1.state.modifications.length, 1);

      // Low rating -> no more mods -> closed
      const r2 = await processFeedback(r1.state, 2, llm, []);
      assert.equal(r2.state.status, 'closed');
      assert.equal(r2.modification, undefined);
      assert.ok(r2.reply.includes('physical therapist') || r2.reply.includes('shared all'));
    });

    it('tracks all ratings in modificationRatings array', async () => {
      const state = createSession('test');

      const r1 = await processMessage(state, 'Kneecap pain when squatting', tree, llm, []);
      const r2 = await processFeedback(r1.state, 2, llm, []);
      const r3 = await processFeedback(r2.state, 3, llm, []);

      assert.deepEqual(r3.state.modificationRatings, [2, 3]);
    });
  });

  // ---------------------------------------------------------------------------
  // Flow 3: High feedback -> wrap-up
  // ---------------------------------------------------------------------------
  describe('Flow 3: high feedback closes session', () => {
    it('rating 5 immediately closes session', async () => {
      const state = createSession('test');

      const r1 = await processMessage(state, 'Kneecap pain when squatting', tree, llm, []);
      assert.equal(r1.state.status, 'recommending');

      const r2 = await processFeedback(r1.state, 5, llm, []);
      assert.equal(r2.state.status, 'closed');
      assert.equal(r2.state.consecutiveLowRatings, 0);
      assert.deepEqual(r2.state.modificationRatings, [5]);
      assert.ok(r2.reply.includes('glad') || r2.reply.includes('helpful'));
    });

    it('rating 4 closes session', async () => {
      const state = createSession('test');

      const r1 = await processMessage(state, 'Inner knee pain when running', tree, llm, []);
      assert.equal(r1.state.status, 'recommending');

      const r2 = await processFeedback(r1.state, 4, llm, []);
      assert.equal(r2.state.status, 'closed');
    });

    it('high rating after low ratings still closes and resets counter', async () => {
      const state = createSession('test');

      const r1 = await processMessage(state, 'Kneecap pain when squatting', tree, llm, []);
      const r2 = await processFeedback(r1.state, 2, llm, []);
      assert.equal(r2.state.consecutiveLowRatings, 1);

      const r3 = await processFeedback(r2.state, 5, llm, []);
      assert.equal(r3.state.status, 'closed');
      assert.equal(r3.state.consecutiveLowRatings, 0);
      assert.deepEqual(r3.state.modificationRatings, [2, 5]);
    });
  });

  // ---------------------------------------------------------------------------
  // Flow 4: 3-strike escalation
  // ---------------------------------------------------------------------------
  describe('Flow 4: 3-strike escalation', () => {
    it('escalates after 3 consecutive low ratings', async () => {
      const state = createSession('test');

      // Get to recommending with 3 mods
      const r1 = await processMessage(state, 'Kneecap pain when squatting', tree, llm, []);
      assert.equal(r1.state.status, 'recommending');
      assert.equal(r1.state.modifications.length, 3);

      // Strike 1
      const r2 = await processFeedback(r1.state, 2, llm, []);
      assert.equal(r2.state.status, 'recommending');
      assert.equal(r2.state.consecutiveLowRatings, 1);
      assert.equal(r2.modification!.id, 'mod_2');

      // Strike 2
      const r3 = await processFeedback(r2.state, 1, llm, []);
      assert.equal(r3.state.status, 'recommending');
      assert.equal(r3.state.consecutiveLowRatings, 2);
      assert.equal(r3.modification!.id, 'mod_3');

      // Strike 3 -> escalated
      const r4 = await processFeedback(r3.state, 3, llm, []);
      assert.equal(r4.state.status, 'escalated');
      assert.equal(r4.state.consecutiveLowRatings, 3);
      assert.deepEqual(r4.state.modificationRatings, [2, 1, 3]);
      assert.ok(r4.reply.includes('specialist') || r4.reply.includes('personalized'));
      assert.equal(r4.modification, undefined);
    });

    it('does not escalate if a high rating breaks the streak', async () => {
      const state = createSession('test');

      const r1 = await processMessage(state, 'Kneecap pain when squatting', tree, llm, []);

      // Low, low, then high -> resets
      const r2 = await processFeedback(r1.state, 2, llm, []);
      assert.equal(r2.state.consecutiveLowRatings, 1);

      const r3 = await processFeedback(r2.state, 1, llm, []);
      assert.equal(r3.state.consecutiveLowRatings, 2);

      // High rating -> closed, no escalation
      const r4 = await processFeedback(r3.state, 4, llm, []);
      assert.equal(r4.state.status, 'closed');
      assert.equal(r4.state.consecutiveLowRatings, 0);
    });

    it('escalates at exactly 3 (ratings 3, 3, 3)', async () => {
      const state = createSession('test');

      const r1 = await processMessage(state, 'Kneecap pain when squatting', tree, llm, []);

      const r2 = await processFeedback(r1.state, 3, llm, []);
      const r3 = await processFeedback(r2.state, 3, llm, []);
      const r4 = await processFeedback(r3.state, 3, llm, []);

      assert.equal(r4.state.status, 'escalated');
      assert.equal(r4.state.consecutiveLowRatings, 3);
    });
  });

  // ---------------------------------------------------------------------------
  // No-coverage flow
  // ---------------------------------------------------------------------------
  describe('No-coverage: uncovered activity suggests alternatives', () => {
    it('returns no_coverage with suggestion when activity not in tree', async () => {
      const state = createSession('test');

      const result = await processMessage(
        state,
        'Pain on the inner knee when cycling',
        tree,
        llm,
        [],
      );

      assert.equal(result.state.status, 'no_coverage');
      assert.equal(result.state.entities.triggering_activity, 'cycling');
      assert.ok(result.reply.includes('cycling'));
      // Should mention at least one covered activity
      assert.ok(
        result.reply.includes('squatting_bodyweight') || result.reply.includes('running_level'),
        'reply should suggest covered activities',
      );
    });

    it('recovers from no_coverage when user switches to covered activity', async () => {
      const state = createSession('test');

      // First: uncovered
      const r1 = await processMessage(state, 'Pain on the kneecap when cycling', tree, llm, []);
      assert.equal(r1.state.status, 'no_coverage');

      // User switches to squatting — location (patella) is preserved from merge
      const r2 = await processMessage(r1.state, 'What about squatting?', tree, llm, []);
      assert.equal(r2.state.entities.triggering_activity, 'squatting_bodyweight');
      assert.equal(r2.state.entities.symptom_location, 'patella');
      assert.equal(r2.state.status, 'recommending');
      assert.ok(r2.modification);
      assert.equal(r2.modification.id, 'mod_1');
    });
  });

  // ---------------------------------------------------------------------------
  // Full end-to-end: message -> recommend -> low -> low -> high
  // ---------------------------------------------------------------------------
  describe('End-to-end: complete user journey', () => {
    it('gather -> recommend -> low -> next -> high -> closed', async () => {
      const state = createSession('test');

      // Step 1: partial info -> clarification
      const r1 = await processMessage(state, 'Pain when squatting', tree, llm, []);
      assert.equal(r1.state.status, 'gathering');

      // Step 2: provide location -> recommendation
      const r2 = await processMessage(r1.state, 'On my kneecap', tree, llm, []);
      assert.equal(r2.state.status, 'recommending');
      assert.equal(r2.modification!.title, 'Box squat to parallel');

      // Step 3: not helpful -> next mod
      const r3 = await processFeedback(r2.state, 2, llm, []);
      assert.equal(r3.state.status, 'recommending');
      assert.equal(r3.modification!.title, 'Heel-elevated squat');

      // Step 4: still not great -> next mod
      const r4 = await processFeedback(r3.state, 3, llm, []);
      assert.equal(r4.state.status, 'recommending');
      assert.equal(r4.modification!.title, 'Tempo eccentric squat');

      // Step 5: this one works!
      const r5 = await processFeedback(r4.state, 5, llm, []);
      assert.equal(r5.state.status, 'closed');
      assert.deepEqual(r5.state.modificationRatings, [2, 3, 5]);
      assert.equal(r5.state.consecutiveLowRatings, 0);
    });

    it('gather -> recommend -> escalation after 3 strikes', async () => {
      const state = createSession('test');

      // All entities in one message
      const r1 = await processMessage(state, 'Kneecap pain when squatting', tree, llm, []);
      assert.equal(r1.state.status, 'recommending');

      // 3 low ratings in a row
      const r2 = await processFeedback(r1.state, 1, llm, []);
      const r3 = await processFeedback(r2.state, 2, llm, []);
      const r4 = await processFeedback(r3.state, 1, llm, []);

      assert.equal(r4.state.status, 'escalated');
      assert.deepEqual(r4.state.modificationRatings, [1, 2, 1]);
    });
  });
});
