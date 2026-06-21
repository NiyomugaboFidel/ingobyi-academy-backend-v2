const LEVEL_SLUG_MAP: Record<string, string | null> = {
  beginner: 'BEGINNER',
  intermediate: 'INTERMEDIATE',
  advanced: 'ADVANCED',
  'all-levels': null,
};

const DURATION_RANGES: Record<string, { min: number; max: number | null }> = {
  '0-1': { min: 0, max: 60 },
  '1-3': { min: 60, max: 180 },
  '3-6': { min: 180, max: 360 },
  '6-17': { min: 360, max: 1020 },
  '17+': { min: 1020, max: null },
};

export function parseCsv(value?: string): string[] {
  if (!value?.trim()) return [];
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function normalizeLevelSlug(slug: string): string | null {
  const key = slug.trim().toLowerCase();
  if (key in LEVEL_SLUG_MAP) return LEVEL_SLUG_MAP[key];
  const upper = key.toUpperCase().replace(/-/g, '_');
  if (['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].includes(upper)) return upper;
  return slug.trim();
}

export function resolveLevels(level?: string, levels?: string): string[] {
  const raw = [...parseCsv(level), ...parseCsv(levels)];
  const resolved = raw
    .map(normalizeLevelSlug)
    .filter((value): value is string => Boolean(value));
  return [...new Set(resolved)];
}

export function resolveCategories(
  category?: string,
  categories?: string,
): string[] {
  return [...new Set([...parseCsv(category), ...parseCsv(categories)])];
}

export function resolveLanguages(language?: string): string[] {
  return [...new Set(parseCsv(language).map((code) => code.toLowerCase()))];
}

export function resolveDurationRanges(duration?: string) {
  return parseCsv(duration)
    .map((slug) => DURATION_RANGES[slug])
    .filter((range): range is { min: number; max: number | null } =>
      Boolean(range),
    );
}

export function intersectIds(
  current: string[] | undefined,
  next: string[],
): string[] | undefined {
  if (!next.length) return current ?? [];
  if (!current) return next;
  const allowed = new Set(next);
  return current.filter((id) => allowed.has(id));
}
