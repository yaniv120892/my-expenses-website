export type Category = {
  id: string;
  name: string;
  // Present only when loaded with hierarchy (getAllCategories selects it).
  parentId?: string | null;
};
