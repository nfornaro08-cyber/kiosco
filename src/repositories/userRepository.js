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
      authProvider: row.auth_provider ?? 'local',
      googleSub: row.google_sub ?? null,
      createdAt: row.created_at,
    };
  }

  return {
    create({ name, email, passwordHash, role = 'cliente', authProvider = 'local', googleSub = null }) {
      const now = new Date().toISOString();
      const result = db
        .prepare(
          "INSERT INTO users (name, email, password_hash, role, active, auth_provider, google_sub, created_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?)",
        )
        .run(name, email, passwordHash, role, authProvider, googleSub, now);
      return this.findById(Number(result.lastInsertRowid));
    },

    findById(id) {
      return map(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
    },

    findByEmail(email) {
      return map(db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email));
    },

    findByGoogleSub(sub) {
      return map(db.prepare('SELECT * FROM users WHERE google_sub = ?').get(sub));
    },

    linkGoogleAccount(id, sub) {
      db.prepare("UPDATE users SET google_sub = ?, auth_provider = 'google' WHERE id = ?").run(sub, id);
      return this.findById(id);
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
