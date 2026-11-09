import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createApp } from '../src/app.js';

/**
 * Pruebas de la logica de negocio de pedidos contra una base SQLite en memoria.
 * No usan HTTP: ejercitan directamente los servicios del backend.
 */

let app;
let ctx;
let student;
let admin;
let recreo;
let productA;
let productB;

function expectAppError(fn, code, status) {
  let thrown = null;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).not.toBeNull();
  expect(thrown.code).toBe(code);
  if (status !== undefined) expect(thrown.status).toBe(status);
  return thrown;
}

beforeEach(() => {
  app = createApp({ dbPath: ':memory:' });
  ctx = app.ctx;
  student = ctx.auth.login({ email: 'alumno@kiosco.local', password: 'Alumno1234' }, 'test').user;
  admin = ctx.auth.login({ email: 'admin@kiosco.local', password: 'Admin1234' }, 'test').user;
  recreo = ctx.catalog.listRecreos()[0];
  [productA, productB] = ctx.catalog.listProducts({}).filter((product) => product.stock >= 3 && product.active);
});

afterEach(() => {
  app.close();
});

describe('creacion de pedidos', () => {
  it('calcula el total en el servidor y descuenta el stock', () => {
    const stockA = productA.stock;
    const stockB = productB.stock;
    const expected = productA.priceCents * 2 + productB.priceCents;

    const order = ctx.orders.create({
      userId: student.id,
      recreoId: recreo.id,
      items: [
        { productId: productA.id, quantity: 2 },
        { productId: productB.id, quantity: 1 },
      ],
      notes: 'sin sal',
      // Un total enviado por el cliente debe ignorarse.
      totalCents: 1,
    });

    expect(order.totalCents).toBe(expected);
    expect(order.items).toHaveLength(2);
    expect(order.status).toBe('pendiente');
    expect(order.userId).toBe(student.id);
    expect(order.notes).toBe('sin sal');
    expect(ctx.catalog.getProduct(productA.id).stock).toBe(stockA - 2);
    expect(ctx.catalog.getProduct(productB.id).stock).toBe(stockB - 1);
  });

  it('agrupa items repetidos del mismo producto', () => {
    const stock = productA.stock;
    const order = ctx.orders.create({
      userId: student.id,
      recreoId: recreo.id,
      items: [
        { productId: productA.id, quantity: 1 },
        { productId: productA.id, quantity: 2 },
      ],
    });
    expect(order.items).toHaveLength(1);
    expect(order.items[0].quantity).toBe(3);
    expect(ctx.catalog.getProduct(productA.id).stock).toBe(stock - 3);
  });

  it('rechaza stock insuficiente sin tocar el stock ni crear el pedido', () => {
    const stock = productA.stock;
    const before = ctx.orders.listMine(student.id).length;

    expectAppError(
      () =>
        ctx.orders.create({
          userId: student.id,
          recreoId: recreo.id,
          items: [{ productId: productA.id, quantity: stock + 1 }],
        }),
      'INSUFFICIENT_STOCK',
      409,
    );

    expect(ctx.catalog.getProduct(productA.id).stock).toBe(stock);
    expect(ctx.orders.listMine(student.id)).toHaveLength(before);
  });

  it('no descuenta nada si falla una linea posterior', () => {
    const stockA = productA.stock;
    const stockB = productB.stock;

    // Se valida todo antes de reservar: el primer producto no debe descontarse.
    expectAppError(
      () =>
        ctx.orders.create({
          userId: student.id,
          recreoId: recreo.id,
          items: [
            { productId: productA.id, quantity: 1 },
            { productId: productB.id, quantity: productB.stock + 1 },
          ],
        }),
      'INSUFFICIENT_STOCK',
    );

    expect(ctx.catalog.getProduct(productA.id).stock).toBe(stockA);
    expect(ctx.catalog.getProduct(productB.id).stock).toBe(stockB);
  });

  it('rechaza productos inactivos o inexistentes', () => {
    ctx.products.update(productA.id, { ...productA, active: false });

    expectAppError(
      () =>
        ctx.orders.create({
          userId: student.id,
          recreoId: recreo.id,
          items: [{ productId: productA.id, quantity: 1 }],
        }),
      'PRODUCT_NOT_AVAILABLE',
      409,
    );

    expectAppError(
      () =>
        ctx.orders.create({
          userId: student.id,
          recreoId: recreo.id,
          items: [{ productId: 999999, quantity: 1 }],
        }),
      'PRODUCT_NOT_AVAILABLE',
      409,
    );
  });

  it('rechaza recreos inactivos y listas vacias', () => {
    expectAppError(
      () =>
        ctx.orders.create({
          userId: student.id,
          recreoId: 999999,
          items: [{ productId: productA.id, quantity: 1 }],
        }),
      'RECREO_NOT_AVAILABLE',
      400,
    );

    expectAppError(
      () => ctx.orders.create({ userId: student.id, recreoId: recreo.id, items: [] }),
      'VALIDATION_ERROR',
      400,
    );
  });
});

