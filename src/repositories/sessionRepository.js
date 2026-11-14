export function createSessionRepository(db) {
  return {
    create({ tokenHash, userId, expiresAt }) {
      db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
        tokenHash,
        userId,
        new Date().toISOString(),
        expiresAt,
      );
    },

    findUserByTokenHash(tokenHash) {
      const row = db
        .prepare(
          `SELECT u.*
             FROM sessions s
             JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1`,
        )
        .get(tokenHash, new Date().toISOString());
      if (!row) return null;
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        active: Boolean(row.active),
        createdAt: row.created_at,
      };
    },

    deleteByTokenHash(tokenHash) {
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    },

    deleteExpired(now = new Date().toISOString()) {
      db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
    },
  };
}
