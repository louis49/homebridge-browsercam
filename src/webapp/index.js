import {Client} from "./client.js";
import {Video} from "./video.js";
import {Device} from "./device.js";

async function start(){

    let video = new Video(150);
    let identifier = await video.init();

    if(identifier){

        let client = new Client(location.hostname,
            parseInt(location.port,10)?parseInt(location.port,10):443,
            30000,
            identifier);

        client.on('pulse_detector', async (threshold) => {
            let device = new Device(threshold);
            await device.init();

            device.on('pulse', (values) => {
                //document.getElementById("log").value += `\rOn Pulse ${threshold}`;
                client.send_message({'pulse':true, values, 'id':identifier});
            });

            device.on('battery_level', (level) => {
                client.send_message({'battery_level':level, 'id':identifier});
            });

            device.on('battery_charging', (charging) => {
                client.send_message({'battery_charging':charging, 'id':identifier});
            });
        });

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

start().then(() => {});
