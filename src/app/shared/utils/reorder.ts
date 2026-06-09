// why: reused by every "order: string[]" entity (images, files, book chapters)
//      when an item is dropped onto another. `from` is moved to occupy `to`'s
//      slot; ids missing from `order` (e.g. recently-added items not yet in the
//      array) are tolerated.
export const reorderById = (
  order: readonly string[],
  from: string,
  to: string,
): readonly string[] => {
  if (from === to) return order;
  const without = order.filter((id) => id !== from);
  const idx = without.indexOf(to);
  if (idx < 0) return [...without, from];
  return [...without.slice(0, idx), from, ...without.slice(idx)];
};
