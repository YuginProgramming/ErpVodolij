import TelegramBot from 'node-telegram-bot-api';
import { dataBot } from './values.js';
import { endedShiftKeyb, locationKeyboard, processKeyb, startShift } from './keyboards.js';
import { createNewWorkerByChatId, findWorkerByChatId, updateWorkerByChatId, listWorkersBrief, setWorkerName, findWorkerById } from './models/workers.js';
import { createNewPoint, todayPoins } from './models/work-datapoint.js';
import geocode from './modules/geocode.js';
import axios from 'axios';
import { getShiftDuration } from './modules/shift-duration.js';
import { getRouteDistanceAndMapLink } from './models/distance-link.js';
import { findActiveTasksByWorker, markTaskAsDone, createTaskForWorker, findActiveTasksAll } from './models/tasks.js';
import 'dotenv/config';
import { pingDb } from './models/sequelize.js';

export const bot = new TelegramBot(dataBot.telegramBotToken, { polling: true });

await pingDb();

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

const newTaskWizard = new Map(); // key: chatId -> { step, data }

async function installCommands() {
  const commands = [
    { command: '/start',      description: 'Почати спочатку' },
    { command: '/tasks',      description: 'Мої відкриті задачі' },
    { command: '/tasks_todo', description: 'Усі TODO задачі' },
    { command: '/tasks_all',  description: 'Усі відкриті задачі' },
    { command: '/newtask',    description: 'Створити задачу' },
    { command: '/users',      description: 'Виконавці' },
    { command: '/setname',    description: 'Перейменувати виконавця (адмін)' },
    { command: '/cancel',     description: 'Скасувати створення' },
  ];

  // 1) Clear old definitions across common scopes
  await bot.setMyCommands([], { scope: { type: 'default' } });
  await bot.setMyCommands([], { scope: { type: 'all_private_chats' } });
  await bot.setMyCommands([], { scope: { type: 'all_group_chats' } });

  // 2) Set for default + private + groups (so it shows everywhere)
  await bot.setMyCommands(commands); // default
  await bot.setMyCommands(commands, { scope: { type: 'all_private_chats' } });
  await bot.setMyCommands(commands, { scope: { type: 'all_group_chats' } });

  // 3) Sanity check
  const current = await bot.getMyCommands();
  console.log('[BOT] Commands installed:', current);
}

await installCommands();

const me = await bot.getMe();
console.log('[BOT] Running as', me.username);

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

  } else {}

});

// мої відкриті (open = все крім done/closed)
bot.onText(/\/tasks$/, async (msg) => {
  const chatId = msg.chat.id;
  const me = await findWorkerByChatId(chatId);
  if (!me) return bot.sendMessage(chatId, 'Спершу /start.');

  // якщо треба бачити і непризначені (NULL) поруч із "моїми":
  const tasks = await findActiveTasksByWorker(me.id, { status: 'open', limit: 100, includeUnassigned: false });

  if (!tasks.length) return bot.sendMessage(chatId, '🎉 У вас немає активних завдань!');
  for (const t of tasks) {
    const taskText = `📌 *${t.title}*\n🗒️ ${t.description || 'Без опису'}\n📟 Апарат: ${t.deviceId ?? '—'}\n🎯 Пріоритет: ${t.priority ?? 'normal'}\n👤 workerId: ${t.workerId ?? '—'}`;
    await bot.sendMessage(chatId, taskText, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '✅ Виконано', callback_data: `done_${t.id}` }]] }
    });
  }
});

// всі відкриті (для огляду всієї дошки)
bot.onText(/\/tasks_all$/, async (msg) => {
  const chatId = msg.chat.id;
  const tasks = await findActiveTasksAll({ status: 'open', limit: 200 });
  if (!tasks.length) return bot.sendMessage(chatId, 'Відкритих завдань немає.');
  for (const t of tasks) {
    const taskText = `[#${t.id}] *${t.title}* — ${t.status}\n👤 workerId: ${t.workerId ?? '—'}\n🗒️ ${t.description || '—'}\n📟 ${t.deviceId ?? '—'}\n🎯 ${t.priority ?? 'normal'}`;
    await bot.sendMessage(chatId, taskText, { parse_mode: 'Markdown' });
  }
});

