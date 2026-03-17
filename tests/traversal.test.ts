import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { traverseTree, getAvailableActivities } from '../src/engine/traversal.js';
import { loadTree, resetState } from '../src/engine/state-machine.js';
import type { AssessmentTree } from '../src/types/decision-tree.js';
import type { ExtractedEntities } from '../src/types/entities.js';

const nullEntities: ExtractedEntities = {
  symptom_side: null,
  triggering_activity: null,
  symptom_location: null,
  symptom_description: null,
};

describe('traverseTree', () => {
  let sampleTree: AssessmentTree;

  beforeEach(() => {
    resetState();
    sampleTree = loadTree('sample-tree');
  });

  it('happy path: squatting + anterior reaches dx_squat_anterior', () => {
    const entities: ExtractedEntities = {
      ...nullEntities,
      triggering_activity: 'squatting',
      symptom_location: 'patella', // mapped to "anterior" via tree conditions
    };

    // The sample tree uses "anterior" as the option value, so we need to match that
    // Let's use the raw value the tree expects
    const entitiesRaw: ExtractedEntities = {
      ...nullEntities,
      triggering_activity: 'squatting',
    };

    // First traverse with just activity to see what happens — the tree expects
    // "symptom_location" as save_to, matching condition values "anterior", "medial", "lateral"
    // We need to provide the value the tree conditions check for
    const result = traverseTree(sampleTree, {
      ...nullEntities,
      triggering_activity: 'squatting',
      symptom_location: 'anterior' as ExtractedEntities['symptom_location'],
    });

    assert.ok(result !== null, 'Should find a path');
    assert.ok(result.path.includes('q_activity'));
    assert.ok(result.path.includes('q_location_squat'));
    assert.ok(result.path.includes('dx_squat_anterior'));
    assert.ok(result.modifications.length >= 2);
  });

  it('happy path: running + medial reaches dx_running_medial', () => {
    const result = traverseTree(sampleTree, {
      ...nullEntities,
      triggering_activity: 'running',
      symptom_location: 'medial' as ExtractedEntities['symptom_location'],
    });

    assert.ok(result !== null);
    assert.deepEqual(result.path, ['q_activity', 'q_location_running', 'dx_running_medial']);
    assert.ok(result.modifications.length >= 2);
  });

  it('happy path: stairs_descending + lateral reaches dx_stairs_lateral', () => {
    const result = traverseTree(sampleTree, {
      ...nullEntities,
      triggering_activity: 'stairs_descending' as ExtractedEntities['triggering_activity'],
      symptom_location: 'lateral' as ExtractedEntities['symptom_location'],
    });

    assert.ok(result !== null);
    assert.deepEqual(result.path, ['q_activity', 'q_location_stairs', 'dx_stairs_lateral']);
  });

  it('returns null when triggering activity has no branch (no default child)', () => {
    const result = traverseTree(sampleTree, {
      ...nullEntities,
      triggering_activity: 'cycling',
      symptom_location: 'anterior' as ExtractedEntities['symptom_location'],
    });

    assert.equal(result, null);
  });

  it('returns null when entity is missing (null triggering_activity)', () => {
    const result = traverseTree(sampleTree, {
      ...nullEntities,
      symptom_location: 'anterior' as ExtractedEntities['symptom_location'],
    });

    assert.equal(result, null);
  });

  it('returns null when all entities are null', () => {
    const result = traverseTree(sampleTree, { ...nullEntities });
    assert.equal(result, null);
  });

  it('determinism: 100 identical runs produce identical results', () => {
    const entities: ExtractedEntities = {
      ...nullEntities,
      triggering_activity: 'squatting',
      symptom_location: 'anterior' as ExtractedEntities['symptom_location'],
    };

    const first = traverseTree(sampleTree, entities);
    assert.ok(first !== null);

    for (let i = 0; i < 100; i++) {
      const result = traverseTree(sampleTree, entities);
      assert.ok(result !== null, `Run ${i} returned null`);
      assert.deepEqual(result.path, first.path, `Run ${i} path differs`);
      assert.deepEqual(
        result.modifications.map((m) => m.id),
        first.modifications.map((m) => m.id),
        `Run ${i} modifications differ`,
      );
    }
  });

  it('circular reference detection returns null', () => {
    const circularTree: AssessmentTree = {
      id: 'circular_test',
      version: '1.0.0',
      title: 'Circular Test',
      entry_node_id: 'node_a',
      nodes: {
        node_a: {
          id: 'node_a',
          type: 'question',
          prompt: 'Test?',
          answer_type: 'choice',
          save_to: 'test_key',
          next: [{ condition: { type: 'always' }, next_node_id: 'node_b' }],
        },
        node_b: {
          id: 'node_b',
          type: 'question',
          prompt: 'Test 2?',
          answer_type: 'choice',
          save_to: 'test_key_2',
          next: [{ condition: { type: 'always' }, next_node_id: 'node_a' }],
        },
      },
    };

    const result = traverseTree(circularTree, { ...nullEntities });
    assert.equal(result, null);
  });

  it('missing node reference returns null', () => {
    const brokenTree: AssessmentTree = {
      id: 'broken_test',
      version: '1.0.0',
      title: 'Broken Test',
      entry_node_id: 'start',
      nodes: {
        start: {
          id: 'start',
          type: 'question',
          prompt: 'Test?',
          answer_type: 'choice',
          save_to: 'val',
          next: [{ condition: { type: 'always' }, next_node_id: 'does_not_exist' }],
        },
      },
    };

    const result = traverseTree(brokenTree, { ...nullEntities });
    assert.equal(result, null);
  });

  it('default child (always condition) is followed when no specific match', () => {
    const treeWithDefault: AssessmentTree = {
      id: 'default_test',
      version: '1.0.0',
      title: 'Default Test',
      entry_node_id: 'q1',
      nodes: {
        q1: {
          id: 'q1',
          type: 'question',
          prompt: 'Activity?',
          answer_type: 'choice',
          save_to: 'triggering_activity',
          next: [
            { condition: { type: 'equals', key: 'triggering_activity', value: 'running' }, next_node_id: 'dx_specific' },
            { condition: { type: 'always' }, next_node_id: 'dx_default' },
          ],
        },
        dx_specific: {
          id: 'dx_specific',
          type: 'assessment',
          summary: 'Specific',
          explanation: 'Specific path',
          region_id: 'patella',
          recommendations: [{ id: 'r1', title: 'Specific rec', type: 'movement_mod', description: 'Specific' }],
        },
        dx_default: {
          id: 'dx_default',
          type: 'assessment',
          summary: 'Default',
          explanation: 'Default path',
          region_id: 'patella',
          recommendations: [{ id: 'r2', title: 'Default rec', type: 'education', description: 'Default' }],
        },
      },
    };

    // Specific match
    const specific = traverseTree(treeWithDefault, { ...nullEntities, triggering_activity: 'running' });
    assert.ok(specific !== null);
    assert.deepEqual(specific.path, ['q1', 'dx_specific']);

    // Default fallback
    const fallback = traverseTree(treeWithDefault, { ...nullEntities, triggering_activity: 'cycling' });
    assert.ok(fallback !== null);
    assert.deepEqual(fallback.path, ['q1', 'dx_default']);
  });

  it('returns recommendations from the assessment node', () => {
    const result = traverseTree(sampleTree, {
      ...nullEntities,
      triggering_activity: 'squatting',
      symptom_location: 'anterior' as ExtractedEntities['symptom_location'],
    });

    assert.ok(result !== null);
    assert.ok(result.modifications.length === 3);
    assert.ok(result.modifications.every((m) => typeof m.id === 'string'));
    assert.ok(result.modifications.every((m) => typeof m.title === 'string'));
    assert.ok(result.modifications.every((m) => typeof m.description === 'string'));
    assert.ok(result.modifications.every((m) =>
      ['movement_mod', 'exercise', 'education', 'referral', 'other'].includes(m.type),
    ));
  });
});

