import { createProductRepository } from '../repositories/productRepository.js';
import { createCategoryRepository } from '../repositories/categoryRepository.js';
import { createRecreoRepository } from '../repositories/recreoRepository.js';

/** Datos publicos del kiosco: catalogo, categorias y recreos habilitados. */
export function createCatalogService({ db }) {
  const products = createProductRepository(db);
  const categories = createCategoryRepository(db);
  const recreos = createRecreoRepository(db);

  return {
    listProducts({ categoryId = null, search = null, onlyAvailable = false } = {}) {
      return products.list({ categoryId, search, onlyAvailable });
    },

    listCategories() {
      return categories.list();
    },

    listRecreos() {
      return recreos.list({ activeOnly: true });
    },
  };
}
