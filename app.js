import TelegramBot from 'node-telegram-bot-api';
import { dataBot } from './values.js';
import { generateMainMenu } from './keyboards.js';

const bot = new TelegramBot(dataBot.telegramBotToken, { polling: true });

bot.setMyCommands([
    { command: '/start', description: 'Почати спочатку' },
  ]);

  bot.onText(/\/start/, async (msg) => {

    const chatId = msg.chat.id;

    bot.sendMessage(chatId, '👋 Вітаємо! Оберіть один із пунктів меню:', {
        reply_markup: generateMainMenu()
    });

});