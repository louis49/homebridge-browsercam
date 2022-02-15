import {Client} from "./client.js";
import {Video} from "./video.js";

async function start(){

    let video = new Video(100);
    let identifier = await video.init();

    if(identifier){
        let client = new Client(location.hostname,
            parseInt(location.port,10)?parseInt(location.port,10):443,
            10000,
            identifier);

        video.on('settings', (message) => {
            client.send_message(message);
        });

        video.on('data', async (data) => {
            await client.send_data(data);
        });

        client.on('start', async () => {
            video.start();
        });

        client.on('stop', () => {
            video.stop();
        });

        client.on('torch', (value) => {
            video.torch(value);
        });

        await client.start();
    }
}

start().then(r => console.log(r));
