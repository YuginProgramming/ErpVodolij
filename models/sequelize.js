import { Sequelize } from 'sequelize';


export const sequelize = new Sequelize('vodolijdb', 'vodolij', '09vodolij@4516', {
    host: '49.13.142.186',
    dialect: 'postgres',
    port: 5432,  
    logging: false,  
});