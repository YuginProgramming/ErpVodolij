import { Sequelize } from 'sequelize';

export const sequelize = new Sequelize(
  process.env.DB_NAME || 'vodolijdb',
  process.env.DB_USER || 'vodolij',
  process.env.DB_PASS || 'REDACTED',
  {
    host: process.env.DB_HOST || '49.13.142.186', 
    port: Number(process.env.DB_PORT || 5432),
    dialect: 'postgres',
    logging: false,
  }
);

export async function pingDb() {
  await sequelize.authenticate();
  console.log('[DB] connected');
}
