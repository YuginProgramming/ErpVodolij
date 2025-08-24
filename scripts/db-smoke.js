// scripts/db-smoke.js
import { sequelize, Task } from './models/sequelize.js';

try {
  await sequelize.authenticate();
  const cnt = await Task.count();
  const top = await Task.findAll({ limit: 5, order: [['id', 'DESC']] });
  console.log(`OK. Tasks: ${cnt}`);
  console.table(top.map(t => ({ id: t.id, title: t.title, status: t.status })));
} catch (e) {
  console.error('DB smoke failed:', e);
  process.exitCode = 1;
}
