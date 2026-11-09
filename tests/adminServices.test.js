import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createApp } from '../src/app.js';

/** Pruebas de los servicios de administracion (catalogo, categorias y recreos). */

let app;
let ctx;

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
});

afterEach(() => {
  app.close();
});

describe('recreos', () => {
  it('permite guardar un recreo sin cambiarle el nombre (toggle de estado)', () => {
    const recreo = ctx.recreos.listAll()[0];
    const updated = ctx.recreos.update(recreo.id, { ...recreo, active: !recreo.active });
    expect(updated.id).toBe(recreo.id);
    expect(updated.active).toBe(!recreo.active);
    expect(ctx.recreos.listAll().find((item) => item.id === recreo.id).active).toBe(!recreo.active);
  });

  it('impide nombres duplicados al crear y al editar', () => {
    const first = ctx.recreos.create({ name: 'Recreo Unico', startTime: '08:00', endTime: '08:10' });
    const second = ctx.recreos.create({ name: 'Otro Recreo', startTime: '08:20', endTime: '08:30' });

    expectAppError(
      () => ctx.recreos.create({ name: 'Recreo Unico', startTime: '09:00', endTime: '09:10' }),
      'RECREO_EXISTS',
      409,
    );
    expectAppError(() => ctx.recreos.update(second.id, { ...second, name: first.name }), 'RECREO_EXISTS', 409);
  });

  it('valida el rango horario', () => {
    expectAppError(
      () => ctx.recreos.create({ name: 'Recreo Invalido', startTime: '10:00', endTime: '09:00' }),
      'INVALID_TIME_RANGE',
      400,
    );
  });
});

describe('categorias', () => {
  it('permite guardar una categoria sin cambiarle el nombre', () => {
    const category = ctx.categories.list()[0];
    const updated = ctx.categories.update(category.id, { ...category, emoji: '🧪' });
    expect(updated.id).toBe(category.id);
    expect(updated.emoji).toBe('🧪');
  });

  it('impide categorias duplicadas al crear y al editar', () => {
    const first = ctx.categories.create({ name: 'Categoria Unica', emoji: '🧪' });
    const second = ctx.categories.create({ name: 'Otra Categoria', emoji: '🧪' });

    expectAppError(() => ctx.categories.create({ name: 'Categoria Unica' }), 'CATEGORY_EXISTS', 409);
    expectAppError(() => ctx.categories.update(second.id, { ...second, name: first.name }), 'CATEGORY_EXISTS', 409);
  });
});

describe('productos', () => {
  it('crea, edita y ajusta stock de un producto', () => {
    const category = ctx.categories.list()[0];
    const product = ctx.products.create({
      name: 'Producto de Prueba',
      description: 'Descripcion',
      priceCents: 12345,
      stock: 10,
      categoryId: category.id,
      active: true,
    });

    expect(product.priceCents).toBe(12345);
    expect(product.stock).toBe(10);

    const edited = ctx.products.update(product.id, { ...product, name: 'Producto Editado', priceCents: 15000 });
    expect(edited.name).toBe('Producto Editado');
    expect(edited.priceCents).toBe(15000);

    expect(ctx.products.updateStock(product.id, { delta: 5 }).stock).toBe(15);
    expect(ctx.products.updateStock(product.id, { stock: 3 }).stock).toBe(3);
    expectAppError(() => ctx.products.updateStock(product.id, { delta: -4 }), 'STOCK_INSUFFICIENT', 409);
  });

  it('archiva productos con pedidos en lugar de borrarlos', () => {
    const student = ctx.auth.login({ email: 'alumno@kiosco.local', password: 'Alumno1234' }, 'test').user;
    const recreo = ctx.catalog.listRecreos()[0];
    const product = ctx.catalog.listProducts({})[0];
    ctx.orders.create({
      userId: student.id,
      recreoId: recreo.id,
      items: [{ productId: product.id, quantity: 1 }],
    });

    const result = ctx.products.remove(product.id);
    expect(result.deleted).toBe(false);
    expect(result.archived).toBe(true);
    expect(result.product.active).toBe(false);
  });
});
