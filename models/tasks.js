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
    workerId:    { type: DataTypes.INTEGER, field: 'workerId' },
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
    workerId,
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

// Creates a TODO task assigned to a worker.
export async function createTaskForWorker({ title, description = null, assigneeWorkerId, deviceId = null, priority = 'normal' }) {
  const qi = sequelize.getQueryInterface();
  const desc = await qi.describeTable('tasks'); // map of columns

  // Decide real column names
  // const assigneeCol = ['assignee_id', 'worker_id', 'user_id'].find(c => !!desc[c]);
  const assigneeCol =
  (desc.workerId && 'workerId') ||           
  (desc.worker_id && 'worker_id') ||
  (desc.assignee_id && 'assignee_id') || null;
  const deviceCol   = desc.deviceId ? 'deviceId' : (desc.device_id ? 'device_id' : null);

  const cols = ['title', 'status', 'priority'];
  const vals = [title, 'todo', priority];
  const params = ['$1', '$2', '$3'];
  let p = 3;

  if (assigneeCol && assigneeWorkerId) {
    cols.push(assigneeCol); vals.push(assigneeWorkerId); params.push(`$${++p}`);
  }

  if (description !== null && desc.description) {
    cols.push('description'); vals.push(description); params.push(`$${++p}`);
  }

  if (deviceId !== null && deviceCol) {
    cols.push(deviceCol); vals.push(deviceId); params.push(`$${++p}`);
  }
  if (desc.createdAt) { 
    cols.push('createdAt'); 
    vals.push(new Date()); 
    params.push(`$${++p}`); 
  }
  if (desc.updatedAt) { 
    cols.push('updatedAt'); 
    vals.push(new Date()); 
    params.push(`$${++p}`); 
  }

  const sql = `INSERT INTO "public"."tasks" (${cols.map(c => `"${c}"`).join(', ')})
               VALUES (${params.join(', ')})
               RETURNING id;`;

  const [rows] = await sequelize.query(sql, { bind: vals });
  return rows[0]?.id;
}

