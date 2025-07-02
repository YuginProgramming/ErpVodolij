import {  Worker } from '../models/workers.js';
import { WorkDatapoint } from '../models/work-datapoint.js';

const DEBUG = true;

const main = async () => {
    try {
        const syncState = await Promise.all([
            Worker.sync(),
            WorkDatapoint.sync(),
        ]);
        
        

    } catch (err) {
        // eslint-disable-next-line no-console
        console.log(err);
    }
};

main();
