// Cliente HTTP: el frontend SOLO habla con la API del backend (nunca con la base de datos).
const BASE_URL = '/api';
const REQUEST_TIMEOUT_MS = 10000;

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'ERROR', details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const init = {
    method,
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    let response;
    try {
      response = await fetch(BASE_URL + path, { ...init, signal: controller.signal });
    } catch {
      throw new ApiError('No hay conexión con el servidor. Iniciá el kiosco con start.bat y probá de nuevo.', {
        code: 'NETWORK_ERROR',
      });
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const error = payload?.error ?? {};
      throw new ApiError(error.message ?? 'Ocurrió un error inesperado.', {
        status: response.status,
        code: error.code ?? 'ERROR',
        details: error.details ?? null,
      });
    }

    return payload;
  } finally {
    clearTimeout(timer);
  }
}

function toQuery(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export const api = {
  me: () => request('/auth/me'),
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  changePassword: (payload) => request('/auth/password', { method: 'PUT', body: payload }),

  getProducts: (params = {}) => request(`/products${toQuery(params)}`),
  getCategories: () => request('/categories'),
  getRecreos: () => request('/recreos'),

  getMyOrders: () => request('/orders'),
  createOrder: (payload) => request('/orders', { method: 'POST', body: payload }),
  cancelOrder: (id) => request(`/orders/${id}/cancel`, { method: 'POST' }),

  createPayment: (id) => request(`/orders/${id}/pay`, { method: 'POST' }),
  getPaymentStatus: (id) => request(`/orders/${id}/payment`),

  admin: {
    getProducts: (params = {}) => request(`/admin/products${toQuery(params)}`),
    createProduct: (payload) => request('/admin/products', { method: 'POST', body: payload }),
    updateProduct: (id, payload) => request(`/admin/products/${id}`, { method: 'PUT', body: payload }),
    updateStock: (id, payload) => request(`/admin/products/${id}/stock`, { method: 'PATCH', body: payload }),
    deleteProduct: (id) => request(`/admin/products/${id}`, { method: 'DELETE' }),

    getCategories: () => request('/admin/categories'),
    createCategory: (payload) => request('/admin/categories', { method: 'POST', body: payload }),
    updateCategory: (id, payload) => request(`/admin/categories/${id}`, { method: 'PUT', body: payload }),
    deleteCategory: (id) => request(`/admin/categories/${id}`, { method: 'DELETE' }),

    getRecreos: () => request('/admin/recreos'),
    createRecreo: (payload) => request('/admin/recreos', { method: 'POST', body: payload }),
    updateRecreo: (id, payload) => request(`/admin/recreos/${id}`, { method: 'PUT', body: payload }),
    deleteRecreo: (id) => request(`/admin/recreos/${id}`, { method: 'DELETE' }),

    getOrders: (params = {}) => request(`/admin/orders${toQuery(params)}`),
    updateOrderStatus: (id, status) =>
      request(`/admin/orders/${id}/status`, { method: 'PATCH', body: { status } }),
    updatePaymentStatus: (id, status) =>
      request(`/admin/orders/${id}/payment`, { method: 'PATCH', body: { status } }),

    getStats: () => request('/admin/stats'),
    getUsers: () => request('/admin/users'),
    createUser: (payload) => request('/admin/users', { method: 'POST', body: payload }),
    deleteUser: (id) => request(`/admin/users/${id}`, { method: 'DELETE' }),
  },
};
