export function createPaymentRepository(db) {
  function map(row) {
    if (!row) return null;
    return {
      id: row.id,
      orderId: row.order_id,
      provider: row.provider,
      preferenceId: row.preference_id,
      externalReference: row.external_reference,
      status: row.status,
      amountCents: row.amount_cents,
      paymentMethod: row.payment_method,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  return {
    create({ orderId, provider, amountCents, externalReference = null }) {
      const now = new Date().toISOString();
      const result = db
        .prepare(
          `INSERT INTO payments (order_id, provider, amount_cents, external_reference, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
        )
        .run(orderId, provider, amountCents, externalReference, now, now);
      return this.findById(Number(result.lastInsertRowid));
    },

    findById(id) {
      return map(db.prepare('SELECT * FROM payments WHERE id = ?').get(id));
    },

    findByOrder(orderId) {
      return map(
        db
          .prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1')
          .get(orderId),
      );
    },

    findByExternalReference(ref) {
      return map(db.prepare('SELECT * FROM payments WHERE external_reference = ?').get(ref));
    },

    setPreference(id, preferenceId) {
      const now = new Date().toISOString();
      db.prepare('UPDATE payments SET preference_id = ?, updated_at = ? WHERE id = ?').run(
        preferenceId,
        now,
        id,
      );
      return this.findById(id);
    },

    updateStatus(id, status, { paymentMethod = null } = {}) {
      const now = new Date().toISOString();
      db.prepare(
        'UPDATE payments SET status = ?, payment_method = COALESCE(?, payment_method), updated_at = ? WHERE id = ?',
      ).run(status, paymentMethod, now, id);
      return this.findById(id);
    },
  };
}