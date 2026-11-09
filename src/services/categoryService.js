import { AppError } from '../lib/errors.js';
import { integer, text } from '../lib/validation.js';
import { createCategoryRepository } from '../repositories/categoryRepository.js';

function parseCategoryInput(input) {
  return {
    name: text(input.name, 'name', { min: 2, max: 40 }),
    emoji: text(input.emoji, 'emoji', { required: false, max: 8 }) ?? '',
    sortOrder: input.sortOrder === undefined ? 0 : integer(input.sortOrder, 'sortOrder', { min: 0, max: 999 }),
  };
}

export function createCategoryService({ db }) {
  const categories = createCategoryRepository(db);

  return {
    list() {
      return categories.list();
    },

    create(input) {
      const data = parseCategoryInput(input);
      if (categories.findByName(data.name)) {
        throw AppError.conflict('CATEGORY_EXISTS', 'Ya existe una categoría con ese nombre.');
      }
      return categories.create(data);
    },

    update(id, input) {
      const categoryId = integer(id, 'id', { min: 1 });
      const existing = categories.findById(categoryId);
      if (!existing) throw AppError.notFound('CATEGORY_NOT_FOUND', 'La categoría no existe.');
      const data = parseCategoryInput({ ...existing, ...input });
      const duplicated = categories.findByName(data.name);
      if (duplicated && duplicated.id !== categoryId) {
        throw AppError.conflict('CATEGORY_EXISTS', 'Ya existe una categoría con ese nombre.');
      }
      return categories.update(categoryId, data);
    },

    remove(id) {
      const categoryId = integer(id, 'id', { min: 1 });
      const existing = categories.findById(categoryId);
      if (!existing) throw AppError.notFound('CATEGORY_NOT_FOUND', 'La categoría no existe.');
      categories.remove(categoryId);
      return { deleted: true };
    },
  };
}
