import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MockLLMAdapter, createLLMAdapter } from '../src/engine/llm-adapter.js';
import type { ExtractedEntities } from '../src/types/entities.js';

const mock = new MockLLMAdapter();

describe('MockLLMAdapter', () => {
  describe('extractEntities', () => {
    it('extracts activity, side, location, and description', async () => {
      const { entities } = await mock.extractEntities(
        'My left knee has a sharp pain on the kneecap when squatting',
        [],
      );

      assert.equal(entities.symptom_side, 'left');
      assert.equal(entities.triggering_activity, 'squatting');
      assert.equal(entities.symptom_location, 'patella');
      assert.equal(entities.symptom_description, 'sharp');
    });

    it('returns null for fields not mentioned', async () => {
      const { entities } = await mock.extractEntities('my knee hurts', []);

      assert.equal(entities.symptom_side, null);
      assert.equal(entities.triggering_activity, null);
      assert.equal(entities.symptom_location, null);
      assert.equal(entities.symptom_description, null);
    });

    it('normalizes "going downstairs" to stairs_down', async () => {
      const { entities } = await mock.extractEntities(
        'I get pain going downstairs',
        [],
      );
      assert.equal(entities.triggering_activity, 'stairs_down');
    });

    it('normalizes "jogging" to running', async () => {
      const { entities } = await mock.extractEntities(
        'Pain when jogging on the inner knee',
        [],
      );
      assert.equal(entities.triggering_activity, 'running');
      assert.equal(entities.symptom_location, 'anteromedial_tibial_plateau');
    });

    it('normalizes "biking" to cycling', async () => {
      const { entities } = await mock.extractEntities('Hurts when biking', []);
      assert.equal(entities.triggering_activity, 'cycling');
    });

    it('normalizes description synonyms', async () => {
      const { entities: e1 } = await mock.extractEntities('My knee is swollen', []);
      assert.equal(e1.symptom_description, 'swelling');

      const { entities: e2 } = await mock.extractEntities('It feels tight', []);
      assert.equal(e2.symptom_description, 'tightness');

      const { entities: e3 } = await mock.extractEntities('My knee gives way sometimes', []);
      assert.equal(e3.symptom_description, 'giving_way');
    });

    it('normalizes "both" and "bilateral" to both', async () => {
      const { entities: e1 } = await mock.extractEntities('Both knees hurt', []);
      assert.equal(e1.symptom_side, 'both');

      const { entities: e2 } = await mock.extractEntities('Bilateral knee pain', []);
      assert.equal(e2.symptom_side, 'both');
    });

    it('returns zero token usage', async () => {
      const { tokensUsed } = await mock.extractEntities('test', []);
      assert.equal(tokensUsed.prompt, 0);
      assert.equal(tokensUsed.completion, 0);
    });
  });

  describe('suggestAlternatives', () => {
    it('generates a message with available activities', async () => {
      const entities: ExtractedEntities = {
        symptom_side: 'left',
        triggering_activity: 'cycling',
        symptom_location: null,
        symptom_description: null,
      };

      const { text } = await mock.suggestAlternatives(entities, [
        'squatting',
        'running',
        'stairs_down',
      ]);

      assert.ok(text.includes('cycling'));
      assert.ok(text.includes('squatting'));
      assert.ok(text.includes('running'));
      assert.ok(text.includes('stairs_down'));
    });

    it('handles null triggering activity gracefully', async () => {
      const entities: ExtractedEntities = {
        symptom_side: null,
        triggering_activity: null,
        symptom_location: null,
        symptom_description: null,
      };

      const { text } = await mock.suggestAlternatives(entities, ['squatting']);
      assert.ok(text.includes('that activity'));
      assert.ok(text.includes('squatting'));
    });
  });

  describe('generateClarification', () => {
    it('asks about missing entities', async () => {
      const { text } = await mock.generateClarification(
        ['symptom_location', 'triggering_activity'],
        [],
      );
      assert.ok(text.includes('symptom_location'));
      assert.ok(text.includes('triggering_activity'));
    });
  });

  describe('generateWrapper', () => {
    it('wraps a recommendation in friendly text', async () => {
      const { text } = await mock.generateWrapper(
        { title: 'Limit squat depth', description: 'Use a box to reduce range.' },
        [],
      );
      assert.ok(text.includes('Limit squat depth'));
      assert.ok(text.includes('Use a box'));
    });
  });
});

describe('createLLMAdapter factory', () => {
  it('throws for anthropic (not yet implemented)', () => {
    assert.throws(
      () => createLLMAdapter('anthropic', 'fake-key'),
      /not yet implemented/,
    );
  });

  it('throws for openai (not yet implemented)', () => {
    assert.throws(
      () => createLLMAdapter('openai', 'fake-key'),
      /not yet implemented/,
    );
  });
});
