export function createOrderRepository(db) {
  const BASE_SELECT = `
    SELECT o.*,
           u.name  AS user_name,
           u.email AS user_email,
           r.name  AS recreo_name,
           r.start_time AS recreo_start_time,
           r.end_time   AS recreo_end_time
      FROM orders o
      JOIN users u   ON u.id = o.user_id
      JOIN recreos r ON r.id = o.recreo_id
  `;

  function map(row) {
    if (!row) return null;
    return {
      id: row.id,
      code: row.code,
      userId: row.user_id,
      userName: row.user_name ?? null,
      userEmail: row.user_email ?? null,
      recreoId: row.recreo_id,
      recreoName: row.recreo_name ?? null,
      recreoStartTime: row.recreo_start_time ?? null,
      recreoEndTime: row.recreo_end_time ?? null,
      serviceDate: row.service_date,
      status: row.status,
      paymentStatus: row.payment_status ?? 'unpaid',
      totalCents: row.total_cents,
      notes: row.notes,
      stockRestored: Boolean(row.stock_restored),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      items: [],
    };
  }

  function hydrate(orders) {
    if (orders.length === 0) return orders;
    const ids = orders.map((order) => order.id);
    const placeholders = ids.map(() => '?').join(',');
    const rows = db
      .prepare(`SELECT * FROM order_items WHERE order_id IN (${placeholders}) ORDER BY id`)
      .all(...ids);
    const itemsByOrder = new Map();
    for (const row of rows) {
      const item = {
        id: row.id,
        productId: row.product_id,
        productName: row.product_name,
        unitPriceCents: row.unit_price_cents,
        quantity: row.quantity,
        subtotalCents: row.subtotal_cents,
      };
      if (!itemsByOrder.has(row.order_id)) itemsByOrder.set(row.order_id, []);
      itemsByOrder.get(row.order_id).push(item);
    }
    for (const order of orders) {
      order.items = itemsByOrder.get(order.id) ?? [];
    }
    return orders;
  }

  function findById(id) {
    const order = map(db.prepare(`${BASE_SELECT} WHERE o.id = ?`).get(id));
    if (!order) return null;
    hydrate([order]);
    return order;
  }

  return {
    findById,

    findByCode(code) {
      const order = map(db.prepare(`${BASE_SELECT} WHERE o.code = ? COLLATE NOCASE`).get(code));
      if (!order) return null;
      hydrate([order]);
      return order;
    },

    create({ code, userId, recreoId, serviceDate, totalCents, notes = '', status = 'pendiente' }) {
      const now = new Date().toISOString();
      const result = db
        .prepare(
          `INSERT INTO orders (code, user_id, recreo_id, service_date, status, total_cents, notes, stock_restored, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        )
        .run(code, userId, recreoId, serviceDate, status, totalCents, notes, now, now);
      return Number(result.lastInsertRowid);
    },

    addItem(orderId, { productId, productName, unitPriceCents, quantity, subtotalCents }) {
      db.prepare(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price_cents, quantity, subtotal_cents)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(orderId, productId, productName, unitPriceCents, quantity, subtotalCents);
    },

    listByUser(userId, limit = 50) {
      const orders = db
        .prepare(`${BASE_SELECT} WHERE o.user_id = ? ORDER BY o.created_at DESC, o.id DESC LIMIT ?`)
        .all(userId, limit)
        .map(map);
      return hydrate(orders);
    },

    list({ status = null, recreoId = null, serviceDate = null, userId = null, limit = 200 } = {}) {
      const where = [];
      const params = [];
      if (status) {
        where.push('o.status = ?');
        params.push(status);
      }
      if (recreoId) {
        where.push('o.recreo_id = ?');
        params.push(recreoId);
      }
      if (serviceDate) {
        where.push('o.service_date = ?');
        params.push(serviceDate);
      }
      if (userId) {
        where.push('o.user_id = ?');
        params.push(userId);
      }
      const sql = `${BASE_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
                   ORDER BY CASE o.status
                              WHEN 'pendiente' THEN 0
                              WHEN 'preparando' THEN 1
                              WHEN 'listo' THEN 2
                              WHEN 'entregado' THEN 3
                              ELSE 4 END,
                            o.created_at DESC
                   LIMIT ?`;
      const orders = db.prepare(sql).all(...params, limit).map(map);
      return hydrate(orders);
    },

    updateStatus(id, status, { stockRestored } = {}) {
      const now = new Date().toISOString();
      if (stockRestored === undefined) {
        db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id);
      } else {
        db.prepare('UPDATE orders SET status = ?, stock_restored = ?, updated_at = ? WHERE id = ?').run(
          status,
          stockRestored ? 1 : 0,
          now,
          id,
        );
      }
      return findById(id);
    },

    updatePaymentStatus(id, paymentStatus) {
      const now = new Date().toISOString();
      db.prepare('UPDATE orders SET payment_status = ?, updated_at = ? WHERE id = ?').run(
        paymentStatus,
        now,
        id,
      );
      return findById(id);
    },

    statsByStatus(serviceDate) {
      const rows = db
        .prepare('SELECT status, COUNT(*) AS total, COALESCE(SUM(total_cents), 0) AS amount FROM orders WHERE service_date = ? GROUP BY status')
        .all(serviceDate);
      return rows.map((row) => ({ status: row.status, count: row.total, amountCents: row.amount }));
    },

    countAll(serviceDate = null) {
      if (serviceDate) {
        return db.prepare('SELECT COUNT(*) AS total FROM orders WHERE service_date = ?').get(serviceDate).total;
      }
      return db.prepare('SELECT COUNT(*) AS total FROM orders').get().total;
    },

    topProducts(sinceDate, limit = 5) {
      return db
        .prepare(
          `SELECT oi.product_name AS name, SUM(oi.quantity) AS quantity, SUM(oi.subtotal_cents) AS amount
             FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
            WHERE o.service_date >= ? AND o.status != 'cancelado'
            GROUP BY oi.product_name
            ORDER BY quantity DESC
            LIMIT ?`,
        )
        .all(sinceDate, limit);
    },
  };
}