describe('getAvailableActivities', () => {
  let sampleTree: AssessmentTree;

  beforeEach(() => {
    resetState();
    sampleTree = loadTree('sample-tree');
  });

  it('returns activities from the sample tree', () => {
    const activities = getAvailableActivities(sampleTree);
    assert.ok(activities.includes('squatting'));
    assert.ok(activities.includes('stairs_descending'));
    assert.ok(activities.includes('running'));
  });

  it('returns a sorted array', () => {
    const activities = getAvailableActivities(sampleTree);
    const sorted = [...activities].sort();
    assert.deepEqual(activities, sorted);
  });

  it('does not include activities not in the tree', () => {
    const activities = getAvailableActivities(sampleTree);
    assert.ok(!activities.includes('cycling'));
    assert.ok(!activities.includes('swimming'));
  });

  it('returns empty for a tree with no activity branches', () => {
    const noActivityTree: AssessmentTree = {
      id: 'no_activity',
      version: '1.0.0',
      title: 'No Activity',
      entry_node_id: 'dx',
      nodes: {
        dx: {
          id: 'dx',
          type: 'assessment',
          summary: 'Done',
          explanation: 'Done',
          region_id: 'patella',
          recommendations: [],
        },
      },
    };
    const activities = getAvailableActivities(noActivityTree);
    assert.deepEqual(activities, []);
  });
});
