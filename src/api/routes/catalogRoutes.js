import { sendJson } from '../../lib/http.js';
import { integer } from '../../lib/validation.js';

export function registerCatalogRoutes(routes, ctx) {
  const { catalog } = ctx;

  routes.push({
    method: 'GET',
    path: '/api/health',
    handler: async (req, res) => {
      sendJson(res, 200, { status: 'ok', time: new Date().toISOString() });
    },
  });

  routes.push({
    method: 'GET',
    path: '/api/products',
    handler: async (req, res, { url }) => {
      const search = url.searchParams.get('search')?.trim() || null;
      const categoryParam = url.searchParams.get('categoryId');
      const categoryId = categoryParam ? integer(categoryParam, 'categoryId', { min: 1 }) : null;
      const onlyAvailable = url.searchParams.get('available') === '1';
      const products = catalog.listProducts({ search, categoryId, onlyAvailable });
      sendJson(res, 200, { products });
    },
  });

  routes.push({
    method: 'GET',
    path: '/api/categories',
    handler: async (req, res) => {
      sendJson(res, 200, { categories: catalog.listCategories() });
    },
  });

  routes.push({
    method: 'GET',
    path: '/api/recreos',
    handler: async (req, res) => {
      sendJson(res, 200, { recreos: catalog.listRecreos() });
    },
  });
}
