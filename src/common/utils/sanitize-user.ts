export function sanitizeUser<T extends { passwordHash?: string | null }>(
  user: T,
): Omit<T, 'passwordHash'> {
  const rest = { ...user };
  delete rest.passwordHash;
  return rest;
}
