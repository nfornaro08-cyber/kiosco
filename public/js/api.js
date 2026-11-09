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

// ============================================================================
// BASE DE DATOS Y SERVICIOS EN EL NAVEGADOR (MODO LOCAL / DOBLE CLIC EN INDEX)
// Permite que la aplicación funcione inmediatamente al abrir index.html con
// doble clic (protocolo file://) o si el servidor backend no está iniciado.
// ============================================================================

const LOCAL_STORAGE_DB_KEY = 'kiosco.local_db.v1';
const LOCAL_STORAGE_SESSION_KEY = 'kiosco.local_session.v1';

function getInitialDbState() {
  return {
    users: [
      { id: 1, name: 'Administración', email: 'admin@kiosco.local', password: 'Admin1234', role: 'admin' },
      { id: 2, name: 'Alumno demo', email: 'alumno@kiosco.local', password: 'Alumno1234', role: 'cliente' }
    ],
    categories: [
      { id: 1, name: 'Golosinas', emoji: '', sortOrder: 1 },
      { id: 2, name: 'Bebidas', emoji: '', sortOrder: 2 },
      { id: 3, name: 'Salados', emoji: '', sortOrder: 3 },
      { id: 4, name: 'Panadería', emoji: '', sortOrder: 4 },
      { id: 5, name: 'Helados', emoji: '', sortOrder: 5 }
    ],
    products: [
      { id: 1, name: 'Alfajor triple', categoryId: 1, priceCents: 150000, stock: 40, emoji: '', description: 'Alfajor de chocolate relleno con dulce de leche.', active: true },
      { id: 2, name: 'Chocolate', categoryId: 1, priceCents: 120000, stock: 30, emoji: '', description: 'Barra de chocolate con leche.', active: true },
      { id: 3, name: 'Chicles', categoryId: 1, priceCents: 50000, stock: 60, emoji: '', description: 'Chicles de menta, caja chica.', active: true },
      { id: 4, name: 'Caramelos', categoryId: 1, priceCents: 30000, stock: 80, emoji: '', description: 'Caramelos surtidos.', active: true },
      { id: 5, name: 'Agua mineral', categoryId: 2, priceCents: 90000, stock: 35, emoji: '', description: 'Botella de 500 ml sin gas.', active: true },
      { id: 6, name: 'Gaseosa', categoryId: 2, priceCents: 140000, stock: 25, emoji: '', description: 'Botella de 500 ml.', active: true },
      { id: 7, name: 'Jugo natural', categoryId: 2, priceCents: 110000, stock: 20, emoji: '', description: 'Jugo de frutas en cajita.', active: true },
      { id: 8, name: 'Chocolatada', categoryId: 2, priceCents: 130000, stock: 18, emoji: '', description: 'Leche chocolatada de 200 ml.', active: true },
      { id: 9, name: 'Papas fritas', categoryId: 3, priceCents: 160000, stock: 22, emoji: '', description: 'Bolsa de papas fritas clásicas.', active: true },
      { id: 10, name: 'Palitos salados', categoryId: 3, priceCents: 80000, stock: 30, emoji: '', description: 'Palitos de queso.', active: true },
      { id: 11, name: 'Chizitos', categoryId: 3, priceCents: 90000, stock: 28, emoji: '', description: 'Snack de maíz sabor queso.', active: true },
      { id: 12, name: 'Medialuna', categoryId: 4, priceCents: 60000, stock: 24, emoji: '', description: 'Medialuna de manteca.', active: true },
      { id: 13, name: 'Sandwich', categoryId: 4, priceCents: 180000, stock: 12, emoji: '', description: 'Sandwich de jamón y queso.', active: true },
      { id: 14, name: 'Bizcochuelo', categoryId: 4, priceCents: 100000, stock: 15, emoji: '', description: 'Porción de bizcochuelo casero.', active: true },
      { id: 15, name: 'Palito de agua', categoryId: 5, priceCents: 80000, stock: 26, emoji: '', description: 'Helado de agua sabor limón.', active: true },
      { id: 16, name: 'Helado de crema', categoryId: 5, priceCents: 150000, stock: 16, emoji: '', description: 'Cucurucho de crema americana.', active: true }
    ],
    recreos: [
      { id: 1, name: 'Primer recreo', startTime: '09:30', endTime: '09:45', active: true, sortOrder: 1 },
      { id: 2, name: 'Segundo recreo', startTime: '11:15', endTime: '11:30', active: true, sortOrder: 2 },
      { id: 3, name: 'Tercer recreo', startTime: '13:00', endTime: '13:15', active: true, sortOrder: 3 }
    ],
    orders: [
      {
        id: 1,
        code: 'K-261101-9X2A',
        userId: 2,
        userName: 'Alumno demo',
        userEmail: 'alumno@kiosco.local',
        recreoId: 1,
        recreoName: 'Primer recreo',
        recreoStartTime: '09:30',
        recreoEndTime: '09:45',
        serviceDate: new Date().toISOString().slice(0, 10),
        status: 'listo',
        totalCents: 270000,
        notes: 'Sin mayonesa',
        stockRestored: false,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        updatedAt: new Date(Date.now() - 1800000).toISOString(),
        items: [
          { id: 1, orderId: 1, productId: 13, productName: 'Sandwich', unitPriceCents: 180000, quantity: 1, subtotalCents: 180000 },
          { id: 2, orderId: 1, productId: 5, productName: 'Agua mineral', unitPriceCents: 90000, quantity: 1, subtotalCents: 90000 }
        ]
      }
    ],
    orderItemsSeq: 3,
    ordersSeq: 2,
    productsSeq: 17,
    categoriesSeq: 6,
    recreosSeq: 4,
    usersSeq: 3
  };
}

