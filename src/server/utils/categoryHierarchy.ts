import categoryRepository from '@/server/repositories/categoryRepository';

export interface CategoryNode {
  id: string;
  parentId?: string | null;
}

function buildChildrenIndex(categories: CategoryNode[]): Map<string, string[]> {
  const childrenByParent = new Map<string, string[]>();
  for (const category of categories) {
    if (!category.parentId) {
      continue;
    }
    const siblings = childrenByParent.get(category.parentId) ?? [];
    siblings.push(category.id);
    childrenByParent.set(category.parentId, siblings);
  }
  return childrenByParent;
}

/** The root plus every id beneath it. An unknown root is just itself. */
function collectSubtree(
  childrenByParent: Map<string, string[]>,
  rootId: string,
): string[] {
  const descendants: string[] = [];
  const queue = [rootId];
  const seen = new Set<string>([rootId]);
  while (queue.length > 0) {
    const currentId = queue.shift() as string;
    descendants.push(currentId);
    for (const childId of childrenByParent.get(currentId) ?? []) {
      // Guards against a cycle from bad data looping forever.
      if (seen.has(childId)) {
        continue;
      }
      seen.add(childId);
      queue.push(childId);
    }
  }
  return descendants;
}

/**
 * Maps every category id to itself plus all of its descendants. The inverse of
 * buildParentMap: callers that must keep sibling categories distinct (rather
 * than rolling them up to a shared ancestor) expand ids through this.
 */
export function buildDescendantMap(
  categories: CategoryNode[],
): Map<string, string[]> {
  const childrenByParent = buildChildrenIndex(categories);
  const descendantMap = new Map<string, string[]>();
  for (const category of categories) {
    descendantMap.set(
      category.id,
      collectSubtree(childrenByParent, category.id),
    );
  }
  return descendantMap;
}

/**
 * The ids a single-category filter covers. Walks from the one root instead of
 * building the whole map, which callers filtering by one category would throw
 * away.
 */
export async function expandCategoryToSubtree(
  categoryId: string,
): Promise<string[]> {
  const categories = await categoryRepository.getAllCategories();
  return collectSubtree(buildChildrenIndex(categories), categoryId);
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
