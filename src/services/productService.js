import { AppError } from '../lib/errors.js';
import { boolean, integer, text } from '../lib/validation.js';
import { createProductRepository } from '../repositories/productRepository.js';
import { createCategoryRepository } from '../repositories/categoryRepository.js';

function parseProductInput(input) {
  const name = text(input.name, 'name', { min: 2, max: 80 });
  const description = text(input.description, 'description', { required: false, max: 300 }) ?? '';
  const categoryId = integer(input.categoryId, 'categoryId', { min: 1, required: false });
  const priceCents = integer(input.priceCents, 'priceCents', { min: 0, max: 100_000_000 });
  const stock = integer(input.stock, 'stock', { min: 0, max: 100_000 });
  const emoji = text(input.emoji, 'emoji', { required: false, max: 8 }) ?? '';
  const active = input.active === undefined ? true : boolean(input.active, 'active');
  return { name, description, categoryId, priceCents, stock, emoji, active };
}

export function createProductService({ db }) {
  const products = createProductRepository(db);
  const categories = createCategoryRepository(db);

  function ensureCategory(categoryId) {
    if (categoryId !== null && !categories.findById(categoryId)) {
      throw AppError.badRequest('CATEGORY_NOT_FOUND', 'La categoría seleccionada no existe.', {
        categoryId: 'Elegí una categoría válida.',
      });
    }
  }

  return {
    listAll({ search = null, categoryId = null } = {}) {
      return products.list({ includeInactive: true, search, categoryId });
    },

    create(input) {
      const data = parseProductInput(input);
      ensureCategory(data.categoryId);
      return products.create(data);
    },

    update(id, input) {
      const existing = products.findById(id);
      if (!existing) throw AppError.notFound('PRODUCT_NOT_FOUND', 'El producto no existe.');
      const data = parseProductInput({ ...existing, ...input });
      ensureCategory(data.categoryId);
      return products.update(id, data);
    },

    updateStock(id, { stock, delta }) {
      const existing = products.findById(id);
      if (!existing) throw AppError.notFound('PRODUCT_NOT_FOUND', 'El producto no existe.');

      if (stock !== undefined) {
        const newStock = integer(stock, 'stock', { min: 0, max: 100_000 });
        return products.update(id, { ...existing, stock: newStock });
      }

      const amount = integer(delta, 'delta', { min: -100_000, max: 100_000 });
      if (amount === 0) throw AppError.badRequest('INVALID_DELTA', 'El ajuste de stock no puede ser cero.');
      if (existing.stock + amount < 0) {
        throw AppError.conflict('STOCK_INSUFFICIENT', 'El ajuste dejaria el stock en un valor negativo.');
      }
      const newStock = existing.stock + amount;
      return products.update(id, { ...existing, stock: newStock });
    },

    remove(id) {
      const existing = products.findById(id);
      if (!existing) throw AppError.notFound('PRODUCT_NOT_FOUND', 'El producto no existe.');

      const timesOrdered = products.countOrderItems(id);
      if (timesOrdered > 0) {
        products.setActive(id, false);
        return { deleted: false, archived: true, product: products.findById(id) };
      }

      products.remove(id);
      return { deleted: true, archived: false };
    },
  };
}
