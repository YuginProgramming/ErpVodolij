import { Model, DataTypes } from "sequelize";
import { sequelize } from './sequelize.js';
//import { logger } from '../logger/index.js';


class Worker extends Model {}
Worker.init({
    chat_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        unique: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: true
    },
    active: {
        type: DataTypes.BOOLEAN,
        allowNull: true
    },
    dialoguestatus: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: ''
    }

}, {
    freezeTableName: false,
    timestamps: false,
    modelName: 'workers',
    sequelize
});


const createNewWorkerByChatId = async (chat_id) => {
    let res;
    try {
        res = await Worker.create({ chat_id });
        res = res.dataValues;
    } catch (err) {
//        logger.error(`Impossible to create user: ${err}. Chat id ${chat_id}`);
    }
    return res;
};

const updateWorkerByChatId = async (chat_id, updateParams) => {
    const res = await Worker.update({ ...updateParams } , { where: { chat_id } });
    if (res[0]) {
        const data = await findWorkerByChatId(chat_id);
        if (data) {
            return data;
        }
//        logger.info(`User ${chat_id} updated, but can't read result data`);
    } 
    return undefined;
};


const findWorkerByChatId = async (chat_id) => {
    const res = await Worker.findOne({ where: { chat_id: chat_id } });
    if (res) return res.dataValues;
    return res;
};

export {
    Worker,
    createNewWorkerByChatId,
    updateWorkerByChatId,
    findWorkerByChatId,
};   