describe('cancelacion y stock', () => {
  it('devuelve el stock una sola vez al cancelar', () => {
    const stockA = productA.stock;
    const order = ctx.orders.create({
      userId: student.id,
      recreoId: recreo.id,
      items: [{ productId: productA.id, quantity: 2 }],
    });
    expect(ctx.catalog.getProduct(productA.id).stock).toBe(stockA - 2);

    const cancelled = ctx.orders.cancel(order.id, student);
    expect(cancelled.status).toBe('cancelado');
    expect(ctx.catalog.getProduct(productA.id).stock).toBe(stockA);

    expectAppError(() => ctx.orders.cancel(order.id, student), 'ORDER_ALREADY_CANCELLED', 409);
    expect(ctx.catalog.getProduct(productA.id).stock).toBe(stockA);
  });

  it('el alumno no puede cancelar un pedido en preparacion, el admin si', () => {
    const stockA = productA.stock;
    const order = ctx.orders.create({
      userId: student.id,
      recreoId: recreo.id,
      items: [{ productId: productA.id, quantity: 1 }],
    });
    ctx.orders.updateStatus(order.id, 'preparando');

    expectAppError(() => ctx.orders.cancel(order.id, student), 'ORDER_IN_PROGRESS', 409);
    expect(ctx.orders.cancel(order.id, admin).status).toBe('cancelado');
    expect(ctx.catalog.getProduct(productA.id).stock).toBe(stockA);
  });

  it('no permite cancelar un pedido entregado', () => {
    const order = ctx.orders.create({
      userId: student.id,
      recreoId: recreo.id,
      items: [{ productId: productA.id, quantity: 1 }],
    });
    ctx.orders.updateStatus(order.id, 'preparando');
    ctx.orders.updateStatus(order.id, 'listo');
    ctx.orders.updateStatus(order.id, 'entregado');

    expectAppError(() => ctx.orders.cancel(order.id, admin), 'ORDER_DELIVERED', 409);
  });
});

describe('estados del pedido', () => {
  it('respeta las transiciones permitidas', () => {
    const order = ctx.orders.create({
      userId: student.id,
      recreoId: recreo.id,
      items: [{ productId: productA.id, quantity: 1 }],
    });

    expect(ctx.orders.updateStatus(order.id, 'preparando').status).toBe('preparando');
    expect(ctx.orders.updateStatus(order.id, 'listo').status).toBe('listo');
    expect(ctx.orders.updateStatus(order.id, 'entregado').status).toBe('entregado');

    expectAppError(() => ctx.orders.updateStatus(order.id, 'pendiente'), 'INVALID_TRANSITION', 409);
    expectAppError(() => ctx.orders.updateStatus(order.id, 'inventado'), 'VALIDATION_ERROR', 400);
  });

  it('cancelar desde el panel admin devuelve el stock aunque este listo', () => {
    const stockA = productA.stock;
    const order = ctx.orders.create({
      userId: student.id,
      recreoId: recreo.id,
      items: [{ productId: productA.id, quantity: 2 }],
    });
    ctx.orders.updateStatus(order.id, 'listo');

    const cancelled = ctx.orders.updateStatus(order.id, 'cancelado');
    expect(cancelled.status).toBe('cancelado');
    expect(ctx.catalog.getProduct(productA.id).stock).toBe(stockA);
  });
});

describe('acceso a pedidos', () => {
  it('un alumno no puede ver pedidos de otro alumno', () => {
    const other = ctx.auth.register(
      { name: 'Otro Alumno', email: 'otro@kiosco.local', password: 'Otro12345' },
      'test',
    ).user;
    const order = ctx.orders.create({
      userId: student.id,
      recreoId: recreo.id,
      items: [{ productId: productA.id, quantity: 1 }],
    });

    expect(ctx.orders.getForActor(order.id, student).id).toBe(order.id);
    expect(ctx.orders.getForActor(order.id, admin).id).toBe(order.id);
    expectAppError(() => ctx.orders.getForActor(order.id, other), 'ORDER_FORBIDDEN', 403);
  });

  it('lista solo los pedidos propios y permite filtrar como admin', () => {
    const other = ctx.auth.register(
      { name: 'Otro Alumno', email: 'otro2@kiosco.local', password: 'Otro12345' },
      'test',
    ).user;
    const mine = ctx.orders.create({
      userId: student.id,
      recreoId: recreo.id,
      items: [{ productId: productA.id, quantity: 1 }],
    });
    ctx.orders.create({
      userId: other.id,
      recreoId: recreo.id,
      items: [{ productId: productB.id, quantity: 1 }],
    });

    expect(ctx.orders.listMine(student.id).map((order) => order.id)).toEqual([mine.id]);
    expect(ctx.orders.listMine(other.id)).toHaveLength(1);
    expect(ctx.orders.listAdmin({}).length).toBeGreaterThanOrEqual(2);
    expect(ctx.orders.listAdmin({ status: 'pendiente' })).toHaveLength(2);
  });
});
