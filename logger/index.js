import { bot } from "../app.js";
import { DateTime } from "luxon";
import { dataBot } from '../values.js';

const DEBUG = true;

// 🗽✨🎈🌞⛵🎃🚸

const logger = {
    now() {
        return DateTime.now().setZone('Europe/Kyiv').toFormat('yy-MM-dd HH:mm:ss');
    },

    async createNewLog(channelId, description) {
        let res;
        try {
            res = await bot.sendMessage(channelId, description);
        } catch (err) {
            console.log(`🚩 ${this.now()} Impossible to create log: ${err}`);
        }
        if (res) {
            return res;
        }
        return;
    },

    async info(desc) {
        const channel = dataBot.loggerId || -1;
        const log = `🏂 ${this.now()} ${desc}`;
        const res = await this.createNewLog(channel, log);
        if (res && DEBUG) {
            console.log(`🏂 ${this.now()} ${desc}`);
        }
    },

    async warn(desc) {
        const channel = dataBot.loggerId || -1;
        const log = `🎈 ${this.now()} ${desc}`;
        const res = await this.createNewLog(channel, log);
        if (res && DEBUG) {
            console.log(log);
        }
    },

    async error(desc) {
        const channel = dataBot.loggerId || -1;
        const log = `🚩 ${this.now()} ${desc}`;
        const res = await this.createNewLog(channel, log);
        if (res) {
            console.log(log);
        }
    },
}



export { logger };