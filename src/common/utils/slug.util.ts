export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const slug = slugify(base);
  let counter = 0;
  while (await exists(counter === 0 ? slug : `${slug}-${counter}`)) {
    counter++;
  }
  return counter === 0 ? slug : `${slug}-${counter}`;
}
