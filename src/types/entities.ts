import { z } from 'zod';
import {
  VALID_SIDES,
  VALID_ACTIVITIES,
  VALID_LOCATIONS,
  VALID_DESCRIPTIONS,
} from './controlled-vocabulary.js';

// --- Extracted entity enums (derived from controlled vocabulary) ---

export const SymptomSideSchema = z.enum(VALID_SIDES);

export const TriggeringActivitySchema = z.enum(VALID_ACTIVITIES);

export const SymptomLocationSchema = z.enum(VALID_LOCATIONS);

export const SymptomDescriptionSchema = z.enum(VALID_DESCRIPTIONS);

export const ExtractedEntitiesSchema = z.object({
  symptom_side: SymptomSideSchema.nullable(),
  triggering_activity: TriggeringActivitySchema.nullable(),
  symptom_location: SymptomLocationSchema.nullable(),
  symptom_description: SymptomDescriptionSchema.nullable(),
});

export type SymptomSide = z.infer<typeof SymptomSideSchema>;
export type TriggeringActivity = z.infer<typeof TriggeringActivitySchema>;
export type SymptomLocation = z.infer<typeof SymptomLocationSchema>;
export type SymptomDescription = z.infer<typeof SymptomDescriptionSchema>;
export type ExtractedEntities = z.infer<typeof ExtractedEntitiesSchema>;

// --- Session state ---

export const HistoryEntrySchema = z.object({
  node_id: z.string(),
  value: z.unknown(),
  timestamp: z.string().datetime(),
});

export const SessionStateSchema = z.object({
  sessionId: z.string().uuid(),
  treeId: z.string(),
  treeVersion: z.string(),
  currentNodeId: z.string(),
  answers: z.record(z.string(), z.unknown()),
  entities: ExtractedEntitiesSchema,
  history: z.array(HistoryEntrySchema),
  startedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;
export type SessionState = z.infer<typeof SessionStateSchema>;
