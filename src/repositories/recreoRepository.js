export function createRecreoRepository(db) {
  function map(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      startTime: row.start_time,
      endTime: row.end_time,
      active: Boolean(row.active),
      sortOrder: row.sort_order,
      createdAt: row.created_at,
    };
  }

  return {
    list({ activeOnly = false } = {}) {
      const sql = `SELECT * FROM recreos ${activeOnly ? 'WHERE active = 1' : ''} ORDER BY sort_order, start_time`;
      return db.prepare(sql).all().map(map);
    },

    findById(id) {
      return map(db.prepare('SELECT * FROM recreos WHERE id = ?').get(id));
    },

    findActiveById(id) {
      return map(db.prepare('SELECT * FROM recreos WHERE id = ? AND active = 1').get(id));
    },

    findByName(name) {
      return map(db.prepare('SELECT * FROM recreos WHERE name = ? COLLATE NOCASE').get(name));
    },

    create({ name, startTime, endTime, sortOrder = 0, active = true, createdAt = new Date().toISOString() }) {
      const result = db
        .prepare('INSERT INTO recreos (name, start_time, end_time, active, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(name, startTime, endTime, active ? 1 : 0, sortOrder, createdAt);
      return this.findById(Number(result.lastInsertRowid));
    },

    update(id, { name, startTime, endTime, sortOrder = 0, active = true }) {
      db.prepare(
        'UPDATE recreos SET name = ?, start_time = ?, end_time = ?, active = ?, sort_order = ? WHERE id = ?',
      ).run(name, startTime, endTime, active ? 1 : 0, sortOrder, id);
      return this.findById(id);
    },

    remove(id) {
      const result = db.prepare('DELETE FROM recreos WHERE id = ?').run(id);
      return result.changes > 0;
    },

    countOrders(id) {
      return db.prepare('SELECT COUNT(*) AS total FROM orders WHERE recreo_id = ?').get(id).total;
    },
  };
}
