// public/js/api.js
var BASE_URL = "/api";
var REQUEST_TIMEOUT_MS = 1e4;

class ApiError extends Error {
  constructor(message, { status = 0, code = "ERROR", details = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
var LOCAL_STORAGE_DB_KEY = "kiosco.local_db.v1";
var LOCAL_STORAGE_SESSION_KEY = "kiosco.local_session.v1";
function getInitialDbState() {
  return {
    users: [
      { id: 1, name: "Administración", email: "admin@kiosco.local", password: "Admin1234", role: "admin" },
      { id: 2, name: "Alumno demo", email: "alumno@kiosco.local", password: "Alumno1234", role: "cliente" }
    ],
    categories: [
      { id: 1, name: "Golosinas", emoji: "", sortOrder: 1 },
      { id: 2, name: "Bebidas", emoji: "", sortOrder: 2 },
      { id: 3, name: "Salados", emoji: "", sortOrder: 3 },
      { id: 4, name: "Panadería", emoji: "", sortOrder: 4 },
      { id: 5, name: "Helados", emoji: "", sortOrder: 5 }
    ],
    products: [
      { id: 1, name: "Alfajor triple", categoryId: 1, priceCents: 150000, stock: 40, emoji: "", description: "Alfajor de chocolate relleno con dulce de leche.", active: true },
      { id: 2, name: "Chocolate", categoryId: 1, priceCents: 120000, stock: 30, emoji: "", description: "Barra de chocolate con leche.", active: true },
      { id: 3, name: "Chicles", categoryId: 1, priceCents: 50000, stock: 60, emoji: "", description: "Chicles de menta, caja chica.", active: true },
      { id: 4, name: "Caramelos", categoryId: 1, priceCents: 30000, stock: 80, emoji: "", description: "Caramelos surtidos.", active: true },
      { id: 5, name: "Agua mineral", categoryId: 2, priceCents: 90000, stock: 35, emoji: "", description: "Botella de 500 ml sin gas.", active: true },
      { id: 6, name: "Gaseosa", categoryId: 2, priceCents: 140000, stock: 25, emoji: "", description: "Botella de 500 ml.", active: true },
      { id: 7, name: "Jugo natural", categoryId: 2, priceCents: 110000, stock: 20, emoji: "", description: "Jugo de frutas en cajita.", active: true },
      { id: 8, name: "Chocolatada", categoryId: 2, priceCents: 130000, stock: 18, emoji: "", description: "Leche chocolatada de 200 ml.", active: true },
      { id: 9, name: "Papas fritas", categoryId: 3, priceCents: 160000, stock: 22, emoji: "", description: "Bolsa de papas fritas clásicas.", active: true },
      { id: 10, name: "Palitos salados", categoryId: 3, priceCents: 80000, stock: 30, emoji: "", description: "Palitos de queso.", active: true },
      { id: 11, name: "Chizitos", categoryId: 3, priceCents: 90000, stock: 28, emoji: "", description: "Snack de maíz sabor queso.", active: true },
      { id: 12, name: "Medialuna", categoryId: 4, priceCents: 60000, stock: 24, emoji: "", description: "Medialuna de manteca.", active: true },
      { id: 13, name: "Sandwich", categoryId: 4, priceCents: 180000, stock: 12, emoji: "", description: "Sandwich de jamón y queso.", active: true },
      { id: 14, name: "Bizcochuelo", categoryId: 4, priceCents: 1e5, stock: 15, emoji: "", description: "Porción de bizcochuelo casero.", active: true },
      { id: 15, name: "Palito de agua", categoryId: 5, priceCents: 80000, stock: 26, emoji: "", description: "Helado de agua sabor limón.", active: true },
      { id: 16, name: "Helado de crema", categoryId: 5, priceCents: 150000, stock: 16, emoji: "", description: "Cucurucho de crema americana.", active: true }
    ],
    recreos: [
      { id: 1, name: "Primer recreo", startTime: "09:30", endTime: "09:45", active: true, sortOrder: 1 },
      { id: 2, name: "Segundo recreo", startTime: "11:15", endTime: "11:30", active: true, sortOrder: 2 },
      { id: 3, name: "Tercer recreo", startTime: "13:00", endTime: "13:15", active: true, sortOrder: 3 }
    ],
    orders: [
      {
        id: 1,
        code: "K-261101-9X2A",
        userId: 2,
        userName: "Alumno demo",
        userEmail: "alumno@kiosco.local",
        recreoId: 1,
        recreoName: "Primer recreo",
        recreoStartTime: "09:30",
        recreoEndTime: "09:45",
        serviceDate: new Date().toISOString().slice(0, 10),
        status: "listo",
        totalCents: 270000,
        notes: "Sin mayonesa",
        stockRestored: false,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        updatedAt: new Date(Date.now() - 1800000).toISOString(),
        items: [
          { id: 1, orderId: 1, productId: 13, productName: "Sandwich", unitPriceCents: 180000, quantity: 1, subtotalCents: 180000 },
          { id: 2, orderId: 1, productId: 5, productName: "Agua mineral", unitPriceCents: 90000, quantity: 1, subtotalCents: 90000 }
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
    console.error("Error saving local db to localStorage", e);
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
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let rand = "";
  for (let i = 0;i < 4; i++) {
    rand += chars[Math.floor(Math.random() * chars.length)];
  }
  const date = new Date;
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `K-${yy}${mm}${dd}-${rand}`;
}
var localBackend = {
  me() {
    const user = getLocalSession();
    return { user };
  },
  login(email, password) {
    const db = loadLocalDb();
    const user = db.users.find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase());
    if (!user || user.password !== password) {
      throw new ApiError("Credenciales incorrectas.", { status: 401, code: "INVALID_CREDENTIALS" });
    }
    const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
    setLocalSession(safeUser);
    return { user: safeUser };
  },
  register({ name, email, password }) {
    const db = loadLocalDb();
    const cleanEmail = String(email).trim().toLowerCase();
    if (db.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      throw new ApiError("Ya existe una cuenta con ese correo.", { status: 409, code: "EMAIL_IN_USE" });
    }
    const newUser = {
      id: db.usersSeq++,
      name: String(name).trim(),
      email: cleanEmail,
      password: String(password),
      role: "cliente"
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
    if (!session)
      throw new ApiError("No autenticado", { status: 401 });
    const db = loadLocalDb();
    const user = db.users.find((u) => u.id === session.id);
    if (!user || user.password !== currentPassword) {
      throw new ApiError("La contraseña actual es incorrecta.", { status: 401, code: "INVALID_CREDENTIALS" });
    }
    if (!newPassword || newPassword.length < 8) {
      throw new ApiError("La nueva contraseña debe tener al menos 8 caracteres.", { status: 400 });
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
      prods = prods.filter((p) => p.name.toLowerCase().includes(q) || p.description && p.description.toLowerCase().includes(q));
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
    const counts = new Map;
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
    if (!session)
      throw new ApiError("No autenticado", { status: 401 });
    const db = loadLocalDb();
    const orders = db.orders.filter((o) => o.userId === session.id);
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return { orders };
  },
  createOrder({ recreoId, items, notes, paymentMethod }) {
    const session = getLocalSession();
    if (!session)
      throw new ApiError("Iniciá sesión para hacer un pedido.", { status: 401 });
    const db = loadLocalDb();
    const recreo = db.recreos.find((r) => r.id === Number(recreoId) && r.active);
    if (!recreo)
      throw new ApiError("El recreo seleccionado no está habilitado.", { status: 400 });
    if (!Array.isArray(items) || items.length === 0) {
      throw new ApiError("El pedido está vacío.", { status: 400 });
    }
    let totalCents = 0;
    const orderItems = [];
    for (const it of items) {
      const prod = db.products.find((p) => p.id === Number(it.productId) && p.active);
      if (!prod)
        throw new ApiError(`Producto no disponible.`, { status: 400 });
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
      status: "pendiente",
      paymentMethod: paymentMethod || "mercadopago",
      totalCents,
      notes: notes ? String(notes).trim() : "",
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
    if (!session)
      throw new ApiError("No autenticado", { status: 401 });
    const db = loadLocalDb();
    const order = db.orders.find((o) => o.id === Number(id));
    if (!order)
      throw new ApiError("Pedido no encontrado", { status: 404 });
    if (session.role !== "admin" && order.userId !== session.id) {
      throw new ApiError("No tenés permiso para cancelar este pedido.", { status: 403 });
    }
    if (order.status !== "pendiente" && session.role !== "admin") {
      throw new ApiError("Solo podés cancelar pedidos pendientes.", { status: 409 });
    }
    if (order.status === "entregado" || order.status === "cancelado") {
      throw new ApiError("No se puede cancelar un pedido entregado o ya cancelado.", { status: 409 });
    }
    if (!order.stockRestored) {
      for (const it of order.items) {
        const prod = db.products.find((p) => p.id === it.productId);
        if (prod)
          prod.stock += it.quantity;
      }
      order.stockRestored = true;
    }
    order.status = "cancelado";
    order.updatedAt = new Date().toISOString();
    saveLocalDb(db);
    return { order };
  },
  admin: {
    getProducts({ search, categoryId } = {}) {
      const db = loadLocalDb();
      const catMap = new Map(db.categories.map((c) => [c.id, c]));
      let prods = db.products;
      if (categoryId)
        prods = prods.filter((p) => p.categoryId === Number(categoryId));
      if (search) {
        const q = String(search).toLowerCase();
        prods = prods.filter((p) => p.name.toLowerCase().includes(q) || p.description && p.description.toLowerCase().includes(q));
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
        description: payload.description ? String(payload.description).trim() : "",
        categoryId: Number(payload.categoryId) || null,
        priceCents: Number(payload.priceCents) || 0,
        stock: Number(payload.stock) || 0,
        emoji: payload.emoji || "",
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
      if (!p)
        throw new ApiError("Producto no encontrado", { status: 404 });
      if (payload.name)
        p.name = String(payload.name).trim();
      if (payload.description !== undefined)
        p.description = String(payload.description).trim();
      if (payload.categoryId !== undefined)
        p.categoryId = Number(payload.categoryId) || null;
      if (payload.priceCents !== undefined)
        p.priceCents = Number(payload.priceCents);
      if (payload.stock !== undefined)
        p.stock = Number(payload.stock);
      if (payload.emoji)
        p.emoji = payload.emoji;
      if (payload.active !== undefined)
        p.active = Boolean(payload.active);
      p.updatedAt = new Date().toISOString();
      saveLocalDb(db);
      return { product: p };
    },
    updateStock(id, { stock, delta }) {
      const db = loadLocalDb();
      const p = db.products.find((item) => item.id === Number(id));
      if (!p)
        throw new ApiError("Producto no encontrado", { status: 404 });
      if (stock !== undefined)
        p.stock = Math.max(0, Number(stock));
      else if (delta !== undefined)
        p.stock = Math.max(0, p.stock + Number(delta));
      p.updatedAt = new Date().toISOString();
      saveLocalDb(db);
      return { product: p };
    },
    deleteProduct(id) {
      const db = loadLocalDb();
      const hasOrders = db.orders.some((o) => o.items && o.items.some((it) => it.productId === Number(id)));
      if (hasOrders) {
        const p = db.products.find((item) => item.id === Number(id));
        if (p)
          p.active = false;
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
        emoji: payload.emoji || "",
        sortOrder: Number(payload.sortOrder) || db.categories.length + 1
      };
      db.categories.push(newCat);
      saveLocalDb(db);
      return { category: newCat };
    },
    updateCategory(id, payload) {
      const db = loadLocalDb();
      const c = db.categories.find((item) => item.id === Number(id));
      if (!c)
        throw new ApiError("Categoría no encontrada", { status: 404 });
      if (payload.name)
        c.name = String(payload.name).trim();
      if (payload.emoji)
        c.emoji = payload.emoji;
      if (payload.sortOrder !== undefined)
        c.sortOrder = Number(payload.sortOrder);
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
      if (!r)
        throw new ApiError("Recreo no encontrado", { status: 404 });
      if (payload.name)
        r.name = String(payload.name).trim();
      if (payload.startTime)
        r.startTime = String(payload.startTime).trim();
      if (payload.endTime)
        r.endTime = String(payload.endTime).trim();
      if (payload.active !== undefined)
        r.active = Boolean(payload.active);
      if (payload.sortOrder !== undefined)
        r.sortOrder = Number(payload.sortOrder);
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
      if (status)
        orders = orders.filter((o) => o.status === status);
      if (recreoId)
        orders = orders.filter((o) => o.recreoId === Number(recreoId));
      if (date && date !== "all")
        orders = orders.filter((o) => o.serviceDate === date);
      orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return { orders };
    },
    updateOrderStatus(id, status) {
      const db = loadLocalDb();
      const order = db.orders.find((o) => o.id === Number(id));
      if (!order)
        throw new ApiError("Pedido no encontrado", { status: 404 });
      if (status === "cancelado" && order.status !== "cancelado") {
        if (!order.stockRestored) {
          for (const it of order.items) {
            const prod = db.products.find((p) => p.id === it.productId);
            if (prod)
              prod.stock += it.quantity;
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
      const activeOrders = ordersToday.filter((o) => o.status !== "cancelado");
      const revenueCents = activeOrders.reduce((sum, o) => sum + o.totalCents, 0);
      const inProgress = ordersToday.filter((o) => o.status === "pendiente" || o.status === "preparando").length;
      const ready = ordersToday.filter((o) => o.status === "listo").length;
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
var isFileProtocol = typeof window !== "undefined" && window.location.protocol === "file:";
async function request(path, { method = "GET", body } = {}) {
  if (isFileProtocol) {
    return handleLocalFallback(path, method, body);
  }
  const init = {
    method,
    credentials: "same-origin",
    headers: { Accept: "application/json" }
  };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const controller = new AbortController;
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    let response;
    try {
      response = await fetch(BASE_URL + path, { ...init, signal: controller.signal });
    } catch (error) {
      console.warn(`[API] Falló conexión con servidor HTTP (${path}). Usando almacenamiento local.`);
      return handleLocalFallback(path, method, body);
    }
    const contentType = response.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");
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
      throw new ApiError(error.message ?? "Ocurrió un error inesperado.", {
        status: response.status,
        code: error.code ?? "ERROR",
        details: error.details ?? null
      });
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}
function handleLocalFallback(path, method, body) {
  const [routePath, queryString] = path.split("?");
  const params = Object.fromEntries(new URLSearchParams(queryString || ""));
  if (routePath === "/auth/me")
    return localBackend.me();
  if (routePath === "/auth/login")
    return localBackend.login(body.email, body.password);
  if (routePath === "/auth/register")
    return localBackend.register(body);
  if (routePath === "/auth/logout")
    return localBackend.logout();
  if (routePath === "/auth/password" && method === "PUT")
    return localBackend.changePassword(body.currentPassword, body.newPassword);
  if (routePath === "/products")
    return localBackend.getProducts(params);
  if (routePath === "/categories")
    return localBackend.getCategories();
  if (routePath === "/recreos")
    return localBackend.getRecreos();
  if (routePath === "/orders") {
    if (method === "POST")
      return localBackend.createOrder(body);
    return localBackend.getMyOrders();
  }
  const cancelMatch = routePath.match(/^\/orders\/(\d+)\/cancel$/);
  if (cancelMatch)
    return localBackend.cancelOrder(Number(cancelMatch[1]));
  if (routePath === "/admin/products") {
    if (method === "POST")
      return localBackend.admin.createProduct(body);
    return localBackend.admin.getProducts(params);
  }
  const prodStockMatch = routePath.match(/^\/admin\/products\/(\d+)\/stock$/);
  if (prodStockMatch)
    return localBackend.admin.updateStock(Number(prodStockMatch[1]), body);
  const prodMatch = routePath.match(/^\/admin\/products\/(\d+)$/);
  if (prodMatch) {
    if (method === "PUT")
      return localBackend.admin.updateProduct(Number(prodMatch[1]), body);
    if (method === "DELETE")
      return localBackend.admin.deleteProduct(Number(prodMatch[1]));
  }
  if (routePath === "/admin/categories") {
    if (method === "POST")
      return localBackend.admin.createCategory(body);
    return localBackend.admin.getCategories();
  }
  const catMatch = routePath.match(/^\/admin\/categories\/(\d+)$/);
  if (catMatch) {
    if (method === "PUT")
      return localBackend.admin.updateCategory(Number(catMatch[1]), body);
    if (method === "DELETE")
      return localBackend.admin.deleteCategory(Number(catMatch[1]));
  }
  if (routePath === "/admin/recreos") {
    if (method === "POST")
      return localBackend.admin.createRecreo(body);
    return localBackend.admin.getRecreos();
  }
  const recMatch = routePath.match(/^\/admin\/recreos\/(\d+)$/);
  if (recMatch) {
    if (method === "PUT")
      return localBackend.admin.updateRecreo(Number(recMatch[1]), body);
    if (method === "DELETE")
      return localBackend.admin.deleteRecreo(Number(recMatch[1]));
  }
  if (routePath === "/admin/orders")
    return localBackend.admin.getOrders(params);
  const orderStatusMatch = routePath.match(/^\/admin\/orders\/(\d+)\/status$/);
  if (orderStatusMatch)
    return localBackend.admin.updateOrderStatus(Number(orderStatusMatch[1]), body.status);
  if (routePath === "/admin/stats")
    return localBackend.admin.getStats();
  if (routePath === "/admin/users")
    return localBackend.admin.getUsers();
  if (routePath.match(/^\/orders\/\d+\/pay$/)) {
    throw new ApiError("Los pagos no están disponibles en modo local.", { status: 503 });
  }
  if (routePath.match(/^\/orders\/\d+\/payment$/)) {
    return { payment: null };
  }
  throw new ApiError(`Ruta no encontrada: ${path}`, { status: 404 });
}
function toQuery(params = {}) {
  const search = new URLSearchParams;
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "")
      search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}
var api = {
  me: () => request("/auth/me"),
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),
  register: (payload) => request("/auth/register", { method: "POST", body: payload }),
  logout: () => request("/auth/logout", { method: "POST" }),
  changePassword: (payload) => request("/auth/password", { method: "PUT", body: payload }),
  getProducts: (params = {}) => request(`/products${toQuery(params)}`),
  getCategories: () => request("/categories"),
  getRecreos: () => request("/recreos"),
  getMyOrders: () => request("/orders"),
  createOrder: (payload) => request("/orders", { method: "POST", body: payload }),
  cancelOrder: (id) => request(`/orders/${id}/cancel`, { method: "POST" }),
  createPayment: (id) => request(`/orders/${id}/pay`, { method: "POST" }),
  getPaymentStatus: (id) => request(`/orders/${id}/payment`),
  admin: {
    getProducts: (params = {}) => request(`/admin/products${toQuery(params)}`),
    createProduct: (payload) => request("/admin/products", { method: "POST", body: payload }),
    updateProduct: (id, payload) => request(`/admin/products/${id}`, { method: "PUT", body: payload }),
    updateStock: (id, payload) => request(`/admin/products/${id}/stock`, { method: "PATCH", body: payload }),
    deleteProduct: (id) => request(`/admin/products/${id}`, { method: "DELETE" }),
    getCategories: () => request("/admin/categories"),
    createCategory: (payload) => request("/admin/categories", { method: "POST", body: payload }),
    updateCategory: (id, payload) => request(`/admin/categories/${id}`, { method: "PUT", body: payload }),
    deleteCategory: (id) => request(`/admin/categories/${id}`, { method: "DELETE" }),
    getRecreos: () => request("/admin/recreos"),
    createRecreo: (payload) => request("/admin/recreos", { method: "POST", body: payload }),
    updateRecreo: (id, payload) => request(`/admin/recreos/${id}`, { method: "PUT", body: payload }),
    deleteRecreo: (id) => request(`/admin/recreos/${id}`, { method: "DELETE" }),
    getOrders: (params = {}) => request(`/admin/orders${toQuery(params)}`),
    updateOrderStatus: (id, status) => request(`/admin/orders/${id}/status`, { method: "PATCH", body: { status } }),
    updatePaymentStatus: (id, status) => request(`/admin/orders/${id}/payment`, { method: "PATCH", body: { status } }),
    getStats: () => request("/admin/stats"),
    getUsers: () => request("/admin/users"),
    deleteUser: (id) => request(`/admin/users/${id}`, { method: "DELETE" })
  }
};

// public/js/utils.js
var currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});
function money(cents) {
  return currencyFormatter.format((Number(cents) || 0) / 100);
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
function formatDate(iso) {
  if (!iso)
    return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime()))
    return "";
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}
function formatTime(iso) {
  if (!iso)
    return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime()))
    return "";
  return date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}
function formatDateTime(iso) {
  if (!iso)
    return "";
  return `${formatDate(iso)} · ${formatTime(iso)}`;
}
function formatLongDate(isoDate) {
  if (!isoDate)
    return "";
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}
var STATUS_META = {
  pendiente: { label: "Pendiente", tone: "amber", icon: "", step: 1 },
  preparando: { label: "En preparación", tone: "blue", icon: "‍", step: 2 },
  listo: { label: "Listo para retirar", tone: "green", icon: "", step: 3 },
  entregado: { label: "Entregado", tone: "slate", icon: "", step: 4 },
  cancelado: { label: "Cancelado", tone: "red", icon: "", step: 0 }
};
function statusBadge(status) {
  const meta = STATUS_META[status] ?? { label: status, tone: "slate", icon: "•" };
  return `<span class="badge badge-${meta.tone}"><span class="badge-dot"></span>${escapeHtml(meta.label)}</span>`;
}
function stockLabel(stock) {
  if (stock <= 0)
    return { label: "Sin stock", tone: "red" };
  if (stock <= 5)
    return { label: `Últimas ${stock}`, tone: "amber" };
  return { label: "Disponible", tone: "green" };
}
function initials(name) {
  return String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}
function todayISO() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date);
  const get = (type) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// public/js/ui.js
function toast(message, tone = "success", timeout = 4000) {
  const host = document.getElementById("toast-root");
  if (!host)
    return;
  const element = document.createElement("div");
  element.className = `toast toast-${tone}`;
  element.innerHTML = `<span class="toast-icon">${tone === "success" ? "" : tone === "error" ? "!" : "i"}</span><span class="toast-text">${escapeHtml(message)}</span>`;
  host.appendChild(element);
  requestAnimationFrame(() => element.classList.add("is-visible"));
  setTimeout(() => {
    element.classList.remove("is-visible");
    setTimeout(() => element.remove(), 260);
  }, timeout);
}
function openModal({ title, subtitle = "", content = "", footer = "", size = "" }) {
  const root = document.getElementById("modal-root");
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <header class="modal-head">
        <div>
          <h2>${escapeHtml(title)}</h2>
          ${subtitle ? `<p class="modal-subtitle">${escapeHtml(subtitle)}</p>` : ""}
        </div>
        <button type="button" class="icon-btn" data-close aria-label="Cerrar"></button>
      </header>
      <div class="modal-body">${content}</div>
      ${footer ? `<footer class="modal-foot">${footer}</footer>` : ""}
    </div>
  `;
  root.appendChild(overlay);
  document.body.classList.add("modal-open");
  let closed = false;
  const close = () => {
    if (closed)
      return;
    closed = true;
    overlay.classList.remove("is-visible");
    document.body.classList.remove("modal-open");
    setTimeout(() => overlay.remove(), 200);
    document.removeEventListener("keydown", onKey);
  };
  function onKey(event) {
    if (event.key === "Escape")
      close();
  }
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.closest("[data-close]"))
      close();
  });
  document.addEventListener("keydown", onKey);
  requestAnimationFrame(() => overlay.classList.add("is-visible"));
  return { root: overlay, close };
}
function confirmAction({
  title = "Confirmar accion",
  message = "",
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  danger = false
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled)
        return;
      settled = true;
      resolve(value);
    };
    const modal = openModal({
      title,
      content: `<p class="confirm-text">${escapeHtml(message)}</p>`,
      size: "modal-sm",
      footer: `
        <button type="button" class="btn btn-ghost" data-close>${escapeHtml(cancelText)}</button>
        <button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"}" data-confirm>${escapeHtml(confirmText)}</button>
      `
    });
    modal.root.querySelector("[data-confirm]").addEventListener("click", () => {
      finish(true);
      modal.close();
    });
    modal.root.querySelectorAll("[data-close]").forEach((button) => {
      button.addEventListener("click", () => finish(false));
    });
    modal.root.addEventListener("click", (event) => {
      if (event.target === modal.root)
        finish(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape")
        finish(false);
    }, { once: true });
  });
}
function spinnerBlock(text = "Cargando...") {
  return `
    <div class="loading-block">
      <span class="spinner"></span>
      <p>${escapeHtml(text)}</p>
    </div>
  `;
}
function emptyState({ icon = "", title = "Nada por aquí", text = "", action = "" } = {}) {
  return `
    <div class="empty-state">
      <span class="empty-icon">${icon}</span>
      <h3>${escapeHtml(title)}</h3>
      ${text ? `<p>${escapeHtml(text)}</p>` : ""}
      ${action}
    </div>
  `;
}
function errorBlock(message, retryAction = "retry") {
  return `
    <div class="error-block">
      <span class="empty-icon"></span>
      <h3>Algo salió mal</h3>
      <p>${escapeHtml(message)}</p>
      <button class="btn btn-primary" data-action="${retryAction}">Reintentar</button>
    </div>
  `;
}
function setButtonLoading(button, loading, loadingText = "Guardando...") {
  if (!button)
    return;
  if (loading) {
    button.dataset.originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spinner spinner-sm"></span>${escapeHtml(loadingText)}`;
  } else {
    button.disabled = false;
    if (button.dataset.originalText) {
      button.innerHTML = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  }
}

// public/js/views/auth.js
function renderAuth(app, container) {
  container.innerHTML = `
    <section class="auth">
      <div class="auth-brand">
        <a class="brand brand-light" href="#/">
          <span class="brand-mark"></span>
          <span class="brand-text">
            <strong>Kiosco del Recreo</strong>
            <small>Pedidos, stock y recreos</small>
          </span>
        </a>

        <div class="auth-pitch">
          <h1>Tu merienda,<br />sin hacer fila.</h1>
          <p>Consultá el catálogo, reservá lo que querés y elegí en qué recreo lo retirás.</p>
          <ul class="auth-points">
            <li><span></span> Productos, precios y stock actualizados</li>
            <li><span></span> Pedidos organizados por recreo</li>
            <li><span></span> Seguí el estado de tu pedido</li>
          </ul>
        </div>

        <div class="auth-demo">
          <p class="auth-demo-title">Cuentas de prueba</p>
          <button type="button" class="demo-chip" data-fill-demo="admin">
            <span>‍</span>
            <span><strong>Administración</strong><small>admin@kiosco.local · Admin1234</small></span>
          </button>
          <button type="button" class="demo-chip" data-fill-demo="student">
            <span></span>
            <span><strong>Alumno demo</strong><small>alumno@kiosco.local · Alumno1234</small></span>
          </button>
        </div>
      </div>

      <div class="auth-panel">
        <div class="auth-card">
          <div class="auth-tabs" role="tablist">
            <button type="button" class="auth-tab is-active" data-mode="login" role="tab">Ingresar</button>
            <button type="button" class="auth-tab" data-mode="register" role="tab">Crear cuenta</button>
          </div>

          <div class="auth-google">
            <a class="btn btn-google btn-block" href="/api/auth/google">
              <span class="btn-google-icon">G</span> Continuar con Google
            </a>
            <p class="auth-google-note">Usá tu cuenta de Google para ingresar o registrarte.</p>
          </div>

          <div class="auth-divider">o</div>

          <form id="auth-form" class="form" novalidate>
            <div class="field" data-field="name" hidden>
              <label for="auth-name">Nombre y apellido</label>
              <input id="auth-name" name="name" autocomplete="name" placeholder="Ana Pérez" maxlength="60" />
              <span class="field-error" data-error="name"></span>
            </div>

            <div class="field">
              <label for="auth-email">Correo electrónico</label>
              <input id="auth-email" name="email" type="email" autocomplete="email" placeholder="vos@escuela.edu.ar" maxlength="160" required />
              <span class="field-error" data-error="email"></span>
            </div>

            <div class="field">
              <label for="auth-password">Contraseña</label>
              <input id="auth-password" name="password" type="password" autocomplete="current-password" placeholder="Mínimo 8 caracteres" maxlength="128" required />
              <span class="field-error" data-error="password"></span>
            </div>

            <p class="form-error" data-form-error hidden></p>

            <button type="submit" class="btn btn-primary btn-block" id="auth-submit">Ingresar</button>
            <p class="auth-note" data-auth-note>¿Primera vez? Creá tu cuenta de alumno en segundos.</p>
          </form>
        </div>

        <p class="auth-foot">Kiosco del Recreo · Etapa 1 · Frontend + API + Backend + Base de datos</p>
      </div>
    </section>
  `;
  const form = container.querySelector("#auth-form");
  const nameField = container.querySelector('[data-field="name"]');
  const nameInput = container.querySelector("#auth-name");
  const emailInput = container.querySelector("#auth-email");
  const passwordInput = container.querySelector("#auth-password");
  const submitButton = container.querySelector("#auth-submit");
  const formError = container.querySelector("[data-form-error]");
  const note = container.querySelector("[data-auth-note]");
  const tabs = [...container.querySelectorAll(".auth-tab")];
  let mode = "login";
  function setMode(nextMode) {
    mode = nextMode;
    tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.mode === mode));
    nameField.hidden = mode !== "register";
    nameInput.required = mode === "register";
    submitButton.textContent = mode === "register" ? "Crear cuenta" : "Ingresar";
    passwordInput.autocomplete = mode === "register" ? "new-password" : "current-password";
    note.textContent = mode === "register" ? "Tu cuenta se crea como alumno. El acceso de administración lo asigna el kiosco." : "¿Primera vez? Creá tu cuenta de alumno en segundos.";
    clearErrors();
  }
  function clearErrors() {
    formError.hidden = true;
    formError.textContent = "";
    container.querySelectorAll("[data-error]").forEach((element) => {
      element.textContent = "";
    });
    container.querySelectorAll(".field input").forEach((input) => input.classList.remove("is-invalid"));
  }
  function showErrors(error) {
    const details = error.details ?? {};
    for (const [field, message] of Object.entries(details)) {
      const target = container.querySelector(`[data-error="${field}"]`);
      if (target) {
        target.textContent = message;
        target.closest(".field")?.querySelector("input")?.classList.add("is-invalid");
      }
    }
    if (Object.keys(details).length === 0) {
      formError.textContent = error.message;
      formError.hidden = false;
    }
  }
  tabs.forEach((tab) => tab.addEventListener("click", () => setMode(tab.dataset.mode)));
  container.querySelectorAll("[data-fill-demo]").forEach((button) => {
    button.addEventListener("click", () => {
      const isAdmin = button.dataset.fillDemo === "admin";
      setMode("login");
      emailInput.value = isAdmin ? "admin@kiosco.local" : "alumno@kiosco.local";
      passwordInput.value = isAdmin ? "Admin1234" : "Alumno1234";
      emailInput.focus();
    });
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email) {
      emailInput.classList.add("is-invalid");
      container.querySelector('[data-error="email"]').textContent = "Ingresá tu correo.";
      emailInput.focus();
      return;
    }
    if (!password) {
      passwordInput.classList.add("is-invalid");
      container.querySelector('[data-error="password"]').textContent = "Ingresá tu contraseña.";
      passwordInput.focus();
      return;
    }
    if (mode === "register" && password.length < 8) {
      passwordInput.classList.add("is-invalid");
      container.querySelector('[data-error="password"]').textContent = "Usá al menos 8 caracteres.";
      passwordInput.focus();
      return;
    }
    setButtonLoading(submitButton, true, mode === "register" ? "Creando cuenta..." : "Ingresando...");
    try {
      const result = mode === "register" ? await api.register({ name: nameInput.value.trim(), email, password }) : await api.login(email, password);
      toast(`¡Hola, ${result.user.name.split(" ")[0]}!`, "success");
      await app.onAuthenticated(result.user);
    } catch (error) {
      showErrors(error);
      if (!error.details || Object.keys(error.details).length === 0) {
        formError.textContent = error.message;
        formError.hidden = false;
      }
      toast(error.message, "error");
    } finally {
      setButtonLoading(submitButton, false);
    }
  });
  emailInput.focus();
}

// public/js/views/catalog.js
function productCard(app, product) {
  const inCart = app.cartQuantity(product.id);
  const stock = stockLabel(product.stock);
  const canAdd = product.stock > 0 && inCart < product.stock;
  return `
    <article class="product-card" data-card="${product.id}">
      <div class="product-media">
        <span class="product-emoji" aria-hidden="true">${escapeHtml(product.emoji || "")}</span>
        <span class="stock-pill stock-${stock.tone}"><span class="stock-dot"></span>${escapeHtml(stock.label)}</span>
      </div>
      <div class="product-body">
        <p class="product-category">${escapeHtml(product.categoryEmoji ?? "")} ${escapeHtml(product.categoryName ?? "Sin categoría")}</p>
        <h3 class="product-name">${escapeHtml(product.name)}</h3>
        <p class="product-desc">${escapeHtml(product.description || "")}</p>
      </div>
      <div class="product-footer">
        <span class="price">${money(product.priceCents)}</span>
        <button
          type="button"
          class="btn btn-primary btn-sm add-btn"
          data-action="add-to-cart"
          data-id="${product.id}"
          ${canAdd ? "" : "disabled"}
        >
          ${product.stock <= 0 ? "Sin stock" : "Agregar"}
        </button>
      </div>
      <p class="in-cart" data-card-qty="${product.id}">${inCart > 0 ? `${inCart} en tu pedido` : ""}</p>
    </article>
  `;
}
function renderCatalog(app, container) {
  const { products, categories, recreos, user } = app.state;
  const filters = app.state.catalogFilters;
  const firstName = String(user?.name ?? "").split(" ")[0] || "hola";
  container.innerHTML = `
    <section class="catalog">
      <div class="hero">
        <div class="hero-copy">
          <p class="eyebrow">Kiosco abierto</p>
          <h1>¡Hola, ${escapeHtml(firstName)}! </h1>
          <p class="hero-text">Elegí tus productos, sumalos al carrito y reservalos para el recreo que quieras.</p>
          <div class="hero-recreos">
            ${recreos.map((recreo) => `
                <span class="recreo-chip">
                  <span class="recreo-dot"></span>
                  <strong>${escapeHtml(recreo.name)}</strong>
                  <span>${escapeHtml(recreo.startTime)}–${escapeHtml(recreo.endTime)}</span>
                </span>`).join("")}
            ${recreos.length === 0 ? '<span class="recreo-chip is-muted">No hay recreos habilitados</span>' : ""}
          </div>
        </div>
        <div class="hero-art" aria-hidden="true">
          <span class="float-emoji emoji-1"></span>
          <span class="float-emoji emoji-2"></span>
          <span class="float-emoji emoji-3"></span>
          <span class="hero-bag"></span>
        </div>
      </div>

      <div class="catalog-toolbar">
        <label class="search-field">
          <span aria-hidden="true"></span>
          <input
            id="product-search"
            type="search"
            placeholder="Buscar alfajor, gaseosa, sandwich..."
            autocomplete="off"
            value="${escapeHtml(filters.search)}"
          />
        </label>
        <button type="button" class="btn btn-soft cart-inline-btn" data-action="open-cart">
           Mi pedido
          <span class="cart-inline-count" data-cart-count>${app.cartCount()}</span>
        </button>
      </div>

      <div id="catalog-results"></div>
    </section>
  `;
  const results = container.querySelector("#catalog-results");
  const searchInput = container.querySelector("#product-search");
  function filteredProducts() {
    const search = filters.search.trim().toLowerCase();
    return products.filter((product) => {
      if (filters.categoryId && product.categoryId !== filters.categoryId)
        return false;
      if (!search)
        return true;
      return product.name.toLowerCase().includes(search) || (product.description ?? "").toLowerCase().includes(search) || (product.categoryName ?? "").toLowerCase().includes(search);
    });
  }
  function paint() {
    const visible = filteredProducts();
    const categoryChips = [
      `<button type="button" class="chip ${filters.categoryId === null ? "is-active" : ""}" data-category="">Todos</button>`,
      ...categories.map((category) => `
          <button type="button" class="chip ${filters.categoryId === category.id ? "is-active" : ""}" data-category="${category.id}">
            <span aria-hidden="true">${escapeHtml(category.emoji)}</span> ${escapeHtml(category.name)}
          </button>`)
    ].join("");
    results.innerHTML = `
      <div class="chip-row" role="group" aria-label="Filtrar por categoría">${categoryChips}</div>
      <div class="results-meta">
        <span>${visible.length} ${visible.length === 1 ? "producto" : "productos"}</span>
        ${filters.search ? `<button type="button" class="link-btn" data-clear-search>Limpiar búsqueda</button>` : ""}
      </div>
      ${visible.length > 0 ? `<div class="product-grid">${visible.map((product) => productCard(app, product)).join("")}</div>` : emptyState({
      icon: "",
      title: "No encontramos productos",
      text: "Probá con otra búsqueda o elegí otra categoría."
    })}
    `;
  }
  paint();
  results.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-category]");
    if (chip) {
      filters.categoryId = chip.dataset.category ? Number(chip.dataset.category) : null;
      paint();
      return;
    }
    if (event.target.closest("[data-clear-search]")) {
      filters.search = "";
      searchInput.value = "";
      paint();
      searchInput.focus();
    }
  });
  let searchTimer;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      filters.search = searchInput.value;
      paint();
    }, 180);
  });
}
function syncCatalogCards(app) {
  document.querySelectorAll("[data-card]").forEach((card) => {
    const productId = Number(card.dataset.card);
    const product = app.state.products.find((item) => item.id === productId);
    const quantity = app.cartQuantity(productId);
    const badge = card.querySelector(`[data-card-qty="${productId}"]`);
    if (badge)
      badge.textContent = quantity > 0 ? `${quantity} en tu pedido` : "";
    const button = card.querySelector('[data-action="add-to-cart"]');
    if (button && product) {
      button.disabled = product.stock <= 0 || quantity >= product.stock;
    }
  });
}

