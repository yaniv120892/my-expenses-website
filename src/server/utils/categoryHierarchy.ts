import categoryRepository from '@/server/repositories/categoryRepository';

/**
 * Maps every category id to itself plus all of its descendants. The inverse of
 * buildCategoryParentMap: callers that must keep sibling categories distinct
 * (rather than rolling them up to a shared ancestor) expand ids through this.
 */
export async function buildCategoryDescendantMap(): Promise<
  Map<string, string[]>
> {
  const allCategories = await categoryRepository.getAllCategories();

  const childrenByParent = new Map<string, string[]>();
  for (const category of allCategories) {
    if (!category.parentId) continue;
    const siblings = childrenByParent.get(category.parentId) ?? [];
    siblings.push(category.id);
    childrenByParent.set(category.parentId, siblings);
  }

  const descendantMap = new Map<string, string[]>();
  for (const category of allCategories) {
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

export async function buildCategoryParentMap(): Promise<Map<string, string>> {
  const allCategories = await categoryRepository.getAllCategories();
  const parentMap = new Map<string, string>();

  const categoryToParentMap = new Map<string, string | null>();
  for (const category of allCategories) {
    if (category.parentId !== null && category.parentId !== undefined) {
      categoryToParentMap.set(category.id, category.parentId);
    }
  }

  for (const category of allCategories) {
    let currentId = category.id;
    let parentId = categoryToParentMap.get(currentId);

    if (parentMap.has(currentId)) continue;

    while (parentId) {
      const nextParentId = categoryToParentMap.get(parentId);
      if (!nextParentId) {
        parentMap.set(currentId, parentId);
        break;
      }
      currentId = parentId;
      parentId = nextParentId;
    }

    // No parent chain found: the category is itself top-level.
    if (!parentMap.has(category.id)) {
      parentMap.set(category.id, category.id);
    }
  }

  return parentMap;
}
