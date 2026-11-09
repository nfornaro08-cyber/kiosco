import { createUserRepository } from '../repositories/userRepository.js';
import { createCategoryRepository } from '../repositories/categoryRepository.js';
import { createProductRepository } from '../repositories/productRepository.js';
import { createRecreoRepository } from '../repositories/recreoRepository.js';
import { hashPassword } from '../lib/password.js';
import { config } from '../config.js';
import { openDatabase, applySchema, closeDatabase } from './database.js';

const DEFAULT_CATEGORIES = [
  { name: 'Golosinas', emoji: '', sortOrder: 1 },
  { name: 'Bebidas', emoji: '', sortOrder: 2 },
  { name: 'Salados', emoji: '', sortOrder: 3 },
  { name: 'Panadería', emoji: '', sortOrder: 4 },
  { name: 'Helados', emoji: '', sortOrder: 5 },
];

const DEFAULT_PRODUCTS = [
  { name: 'Alfajor triple', category: 'Golosinas', priceCents: 150000, stock: 40, emoji: '', description: 'Alfajor de chocolate relleno con dulce de leche.' },
  { name: 'Chocolate', category: 'Golosinas', priceCents: 120000, stock: 30, emoji: '', description: 'Barra de chocolate con leche.' },
  { name: 'Chicles', category: 'Golosinas', priceCents: 50000, stock: 60, emoji: '', description: 'Chicles de menta, caja chica.' },
  { name: 'Caramelos', category: 'Golosinas', priceCents: 30000, stock: 80, emoji: '', description: 'Caramelos surtidos.' },
  { name: 'Agua mineral', category: 'Bebidas', priceCents: 90000, stock: 35, emoji: '', description: 'Botella de 500 ml sin gas.' },
  { name: 'Gaseosa', category: 'Bebidas', priceCents: 140000, stock: 25, emoji: '', description: 'Botella de 500 ml.' },
  { name: 'Jugo natural', category: 'Bebidas', priceCents: 110000, stock: 20, emoji: '', description: 'Jugo de frutas en cajita.' },
  { name: 'Chocolatada', category: 'Bebidas', priceCents: 130000, stock: 18, emoji: '', description: 'Leche chocolatada de 200 ml.' },
  { name: 'Papas fritas', category: 'Salados', priceCents: 160000, stock: 22, emoji: '', description: 'Bolsa de papas fritas clásicas.' },
  { name: 'Palitos salados', category: 'Salados', priceCents: 80000, stock: 30, emoji: '', description: 'Palitos de queso.' },
  { name: 'Chizitos', category: 'Salados', priceCents: 90000, stock: 28, emoji: '', description: 'Snack de maíz sabor queso.' },
  { name: 'Medialuna', category: 'Panadería', priceCents: 60000, stock: 24, emoji: '', description: 'Medialuna de manteca.' },
  { name: 'Sandwich', category: 'Panadería', priceCents: 180000, stock: 12, emoji: '', description: 'Sandwich de jamón y queso.' },
  { name: 'Bizcochuelo', category: 'Panadería', priceCents: 100000, stock: 15, emoji: '', description: 'Porción de bizcochuelo casero.' },
  { name: 'Palito de agua', category: 'Helados', priceCents: 80000, stock: 26, emoji: '', description: 'Helado de agua sabor limón.' },
  { name: 'Helado de crema', category: 'Helados', priceCents: 150000, stock: 16, emoji: '', description: 'Cucurucho de crema americana.' },
];

const DEFAULT_RECREOS = [
  { name: 'Primer recreo', startTime: '09:30', endTime: '09:45', sortOrder: 1 },
  { name: 'Segundo recreo', startTime: '11:15', endTime: '11:30', sortOrder: 2 },
  { name: 'Tercer recreo', startTime: '13:00', endTime: '13:15', sortOrder: 3 },
];

/**
 * Carga los datos iniciales. Es idempotente: si ya hay usuarios no vuelve a sembrar
 * salvo que se pida `force` (reset completo de la base).
 */
export function seedDatabase(db, { force = false } = {}) {
  const users = createUserRepository(db);
  const categories = createCategoryRepository(db);
  const products = createProductRepository(db);
  const recreos = createRecreoRepository(db);

  if (force) {
    db.exec(`
      DELETE FROM order_items;
      DELETE FROM orders;
      DELETE FROM sessions;
      DELETE FROM products;
      DELETE FROM categories;
      DELETE FROM recreos;
      DELETE FROM users;
      DELETE FROM sqlite_sequence;
    `);
  } else if (users.count() > 0) {
    return { seeded: false };
  }

  const now = new Date().toISOString();

  const admin = users.create({
    name: config.seedAdmin.name,
    email: config.seedAdmin.email,
    passwordHash: hashPassword(config.seedAdmin.password),
    role: 'admin',
  });
  users.create({
    name: config.seedDemoStudent.name,
    email: config.seedDemoStudent.email,
    passwordHash: hashPassword(config.seedDemoStudent.password),
    role: 'cliente',
  });

  for (const category of DEFAULT_CATEGORIES) {
    categories.create({ ...category, createdAt: now });
  }

  const categoryByName = new Map(categories.list().map((category) => [category.name, category.id]));
  for (const product of DEFAULT_PRODUCTS) {
    products.create({
      name: product.name,
      description: product.description,
      categoryId: categoryByName.get(product.category) ?? null,
      priceCents: product.priceCents,
      stock: product.stock,
      emoji: product.emoji,
      active: true,
    });
  }

  for (const recreo of DEFAULT_RECREOS) {
    recreos.create({ ...recreo, createdAt: now });
  }

  return { seeded: true, adminEmail: admin.email };
}

// Ejecucion directa: bun run src/db/seed.js [--force]
if (import.meta.main) {
  const force = process.argv.includes('--force');
  const db = openDatabase(process.env.DB_PATH || config.dbPath);
  applySchema(db);
  const result = seedDatabase(db, { force });
  closeDatabase(db);

  if (result.seeded) {
    console.log(force ? 'Base de datos reiniciada con los datos iniciales.' : 'Datos iniciales cargados.');
    console.log(`Admin:  ${config.seedAdmin.email} / ${config.seedAdmin.password}`);
    console.log(`Alumno: ${config.seedDemoStudent.email} / ${config.seedDemoStudent.password}`);
  } else {
    console.log('La base ya tiene usuarios. Usa --force para reiniciarla desde cero.');
  }
}
