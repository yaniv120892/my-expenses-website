import categoryRepository from '@/server/repositories/categoryRepository';

export interface CategoryNode {
  id: string;
  parentId?: string | null;
}

/**
 * Maps every category id to itself plus all of its descendants. The inverse of
 * buildParentMap: callers that must keep sibling categories distinct (rather
 * than rolling them up to a shared ancestor) expand ids through this.
 */
export function buildDescendantMap(
  categories: CategoryNode[],
): Map<string, string[]> {
  const childrenByParent = new Map<string, string[]>();
  for (const category of categories) {
    if (!category.parentId) continue;
    const siblings = childrenByParent.get(category.parentId) ?? [];
    siblings.push(category.id);
    childrenByParent.set(category.parentId, siblings);
  }

  const descendantMap = new Map<string, string[]>();
  for (const category of categories) {
    const descendants: string[] = [];
    const queue = [category.id];
    const seen = new Set<string>([category.id]);
    while (queue.length > 0) {
      const currentId = queue.shift() as string;
      descendants.push(currentId);
      for (const childId of childrenByParent.get(currentId) ?? []) {
        // Guards against a cycle from bad data looping forever.
        if (seen.has(childId)) continue;
        seen.add(childId);
        queue.push(childId);
      }
    }
    descendantMap.set(category.id, descendants);
  }

  return descendantMap;
}

/**
 * Maps every category id to its top-level ancestor (itself when top-level).
 * A cycle from bad data stops the walk at the last id before the repeat.
 */
export function buildParentMap(
  categories: CategoryNode[],
): Map<string, string> {
  const parentById = new Map<string, string>();
  for (const category of categories) {
    if (category.parentId) {
      parentById.set(category.id, category.parentId);
    }
  }

  const parentMap = new Map<string, string>();
  for (const category of categories) {
    let rootId = category.id;
    const seen = new Set<string>([rootId]);
    let parentId = parentById.get(rootId);
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      rootId = parentId;
      parentId = parentById.get(rootId);
    }
    parentMap.set(category.id, rootId);
  }

  return parentMap;
}

export async function buildCategoryDescendantMap(): Promise<
  Map<string, string[]>
> {
  return buildDescendantMap(await categoryRepository.getAllCategories());
}

export async function buildCategoryParentMap(): Promise<Map<string, string>> {
  return buildParentMap(await categoryRepository.getAllCategories());
}