// public/js/views/orders.js
var STEPS = [
  { key: "pendiente", label: "Pedido recibido" },
  { key: "preparando", label: "En preparación" },
  { key: "listo", label: "Listo para retirar" },
  { key: "entregado", label: "Entregado" }
];
function renderTimeline(order) {
  if (order.status === "cancelado") {
    return `<p class="order-cancelled"> Pedido cancelado · el stock fue devuelto al kiosco</p>`;
  }
  const currentStep = STATUS_META[order.status]?.step ?? 1;
  return `
    <ol class="timeline">
      ${STEPS.map((step, index) => {
    const position = index + 1;
    const classes = ["timeline-step"];
    if (position <= currentStep)
      classes.push("is-done");
    if (position === currentStep)
      classes.push("is-current");
    return `<li class="${classes.join(" ")}"><span class="timeline-dot">${position <= currentStep ? "" : position}</span><span class="timeline-label">${step.label}</span></li>`;
  }).join("")}
    </ol>
  `;
}
function renderOrderCard(order) {
  return `
    <article class="order-card" data-order-card="${order.id}">
      <header class="order-head">
        <div>
          <p class="order-code">${escapeHtml(order.code)}</p>
          <p class="order-when">
            ${escapeHtml(order.recreoName ?? "Recreo")} · ${escapeHtml(order.recreoStartTime ?? "")}–${escapeHtml(order.recreoEndTime ?? "")}
            · ${escapeHtml(formatLongDate(order.serviceDate))}
          </p>
        </div>
        ${statusBadge(order.status)}
      </header>

      <div class="order-body">
        <ul class="order-items">
          ${order.items.map((item) => `
              <li>
                <span class="order-item-qty">${item.quantity}×</span>
                <span class="order-item-name">${escapeHtml(item.productName)}</span>
                <span class="order-item-amount">${money(item.subtotalCents)}</span>
              </li>`).join("")}
        </ul>
        ${order.notes ? `<p class="order-notes"> ${escapeHtml(order.notes)}</p>` : ""}
        ${renderTimeline(order)}
      </div>

      <footer class="order-foot">
        <div class="order-total"><span>Total</span><strong>${money(order.totalCents)}</strong></div>
        <div class="order-actions">
          <span class="order-time">Creado ${escapeHtml(formatDateTime(order.createdAt))}</span>
          ${order.paymentStatus && order.paymentStatus !== "unpaid" ? `<span class="badge badge-plain">Pago: ${escapeHtml(order.paymentStatus)}</span>` : ""}
          ${order.paymentMethod === "cash" ? `<span class="badge badge-plain">Pago en efectivo</span>` : order.status === "pendiente" && (!order.paymentStatus || order.paymentStatus === "unpaid" || order.paymentStatus === "rejected") ? `<button type="button" class="btn btn-primary btn-sm" data-action="pay-order" data-id="${order.id}">Pagar</button>` : ""}
          ${order.status === "pendiente" ? `<button type="button" class="btn btn-ghost btn-sm" data-action="cancel-order" data-id="${order.id}">Cancelar pedido</button>` : ""}
        </div>
      </footer>
    </article>
  `;
}
async function renderOrders(app, container) {
  container.innerHTML = `
    <section class="orders">
      <header class="page-head">
        <div>
          <p class="eyebrow">Tus reservas</p>
          <h1>Mis pedidos</h1>
          <p class="page-sub">Seguí el estado de cada pedido. La lista se actualiza sola cada 20 segundos.</p>
        </div>
        <button type="button" class="btn btn-soft" data-action="open-cart"> Armar otro pedido</button>
      </header>
      <div id="orders-list">${spinnerBlock("Cargando tus pedidos...")}</div>
    </section>
  `;
  const list = container.querySelector("#orders-list");
  function paint() {
    const { orders } = app.state;
    if (!orders.length) {
      list.innerHTML = emptyState({
        icon: "",
        title: "Todavía no hiciste pedidos",
        text: "Armá tu pedido, elegí el recreo y seguí su estado desde acá.",
        action: '<button type="button" class="btn btn-primary" data-action="open-cart">Ver el catálogo</button>'
      });
      return;
    }
    list.innerHTML = `<div class="orders-grid">${orders.map(renderOrderCard).join("")}</div>`;
  }
  async function load() {
    try {
      await app.loadOrders();
      paint();
    } catch (error) {
      list.innerHTML = errorBlock(error.message, "refresh-orders");
    }
  }
  await load();
  app.poll(load, 20000);
}

