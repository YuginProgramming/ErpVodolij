const generateMainMenu = () => {
    return {
        keyboard: [
            [
                { text: '📝 Створити нову задачу' },
                { text: '📍 Переглянути перелік задач' }
            ],
            [
                { text: '✉️ Статистика' }
            ]
        ],
        resize_keyboard: true, // Зменшення кнопок для зручності
        one_time_keyboard: false // Клавіатура залишатиметься видимою
    };
}

const escapeMarkdown = (text) => {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

export {
    generateMainMenu,
    escapeMarkdown
}