function loadLocalDb() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DB_KEY);
    if (!raw) {
      const initial = getInitialDbState();
      saveLocalDb(initial);
      return initial;
    }
    return JSON.parse(raw);
  } catch (e) {
    return getInitialDbState();
  }
}

function saveLocalDb(db) {
  try {
    localStorage.setItem(LOCAL_STORAGE_DB_KEY, JSON.stringify(db));
  } catch (e) {
    console.error('Error saving local db to localStorage', e);
  }
}

function getLocalSession() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setLocalSession(user) {
  if (user) {
    localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
  }
}

function generateOrderCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars[Math.floor(Math.random() * chars.length)];
  }
  const date = new Date();
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `K-${yy}${mm}${dd}-${rand}`;
}

const localBackend = {
  me() {
    const user = getLocalSession();
    return { user };
  },

  login(email, password) {
    const db = loadLocalDb();
    const user = db.users.find(
      (u) => u.email.toLowerCase() === String(email).trim().toLowerCase()
    );
    if (!user || user.password !== password) {
      throw new ApiError('Credenciales incorrectas.', { status: 401, code: 'INVALID_CREDENTIALS' });
    }
    const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
    setLocalSession(safeUser);
    return { user: safeUser };
  },

  register({ name, email, password }) {
    const db = loadLocalDb();
    const cleanEmail = String(email).trim().toLowerCase();
    if (db.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      throw new ApiError('Ya existe una cuenta con ese correo.', { status: 409, code: 'EMAIL_IN_USE' });
    }
    const newUser = {
      id: db.usersSeq++,
      name: String(name).trim(),
      email: cleanEmail,
      password: String(password),
      role: 'cliente'
    };
    db.users.push(newUser);
    saveLocalDb(db);
    const safeUser = { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role };
    setLocalSession(safeUser);
    return { user: safeUser };
  },

  logout() {
    setLocalSession(null);
    return { ok: true };
  },

  changePassword(currentPassword, newPassword) {
    const session = getLocalSession();
    if (!session) throw new ApiError('No autenticado', { status: 401 });
    const db = loadLocalDb();
    const user = db.users.find((u) => u.id === session.id);
    if (!user || user.password !== currentPassword) {
      throw new ApiError('La contraseña actual es incorrecta.', { status: 401, code: 'INVALID_CREDENTIALS' });
    }
    if (!newPassword || newPassword.length < 8) {
      throw new ApiError('La nueva contraseña debe tener al menos 8 caracteres.', { status: 400 });
    }
    user.password = newPassword;
    saveLocalDb(db);
    return { ok: true };
  },

  getProducts({ search, categoryId, available } = {}) {
    const db = loadLocalDb();
    const catMap = new Map(db.categories.map((c) => [c.id, c]));
    let prods = db.products.filter((p) => p.active);

    if (categoryId) {
      prods = prods.filter((p) => p.categoryId === Number(categoryId));
    }
    if (search) {
      const q = String(search).toLowerCase();
      prods = prods.filter(
        (p) => p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q))
      );
    }
    if (available) {
      prods = prods.filter((p) => p.stock > 0);
    }

    const result = prods.map((p) => {
      const cat = catMap.get(p.categoryId);
      return {
        ...p,
        categoryName: cat ? cat.name : null,
        categoryEmoji: cat ? cat.emoji : null
      };
    });

    return { products: result };
  },

  getCategories() {
    const db = loadLocalDb();
    const counts = new Map();
    for (const p of db.products) {
      if (p.active) {
        counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);
      }
    }
    const categories = db.categories.map((c) => ({
      ...c,
      productCount: counts.get(c.id) ?? 0
    }));
    return { categories };
  },

  getRecreos() {
    const db = loadLocalDb();
    const recreos = db.recreos.filter((r) => r.active);
    return { recreos };
  },

  getMyOrders() {
    const session = getLocalSession();
    if (!session) throw new ApiError('No autenticado', { status: 401 });
    const db = loadLocalDb();
    const orders = db.orders.filter((o) => o.userId === session.id);
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return { orders };
  },

  createOrder({ recreoId, items, notes }) {
    const session = getLocalSession();
    if (!session) throw new ApiError('Iniciá sesión para hacer un pedido.', { status: 401 });
    const db = loadLocalDb();
    const recreo = db.recreos.find((r) => r.id === Number(recreoId) && r.active);
    if (!recreo) throw new ApiError('El recreo seleccionado no está habilitado.', { status: 400 });

    if (!Array.isArray(items) || items.length === 0) {
      throw new ApiError('El pedido está vacío.', { status: 400 });
    }

    let totalCents = 0;
    const orderItems = [];

    // Validar y descontar stock atómicamente
    for (const it of items) {
      const prod = db.products.find((p) => p.id === Number(it.productId) && p.active);
      if (!prod) throw new ApiError(`Producto no disponible.`, { status: 400 });
      if (prod.stock < it.quantity) {
        throw new ApiError(`No hay stock suficiente de "${prod.name}" (disponibles: ${prod.stock}).`, { status: 400 });
      }
    }

    for (const it of items) {
      const prod = db.products.find((p) => p.id === Number(it.productId));
      prod.stock -= it.quantity;
      const subtotalCents = prod.priceCents * it.quantity;
      totalCents += subtotalCents;
      orderItems.push({
        id: db.orderItemsSeq++,
        orderId: db.ordersSeq,
        productId: prod.id,
        productName: prod.name,
        unitPriceCents: prod.priceCents,
        quantity: it.quantity,
        subtotalCents
      });
    }

    const newOrder = {
      id: db.ordersSeq++,
      code: generateOrderCode(),
      userId: session.id,
      userName: session.name,
      userEmail: session.email,
      recreoId: recreo.id,
      recreoName: recreo.name,
      recreoStartTime: recreo.startTime,
      recreoEndTime: recreo.endTime,
      serviceDate: new Date().toISOString().slice(0, 10),
      status: 'pendiente',
      totalCents,
      notes: notes ? String(notes).trim() : '',
      stockRestored: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: orderItems
    };

    db.orders.push(newOrder);
    saveLocalDb(db);
    return { order: newOrder };
  },

  cancelOrder(id) {
    const session = getLocalSession();
    if (!session) throw new ApiError('No autenticado', { status: 401 });
    const db = loadLocalDb();
    const order = db.orders.find((o) => o.id === Number(id));
    if (!order) throw new ApiError('Pedido no encontrado', { status: 404 });

    if (session.role !== 'admin' && order.userId !== session.id) {
      throw new ApiError('No tenés permiso para cancelar este pedido.', { status: 403 });
    }

    if (order.status !== 'pendiente' && session.role !== 'admin') {
      throw new ApiError('Solo podés cancelar pedidos pendientes.', { status: 409 });
    }

    if (order.status === 'entregado' || order.status === 'cancelado') {
      throw new ApiError('No se puede cancelar un pedido entregado o ya cancelado.', { status: 409 });
    }

    // Restituir stock
    if (!order.stockRestored) {
      for (const it of order.items) {
        const prod = db.products.find((p) => p.id === it.productId);
        if (prod) prod.stock += it.quantity;
      }
      order.stockRestored = true;
    }

    order.status = 'cancelado';
    order.updatedAt = new Date().toISOString();
    saveLocalDb(db);
    return { order };
  },

  admin: {
    getProducts({ search, categoryId } = {}) {
      const db = loadLocalDb();
      const catMap = new Map(db.categories.map((c) => [c.id, c]));
      let prods = db.products;
      if (categoryId) prods = prods.filter((p) => p.categoryId === Number(categoryId));
      if (search) {
        const q = String(search).toLowerCase();
        prods = prods.filter((p) => p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q)));
      }
      const products = prods.map((p) => {
        const cat = catMap.get(p.categoryId);
        return {
          ...p,
          categoryName: cat ? cat.name : null,
          categoryEmoji: cat ? cat.emoji : null
        };
      });
      return { products };
    },

    createProduct(payload) {
      const db = loadLocalDb();
      const newProd = {
        id: db.productsSeq++,
        name: String(payload.name).trim(),
        description: payload.description ? String(payload.description).trim() : '',
        categoryId: Number(payload.categoryId) || null,
        priceCents: Number(payload.priceCents) || 0,
        stock: Number(payload.stock) || 0,
        emoji: payload.emoji || '',
        active: payload.active !== undefined ? Boolean(payload.active) : true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.products.push(newProd);
      saveLocalDb(db);
      return { product: newProd };
    },

    updateProduct(id, payload) {
      const db = loadLocalDb();
      const p = db.products.find((item) => item.id === Number(id));
      if (!p) throw new ApiError('Producto no encontrado', { status: 404 });
      if (payload.name) p.name = String(payload.name).trim();
      if (payload.description !== undefined) p.description = String(payload.description).trim();
      if (payload.categoryId !== undefined) p.categoryId = Number(payload.categoryId) || null;
      if (payload.priceCents !== undefined) p.priceCents = Number(payload.priceCents);
      if (payload.stock !== undefined) p.stock = Number(payload.stock);
      if (payload.emoji) p.emoji = payload.emoji;
      if (payload.active !== undefined) p.active = Boolean(payload.active);
      p.updatedAt = new Date().toISOString();
      saveLocalDb(db);
      return { product: p };
    },

    updateStock(id, { stock, delta }) {
      const db = loadLocalDb();
      const p = db.products.find((item) => item.id === Number(id));
      if (!p) throw new ApiError('Producto no encontrado', { status: 404 });
      if (stock !== undefined) p.stock = Math.max(0, Number(stock));
      else if (delta !== undefined) p.stock = Math.max(0, p.stock + Number(delta));
      p.updatedAt = new Date().toISOString();
      saveLocalDb(db);
      return { product: p };
    },

    deleteProduct(id) {
      const db = loadLocalDb();
      const hasOrders = db.orders.some((o) => o.items && o.items.some((it) => it.productId === Number(id)));
      if (hasOrders) {
        const p = db.products.find((item) => item.id === Number(id));
        if (p) p.active = false;
      } else {
        db.products = db.products.filter((item) => item.id !== Number(id));
      }
      saveLocalDb(db);
      return { ok: true };
    },

    getCategories() {
      return localBackend.getCategories();
    },

    createCategory(payload) {
      const db = loadLocalDb();
      const newCat = {
        id: db.categoriesSeq++,
        name: String(payload.name).trim(),
        emoji: payload.emoji || '',
        sortOrder: Number(payload.sortOrder) || db.categories.length + 1
      };
      db.categories.push(newCat);
      saveLocalDb(db);
      return { category: newCat };
    },

    updateCategory(id, payload) {
      const db = loadLocalDb();
      const c = db.categories.find((item) => item.id === Number(id));
      if (!c) throw new ApiError('Categoría no encontrada', { status: 404 });
      if (payload.name) c.name = String(payload.name).trim();
      if (payload.emoji) c.emoji = payload.emoji;
      if (payload.sortOrder !== undefined) c.sortOrder = Number(payload.sortOrder);
      saveLocalDb(db);
      return { category: c };
    },

    deleteCategory(id) {
      const db = loadLocalDb();
      db.categories = db.categories.filter((c) => c.id !== Number(id));
      saveLocalDb(db);
      return { ok: true };
    },

    getRecreos() {
      const db = loadLocalDb();
      return { recreos: db.recreos };
    },

    createRecreo(payload) {
      const db = loadLocalDb();
      const newRec = {
        id: db.recreosSeq++,
        name: String(payload.name).trim(),
        startTime: String(payload.startTime).trim(),
        endTime: String(payload.endTime).trim(),
        active: payload.active !== undefined ? Boolean(payload.active) : true,
        sortOrder: Number(payload.sortOrder) || db.recreos.length + 1
      };
      db.recreos.push(newRec);
      saveLocalDb(db);
      return { recreo: newRec };
    },

    updateRecreo(id, payload) {
      const db = loadLocalDb();
      const r = db.recreos.find((item) => item.id === Number(id));
      if (!r) throw new ApiError('Recreo no encontrado', { status: 404 });
      if (payload.name) r.name = String(payload.name).trim();
      if (payload.startTime) r.startTime = String(payload.startTime).trim();
      if (payload.endTime) r.endTime = String(payload.endTime).trim();
      if (payload.active !== undefined) r.active = Boolean(payload.active);
      if (payload.sortOrder !== undefined) r.sortOrder = Number(payload.sortOrder);
      saveLocalDb(db);
      return { recreo: r };
    },

    deleteRecreo(id) {
      const db = loadLocalDb();
      db.recreos = db.recreos.filter((r) => r.id !== Number(id));
      saveLocalDb(db);
      return { ok: true };
    },

    getOrders({ status, recreoId, date } = {}) {
      const db = loadLocalDb();
      let orders = db.orders;
      if (status) orders = orders.filter((o) => o.status === status);
      if (recreoId) orders = orders.filter((o) => o.recreoId === Number(recreoId));
      if (date && date !== 'all') orders = orders.filter((o) => o.serviceDate === date);
      orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return { orders };
    },

    updateOrderStatus(id, status) {
      const db = loadLocalDb();
      const order = db.orders.find((o) => o.id === Number(id));
      if (!order) throw new ApiError('Pedido no encontrado', { status: 404 });

      if (status === 'cancelado' && order.status !== 'cancelado') {
        if (!order.stockRestored) {
          for (const it of order.items) {
            const prod = db.products.find((p) => p.id === it.productId);
            if (prod) prod.stock += it.quantity;
          }
          order.stockRestored = true;
        }
      }

      order.status = status;
      order.updatedAt = new Date().toISOString();
      saveLocalDb(db);
      return { order };
    },

    getStats() {
      const db = loadLocalDb();
      const today = new Date().toISOString().slice(0, 10);
      const ordersToday = db.orders.filter((o) => o.serviceDate === today);
      const activeOrders = ordersToday.filter((o) => o.status !== 'cancelado');
      const revenueCents = activeOrders.reduce((sum, o) => sum + o.totalCents, 0);

      const inProgress = ordersToday.filter((o) => o.status === 'pendiente' || o.status === 'preparando').length;
      const ready = ordersToday.filter((o) => o.status === 'listo').length;
      const lowStockProducts = db.products.filter((p) => p.active && p.stock <= 5);

      return {
        today: {
          ordersCount: ordersToday.length,
          revenueCents,
          inProgress,
          ready
        },
        lowStock: lowStockProducts,
        topProducts: []
      };
    },

    getUsers() {
      const db = loadLocalDb();
      const safeUsers = db.users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role }));
      return { users: safeUsers };
    }
  }
};

