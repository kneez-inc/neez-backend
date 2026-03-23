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
  // Yoga
  'yoga_hero',
  'yoga_warrior',
  'yoga_eagle',
  'yoga_triangle',
  'yoga_revolved_chair',
  'yoga_pigeon',
  // Catch-all
  'other',
] as const;

/**
 * Activity groups for disambiguation.
 *
 * When the user says something ambiguous like "squat", the system
 * presents these options as tappable buttons in the chat UI.
 * Each group maps a general term to specific activities with user-friendly labels.
 */
export const ACTIVITY_GROUPS: Record<string, { value: string; label: string }[]> = {
  squat: [
    { value: 'squatting_bodyweight', label: 'Bodyweight squat' },
    { value: 'squatting_barbell', label: 'Barbell / back squat' },
  ],
  lunge: [
    { value: 'forward_lunge', label: 'Forward lunge' },
    { value: 'backward_lunge', label: 'Backward / reverse lunge' },
    { value: 'side_lunge', label: 'Side / lateral lunge' },
    { value: 'split_squats', label: 'Split squat' },
  ],
  run: [
    { value: 'running_level', label: 'Running on flat ground' },
    { value: 'running_uphill', label: 'Running uphill' },
    { value: 'running_downhill', label: 'Running downhill' },
    { value: 'running_uneven', label: 'Trail / uneven ground' },
  ],
  walk: [
    { value: 'walking_level', label: 'Walking / hiking on flat ground' },
    { value: 'walking_uphill', label: 'Hiking uphill' },
    { value: 'walking_downhill', label: 'Hiking downhill' },
  ],
  kneel: [
    { value: 'half_kneeling', label: 'Half kneeling (one knee)' },
    { value: 'tall_kneeling', label: 'Tall kneeling (both knees)' },
    { value: 'full_kneeling', label: 'Full kneeling (sitting on heels)' },
  ],
  deadlift: [
    { value: 'deadlifts', label: 'Conventional deadlift' },
    { value: 'rdl', label: 'Romanian deadlift (RDL)' },
  ],
  yoga: [
    { value: 'yoga_hero', label: 'Hero pose' },
    { value: 'yoga_warrior', label: 'Warrior pose' },
    { value: 'yoga_eagle', label: 'Eagle pose' },
    { value: 'yoga_triangle', label: 'Triangle pose' },
    { value: 'yoga_revolved_chair', label: 'Revolved chair pose' },
    { value: 'yoga_pigeon', label: 'Pigeon pose' },
  ],
  stair: [
    { value: 'stairs_up', label: 'Going upstairs' },
    { value: 'stairs_down', label: 'Going downstairs' },
  ],
};

/**
 * Human-friendly labels for anatomical location values.
 * Used when presenting pain location options as buttons in the chat UI.
 */
export const LOCATION_LABELS: Record<string, string> = {
  anteromedial_femoral_condyle: 'Inner / front of knee',
  anterolateral_femoral_condyle: 'Outer / front of knee',
  posteromedial_femoral_condyle: 'Inner / back of knee',
  posterolateral_femoral_condyle: 'Outer / back of knee',
  patella: 'Kneecap / front center',
  patellar_tendon: 'Below the kneecap',
  supra_patellofemoral_joint: 'Above the kneecap',
  superomedial_patellofemoral_joint: 'Upper inner kneecap',
  inferolateral_patellofemoral_joint: 'Lower outer kneecap',
  inferomedial_patellofemoral_joint: 'Lower inner kneecap',
  superolateral_patellofemoral_joint: 'Upper outer kneecap',
  suprapatellar_pouch: 'Above the kneecap (deep)',
  anteromedial_tibial_plateau: 'Inner shin near knee',
  posteromedial_tibial_plateau: 'Inner back near knee',
  anterolateral_tibial_plateau: 'Outer shin near knee',
  posterolateral_tibial_plateau: 'Outer back near knee',
};

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