// тільки TODO (всі, незалежно від виконавця)
bot.onText(/\/tasks_todo$/, async (msg) => {
  const chatId = msg.chat.id;
  const tasks = await findActiveTasksAll({ status: 'todo', limit: 200 });
  if (!tasks.length) return bot.sendMessage(chatId, 'TODO задач немає.');
  for (const t of tasks) {
    const taskText = `[#${t.id}] *${t.title}*\n👤 workerId: ${t.workerId ?? '—'}\n🗒️ ${t.description || '—'}`;
    await bot.sendMessage(chatId, taskText, { parse_mode: 'Markdown' });
  }
});

// 1) Entry point: ask for title
bot.onText(/^\/newtask$/, async (msg) => {
  const chatId = msg.chat.id;
  const worker = await findWorkerByChatId(chatId);
  if (!worker) return bot.sendMessage(chatId, 'Спочатку натисніть /start, щоб зареєструватись.');

  newTaskWizard.set(chatId, { step: 'title', data: {} });
  bot.sendMessage(chatId, 'Введіть заголовок задачі (або /cancel):');
});

bot.onText(/^\/setname\s+(\d+)\s+(.+)$/i, async (msg, m) => {
  await setWorkerName(Number(m[1]), m[2].trim());
  bot.sendMessage(msg.chat.id, `OK. #${m[1]} → "${m[2].trim()}"`);
});

bot.onText(/^\/users$/, async (msg) => {
  const list = await listWorkersBrief(50);
  const text = list.map(w => `• #${w.id} — ${w.display}`).join('\n') || 'Немає виконавців.';
  bot.sendMessage(msg.chat.id, `Виконавці:\n${text}`);
});