// ============================================================================
// CLIENTE HTTP CON FALLBACK AUTOMÁTICO A MODO LOCAL
// ============================================================================

const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';

async function request(path, { method = 'GET', body } = {}) {
  // Si se abre con doble clic (file://), usamos directamente la base de datos local
  if (isFileProtocol) {
    return handleLocalFallback(path, method, body);
  }

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
    } catch (error) {
      // Si la red falla o el servidor backend no está respondiendo, usamos fallback local
      console.warn(`[API] Falló conexión con servidor HTTP (${path}). Usando almacenamiento local.`);
      return handleLocalFallback(path, method, body);
    }

    const contentType = response.headers.get('content-type') ?? '';
    const isJson = contentType.includes('application/json');
    if (!isJson) {
      console.warn(`[API] El servidor no devolvió JSON (${path}). Usando almacenamiento local.`);
      return handleLocalFallback(path, method, body);
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
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

// Router para peticiones locales cuando no hay servidor HTTP
function handleLocalFallback(path, method, body) {
  const [routePath, queryString] = path.split('?');
  const params = Object.fromEntries(new URLSearchParams(queryString || ''));

  if (routePath === '/auth/me') return localBackend.me();
  if (routePath === '/auth/login') return localBackend.login(body.email, body.password);
  if (routePath === '/auth/register') return localBackend.register(body);
  if (routePath === '/auth/logout') return localBackend.logout();
  if (routePath === '/auth/password' && method === 'PUT') return localBackend.changePassword(body.currentPassword, body.newPassword);

  if (routePath === '/products') return localBackend.getProducts(params);
  if (routePath === '/categories') return localBackend.getCategories();
  if (routePath === '/recreos') return localBackend.getRecreos();

  if (routePath === '/orders') {
    if (method === 'POST') return localBackend.createOrder(body);
    return localBackend.getMyOrders();
  }

  const cancelMatch = routePath.match(/^\/orders\/(\d+)\/cancel$/);
  if (cancelMatch) return localBackend.cancelOrder(Number(cancelMatch[1]));

  // Admin routes
  if (routePath === '/admin/products') {
    if (method === 'POST') return localBackend.admin.createProduct(body);
    return localBackend.admin.getProducts(params);
  }

  const prodStockMatch = routePath.match(/^\/admin\/products\/(\d+)\/stock$/);
  if (prodStockMatch) return localBackend.admin.updateStock(Number(prodStockMatch[1]), body);

  const prodMatch = routePath.match(/^\/admin\/products\/(\d+)$/);
  if (prodMatch) {
    if (method === 'PUT') return localBackend.admin.updateProduct(Number(prodMatch[1]), body);
    if (method === 'DELETE') return localBackend.admin.deleteProduct(Number(prodMatch[1]));
  }

  if (routePath === '/admin/categories') {
    if (method === 'POST') return localBackend.admin.createCategory(body);
    return localBackend.admin.getCategories();
  }
  const catMatch = routePath.match(/^\/admin\/categories\/(\d+)$/);
  if (catMatch) {
    if (method === 'PUT') return localBackend.admin.updateCategory(Number(catMatch[1]), body);
    if (method === 'DELETE') return localBackend.admin.deleteCategory(Number(catMatch[1]));
  }

  if (routePath === '/admin/recreos') {
    if (method === 'POST') return localBackend.admin.createRecreo(body);
    return localBackend.admin.getRecreos();
  }
  const recMatch = routePath.match(/^\/admin\/recreos\/(\d+)$/);
  if (recMatch) {
    if (method === 'PUT') return localBackend.admin.updateRecreo(Number(recMatch[1]), body);
    if (method === 'DELETE') return localBackend.admin.deleteRecreo(Number(recMatch[1]));
  }

  if (routePath === '/admin/orders') return localBackend.admin.getOrders(params);

  const orderStatusMatch = routePath.match(/^\/admin\/orders\/(\d+)\/status$/);
  if (orderStatusMatch) return localBackend.admin.updateOrderStatus(Number(orderStatusMatch[1]), body.status);

  if (routePath === '/admin/stats') return localBackend.admin.getStats();
  if (routePath === '/admin/users') return localBackend.admin.getUsers();

  if (routePath.match(/^\/orders\/\d+\/pay$/)) {
    throw new ApiError('Los pagos no están disponibles en modo local.', { status: 503 });
  }
  if (routePath.match(/^\/orders\/\d+\/payment$/)) {
    return { payment: null };
  }

  throw new ApiError(`Ruta no encontrada: ${path}`, { status: 404 });
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
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
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

    getStats: () => request('/admin/stats'),
    getUsers: () => request('/admin/users'),
  },
};
