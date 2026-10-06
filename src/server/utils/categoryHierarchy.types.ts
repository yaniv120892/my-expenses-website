export type CategoryTotal = {
  categoryId: string;
  amount: number;
};

export type NamedCategoryNode = {
  id: string;
  name: string;
  parentId?: string | null;
};

export type NamedCategoryTotal = CategoryTotal & { categoryName: string };
