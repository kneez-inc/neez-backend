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
  // Lunges
  'split_squats',
  'forward_lunge',
  'backward_lunge',
  'side_lunge',
  // Squats
  'squatting_bodyweight',
  'squatting_barbell',
  // Running
  'running_level',
  'running_uneven',
  'running_uphill',
  'running_downhill',
  // Walking / hiking
  'walking_level',
  'walking_uphill',
  'walking_downhill',
  // Stairs
  'stairs_up',
  'stairs_down',
  // Kneeling
  'half_kneeling',
  'tall_kneeling',
  'full_kneeling',
  // Gym / weighted
  'deadlifts',
  'rdl',
  'rowing_machine',
  // Functional
  'jumping',
  'cycling',
  'pivoting',
  'bending_down',
  'sitting_down',
  'standing_up',
  'twisting_loaded',
  // Prolonged positions
  'prolonged_sitting',
  'prolonged_standing',
  // Catch-all
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
