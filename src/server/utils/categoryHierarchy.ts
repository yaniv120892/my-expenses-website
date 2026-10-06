import categoryRepository from '@/server/repositories/categoryRepository';
import type { CategoryBreakdownItem } from '@/shared/types/transaction';

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
 * Every category id to itself plus all its descendants, for callers that must
 * keep sibling categories distinct.
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

/** Walks from the one root instead of building the whole map. */
export async function expandCategoryToSubtree(
  categoryId: string,
): Promise<string[]> {
  const categories = await categoryRepository.getAllCategories();
  return collectCategorySubtree(categories, categoryId);
}

export function collectCategorySubtree(
  categories: CategoryNode[],
  rootId: string,
): string[] {
  return collectSubtree(buildChildrenIndex(categories), rootId);
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

export type CategoryTotal = {
  categoryId: string;
  amount: number;
};

export type NamedCategoryNode = CategoryNode & { name: string };

/**
 * Sums each total into its top-level category, largest first, so a slice
 * covers exactly the subtree that filtering by its id returns.
 */
export function rollUpToTopLevel(
  totals: CategoryTotal[],
  categories: NamedCategoryNode[],
): CategoryBreakdownItem[] {
  const parentMap = buildParentMap(categories);
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  const amountByRoot = new Map<string, number>();
  for (const { categoryId, amount } of totals) {
    const rootId = parentMap.get(categoryId) ?? categoryId;
    amountByRoot.set(rootId, (amountByRoot.get(rootId) ?? 0) + amount);
  }

  const total = Array.from(amountByRoot.values()).reduce((a, b) => a + b, 0);
  return Array.from(amountByRoot.entries())
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([categoryId, amount]) => ({
      categoryId,
      categoryName: nameById.get(categoryId) ?? 'Unknown',
      amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
    }));
}