// public/js/views/admin.js
var TABS = [
  { id: "resumen", label: "Resumen", icon: "" },
  { id: "productos", label: "Productos", icon: "" },
  { id: "pedidos", label: "Pedidos", icon: "" },
  { id: "recreos", label: "Recreos", icon: "" },
  { id: "categorias", label: "Categorías", icon: "" },
  { id: "usuarios", label: "Usuarios", icon: "" }
];
var filters = {
  productsSearch: "",
  orders: { status: "", recreoId: "", date: todayISO() }
};
var cache = {
  products: [],
  categories: [],
  recreos: [],
  orders: []
};
var NEXT_STATUS = {
  pendiente: [
    { status: "preparando", label: "Empezar preparación", className: "btn-primary" },
    { status: "listo", label: "Marcar listo", className: "btn-soft" }
  ],
  preparando: [{ status: "listo", label: "Marcar listo", className: "btn-primary" }],
  listo: [{ status: "entregado", label: "Entregar", className: "btn-primary" }],
  entregado: [],
  cancelado: []
};
async function run(main, loader) {
  main.innerHTML = spinnerBlock("Cargando información...");
  try {
    await loader();
  } catch (error) {
    main.innerHTML = errorBlock(error.message);
  }
}
function statCard(label, value, icon, note = "") {
  return `
    <article class="stat-card">
      <span class="stat-icon" aria-hidden="true">${icon}</span>
      <div>
        <p class="stat-label">${escapeHtml(label)}</p>
        <p class="stat-value">${escapeHtml(String(value))}</p>
        ${note ? `<p class="stat-note">${escapeHtml(note)}</p>` : ""}
      </div>
    </article>
  `;
}
async function renderAdmin(app, container, activeTab = "resumen") {
  const tab = TABS.some((item) => item.id === activeTab) ? activeTab : "resumen";
  container.innerHTML = `
    <section class="admin">
      <aside class="admin-side">
        <div class="admin-brand">
          <span class="admin-brand-icon">‍</span>
          <div>
            <strong>Administración</strong>
            <small>Kiosco del Recreo</small>
          </div>
        </div>
        <nav class="admin-nav" aria-label="Secciones de administración">
          ${TABS.map((item) => `
            <a class="admin-nav-link ${item.id === tab ? "is-active" : ""}" href="#/admin/${item.id}">
              <span aria-hidden="true">${item.icon}</span> ${item.label}
            </a>`).join("")}
        </nav>
        <div class="admin-side-foot">
          <p>Gestioná el catálogo, el stock y los pedidos del kiosco.</p>
          <a class="link-btn" href="#/catalogo">← Volver al catálogo</a>
        </div>
      </aside>

      <div class="admin-main" id="admin-main"></div>
    </section>
  `;
  const main = container.querySelector("#admin-main");
  main.addEventListener("click", (event) => {
    handleAdminClick(event, { app, main, tab }).catch((error) => {
      toast(error.message, "error");
    });
  });
  main.addEventListener("change", (event) => {
    handleAdminChange(event, { app, main, tab }).catch((error) => toast(error.message, "error"));
  });
  await paint(tab, main, app);
}
async function paint(tab, main, app) {
  if (tab === "resumen")
    return paintResumen(main, app);
  if (tab === "productos")
    return paintProductos(main, app);
  if (tab === "pedidos")
    return paintPedidos(main, app);
  if (tab === "recreos")
    return paintRecreos(main, app);
  if (tab === "categorias")
    return paintCategorias(main, app);
  return paintUsuarios(main, app);
}
async function paintResumen(main, app) {
  await run(main, async () => {
    const { stats } = await api.admin.getStats();
    main.innerHTML = `
      <header class="page-head">
        <div>
          <p class="eyebrow">Panel de administración</p>
          <h1>Resumen de hoy</h1>
          <p class="page-sub">${escapeHtml(formatLongDate(stats.serviceDate))}</p>
        </div>
        <button type="button" class="btn btn-soft" data-action="refresh">↻ Actualizar</button>
      </header>

      <div class="stat-grid">
        ${statCard("Pedidos de hoy", stats.ordersToday, "", `${stats.byStatus.pendiente.count} pendientes`)}
        ${statCard("En curso", stats.activeOrders, "", "para preparar o retirar")}
        ${statCard("Recaudado hoy", money(stats.deliveredTodayCents), "", "pedidos entregados")}
        ${statCard("Stock bajo", stats.lowStock.length, "", "productos con 5 o menos")}
      </div>

      <div class="admin-grid">
        <section class="panel panel-wide">
          <header class="panel-head">
            <h2>Pedidos recientes</h2>
            <a class="link-btn" href="#/admin/pedidos">Ver todos →</a>
          </header>
          ${stats.recentOrders.length ? `<div class="table-scroll">
                  <table class="data-table compact">
                    <thead><tr><th>Pedido</th><th>Alumno</th><th>Recreo</th><th class="num">Total</th><th>Estado</th></tr></thead>
                    <tbody>
                      ${stats.recentOrders.map((order) => `
                          <tr>
                            <td><strong>${escapeHtml(order.code)}</strong><br /><small>${escapeHtml(formatTime(order.createdAt))}</small></td>
                            <td>${escapeHtml(order.userName ?? "")}</td>
                            <td>${escapeHtml(order.recreoName ?? "")}</td>
                            <td class="num">${money(order.totalCents)}</td>
                            <td>${statusBadge(order.status)}</td>
                          </tr>`).join("")}
                    </tbody>
                  </table>
                </div>` : emptyState({ icon: "", title: "Sin pedidos por ahora", text: "Los pedidos de hoy van a aparecer acá." })}
        </section>

        <section class="panel">
          <header class="panel-head">
            <h2>Stock bajo</h2>
            <a class="link-btn" href="#/admin/productos">Reponer →</a>
          </header>
          ${stats.lowStock.length ? `<ul class="mini-list">
                  ${stats.lowStock.slice(0, 6).map((product) => {
      const stock = stockLabel(product.stock);
      return `<li>
                        <span class="mini-emoji">${escapeHtml(product.emoji)}</span>
                        <span class="mini-info"><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.categoryName ?? "Sin categoría")}</small></span>
                        <span class="stock-pill stock-${stock.tone}">${product.stock} u.</span>
                      </li>`;
    }).join("")}
                </ul>` : '<p class="muted">Todo el stock está en orden </p>'}
        </section>

        <section class="panel">
          <header class="panel-head">
            <h2>Más vendidos</h2>
            <span class="panel-note">últimos 7 días</span>
          </header>
          ${stats.topProducts.length ? `<ol class="rank-list">
                  ${stats.topProducts.map((product, index) => `
                      <li>
                        <span class="rank-index">${index + 1}</span>
                        <span class="mini-info"><strong>${escapeHtml(product.name)}</strong><small>${money(product.amountCents)}</small></span>
                        <span class="rank-qty">${product.quantity} u.</span>
                      </li>`).join("")}
                </ol>` : '<p class="muted">Todavía no hay ventas registradas.</p>'}
        </section>
      </div>
    `;
  });
}
function productRow(product) {
  return `
    <tr>
      <td>
        <div class="cell-product">
          <span class="cell-emoji">${escapeHtml(product.emoji || "")}</span>
          <div>
            <strong>${escapeHtml(product.name)}</strong>
            <small>${escapeHtml(product.description || "Sin descripción")}</small>
          </div>
        </div>
      </td>
      <td><span class="badge badge-plain">${escapeHtml(product.categoryEmoji ?? "")} ${escapeHtml(product.categoryName ?? "Sin categoría")}</span></td>
      <td class="num">${money(product.priceCents)}</td>
      <td class="num">
        <div class="stock-control">
          <button type="button" class="icon-btn icon-btn-sm" data-action="stock-delta" data-id="${product.id}" data-delta="-1" ${product.stock <= 0 ? "disabled" : ""} aria-label="Restar una unidad">−</button>
          <span class="stock-number">${product.stock}</span>
          <button type="button" class="icon-btn icon-btn-sm" data-action="stock-delta" data-id="${product.id}" data-delta="1" aria-label="Sumar una unidad">+</button>
        </div>
      </td>
      <td>${product.active ? '<span class="badge badge-green">Activo</span>' : '<span class="badge badge-slate">Inactivo</span>'}</td>
      <td class="actions-col">
        <button type="button" class="btn btn-ghost btn-sm" data-action="edit-product" data-id="${product.id}">Editar</button>
        <button type="button" class="btn btn-ghost btn-sm danger-text" data-action="delete-product" data-id="${product.id}">Eliminar</button>
      </td>
    </tr>
  `;
}
async function paintProductos(main, app) {
  await run(main, async () => {
    const [{ products }, { categories }] = await Promise.all([api.admin.getProducts(), api.admin.getCategories()]);
    cache.products = products;
    cache.categories = categories;
    main.innerHTML = `
      <header class="page-head">
        <div>
          <p class="eyebrow">Catálogo</p>
          <h1>Productos y stock</h1>
          <p class="page-sub">${products.length} productos cargados. Los cambios se reflejan al instante en el catálogo.</p>
        </div>
        <button type="button" class="btn btn-primary" data-action="new-product">+ Nuevo producto</button>
      </header>

      <div class="panel">
        <div class="panel-toolbar">
          <label class="search-field">
            <span aria-hidden="true"></span>
            <input id="admin-product-search" type="search" placeholder="Buscar producto..." value="${escapeHtml(filters.productsSearch)}" />
          </label>
          <span class="toolbar-note" id="product-visible-count"></span>
        </div>
        <div id="products-table-wrap"></div>
      </div>
    `;
    const wrap = main.querySelector("#products-table-wrap");
    const counter = main.querySelector("#product-visible-count");
    const search = main.querySelector("#admin-product-search");
    function paintRows() {
      const term = filters.productsSearch.trim().toLowerCase();
      const visible = products.filter((product) => !term || product.name.toLowerCase().includes(term) || (product.categoryName ?? "").toLowerCase().includes(term));
      counter.textContent = `${visible.length} de ${products.length}`;
      wrap.innerHTML = visible.length ? `<div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th class="num">Precio</th>
                  <th class="num">Stock</th>
                  <th>Estado</th>
                  <th class="actions-col">Acciones</th>
                </tr>
              </thead>
              <tbody>${visible.map(productRow).join("")}</tbody>
            </table>
          </div>` : emptyState({ icon: "", title: "Sin resultados", text: "Probá con otro nombre o creá un producto nuevo." });
    }
    paintRows();
    search.addEventListener("input", () => {
      filters.productsSearch = search.value;
      paintRows();
    });
  });
}
function adminOrderCard(order) {
  const actions = NEXT_STATUS[order.status] ?? [];
  const canCancel = ["pendiente", "preparando", "listo"].includes(order.status);
  return `
    <article class="admin-order">
      <div class="admin-order-main">
        <div class="admin-order-top">
          <span class="order-code">${escapeHtml(order.code)}</span>
          ${statusBadge(order.status)}
          <span class="admin-order-date">${escapeHtml(formatDateTime(order.createdAt))}</span>
        </div>
        <p class="admin-order-user">
           <strong>${escapeHtml(order.userName ?? "Alumno")}</strong>
          <span>${escapeHtml(order.userEmail ?? "")}</span>
          · ${escapeHtml(order.recreoName ?? "")} ${escapeHtml(order.recreoStartTime ?? "")}–${escapeHtml(order.recreoEndTime ?? "")}
        </p>
        <ul class="admin-order-items">
          ${order.items.map((item) => `<li><span>${item.quantity}×</span> ${escapeHtml(item.productName)} <em>${money(item.subtotalCents)}</em></li>`).join("")}
        </ul>
        ${order.notes ? `<p class="order-notes"> ${escapeHtml(order.notes)}</p>` : ""}
      </div>
      <div class="admin-order-side">
        <span class="admin-order-total">${money(order.totalCents)}</span>
        <div class="admin-order-actions">
          ${actions.map((action) => `<button type="button" class="btn ${action.className} btn-sm" data-action="admin-status" data-id="${order.id}" data-status="${action.status}">${escapeHtml(action.label)}</button>`).join("")}
          ${canCancel ? `<button type="button" class="btn btn-ghost btn-sm danger-text" data-action="admin-status" data-id="${order.id}" data-status="cancelado">Cancelar</button>` : ""}
          ${order.paymentMethod === "cash" && order.paymentStatus !== "approved" ? `<button type="button" class="btn btn-soft btn-sm" data-action="mark-paid" data-id="${order.id}">Marcar pagado</button>` : ""}
        </div>
      </div>
    </article>
  `;
}
async function paintPedidos(main, app) {
  await run(main, async () => {
    const { status, recreoId, date } = filters.orders;
    const params = {};
    if (status)
      params.status = status;
    if (recreoId)
      params.recreoId = recreoId;
    if (date && date !== "all")
      params.date = date;
    const [{ orders }, { recreos }] = await Promise.all([api.admin.getOrders(params), api.admin.getRecreos()]);
    cache.orders = orders;
    cache.recreos = recreos;
    const dateLabel = date === "all" ? "en total" : `para el ${formatLongDate(date)}`;
    main.innerHTML = `
      <header class="page-head">
        <div>
          <p class="eyebrow">Operación</p>
          <h1>Pedidos</h1>
          <p class="page-sub">${orders.length} ${orders.length === 1 ? "pedido" : "pedidos"} ${escapeHtml(dateLabel)}</p>
        </div>
        <button type="button" class="btn btn-soft" data-action="refresh">↻ Actualizar</button>
      </header>

      <div class="panel">
        <div class="panel-toolbar filters">
          <label class="inline-field">
            <span>Fecha</span>
            <input type="date" id="filter-date" value="${date === "all" ? "" : escapeHtml(date)}" ${date === "all" ? "disabled" : ""} />
          </label>
          <label class="inline-field">
            <span>Estado</span>
            <select id="filter-status">
              <option value="">Todos</option>
              ${Object.entries(STATUS_META).map(([value, meta]) => `<option value="${value}" ${status === value ? "selected" : ""}>${escapeHtml(meta.label)}</option>`).join("")}
            </select>
          </label>
          <label class="inline-field">
            <span>Recreo</span>
            <select id="filter-recreo">
              <option value="">Todos</option>
              ${recreos.map((recreo) => `<option value="${recreo.id}" ${String(recreoId) === String(recreo.id) ? "selected" : ""}>${escapeHtml(recreo.name)}</option>`).join("")}
            </select>
          </label>
          <button type="button" class="btn btn-ghost btn-sm" data-action="toggle-date">
            ${date === "all" ? "Ver solo hoy" : "Ver todos los días"}
          </button>
        </div>

        <div class="admin-orders">
          ${orders.length ? orders.map(adminOrderCard).join("") : emptyState({
      icon: "",
      title: "No hay pedidos con esos filtros",
      text: "Probá cambiando la fecha o el estado."
    })}
        </div>
      </div>
    `;
  });
}
async function paintRecreos(main, app) {
  await run(main, async () => {
    const { recreos } = await api.admin.getRecreos();
    cache.recreos = recreos;
    main.innerHTML = `
      <header class="page-head">
        <div>
          <p class="eyebrow">Organización</p>
          <h1>Recreos</h1>
          <p class="page-sub">Definí los horarios en los que se pueden reservar pedidos.</p>
        </div>
        <button type="button" class="btn btn-primary" data-action="new-recreo">+ Nuevo recreo</button>
      </header>

      ${recreos.length ? `<div class="card-grid">
              ${recreos.map((recreo) => `
                <article class="panel recreo-card ${recreo.active ? "" : "is-inactive"}">
                  <div class="recreo-card-head">
                    <span class="recreo-clock"></span>
                    ${recreo.active ? '<span class="badge badge-green">Habilitado</span>' : '<span class="badge badge-slate">Deshabilitado</span>'}
                  </div>
                  <h2>${escapeHtml(recreo.name)}</h2>
                  <p class="recreo-hours">${escapeHtml(recreo.startTime)} – ${escapeHtml(recreo.endTime)}</p>
                  <div class="recreo-card-actions">
                    <button type="button" class="btn btn-ghost btn-sm" data-action="edit-recreo" data-id="${recreo.id}">Editar</button>
                    <button type="button" class="btn btn-ghost btn-sm" data-action="toggle-recreo" data-id="${recreo.id}">
                      ${recreo.active ? "Deshabilitar" : "Habilitar"}
                    </button>
                    <button type="button" class="btn btn-ghost btn-sm danger-text" data-action="delete-recreo" data-id="${recreo.id}">Eliminar</button>
                  </div>
                </article>`).join("")}
            </div>` : emptyState({
      icon: "",
      title: "Todavía no hay recreos",
      text: "Creá al menos un recreo para que los alumnos puedan hacer pedidos.",
      action: '<button type="button" class="btn btn-primary" data-action="new-recreo">Crear recreo</button>'
    })}
    `;
  });
}
async function paintCategorias(main, app) {
  await run(main, async () => {
    const { categories } = await api.admin.getCategories();
    cache.categories = categories;
    main.innerHTML = `
      <header class="page-head">
        <div>
          <p class="eyebrow">Catálogo</p>
          <h1>Categorías</h1>
          <p class="page-sub">Agrupá los productos para que sea más fácil encontrarlos.</p>
        </div>
        <button type="button" class="btn btn-primary" data-action="new-category">+ Nueva categoría</button>
      </header>

      <div class="panel">
        ${categories.length ? `<ul class="category-list">
                ${categories.map((category) => `
                    <li>
                      <span class="category-emoji">${escapeHtml(category.emoji)}</span>
                      <span class="mini-info">
                        <strong>${escapeHtml(category.name)}</strong>
                        <small>${category.productCount ?? 0} productos activos</small>
                      </span>
                      <span class="category-actions">
                        <button type="button" class="btn btn-ghost btn-sm" data-action="edit-category" data-id="${category.id}">Editar</button>
                        <button type="button" class="btn btn-ghost btn-sm danger-text" data-action="delete-category" data-id="${category.id}">Eliminar</button>
                      </span>
                    </li>`).join("")}
              </ul>` : emptyState({ icon: "", title: "Sin categorías", text: "Creá la primera categoría del kiosco." })}
      </div>
    `;
  });
}
async function paintUsuarios(main, app) {
  await run(main, async () => {
    const { users } = await api.admin.getUsers();
    main.innerHTML = `
      <header class="page-head">
        <div>
          <p class="eyebrow">Comunidad</p>
          <h1>Usuarios</h1>
          <p class="page-sub">${users.length} cuentas registradas en el kiosco.</p>
        </div>
      </header>

      <div class="panel">
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Alta</th><th class="actions-col">Acciones</th></tr></thead>
            <tbody>
              ${users.map((user) => `
                  <tr>
                    <td><strong>${escapeHtml(user.name)}</strong></td>
                    <td>${escapeHtml(user.email)}</td>
                    <td>${user.role === "admin" ? '<span class="badge badge-amber">Administración</span>' : '<span class="badge badge-plain">Alumno</span>'}</td>
                    <td>${escapeHtml(formatDate(user.createdAt))}</td>

                    <td class="actions-col">

                      ${user.role !== "admin" ? `<button type="button" class="btn btn-ghost btn-sm danger-text" data-action="delete-user" data-id="${user.id}">Eliminar</button>` : ""}

                    </td>
                  </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  });
}
async function handleAdminClick(event, { app, main, tab }) {
  const button = event.target.closest("[data-action]");
  if (!button)
    return;
  const action = button.dataset.action;
  const id = button.dataset.id ? Number(button.dataset.id) : null;
  const repaint = () => paint(tab, main, app);
  switch (action) {
    case "refresh":
      await repaint();
      return;
    case "new-product":
      await openProductModal(app, null, repaint);
      return;
    case "edit-product": {
      let product = cache.products.find((item) => item.id === id);
      if (!product) {
        const { products } = await api.admin.getProducts();
        cache.products = products;
        product = products.find((item) => item.id === id);
      }
      await openProductModal(app, product, repaint);
      return;
    }
    case "delete-product": {
      const product = cache.products.find((item) => item.id === id);
      const confirmed = await confirmAction({
        title: "Eliminar producto",
        message: `¿Seguro que querés eliminar "${product?.name ?? "este producto"}"? Si tiene pedidos asociados se archivará en lugar de borrarse.`,
        confirmText: "Eliminar",
        danger: true
      });
      if (!confirmed)
        return;
      const result = await api.admin.deleteProduct(id);
      toast(result.archived ? "El producto se archivó porque tiene pedidos asociados." : "Producto eliminado.");
      await app.loadCatalog();
      await repaint();
      return;
    }
    case "stock-delta": {
      const delta = Number(button.dataset.delta);
      const { product } = await api.admin.updateStock(id, { delta });
      toast(`Stock de ${product.name}: ${product.stock} unidades.`);
      await app.loadCatalog();
      await repaint();
      return;
    }
    case "new-category":
      await openCategoryModal(app, null, repaint);
      return;
    case "edit-category": {
      let category = cache.categories.find((item) => item.id === id);
      if (!category) {
        const { categories } = await api.admin.getCategories();
        cache.categories = categories;
        category = categories.find((item) => item.id === id);
      }
      await openCategoryModal(app, category, repaint);
      return;
    }
    case "delete-category": {
      const category = cache.categories.find((item) => item.id === id);
      const confirmed = await confirmAction({
        title: "Eliminar categoría",
        message: `¿Eliminar la categoría "${category?.name ?? ""}"? Los productos quedarán sin categoría.`,
        confirmText: "Eliminar",
        danger: true
      });
      if (!confirmed)
        return;
      await api.admin.deleteCategory(id);
      toast("Categoría eliminada.");
      await app.loadCatalog();
      await repaint();
      return;
    }
    case "new-recreo":
      await openRecreoModal(app, null, repaint);
      return;
    case "edit-recreo": {
      let recreo = cache.recreos.find((item) => item.id === id);
      if (!recreo) {
        const { recreos } = await api.admin.getRecreos();
        cache.recreos = recreos;
        recreo = recreos.find((item) => item.id === id);
      }
      await openRecreoModal(app, recreo, repaint);
      return;
    }
    case "toggle-recreo": {
      const recreo = cache.recreos.find((item) => item.id === id);
      if (!recreo)
        return;
      await api.admin.updateRecreo(id, { ...recreo, active: !recreo.active });
      toast(recreo.active ? "Recreo deshabilitado." : "Recreo habilitado.");
      await app.loadCatalog();
      await repaint();
      return;
    }
    case "delete-recreo": {
      const recreo = cache.recreos.find((item) => item.id === id);
      const confirmed = await confirmAction({
        title: "Eliminar recreo",
        message: `¿Eliminar el recreo "${recreo?.name ?? ""}"? Si ya tiene pedidos, se deshabilitará en lugar de borrarse.`,
        confirmText: "Eliminar",
        danger: true
      });
      if (!confirmed)
        return;
      const result = await api.admin.deleteRecreo(id);
      toast(result.archived ? "El recreo se deshabilitó porque tiene pedidos asociados." : "Recreo eliminado.");
      await app.loadCatalog();
      await repaint();
      return;
    }
    case "mark-paid": {
      await api.admin.updatePaymentStatus(id, "approved");
      toast("Pago marcado como recibido.");
      await app.loadCatalog();
      await repaint();
      return;
    }
    case "delete-user": {
      const confirmed = await confirmAction({
        title: "Eliminar usuario",
        message: "¿Seguro que quer�s eliminar esta cuenta? Se borrar�n sus pedidos.",
        confirmText: "Eliminar",
        danger: true
      });
      if (!confirmed)
        return;
      await api.admin.deleteUser(id);
      toast("Usuario eliminado.");
      await repaint();
      return;
    }
    case "admin-status": {
      const status = button.dataset.status;
      if (status === "cancelado") {
        const confirmed = await confirmAction({
          title: "Cancelar pedido",
          message: "El pedido se cancelará y el stock volverá al kiosco. ¿Continuar?",
          confirmText: "Cancelar pedido",
          cancelText: "Volver",
          danger: true
        });
        if (!confirmed)
          return;
      }
      await api.admin.updateOrderStatus(id, status);
      toast(`Pedido actualizado: ${STATUS_META[status]?.label ?? status}.`);
      await app.loadCatalog();
      await repaint();
      return;
    }
    case "toggle-date":
      filters.orders.date = filters.orders.date === "all" ? todayISO() : "all";
      await repaint();
      return;
    default:
      return;
  }
}
async function handleAdminChange(event, { app, main, tab }) {
  const target = event.target;
  if (target.id === "filter-status") {
    filters.orders.status = target.value;
    await paint(tab, main, app);
  } else if (target.id === "filter-recreo") {
    filters.orders.recreoId = target.value;
    await paint(tab, main, app);
  } else if (target.id === "filter-date") {
    filters.orders.date = target.value || todayISO();
    await paint(tab, main, app);
  }
}
function showFormError(modal, form, error) {
  const box = form.querySelector("[data-form-error]");
  const details = error.details ?? {};
  const firstMessage = Object.values(details)[0] || error.message;
  if (box) {
    box.textContent = firstMessage;
    box.hidden = false;
  }
  for (const field of Object.keys(details)) {
    const input = form.querySelector(`[name="${field}"]`);
    if (input)
      input.classList.add("is-invalid");
  }
}
function clearFormErrors(form) {
  form.querySelectorAll(".is-invalid").forEach((element) => element.classList.remove("is-invalid"));
  const box = form.querySelector("[data-form-error]");
  if (box) {
    box.hidden = true;
    box.textContent = "";
  }
}
async function openProductModal(app, product, onSaved) {
  if (!cache.categories.length) {
    const { categories } = await api.admin.getCategories();
    cache.categories = categories;
  }
  const categories = cache.categories;
  const isEdit = Boolean(product);
  const modal = openModal({
    title: isEdit ? "Editar producto" : "Nuevo producto",
    subtitle: isEdit ? "Actualizá precio, stock, categoría o disponibilidad." : "Se va a mostrar en el catálogo del kiosco.",
    content: `
      <form id="product-form" class="form" novalidate>
        <div class="form-row form-row-emoji">
          <div class="field">
            <label for="p-name">Nombre</label>
            <input id="p-name" name="name" maxlength="80" required value="${escapeHtml(product?.name ?? "")}" placeholder="Ej: Alfajor triple" />
          </div>
          <div class="field">
            <label for="p-emoji">Emoji</label>
            <input id="p-emoji" name="emoji" maxlength="8" value="${escapeHtml(product?.emoji ?? "")}" />
          </div>
        </div>

        <div class="form-row">
          <div class="field">
            <label for="p-category">Categoría</label>
            <select id="p-category" name="categoryId">
              <option value="">Sin categoría</option>
              ${categories.map((category) => `<option value="${category.id}" ${product?.categoryId === category.id ? "selected" : ""}>${escapeHtml(category.emoji)} ${escapeHtml(category.name)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label for="p-price">Precio ($)</label>
            <input id="p-price" name="price" type="number" min="0" step="0.01" required value="${product ? (product.priceCents / 100).toFixed(2) : ""}" placeholder="1500" />
          </div>
        </div>

        <div class="form-row">
          <div class="field">
            <label for="p-stock">Stock</label>
            <input id="p-stock" name="stock" type="number" min="0" step="1" required value="${product?.stock ?? 0}" />
          </div>
          <div class="field field-check">
            <label class="checkbox">
              <input type="checkbox" name="active" ${product?.active === false ? "" : "checked"} />
              <span>Producto activo</span>
            </label>
          </div>
        </div>

        <div class="field">
          <label for="p-desc">Descripción <span class="label-hint">(opcional)</span></label>
          <textarea id="p-desc" name="description" rows="2" maxlength="300">${escapeHtml(product?.description ?? "")}</textarea>
        </div>

        <p class="form-error" data-form-error hidden></p>
      </form>
    `,
    footer: `
      <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
      <button type="submit" form="product-form" class="btn btn-primary">${isEdit ? "Guardar cambios" : "Crear producto"}</button>
    `
  });
  const form = modal.root.querySelector("#product-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearFormErrors(form);
    const submitButton = modal.root.querySelector('[type="submit"]');
    const priceNumber = Number(form.price.value);
    const stockNumber = Number(form.stock.value);
    if (!form.name.value.trim()) {
      showFormError(modal, form, { message: "El nombre es obligatorio." });
      return;
    }
    if (!Number.isFinite(priceNumber) || priceNumber < 0) {
      showFormError(modal, form, { message: "Ingresá un precio válido." });
      return;
    }
    if (!Number.isInteger(stockNumber) || stockNumber < 0) {
      showFormError(modal, form, { message: "El stock debe ser un número entero mayor o igual a 0." });
      return;
    }
    const payload = {
      name: form.name.value.trim(),
      emoji: form.emoji.value.trim() || "",
      categoryId: form.categoryId.value ? Number(form.categoryId.value) : null,
      priceCents: Math.round(priceNumber * 100),
      stock: stockNumber,
      description: form.description.value.trim(),
      active: form.active.checked
    };
    setButtonLoading(submitButton, true);
    try {
      if (isEdit) {
        await api.admin.updateProduct(product.id, payload);
        toast("Producto actualizado.");
      } else {
        await api.admin.createProduct(payload);
        toast("Producto creado.");
      }
      modal.close();
      await app.loadCatalog();
      await onSaved();
    } catch (error) {
      showFormError(modal, form, error);
      toast(error.message, "error");
    } finally {
      setButtonLoading(submitButton, false);
    }
  });
}
async function openCategoryModal(app, category, onSaved) {
  const isEdit = Boolean(category);
  const modal = openModal({
    title: isEdit ? "Editar categoría" : "Nueva categoría",
    content: `
      <form id="category-form" class="form" novalidate>
        <div class="form-row form-row-emoji">
          <div class="field">
            <label for="c-name">Nombre</label>
            <input id="c-name" name="name" maxlength="40" required value="${escapeHtml(category?.name ?? "")}" placeholder="Ej: Golosinas" />
          </div>
          <div class="field">
            <label for="c-emoji">Emoji</label>
            <input id="c-emoji" name="emoji" maxlength="8" value="${escapeHtml(category?.emoji ?? "")}" />
          </div>
        </div>
        <div class="field">
          <label for="c-order">Orden</label>
          <input id="c-order" name="sortOrder" type="number" min="0" step="1" value="${category?.sortOrder ?? 0}" />
        </div>
        <p class="form-error" data-form-error hidden></p>
      </form>
    `,
    footer: `
      <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
      <button type="submit" form="category-form" class="btn btn-primary">${isEdit ? "Guardar cambios" : "Crear categoría"}</button>
    `
  });
  const form = modal.root.querySelector("#category-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearFormErrors(form);
    const submitButton = modal.root.querySelector('[type="submit"]');
    const payload = {
      name: form.name.value.trim(),
      emoji: form.emoji.value.trim() || "",
      sortOrder: Number(form.sortOrder.value) || 0
    };
    setButtonLoading(submitButton, true);
    try {
      if (isEdit) {
        await api.admin.updateCategory(category.id, payload);
        toast("Categoría actualizada.");
      } else {
        await api.admin.createCategory(payload);
        toast("Categoría creada.");
      }
      modal.close();
      await app.loadCatalog();
      await onSaved();
    } catch (error) {
      showFormError(modal, form, error);
      toast(error.message, "error");
    } finally {
      setButtonLoading(submitButton, false);
    }
  });
}
async function openRecreoModal(app, recreo, onSaved) {
  const isEdit = Boolean(recreo);
  const modal = openModal({
    title: isEdit ? "Editar recreo" : "Nuevo recreo",
    subtitle: "Los alumnos solo pueden reservar en recreos habilitados.",
    content: `
      <form id="recreo-form" class="form" novalidate>
        <div class="field">
          <label for="r-name">Nombre</label>
          <input id="r-name" name="name" maxlength="60" required value="${escapeHtml(recreo?.name ?? "")}" placeholder="Ej: Primer recreo" />
        </div>
        <div class="form-row">
          <div class="field">
            <label for="r-start">Desde</label>
            <input id="r-start" name="startTime" type="time" required value="${escapeHtml(recreo?.startTime ?? "09:30")}" />
          </div>
          <div class="field">
            <label for="r-end">Hasta</label>
            <input id="r-end" name="endTime" type="time" required value="${escapeHtml(recreo?.endTime ?? "09:45")}" />
          </div>
        </div>
        <div class="form-row">
          <div class="field">
            <label for="r-order">Orden</label>
            <input id="r-order" name="sortOrder" type="number" min="0" step="1" value="${recreo?.sortOrder ?? 0}" />
          </div>
          <div class="field field-check">
            <label class="checkbox">
              <input type="checkbox" name="active" ${recreo?.active === false ? "" : "checked"} />
              <span>Recreo habilitado</span>
            </label>
          </div>
        </div>
        <p class="form-error" data-form-error hidden></p>
      </form>
    `,
    footer: `
      <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
      <button type="submit" form="recreo-form" class="btn btn-primary">${isEdit ? "Guardar cambios" : "Crear recreo"}</button>
    `
  });
  const form = modal.root.querySelector("#recreo-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearFormErrors(form);
    const submitButton = modal.root.querySelector('[type="submit"]');
    const payload = {
      name: form.name.value.trim(),
      startTime: form.startTime.value,
      endTime: form.endTime.value,
      sortOrder: Number(form.sortOrder.value) || 0,
      active: form.active.checked
    };
    setButtonLoading(submitButton, true);
    try {
      if (isEdit) {
        await api.admin.updateRecreo(recreo.id, payload);
        toast("Recreo actualizado.");
      } else {
        await api.admin.createRecreo(payload);
        toast("Recreo creado.");
      }
      modal.close();
      await app.loadCatalog();
      await onSaved();
    } catch (error) {
      showFormError(modal, form, error);
      toast(error.message, "error");
    } finally {
      setButtonLoading(submitButton, false);
    }
  });
}

// public/js/app.js
var CART_KEY = "kiosco.cart.v1";
var RECREO_KEY = "kiosco.recreo.v1";
var NOTES_KEY = "kiosco.notes.v1";
function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function normalizeCart(raw) {
  if (!Array.isArray(raw))
    return [];
  return raw.filter((item) => item && Number.isInteger(item.productId) && Number.isInteger(item.quantity) && item.quantity > 0).map((item) => ({ productId: item.productId, quantity: item.quantity }));
}
var app = {
  state: {
    booting: true,
    user: null,
    route: { name: "catalogo", sub: null },
    products: [],
    categories: [],
    recreos: [],
    catalogLoaded: false,
    catalogError: null,
    catalogLoading: false,
    catalogFilters: { search: "", categoryId: null },
    cart: normalizeCart(readStorage(CART_KEY, [])),
    paymentMethod: "mercadopago",
    recreoId: Number(localStorage.getItem(RECREO_KEY)) || null,
    notes: localStorage.getItem(NOTES_KEY) ?? "",
    cartOpen: false,
    orders: [],
    ordersLoaded: false,
    checkingOut: false
  },
  pollTimer: null,
  async init() {
    this.state.route = this.parseRoute();
    this.bindGlobalEvents();
    this.render();
    try {
      const { user } = await api.me();
      this.state.user = user;
      if (user) {
        await Promise.allSettled([this.loadCatalog(), this.loadOrders()]);
      }
    } catch (error) {
      toast(error.message, "error", 6000);
    }
    this.state.booting = false;
    document.body.classList.toggle("is-auth", !this.state.user);
    this.render();
  },
  parseRoute() {
    const raw = String(location.hash || "").replace(/^#\/?/, "");
    const [name, sub] = raw.split("/");
    const valid = ["catalogo", "pedidos", "admin"];
    let routeName = valid.includes(name) ? name : "catalogo";
    if (routeName === "admin" && this.state.user?.role !== "admin")
      routeName = "catalogo";
    return {
      name: routeName,
      sub: routeName === "admin" ? sub || "resumen" : null
    };
  },
  navigate(path) {
    const target = `#/${path}`;
    if (location.hash === target) {
      this.render();
      return;
    }
    location.hash = target;
  },
  handleHashChange() {
    const next = this.parseRoute();
    if (next.name === this.state.route.name && next.sub === this.state.route.sub)
      return;
    this.state.route = next;
    this.render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  },
  clearPoll() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  },
  poll(fn, milliseconds) {
    this.clearPoll();
    this.pollTimer = setInterval(() => {
      if (document.hidden)
        return;
      Promise.resolve(fn()).catch(() => {});
    }, milliseconds);
  },
  async loadCatalog() {
    const [productsResponse, categoriesResponse, recreosResponse] = await Promise.all([
      api.getProducts(),
      api.getCategories(),
      api.getRecreos()
    ]);
    this.state.products = productsResponse.products;
    this.state.categories = categoriesResponse.categories;
    this.state.recreos = recreosResponse.recreos;
    if (!this.state.recreos.some((recreo) => recreo.id === Number(this.state.recreoId))) {
      this.state.recreoId = this.state.recreos[0]?.id ?? null;
      this.persistRecreo();
    }
    this.state.catalogLoaded = true;
    this.state.catalogError = null;
    const productIds = new Set(this.state.products.map((product) => product.id));
    const nextCart = this.state.cart.filter((item) => productIds.has(item.productId));
    if (nextCart.length !== this.state.cart.length) {
      this.state.cart = nextCart;
      this.persistCart();
    }
  },
  async loadOrders() {
    const { orders } = await api.getMyOrders();
    this.state.orders = orders;
    this.state.ordersLoaded = true;
  },
  async onAuthenticated(user) {
    this.state.user = user;
    this.state.catalogLoaded = false;
    this.state.catalogError = null;
    this.state.orders = [];
    document.body.classList.remove("is-auth");
    location.hash = user.role === "admin" ? "#/admin/resumen" : "#/catalogo";
    this.state.route = this.parseRoute();
    await Promise.allSettled([this.loadCatalog(), this.loadOrders()]);
    this.render();
  },
  async openChangePasswordModal() {
    const modal = openModal({
      title: "Cambiar contraseña",
      subtitle: "Ingresá tu contraseña actual y la nueva.",
      content: `
        <form id="password-form" class="form" novalidate>
          <div class="field">
            <label for="cp-current">Contraseña actual</label>
            <input id="cp-current" name="currentPassword" type="password" required maxlength="128" />
          </div>
          <div class="field">
            <label for="cp-new">Nueva contraseña</label>
            <input id="cp-new" name="newPassword" type="password" required minlength="8" maxlength="128" />
          </div>
          <div class="field">
            <label for="cp-confirm">Repetir nueva contraseña</label>
            <input id="cp-confirm" name="confirmPassword" type="password" required minlength="8" maxlength="128" />
          </div>
          <p class="form-error" data-form-error hidden></p>
        </form>
      `,
      footer: `
        <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
        <button type="submit" form="password-form" class="btn btn-primary">Cambiar contraseña</button>
      `
    });
    const form = modal.root.querySelector("#password-form");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const box = form.querySelector("[data-form-error]");
      box.hidden = true;
      box.textContent = "";
      const currentPassword = form.currentPassword.value;
      const newPassword = form.newPassword.value;
      const confirmPassword = form.confirmPassword.value;
      if (newPassword !== confirmPassword) {
        box.textContent = "Las contraseñas nuevas no coinciden.";
        box.hidden = false;
        return;
      }
      if (newPassword.length < 8) {
        box.textContent = "La nueva contraseña debe tener al menos 8 caracteres.";
        box.hidden = false;
        return;
      }
      const submitButton = modal.root.querySelector('[type="submit"]');
      submitButton.disabled = true;
      submitButton.textContent = "Guardando...";
      try {
        await api.changePassword({ currentPassword, newPassword });
        modal.close();
        toast("Contraseña actualizada correctamente.");
      } catch (error) {
        box.textContent = error.message || "No se pudo cambiar la contraseña.";
        box.hidden = false;
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Cambiar contraseña";
      }
    });
  },
  async logout() {
    try {
      await api.logout();
    } catch {}
    this.state.user = null;
    this.state.cart = [];
    this.state.notes = "";
    this.state.orders = [];
    this.state.catalogLoaded = false;
    this.state.cartOpen = false;
    localStorage.removeItem(CART_KEY);
    localStorage.removeItem(NOTES_KEY);
    document.body.classList.remove("is-auth", "drawer-open");
    location.hash = "#/catalogo";
    this.state.route = this.parseRoute();
    this.render();
    toast("Cerraste sesión. ¡Hasta la próxima!");
  },
  render() {
    this.clearPoll();
    this.renderHeader();
    const view = document.getElementById("view");
    const { user, route, booting } = this.state;
    if (booting)
      return;
    if (!user) {
      document.body.classList.add("is-auth");
      this.renderCart();
      view.innerHTML = "";
      renderAuth(this, view);
      return;
    }
    document.body.classList.remove("is-auth");
    if (route.name === "admin" && user.role === "admin") {
      view.innerHTML = "";
      renderAdmin(this, view, route.sub).catch((error) => toast(error.message, "error"));
    } else if (route.name === "pedidos") {
      view.innerHTML = "";
      renderOrders(this, view).catch((error) => toast(error.message, "error"));
    } else {
      if (!this.state.catalogLoaded) {
        this.renderCatalogPlaceholder(view);
      } else {
        view.innerHTML = "";
        renderCatalog(this, view);
      }
    }
    this.renderCart();
    this.syncCartIndicators();
  },
  renderCatalogPlaceholder(view) {
    if (this.state.catalogError) {
      view.innerHTML = `
        <div class="error-block">
          <span class="empty-icon"></span>
          <h3>No pudimos cargar el catálogo</h3>
          <p>${escapeHtml(this.state.catalogError)}</p>
          <button type="button" class="btn btn-primary" data-action="reload-catalog">Reintentar</button>
        </div>
      `;
      return;
    }
    view.innerHTML = `<div class="loading-block"><span class="spinner"></span><p>Cargando catálogo...</p></div>`;
    if (!this.state.catalogLoading) {
      this.state.catalogLoading = true;
      this.loadCatalog().then(() => {
        this.state.catalogError = null;
      }).catch((error) => {
        this.state.catalogError = error.message;
      }).finally(() => {
        this.state.catalogLoading = false;
        this.render();
      });
    }
  },
  renderHeader() {
    const topbar = document.getElementById("topbar");
    const { user, route } = this.state;
    if (!user) {
      topbar.hidden = true;
      topbar.innerHTML = "";
      return;
    }
    topbar.hidden = false;
    const pending = this.state.orders.filter((order) => ["pendiente", "preparando", "listo"].includes(order.status)).length;
    topbar.innerHTML = `
      <div class="topbar-inner">
        <a class="brand" href="#/catalogo">
          <span class="brand-mark">K</span>
          <span class="brand-text">
            <strong>Kiosco del Recreo</strong>
            <small>Pedidos y stock</small>
          </span>
        </a>

        <nav class="main-nav" aria-label="Navegación principal">
          <a href="#/catalogo" class="nav-link ${route.name === "catalogo" ? "is-active" : ""}">Catálogo</a>
          <a href="#/pedidos" class="nav-link ${route.name === "pedidos" ? "is-active" : ""}">
            Mis pedidos
            ${pending > 0 ? `<span class="nav-badge">${pending}</span>` : ""}
          </a>
          ${user.role === "admin" ? `<a href="#/admin/resumen" class="nav-link ${route.name === "admin" ? "is-active" : ""}">Administración</a>` : ""}
        </nav>

        <div class="topbar-actions">
          ${route.name === "admin" ? "" : `<button type="button" class="cart-btn" data-action="open-cart" aria-label="Abrir mi pedido">
                   <span aria-hidden="true"></span>
                   <span class="cart-label">Mi pedido</span>
                   <span class="cart-count" data-cart-count>${this.cartCount()}</span>
                 </button>`}
          <div class="user-chip" title="${escapeHtml(user.email)}">
            <span class="avatar">${escapeHtml(initials(user.name))}</span>
            <span class="user-meta">
              <strong>${escapeHtml(user.name)}</strong>
              <small>${user.role === "admin" ? "Administración" : "Alumno"}</small>
            </span>
          </div>
          <button type="button" class="icon-btn" data-action="change-password" title="Cambiar contraseña" aria-label="Cambiar contraseña"></button>
          <button type="button" class="icon-btn logout-btn" data-action="logout" title="Cerrar sesión" aria-label="Cerrar sesión"></button>
        </div>
      </div>
    `;
  },
  cartCount() {
    return this.state.cart.reduce((total, item) => total + item.quantity, 0);
  },
  cartQuantity(productId) {
    return this.state.cart.find((item) => item.productId === productId)?.quantity ?? 0;
  },
  cartLines() {
    const productsById = new Map(this.state.products.map((product) => [product.id, product]));
    return this.state.cart.map((item) => ({ ...item, product: productsById.get(item.productId) })).filter((line) => Boolean(line.product));
  },
  cartTotalCents() {
    return this.cartLines().reduce((total, line) => total + line.product.priceCents * line.quantity, 0);
  },
  persistCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(this.state.cart));
  },
  persistRecreo() {
    localStorage.setItem(RECREO_KEY, String(this.state.recreoId ?? ""));
  },
  addToCart(productId) {
    const product = this.state.products.find((item) => item.id === productId);
    if (!product)
      return;
    if (product.stock <= 0) {
      toast("Ese producto no tiene stock.", "warning");
      return;
    }
    const current = this.cartQuantity(productId);
    if (current + 1 > product.stock) {
      toast(`Solo quedan ${product.stock} unidades de ${product.name}.`, "warning");
      return;
    }
    const existing = this.state.cart.find((item) => item.productId === productId);
    if (existing)
      existing.quantity += 1;
    else
      this.state.cart.push({ productId, quantity: 1 });
    this.persistCart();
    this.renderCart();
    this.syncCartIndicators();
    toast(`${product.name} agregado`, "success", 1600);
  },
  setCartQuantity(productId, quantity) {
    const product = this.state.products.find((item) => item.id === productId);
    const max = product?.stock ?? 0;
    const next = Math.max(0, Math.min(quantity, max));
    if (next === 0) {
      this.state.cart = this.state.cart.filter((item) => item.productId !== productId);
    } else {
      const existing = this.state.cart.find((item) => item.productId === productId);
      if (existing)
        existing.quantity = next;
      else
        this.state.cart.push({ productId, quantity: next });
    }
    this.persistCart();
    this.renderCart();
    this.syncCartIndicators();
  },
  removeFromCart(productId) {
    this.state.cart = this.state.cart.filter((item) => item.productId !== productId);
    this.persistCart();
    this.renderCart();
    this.syncCartIndicators();
  },
  openCart() {
    this.state.cartOpen = true;
    document.body.classList.add("drawer-open");
    this.renderCart();
  },
  closeCart() {
    this.state.cartOpen = false;
    document.body.classList.remove("drawer-open");
    this.renderCart();
  },
  syncCartIndicators() {
    document.querySelectorAll("[data-cart-count]").forEach((element) => {
      element.textContent = this.cartCount();
    });
    const cartButton = document.querySelector(".cart-btn");
    if (cartButton)
      cartButton.classList.toggle("has-items", this.cartCount() > 0);
    syncCatalogCards(this);
  },
  renderCart() {
    const root = document.getElementById("drawer-root");
    if (!root)
      return;
    if (!this.state.user) {
      root.innerHTML = "";
      return;
    }
    const lines = this.cartLines();
    const total = this.cartTotalCents();
    const recreo = this.state.recreos.find((item) => item.id === Number(this.state.recreoId));
    const open = this.state.cartOpen;
    const itemsHtml = lines.length ? lines.map((line) => {
      const overStock = line.quantity > line.product.stock;
      return `
              <div class="cart-line ${overStock ? "is-warning" : ""}">
                <span class="cart-line-emoji" aria-hidden="true">${escapeHtml(line.product.emoji || "")}</span>
                <div class="cart-line-info">
                  <strong>${escapeHtml(line.product.name)}</strong>
                  <small>${money(line.product.priceCents)} c/u${overStock ? " · stock insuficiente" : ""}</small>
                </div>
                <div class="qty-stepper">
                  <button type="button" class="qty-btn" data-action="cart-dec" data-id="${line.productId}" aria-label="Quitar una unidad">−</button>
                  <span class="qty-value">${line.quantity}</span>
                  <button type="button" class="qty-btn" data-action="cart-inc" data-id="${line.productId}" aria-label="Agregar una unidad" ${line.quantity >= line.product.stock ? "disabled" : ""}>+</button>
                </div>
                <span class="cart-line-total">${money(line.product.priceCents * line.quantity)}</span>
                <button type="button" class="icon-btn icon-btn-sm cart-remove" data-action="cart-remove" data-id="${line.productId}" aria-label="Quitar ${escapeHtml(line.product.name)}"></button>
              </div>
            `;
    }).join("") : emptyState({
      icon: "",
      title: "Tu carrito está vacío",
      text: "Sumá productos desde el catálogo.",
      action: '<button type="button" class="btn btn-primary btn-sm" data-action="close-cart">Ver catálogo</button>'
    });
    root.innerHTML = `
      <div class="drawer-backdrop ${open ? "is-open" : ""}" data-action="close-cart"></div>
      <aside class="cart-drawer ${open ? "is-open" : ""}" aria-hidden="${open ? "false" : "true"}" aria-label="Mi pedido">
        <header class="cart-head">
          <div>
            <p class="eyebrow">Tu pedido</p>
            <h2>Carrito</h2>
          </div>
          <button type="button" class="icon-btn" data-action="close-cart" aria-label="Cerrar carrito"></button>
        </header>

        <div class="cart-body">
          <div class="cart-recreo">
            <label for="cart-recreo">Recreo para retirar</label>
            <select id="cart-recreo">
              ${this.state.recreos.length ? this.state.recreos.map((item) => `<option value="${item.id}" ${item.id === Number(this.state.recreoId) ? "selected" : ""}>${escapeHtml(item.name)} · ${escapeHtml(item.startTime)}–${escapeHtml(item.endTime)}</option>`).join("") : '<option value="">No hay recreos disponibles</option>'}
            </select>
            <p class="cart-hint">${recreo ? `Retirás en ${escapeHtml(recreo.name)} (${escapeHtml(recreo.startTime)}–${escapeHtml(recreo.endTime)}).` : "Elegí un recreo para poder confirmar el pedido."}</p>
          </div>

          <div class="cart-payment">
            <label for="cart-payment-method">Forma de pago</label>
            <select id="cart-payment-method">
              <option value="mercadopago" ${this.state.paymentMethod === "mercadopago" ? "selected" : ""}>Mercado Pago (tarjeta/online)</option>
              <option value="cash" ${this.state.paymentMethod === "cash" ? "selected" : ""}>Efectivo al retirar</option>
            </select>
            <p class="cart-hint">${this.state.paymentMethod === "cash" ? "Pagás en efectivo al retirar el pedido en el kiosco." : "Se abre el checkout de Mercado Pago para pagar online."}</p>
          </div>

          <div class="cart-items">${itemsHtml}</div>

          <div class="cart-notes">
            <label for="cart-notes">Nota para el kiosco <span>(opcional)</span></label>
            <textarea id="cart-notes" rows="2" maxlength="200" placeholder="Ej: dejar en el mostrador">${escapeHtml(this.state.notes)}</textarea>
          </div>
        </div>

        <footer class="cart-foot">
          <div class="cart-total">
            <span>Total</span>
            <strong>${money(total)}</strong>
          </div>
          <button
            type="button"
            class="btn btn-primary btn-block"
            data-action="checkout"
            ${!lines.length || !recreo || this.state.checkingOut ? "disabled" : ""}
          >
            ${this.state.checkingOut ? '<span class="spinner spinner-sm"></span> Confirmando...' : "Confirmar pedido"}
          </button>
          <p class="cart-foot-note">
            ${lines.length ? `${this.cartCount()} ${this.cartCount() === 1 ? "producto" : "productos"} · ${recreo ? escapeHtml(recreo.name) : "sin recreo"}` : "Agregá productos para continuar"}
          </p>
        </footer>
      </aside>
    `;
  },
  async checkout() {
    if (this.state.checkingOut)
      return;
    const lines = this.cartLines();
    if (!lines.length) {
      toast("Agregá productos antes de confirmar.", "warning");
      return;
    }
    const recreo = this.state.recreos.find((item) => item.id === Number(this.state.recreoId));
    if (!recreo) {
      toast("Elegí el recreo en el que querés retirar tu pedido.", "warning");
      document.getElementById("cart-recreo")?.focus();
      return;
    }
    this.state.checkingOut = true;
    this.renderCart();
    try {
      const { order } = await api.createOrder({
        recreoId: recreo.id,
        notes: this.state.notes.trim(),
        paymentMethod: this.state.paymentMethod,
        items: lines.map((line) => ({ productId: line.productId, quantity: line.quantity }))
      });
      this.state.cart = [];
      this.state.notes = "";
      this.state.checkingOut = false;
      this.persistCart();
      localStorage.removeItem(NOTES_KEY);
      this.closeCart();
      toast(`Pedido ${order.code} confirmado `, "success", 6000);
      this.showOrderSuccess(order);
      await Promise.allSettled([this.loadCatalog(), this.loadOrders()]);
      this.navigate("pedidos");
      this.renderHeader();
    } catch (error) {
      this.state.checkingOut = false;
      if (error.code === "INSUFFICIENT_STOCK") {
        await this.loadCatalog().catch(() => {});
        this.syncCartIndicators();
        toast(error.message, "error", 6000);
      } else {
        toast(error.message, "error", 5000);
      }
      this.renderCart();
    }
  },
  showOrderSuccess(order) {
    const modal = openModal({
      title: "¡Pedido confirmado!",
      subtitle: "Ya quedó registrado en el kiosco.",
      content: `
        <div class="success-order">
          <p class="success-label">Código del pedido</p>
          <p class="success-code">${escapeHtml(order.code)}</p>
          <p class="success-meta">${escapeHtml(order.recreoName ?? "")} · ${escapeHtml(formatLongDate(order.serviceDate))}</p>
          <ul class="order-items success-items">
            ${order.items.map((item) => `<li><span class="order-item-qty">${item.quantity}×</span><span class="order-item-name">${escapeHtml(item.productName)}</span><span class="order-item-amount">${money(item.subtotalCents)}</span></li>`).join("")}
          </ul>
          <p class="success-total"><span>Total</span><strong>${money(order.totalCents)}</strong></p>
          <p class="success-note">Mostrá este código al retirar tu pedido. Podés seguir su estado en “Mis pedidos”.</p>
        </div>
      `,
      footer: `
        <button type="button" class="btn btn-ghost" data-close>Seguir comprando</button>
        <button type="button" class="btn btn-primary" data-go-orders>Ver mis pedidos</button>
      `
    });
    modal.root.querySelector("[data-go-orders]").addEventListener("click", () => {
      modal.close();
      app.navigate("pedidos");
    });
  },
  bindGlobalEvents() {
    window.addEventListener("hashchange", () => this.handleHashChange());
    document.addEventListener("click", (event) => {
      const target = event.target.closest("[data-action]");
      if (!target)
        return;
      this.handleGlobalAction(target.dataset.action, target).catch((error) => toast(error.message, "error"));
    });
    document.addEventListener("change", (event) => {
      if (event.target.id === "cart-recreo") {
        this.state.recreoId = Number(event.target.value) || null;
        this.persistRecreo();
        this.renderCart();
      }
      if (event.target.id === "cart-payment-method") {
        this.state.paymentMethod = event.target.value;
        this.renderCart();
      }
    });
    document.addEventListener("input", (event) => {
      if (event.target.id === "cart-notes") {
        this.state.notes = event.target.value;
        localStorage.setItem(NOTES_KEY, event.target.value);
      }
    });
  },
  async handleGlobalAction(action, target) {
    switch (action) {
      case "logout":
        await this.logout();
        return;
      case "open-cart":
        this.openCart();
        return;
      case "close-cart":
        this.closeCart();
        return;
      case "add-to-cart":
        this.addToCart(Number(target.dataset.id));
        return;
      case "cart-inc":
        this.setCartQuantity(Number(target.dataset.id), this.cartQuantity(Number(target.dataset.id)) + 1);
        return;
      case "cart-dec":
        this.setCartQuantity(Number(target.dataset.id), this.cartQuantity(Number(target.dataset.id)) - 1);
        return;
      case "cart-remove":
        this.removeFromCart(Number(target.dataset.id));
        return;
      case "checkout":
        await this.checkout();
        return;
      case "cancel-order": {
        const id = Number(target.dataset.id);
        const confirmed = await confirmAction({
          title: "Cancelar pedido",
          message: "¿Querés cancelar este pedido? El stock vuelve al kiosco y no se puede deshacer.",
          confirmText: "Sí, cancelar",
          cancelText: "Volver",
          danger: true
        });
        if (!confirmed)
          return;
        await api.cancelOrder(id);
        toast("Pedido cancelado. El stock volvió al kiosco.");
        await Promise.allSettled([this.loadOrders(), this.loadCatalog()]);
        this.render();
        return;
      }
      case "refresh-orders":
        await this.loadOrders();
        this.render();
        return;
      case "reload-catalog":
        this.state.catalogLoaded = false;
        this.state.catalogError = null;
        this.render();
        return;
      case "open-orders":
        this.navigate("pedidos");
        return;
      case "change-password":
        await this.openChangePasswordModal();
        return;
      case "pay-order": {
        const id = Number(target.dataset.id);
        try {
          const { checkoutUrl } = await api.createPayment(id);
          if (checkoutUrl) {
            window.location.href = checkoutUrl;
          } else {
            toast("No se pudo iniciar el pago.", "error");
          }
        } catch (error) {
          toast(error.message, "error");
        }
        return;
      }
      default:
        return;
    }
  }
};
window.app = app;
Promise.resolve(window.__kioscoReady).catch(function() {}).then(function() {
  return app.init();
}).catch(function(error) {
  console.error("No se pudo iniciar el kiosco", error);
  var view = document.getElementById("view");
  if (!view)
    return;
  view.innerHTML = '<div class="error-block">' + '<span class="empty-icon"></span>' + "<h3>No se pudo iniciar el kiosco</h3>" + "<p>Recargá la página. Si abriste index.html con doble clic, debería funcionar igual en el navegador.</p>" + "</div>";
});
