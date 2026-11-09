export function createCategoryRepository(db) {
  function map(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      emoji: row.emoji,
      sortOrder: row.sort_order,
      productCount: row.product_count === undefined ? undefined : Number(row.product_count),
      createdAt: row.created_at,
    };
  }

  return {
    list() {
      const rows = db
        .prepare(
          `SELECT c.*, COUNT(p.id) AS product_count
             FROM categories c
             LEFT JOIN products p ON p.category_id = c.id AND p.active = 1
            GROUP BY c.id
            ORDER BY c.sort_order, c.name COLLATE NOCASE`,
        )
        .all();
      return rows.map(map);
    },

    findById(id) {
      return map(db.prepare('SELECT * FROM categories WHERE id = ?').get(id));
    },

    findByName(name) {
      return map(db.prepare('SELECT * FROM categories WHERE name = ? COLLATE NOCASE').get(name));
    },

    create({ name, emoji = '🍬', sortOrder = 0, createdAt = new Date().toISOString() }) {
      const result = db
        .prepare('INSERT INTO categories (name, emoji, sort_order, created_at) VALUES (?, ?, ?, ?)')
        .run(name, emoji, sortOrder, createdAt);
      return this.findById(Number(result.lastInsertRowid));
    },

    update(id, { name, emoji, sortOrder }) {
      db.prepare('UPDATE categories SET name = ?, emoji = ?, sort_order = ? WHERE id = ?').run(
        name,
        emoji,
        sortOrder,
        id,
      );
      return this.findById(id);
    },

    remove(id) {
      const result = db.prepare('DELETE FROM categories WHERE id = ?').run(id);
      return result.changes > 0;
    },
  };
}
