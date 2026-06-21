/** Parse env durations like `180d`, `1h`, `15m` into milliseconds. */
export function parseDurationToMs(value: string, fallbackDays = 180): number {
  const trimmed = value.trim();
  const match = /^(\d+)([dhm])$/i.exec(trimmed);
  if (!match) return fallbackDays * 24 * 60 * 60 * 1000;

  const amount = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  if (unit === 'd') return amount * 24 * 60 * 60 * 1000;
  if (unit === 'h') return amount * 60 * 60 * 1000;
  return amount * 60 * 1000;
}

export function parseDurationToDays(value: string, fallbackDays = 180): number {
  return Math.ceil(
    parseDurationToMs(value, fallbackDays) / (24 * 60 * 60 * 1000),
  );
}
