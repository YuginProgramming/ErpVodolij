import TelegramBot from 'node-telegram-bot-api';
import { dataBot } from './values.js';
import { endedShiftKeyb, locationKeyboard, processKeyb, startShift } from './keyboards.js';
import { createNewWorkerByChatId, findWorkerByChatId, updateWorkerByChatId } from './models/workers.js';
import { createNewPoint, todayPoins } from './models/work-datapoint.js';
import geocode from './modules/geocode.js';
import axios from 'axios';
import { getShiftDuration } from './modules/shift-duration.js';
import { getRouteDistanceAndMapLink } from './models/distance-link.js';
import { findActiveTasksByWorker, markTaskAsDone } from './models/tasks.js';

export const bot = new TelegramBot(dataBot.telegramBotToken, { polling: true });


const findNearestCoordinate = (coordinates, targetCoordinate) => {

    const distances = coordinates.map((coordinate) => {
      const distance = Math.sqrt(
        Math.pow(coordinate.lat - targetCoordinate.lat, 2) +
        Math.pow(coordinate.lon - targetCoordinate.lon, 2)
      );
      return { coordinate, distance };
    });

    const sortedCoordinates = distances.sort((a, b) => a.distance - b.distance);

    console.log(sortedCoordinates[0]);

    return sortedCoordinates[0].coordinate;

}

bot.setMyCommands([
    { command: '/start', description: 'Почати спочатку' },
    { command: '/tasks', description: 'Список завдань'}
]);

bot.onText(/\/start/, async (msg) => {

    const chatId = msg.chat.id;

    const worker = await findWorkerByChatId(chatId);

    if (!worker) {

        await createNewWorkerByChatId(chatId);
                    
        const keyboards = {
            contactRequest: [
              [
                {
                  text: '📞 Поділитися контактом',
                  request_contact: true,         
                }
              ]
            ]
          };
          
          const messageText = 
            '👋 Вітаємо! \n\n' +
            'Щоб розпочати роботу з ботом, будь ласка, натисніть кнопку ' +
            '«📞 Поділитися контактом» нижче.';
          
          bot.sendMessage(msg.chat.id, messageText, {
            reply_markup: {
              keyboard: keyboards.contactRequest,
              resize_keyboard: true,           
              one_time_keyboard: true          
            }
          });       

    } else {

        

    }

});

bot.onText(/\/tasks/, async (msg) => {

  const chatId = msg.chat.id;

  const worker = await findWorkerByChatId(chatId);

  console.log(worker.id)
  if (worker) {

    const tasks = await findActiveTasksByWorker(worker.id);

    console.log(tasks);

    if (!tasks || tasks.length === 0) {
      return bot.sendMessage(chatId, '🎉 У вас немає активних завдань!');
    }

    for (const task of tasks) {
      const taskText = `📌 *${task.title}*\n🗒️ ${task.description || 'Без опису'}\n📟  Апарат: ${task.deviceId || 'Невідомо'}\n🎯 Пріоритет: ${task.priority || 'Нормальний'}`;
      
      await bot.sendMessage(chatId, taskText, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            {
              text: '✅ Виконано',
              callback_data: `done_${task.id}`,
            }
          ]]
        }
      });
    
    }

  } else {

      

  }

});

bot.on("message", async (msg) => {

    const chatId = msg.chat.id;

    if(msg.contact) {

        await updateWorkerByChatId(chatId, { 

            name: msg.contact.first_name,
            phone: msg.contact.phone_number,

        })
      
        bot.sendMessage(msg.chat.id, startShift(), locationKeyboard());
   
    }    

});

