
const escapeMarkdown = (text) => {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

const endedShiftKeyb = () => {
    return {
        reply_markup: {
        inline_keyboard: [
            [
            { text: 'Розпочати зміну', callback_data: 'start_shift' }
            ],
            [
            { text: 'Кабінет працівника', callback_data: 'start_shift' },
            ]
        ]
        }
    }
};

const processKeyb = () => {

    return {
        reply_markup: {
        inline_keyboard: [
            [
            { text: 'Завершення зміни', callback_data: 'end_shift' },
            { text: 'Обслуговування автомату', callback_data: 'service_machine' }
            ],
            [
            { text: 'Інкасація', callback_data: 'cash_collection' },
            { text: 'Ремонт', callback_data: 'repair' }
            ]
        ]
        }
    }
    
};

const locationKeyboard = () => {
    return {
        reply_markup: {
          keyboard: [
            [
              {
                text: '📍 Відправити локацію',
                request_location: true,   // Ось тут ключове!
              }
            ]
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      };
} 

const startShift = () => {
    return 'Натисніть кнопку, щоб поділитися своєю локацією і розпочати зміну:'
} 

export {
    escapeMarkdown,
    endedShiftKeyb,
    processKeyb,
    locationKeyboard,
    startShift
}