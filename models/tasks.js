import { Model, DataTypes } from "sequelize";
import { sequelize } from './sequelize.js';

class Task extends Model {}

Task.init({
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    status: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: 'todo'
    },
    
    priority: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: 'medium'
    },
    deviceId: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    completedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    workerId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
}, {
    freezeTableName: false,
    timestamps: true, // createdAt, updatedAt
    modelName: 'tasks',
    sequelize
});

const findActiveTasksByWorker = async (workerId) => {
    console.log('id' + workerId)
    const tasks = await Task.findAll({
      where: {
        workerId,
        status: 'todo',
      },
    });
    console.log(tasks)
    return tasks.map(task => task.dataValues);
  };

const markTaskAsDone = async (taskId) => {
    await Task.update({ status: 'done' }, { where: { id: taskId } });
};
  

import { Worker } from './workers.js';   
Task.belongsTo(Worker, { foreignKey: 'workerId' });
Worker.hasMany(Task, { foreignKey: 'workerId' });

export { 
    Task,
    findActiveTasksByWorker,
    markTaskAsDone
 };


