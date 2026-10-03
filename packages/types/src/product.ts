export type ProductSort = "newest" | "price_asc" | "price_desc";

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  children?: Category[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  sellerId: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  price: string;
  stock: number;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductWithCategory extends Product {
  category: Pick<Category, "id" | "name" | "slug"> | null;
}

export interface ProductPage {
  items: ProductWithCategory[];
  nextCursor: string | null;
}
