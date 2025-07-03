import { Model, DataTypes, Op } from "sequelize";
import { sequelize } from './sequelize.js';

//import { logger } from '../logger/index.js';

class WorkDatapoint extends Model {}
WorkDatapoint.init({
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    workType: {
        type: DataTypes.STRING,
        allowNull: false
    },
    deviceId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    latitude: {
        type: DataTypes.DOUBLE,
        allowNull: false
    },
    longitude: {
        type: DataTypes.DOUBLE,
        allowNull: false
    },
    address: {
        type: DataTypes.STRING,
        allowNull: true
    },
    

}, {
    freezeTableName: false,
    timestamps: true,
    modelName: 'workdatapoints',
    sequelize
});

const createNewPoint = async (dataPoint) => {
    let res;
    try {
        res = await WorkDatapoint.create(dataPoint);
        res = res.dataValues;
    } catch (err) {
        // logger.error(`Impossible to create Bonus: ${err}`);
        throw err;  // або обробляй помилку як треба
    }
    return res;
};

const todayPoins = async (userId) => {
    // Отримуємо початок і кінець сьогоднішнього дня
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
  
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
  
    // Запит до БД
    const points = await WorkDatapoint.findAll({
      where: {
        user_id: userId,
        createdAt: {
          [Op.between]: [startOfDay, endOfDay]
        }
      },
      order: [['createdAt', 'ASC']]
    });
  
    return points;
  }


export {
    WorkDatapoint,
    createNewPoint,
    todayPoins
};   

