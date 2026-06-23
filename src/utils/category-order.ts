/**
 * Orders parameter category (section) names for display in the panes.
 *
 * By default categories sort alphabetically (locale-aware, case-insensitive).
 * A model may override the order per category via a precedence map: categories
 * with an explicit precedence sort first, in ascending precedence order (lower
 * appears earlier). Any category without a precedence falls back to alphabetical
 * order after the prioritized ones. Ties (equal precedence) break alphabetically.
 */
export const sortCategories = (
  categories: string[],
  precedence?: Record<string, number>
): string[] => {
  const prec = precedence ?? {};
  const rank = (category: string): number => {
    const value = prec[category];
    return typeof value === 'number' && Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
  };
  return [...categories].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  });
};
