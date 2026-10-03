import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from "@nestjs/common";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@tradeloop/validators";
import { ProductsRepository } from "../products/products.repository";
import { slugify } from "../common/utils/slug";
import { CategoryRepository } from "./category.repository";
import type { Category } from "./entities/category.entity";

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  children: CategoryNode[];
}

@Injectable()
export class CategoriesService {
  constructor(
    private readonly categories: CategoryRepository,
    @Inject(forwardRef(() => ProductsRepository))
    private readonly products: ProductsRepository,
  ) {}

  async listTree(): Promise<CategoryNode[]> {
    const all = await this.categories.listActive();
    const nodes = new Map<string, CategoryNode>(
      all.map((category) => [
        category.id,
        {
          id: category.id,
          name: category.name,
          slug: category.slug,
          parentId: category.parentId,
          children: [],
        },
      ]),
    );
    const roots: CategoryNode[] = [];
    for (const node of nodes.values()) {
      const parent = node.parentId ? nodes.get(node.parentId) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    return roots;
  }

  async create(input: CreateCategoryInput): Promise<Category> {
    if (input.parentId) {
      await this.requireCategory(input.parentId);
    }
    return this.categories.create({ ...input, slug: slugify(input.name) });
  }

  async update(id: string, input: UpdateCategoryInput): Promise<Category> {
    const category = await this.requireCategory(id);
    if (input.parentId !== undefined && input.parentId !== category.parentId) {
      await this.requireValidParent(id, input.parentId);
    }
    await this.categories.updateFields(id, input);
    return this.requireCategory(id);
  }

  async remove(id: string): Promise<void> {
    await this.requireCategory(id);
    const [children, products] = await Promise.all([
      this.categories.countChildren(id),
      this.products.countByCategory(id),
    ]);
    if (children > 0) {
      throw new ConflictException("Category has subcategories and cannot be deleted");
    }
    if (products > 0) {
      throw new ConflictException("Category has products and cannot be deleted");
    }
    await this.categories.softDelete(id);
  }

  private async requireCategory(id: string): Promise<Category> {
    const category = await this.categories.findById(id);
    if (!category) throw new NotFoundException("Category not found");
    return category;
  }

  private async requireValidParent(id: string, parentId: string | null): Promise<void> {
    if (parentId === null) return;
    if (parentId === id) {
      throw new BadRequestException("A category cannot be its own parent");
    }
    await this.requireCategory(parentId);
    const descendants = await this.collectDescendantIds(id);
    if (descendants.has(parentId)) {
      throw new BadRequestException("A category cannot move under its own subcategory");
    }
  }

  private async collectDescendantIds(id: string): Promise<Set<string>> {
    const all = await this.categories.listActive();
    const childrenOf = new Map<string, string[]>();
    for (const category of all) {
      if (category.parentId) {
        const siblings = childrenOf.get(category.parentId) ?? [];
        siblings.push(category.id);
        childrenOf.set(category.parentId, siblings);
      }
    }
    const descendants = new Set<string>();
    const stack = [...(childrenOf.get(id) ?? [])];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || descendants.has(current)) continue;
      descendants.add(current);
      stack.push(...(childrenOf.get(current) ?? []));
    }
    return descendants;
  }
}
