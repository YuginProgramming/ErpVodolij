import { Model, DataTypes, Op } from 'sequelize';
import { sequelize } from './sequelize.js';

class Worker extends Model {}

Worker.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  chat_id: { type: DataTypes.BIGINT, allowNull: false, unique: true },
  name: { type: DataTypes.STRING, allowNull: true },
  phone: { type: DataTypes.STRING, allowNull: true },
  active: { type: DataTypes.BOOLEAN, allowNull: true },
  dialoguestatus: { type: DataTypes.STRING, allowNull: true, defaultValue: '' },
}, {
  sequelize,
  modelName: 'Worker',
  tableName: 'workers',
  schema: 'public',
  freezeTableName: true,
  timestamps: false,
});

export { Worker };

export async function createNewWorkerByChatId(chat_id) {
  const [rec] = await Worker.findOrCreate({ where: { chat_id }, defaults: { active: true } });
  return rec?.get();
}

export async function updateWorkerByChatId(chat_id, updateParams) {
  await Worker.update({ ...updateParams }, { where: { chat_id } });
  return findWorkerByChatId(chat_id);
}

export async function findWorkerByChatId(chat_id) {
  const res = await Worker.findOne({ where: { chat_id } });
  return res?.get() ?? null;
}

export async function findWorkerById(id) {
  const res = await Worker.findByPk(id);
  return res?.get() ?? null;
}

export async function listWorkersBrief(limit = 20) {
  const rows = await Worker.findAll({
    attributes: ['id', 'name'],
    order: [['id', 'ASC']],
    limit,
  });
  return rows.map(r => ({ id: r.id, display: r.name || `worker_${r.id}` }));
}

export async function setWorkerName(id, name) {
  await Worker.update({ name }, { where: { id } });
}

// (опц.) пошук по імені/цифрі
export async function findWorkerIdByInput(input) {
  const raw = (input || '').trim();
  if (/^\d+$/.test(raw)) return Number(raw);
  const res = await Worker.findOne({ where: { name: { [Op.iLike]: raw } } });
  return res?.id ?? null;
}
