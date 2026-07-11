export const AGE_BANDS = [
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19',
  '20',
  'other',
] as const;

export type AgeBand = (typeof AGE_BANDS)[number];

export const GENDERS = [
  'FEMALE',
  'MALE',
  'NON_BINARY',
  'PREFER_NOT_TO_SAY',
] as const;

export type Gender = (typeof GENDERS)[number];

export const INTERESTED_SKILLS = [
  'Coding & Programming',
  'Robotics & STEM',
  'Mathematics',
  'Science',
  'Art & Design',
  'Music',
  'Languages',
  'Business & Entrepreneurship',
  'Public Speaking',
  'Creative Writing',
  'Physical Education',
  'Social Studies',
] as const;

/** Rwandan primary & secondary class levels */
export const CLASS_LEVELS = [
  'P1',
  'P2',
  'P3',
  'P4',
  'P5',
  'P6',
  'S1',
  'S2',
  'S3',
  'S4',
  'S5',
  'S6',
  'TVET',
  'UNIVERSITY',
  'OTHER',
] as const;

export type ClassLevel = (typeof CLASS_LEVELS)[number];

/** A-Level combinations (Rwandan upper secondary S4–S6) */
export const A_LEVEL_COMBINATIONS = [
  'PCM',
  'PCB',
  'MCB',
  'MPC',
  'MPG',
  'MCE',
  'BCM',
  'BCG',
  'HGL',
  'HGE',
  'LEG',
  'MEG',
  'HEG',
  'LFK',
  'HHL',
  'Other',
] as const;

export type ALevelCombination = (typeof A_LEVEL_COMBINATIONS)[number];

export const A_LEVEL_CLASS_LEVELS = ['S4', 'S5', 'S6'] as const;

export function requiresCombination(classLevel: string): boolean {
  return (A_LEVEL_CLASS_LEVELS as readonly string[]).includes(classLevel);
}

export function ageBandToNumericRange(ageBand: string): { min: number; max: number } {
  if (ageBand === 'other') return { min: 21, max: 99 };
  const parsed = Number.parseInt(ageBand, 10);
  if (!Number.isNaN(parsed)) return { min: parsed, max: parsed };
  return { min: 0, max: 99 };
}

export function courseMatchesAgeBand(
  ageBand: string,
  minAge: number | null | undefined,
  maxAge: number | null | undefined,
): boolean {
  const { min, max } = ageBandToNumericRange(ageBand);
  const courseMin = minAge ?? 0;
  const courseMax = maxAge ?? 99;
  return max >= courseMin && min <= courseMax;
}
