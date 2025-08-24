// models/tasks.js
import { DataTypes, Op } from 'sequelize';
import { sequelize } from './sequelize.js';

// Модель таблиці tasks
export const Task = sequelize.define('Task', {
    id:          { type: DataTypes.INTEGER, primaryKey: true },
    title:       { type: DataTypes.TEXT },
    description: { type: DataTypes.TEXT },
    status:      { type: DataTypes.TEXT },
    priority:    { type: DataTypes.TEXT },
    deviceId:    { type: DataTypes.INTEGER, field: 'deviceId' },
  }, {
    tableName: 'tasks',
    schema: 'public',
    timestamps: false,
  });

// Динамічно підхоплюємо назву колонки-виконавця, якщо така є
async function assigneeWhere(workerId) {
  const qi = sequelize.getQueryInterface();
  const desc = await qi.describeTable('tasks'); // { columnName: { ... } }
  if (desc.assignee_id) return { assignee_id: workerId };
  if (desc.worker_id)   return { worker_id: workerId };
  if (desc.user_id)     return { user_id: workerId };
  // якщо в таблиці немає прив'язки до користувача — повертаємо без фільтра
  return {};
}

// Використовує app.js: findActiveTasksByWorker(worker.id)
export async function findActiveTasksByWorker(workerId) {
  const where = {
    status: { [Op.notIn]: ['done', 'closed'] },
    ...(await assigneeWhere(workerId)),
  };
  return Task.findAll({
    where,
    order: [['id', 'DESC']],
    limit: 25,
  });
}

// Використовує app.js: markTaskAsDone(taskId)
export async function markTaskAsDone(taskId) {
  await Task.update({ status: 'done' }, { where: { id: taskId } });
}