bot.on("location", async (msg) => {

    const chatId = msg.chat.id;

    const worker = await findWorkerByChatId(chatId);

    console.log(worker.dialoguestatus)

    console.log(worker.active)

    if (!worker.active) {

        await updateWorkerByChatId(chatId, { active: true })

        const locations = await axios.get('http://soliton.net.ua/water/api/devices');

        const targetCoordinate = {lat: msg.location.latitude, lon: msg.location.longitude};

        const nearest = findNearestCoordinate(locations.data.devices, targetCoordinate);

        const address = await geocode(targetCoordinate);

        await createNewPoint({

            user_id: worker.id,
            workType: 'shift started',
            deviceId: nearest.id,
            latitude: nearest.lat,
            longitude: nearest.lon,
            address: address

        });

        //Зміну розпочато

        

        const message = 
            `🔔 Зміну розпочато.\n` +
            `Ви знаходитесь за адресою: ${address}.\n` +
            `Найближчий автомат: ${nearest.id}.\n\n` +
            `Оберіть операцію:`;

        bot.sendMessage(msg.chat.id, message, processKeyb());

    } else {

        const locations = await axios.get('http://soliton.net.ua/water/api/devices');

        const targetCoordinate = {lat: msg.location.latitude, lon: msg.location.longitude};

        const nearest = findNearestCoordinate(locations.data.devices, targetCoordinate);

        const address = await geocode(targetCoordinate);

            switch (worker.dialoguestatus) {
                case 'end_shift':

                    await updateWorkerByChatId(chatId, { active: false, dialoguestatus: ''});

                    await createNewPoint({

                        user_id: worker.id,
                        workType: 'end_shift',
                        deviceId: nearest.id,
                        latitude: nearest.lat,
                        longitude: nearest.lon,
                        address: address
            
                    });

                    const shiftPoints = await todayPoins(worker.id);

                    const durationString = getShiftDuration(shiftPoints);

                    const { distanceKm, mapLink } = await getRouteDistanceAndMapLink(shiftPoints);
            
                    const message = 
                        `🔔 Зміну завершено.\n` +
                        `Зміна тривала: ${durationString}\n` +
                        `Протяжність маршруту: ${distanceKm}\n` +
                        `Посилання на маршрут на карті: ${mapLink}\n` +
                        `Ви знаходитесь за адресою: ${address}.\n` +
                        `Найближчий автомат: ${nearest.id}.\n\n` +
                        `Оберіть операцію:`;
            
                    bot.sendMessage(msg.chat.id, message, endedShiftKeyb());
                break;
                case 'service_machine':
                    await createNewPoint({

                        user_id: worker.id,
                        workType: 'service_machine',
                        deviceId: nearest.id,
                        latitude: nearest.lat,
                        longitude: nearest.lon,
                        address: address
            
                    });
            
                    const serviceMessage = 
                        `🔔 Ослуговування завершено.\n` +
                        `Ви знаходитесь за адресою: ${address}.\n` +
                        `Найближчий автомат: ${nearest.id}.\n\n` +
                        `Оберіть операцію:`;
            
                    bot.sendMessage(msg.chat.id, serviceMessage, processKeyb());
                    
                break;
                case 'cash_collection':

                    await createNewPoint({

                        user_id: worker.id,
                        workType: 'cash_collection',
                        deviceId: nearest.id,
                        latitude: nearest.lat,
                        longitude: nearest.lon,
                        address: address
            
                    });
            
                    const cashMessage = 
                        `🔔 Інкасацію завершено.\n` +
                        `Ви знаходитесь за адресою: ${address}.\n` +
                        `Найближчий автомат: ${nearest.id}.\n\n` +
                        `Оберіть операцію:`;
            
                    bot.sendMessage(msg.chat.id, cashMessage, processKeyb());
                    
                break;
                case 'repair':

                    await createNewPoint({

                        user_id: worker.id,
                        workType: 'repair',
                        deviceId: nearest.id,
                        latitude: nearest.lat,
                        longitude: nearest.lon,
                        address: address
            
                    });
            
                    const repairMessage = 
                        `🔔 Ремонт завершено.\n` +
                        `Ви знаходитесь за адресою: ${address}.\n` +
                        `Найближчий автомат: ${nearest.id}.\n\n` +
                        `Оберіть операцію:`;
            
                    bot.sendMessage(msg.chat.id, repairMessage, processKeyb());
                    
                break;
                
            }

    }    

});

bot.on('callback_query', async (callbackQuery) => {

    const msg = callbackQuery.message;
    const data = callbackQuery.data;
    const chatId = msg.chat.id;    
  
    switch (data) {      

      case 'end_shift':

        await updateWorkerByChatId(chatId, { dialoguestatus: 'end_shift'});
        bot.sendMessage(chatId, 'Для завершення зміни натисніть кнопку, щоб поділитися своєю локацією.' , locationKeyboard());

        break;
  
      case 'service_machine':

        await updateWorkerByChatId(chatId, { dialoguestatus: 'service_machine'});
        bot.sendMessage(chatId, 'По завершенню роботи натисніть кнопку, щоб поділитися своєю локацією.' , locationKeyboard());
        break;
  
      case 'cash_collection':

        await updateWorkerByChatId(chatId, { dialoguestatus: 'cash_collection'});
        bot.sendMessage(chatId, 'По завершенню роботи натисніть кнопку, щоб поділитися своєю локацією.' , locationKeyboard());
        break;
  
      case 'repair':

        await updateWorkerByChatId(chatId, { dialoguestatus: 'repair'});
        bot.sendMessage(chatId, 'По завершенню роботи натисніть кнопку, щоб поділитися своєю локацією.' , locationKeyboard());
        break;

        case 'start_shift':

            bot.sendMessage(msg.chat.id, startShift(), locationKeyboard());

        break;
  
      default:
        
        if (data.startsWith('done_')) {
            const taskId = data.split('_')[1];
    
            await markTaskAsDone(taskId); 
        
            await bot.editMessageReplyMarkup(
              { inline_keyboard: [] },
              {
                chat_id: chatId,
                message_id: msg.message_id
              }
            );
        
            await bot.sendMessage(chatId, '✅ Завдання виконано!');

        } else {

            bot.sendMessage(chatId, 'Невідома команда. Спробуйте ще раз.');

        }

        
        
    }
  
    // Підтвердити callback, щоб зняти "завантаження" на кнопці
    bot.answerCallbackQuery(callbackQuery.id);
  });
  