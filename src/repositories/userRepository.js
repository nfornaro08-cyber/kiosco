export function createUserRepository(db) {
  function map(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role,
      active: Boolean(row.active),
      createdAt: row.created_at,
    };
  }

  return {
    map,
    create({ name, email, passwordHash, role = 'cliente' }) {
      const now = new Date().toISOString();
      const result = db
        .prepare('INSERT INTO users (name, email, password_hash, role, active, created_at) VALUES (?, ?, ?, ?, 1, ?)')
        .run(name, email, passwordHash, role, now);
      return this.findById(Number(result.lastInsertRowid));
    },

    findById(id) {
      return map(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
    },

    findByEmail(email) {
      return map(db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email));
    },

    list() {
      return db
        .prepare('SELECT * FROM users ORDER BY role DESC, name COLLATE NOCASE')
        .all()
        .map(map);
    },

    count() {
      return db.prepare('SELECT COUNT(*) AS total FROM users').get().total;
    },

    updatePassword(id, passwordHash) {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id);
      return this.findById(id);
    },
  };
}
