export function createProductRepository(db) {
  const BASE_SELECT = `
    SELECT p.*, c.name AS category_name, c.emoji AS category_emoji
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
  `;

  function map(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      categoryId: row.category_id,
      categoryName: row.category_name ?? null,
      categoryEmoji: row.category_emoji ?? null,
      priceCents: row.price_cents,
      stock: row.stock,
      emoji: row.emoji,
      active: Boolean(row.active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  return {
    list({ includeInactive = false, categoryId = null, search = null, onlyAvailable = false } = {}) {
      const where = [];
      const params = [];
      if (!includeInactive) where.push('p.active = 1');
      if (categoryId) {
        where.push('p.category_id = ?');
        params.push(categoryId);
      }
      if (search) {
        where.push('(p.name LIKE ? OR p.description LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
      }
      if (onlyAvailable) where.push('p.stock > 0');
      const sql = `${BASE_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY c.sort_order, p.name COLLATE NOCASE`;
      return db.prepare(sql).all(...params).map(map);
    },

    findById(id) {
      return map(db.prepare(`${BASE_SELECT} WHERE p.id = ?`).get(id));
    },

    create({ name, description = '', categoryId = null, priceCents, stock, emoji = '', active = true }) {
      const now = new Date().toISOString();
      const result = db
        .prepare(
          `INSERT INTO products (name, description, category_id, price_cents, stock, emoji, active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(name, description, categoryId, priceCents, stock, emoji, active ? 1 : 0, now, now);
      return this.findById(Number(result.lastInsertRowid));
    },

    update(id, { name, description = '', categoryId = null, priceCents, stock, emoji = '', active = true }) {
      const now = new Date().toISOString();
      db.prepare(
        `UPDATE products
            SET name = ?, description = ?, category_id = ?, price_cents = ?, stock = ?, emoji = ?, active = ?, updated_at = ?
          WHERE id = ?`,
      ).run(name, description, categoryId, priceCents, stock, emoji, active ? 1 : 0, now, id);
      return this.findById(id);
    },

    setActive(id, active) {
      db.prepare('UPDATE products SET active = ?, updated_at = ? WHERE id = ?').run(
        active ? 1 : 0,
        new Date().toISOString(),
        id,
      );
      return this.findById(id);
    },

    remove(id) {
      const result = db.prepare('DELETE FROM products WHERE id = ?').run(id);
      return result.changes > 0;
    },

    /** Descuenta stock de forma atomica. Devuelve false si no habia suficiente. */
    decrementStock(id, quantity) {
      const result = db
        .prepare('UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ? AND stock >= ?')
        .run(quantity, new Date().toISOString(), id, quantity);
      return result.changes > 0;
    },

    incrementStock(id, quantity) {
      db.prepare('UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?').run(
        quantity,
        new Date().toISOString(),
        id,
      );
    },

    countOrderItems(productId) {
      return db.prepare('SELECT COUNT(*) AS total FROM order_items WHERE product_id = ?').get(productId).total;
    },

    lowStock(threshold = 5) {
      return db
        .prepare(`${BASE_SELECT} WHERE p.active = 1 AND p.stock <= ? ORDER BY p.stock ASC, p.name COLLATE NOCASE`)
        .all(threshold)
        .map(map);
    },
  };
}
