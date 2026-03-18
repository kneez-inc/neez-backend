/**
 * Controlled vocabulary — single source of truth for all valid entity values.
 *
 * Used by:
 * 1. Zod schemas in entities.ts (runtime validation of LLM responses)
 * 2. LLM system prompt in llm-adapter.ts (so the LLM knows exactly which values to normalize into)
 *
 * When Jabari adds a new activity, location, side, or description,
 * update this file and both the LLM prompt and validation update automatically.
 */

export const VALID_SIDES = ['left', 'right', 'both'] as const;

export const VALID_ACTIVITIES = [
  'running',
  'squatting',
  'lunging',
  'stairs_up',
  'stairs_down',
  'jumping',
  'cycling',
  'walking',
  'sitting',
  'kneeling',
  'pivoting',
  'other',
] as const;

export const VALID_LOCATIONS = [
  'superomedial_patellofemoral_joint',
  'inferomedial_patellofemoral_joint',
  'supra_patellofemoral_joint',
  'superolateral_patellofemoral_joint',
  'inferolateral_patellofemoral_joint',
  'suprapatellar_pouch',
  'anteromedial_tibial_plateau',
  'posteromedial_tibial_plateau',
  'anterolateral_tibial_plateau',
  'posterolateral_tibial_plateau',
  'anteromedial_femoral_condyle',
  'posteromedial_femoral_condyle',
  'anterolateral_femoral_condyle',
  'posterolateral_femoral_condyle',
  'patellar_tendon',
  'patella',
] as const;

export const VALID_DESCRIPTIONS = [
  'sharp',
  'dull',
  'aching',
  'burning',
  'throbbing',
  'stabbing',
  'tingling',
  'stiffness',
  'tightness',
  'pressure',
  'clicking',
  'popping',
  'grinding',
  'locking',
  'giving_way',
  'swelling',
] as const;
