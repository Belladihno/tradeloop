import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, IsNull, Repository } from "typeorm";
import { Category } from "./entities/category.entity";

@Injectable()
export class CategoryRepository {
  constructor(
    @InjectRepository(Category) private readonly categories: Repository<Category>,
  ) {}

  create(data: Partial<Category>): Promise<Category> {
    return this.categories.save(this.categories.create(data));
  }

  findById(id: string): Promise<Category | null> {
    return this.categories.findOne({ where: { id, deletedAt: IsNull() } });
  }

  findBySlug(slug: string): Promise<Category | null> {
    return this.categories.findOne({ where: { slug, deletedAt: IsNull() } });
  }

  listActive(): Promise<Category[]> {
    return this.categories.find({
      where: { deletedAt: IsNull() },
      order: { name: "ASC" },
    });
  }

  async findByIds(ids: string[]): Promise<Category[]> {
    if (ids.length === 0) return [];
    return this.categories.find({ where: { id: In(ids), deletedAt: IsNull() } });
  }

  countChildren(parentId: string): Promise<number> {
    return this.categories.count({ where: { parentId, deletedAt: IsNull() } });
  }

  async updateFields(id: string, data: Partial<Category>): Promise<void> {
    await this.categories.update({ id }, data);
  }

  async softDelete(id: string): Promise<void> {
    await this.categories.update({ id }, { deletedAt: new Date() });
  }
}