// 2) Capture text for the wizard
bot.on('text', async (msg) => {
  const chatId = msg.chat.id;
  const st = newTaskWizard.get(chatId);
  if (!st) return;

  // Cancel
  if (/^\/cancel$/i.test(msg.text || '')) {
    newTaskWizard.delete(chatId);
    return bot.sendMessage(chatId, 'Створення скасовано.');
  }

  // TITLE
  if (st.step === 'title') {
    const title = (msg.text || '').trim();
    if (!title) return bot.sendMessage(chatId, 'Заголовок не може бути порожнім. Введіть заголовок або /cancel.');
    st.data.title = title;
    st.step = 'description';
    return bot.sendMessage(chatId, 'Короткий опис (або "-" якщо без опису):');
  }

  // DESCRIPTION
  if (st.step === 'description') {
    st.data.description = (msg.text?.trim() === '-') ? null : msg.text.trim();
    st.step = 'assignee';
    return bot.sendMessage(
      chatId,
      'Кому призначити? Введіть *workerId* (число) або напишіть *me* якщо виконавець — ви.',
      { parse_mode: 'Markdown' }
    );
  }

  // ASSIGNEE
  if (st.step === 'assignee') {
    const raw = (msg.text || '').trim().toLowerCase();
    let assigneeId;
    if (raw === 'me') {
      const me = await findWorkerByChatId(chatId);
      if (!me) return bot.sendMessage(chatId, 'Спочатку /start для реєстрації.');
      assigneeId = me.id;
    } else if (/^\d+$/.test(raw)) {
      assigneeId = Number(raw);
    } else {
      return bot.sendMessage(chatId, 'workerId має бути числом або "me". Спробуйте ще раз:');
    }

    const exists = await findWorkerById(assigneeId);
    if (!exists) {
      return bot.sendMessage(chatId, 'Такого виконавця немає. Введіть існуючий workerId або скористайтесь /users.');
    }

    st.data.assigneeId = assigneeId;
    st.step = 'device';
    return bot.sendMessage(chatId, 'ID апарата (або "-" якщо не вказувати):');
  }

  // DEVICE
  if (st.step === 'device') {
    const raw = (msg.text || '').trim();
    st.data.deviceId = raw === '-' ? null : Number(raw);
    if (st.data.deviceId !== null && Number.isNaN(st.data.deviceId)) {
      return bot.sendMessage(chatId, 'ID має бути числом або "-", спробуйте ще раз:');
    }
    st.step = 'priority';
    return bot.sendMessage(chatId, 'Пріоритет (low|normal|high). За замовчуванням: normal:', {
      reply_markup: {
        keyboard: [[{ text: 'low' }, { text: 'normal' }, { text: 'high' }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
  }

  // PRIORITY
  if (st.step === 'priority') {
    const pr = (msg.text || 'normal').toLowerCase();
    st.data.priority = ['low', 'normal', 'high'].includes(pr) ? pr : 'normal';
    st.step = 'confirm';

    const preview =
`Підтвердити створення задачі?

Заголовок: ${st.data.title}
Опис: ${st.data.description ?? '—'}
Виконавець (workerId): ${st.data.assigneeId}
Апарат: ${st.data.deviceId ?? '—'}
Пріоритет: ${st.data.priority}

Надішліть "ok" для підтвердження або /cancel.`;
    return bot.sendMessage(chatId, preview, { reply_markup: { remove_keyboard: true } });
  }

  // CONFIRM
  if (st.step === 'confirm') {
    if ((msg.text || '').trim().toLowerCase() !== 'ok') {
      return bot.sendMessage(chatId, 'Надішліть "ok" або /cancel.');
    }

    // дублююча перевірка FK
    const assignee = await findWorkerById(st.data.assigneeId);
    if (!assignee) {
      return bot.sendMessage(chatId, 'Виконавець з таким workerId не знайдений. Спробуйте ще раз (/users).');
    }

    const me = await findWorkerByChatId(chatId);
    const taskId = await createTaskForWorker({
      title: st.data.title,
      description: st.data.description,
      priority: st.data.priority,
      deviceId: st.data.deviceId,
      assigneeWorkerId: st.data.assigneeId,
      creatorWorkerId: me?.id,
    });

    newTaskWizard.delete(chatId);
    return bot.sendMessage(chatId, `✅ Задачу #${taskId} призначено виконавцю #${st.data.assigneeId}.`);
  }
});



bot.on("message", async (msg) => {

  const chatId = msg.chat.id;

  if (msg.contact) {

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

    const targetCoordinate = { lat: msg.location.latitude, lon: msg.location.longitude };

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

    const targetCoordinate = { lat: msg.location.latitude, lon: msg.location.longitude };

    const nearest = findNearestCoordinate(locations.data.devices, targetCoordinate);

    const address = await geocode(targetCoordinate);

    switch (worker.dialoguestatus) {
      case 'end_shift':

        await updateWorkerByChatId(chatId, { active: false, dialoguestatus: '' });

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

      await updateWorkerByChatId(chatId, { dialoguestatus: 'end_shift' });
      bot.sendMessage(chatId, 'Для завершення зміни натисніть кнопку, щоб поділитися своєю локацією.', locationKeyboard());

      break;

    case 'service_machine':

      await updateWorkerByChatId(chatId, { dialoguestatus: 'service_machine' });
      bot.sendMessage(chatId, 'По завершенню роботи натисніть кнопку, щоб поділитися своєю локацією.', locationKeyboard());
      break;

    case 'cash_collection':

      await updateWorkerByChatId(chatId, { dialoguestatus: 'cash_collection' });
      bot.sendMessage(chatId, 'По завершенню роботи натисніть кнопку, щоб поділитися своєю локацією.', locationKeyboard());
      break;

    case 'repair':

      await updateWorkerByChatId(chatId, { dialoguestatus: 'repair' });
      bot.sendMessage(chatId, 'По завершенню роботи натисніть кнопку, щоб поділитися своєю локацією.', locationKeyboard());
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
