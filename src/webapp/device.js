import EventEmitter from "events";

export class Device extends EventEmitter {
    constructor(threshold) {
        super();

        this.threshold = threshold;

        this.x = 0;
        this.y = 0;
        this.z = 0;

        this.started = false;
    }

    async init(){
        console.log('Device Init');
        try{
            if (DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === "function") {
                window.addEventListener("touchstart", this.request.bind(this), true);
            }
            else{
                await this.start();
            }
        }
        catch (_) {}

        //chrome://flags/#enable-generic-sensor-extra-classes 
        document.getElementById('log').value+="'AmbientLightSensor' in window " + 'AmbientLightSensor' in window;
        navigator.permissions.query({ name: 'ambient-light-sensor' }).then(result => {
            if (result.state === 'denied') {
                console.log('Permission to use ambient light sensor is denied.');
                return;
            }

            const als = new AmbientLightSensor({frequency: 10});
            als.addEventListener('activate', () => console.log('Ready to measure EV.'));
            als.addEventListener('error', event => console.log(`Error: ${event.error.name}`));
            als.addEventListener('reading', () => {
                // Defaut ISO value.
                const ISO = 100;
                // Incident-light calibration constant.
                const C = 250;

                let EV = Math.round(Math.log2((als.illuminance * ISO) / C));
                console.log(`Exposure Value (EV) is: ${EV}`);
            });

            als.start();
        });
    }

    request(){
        console.log("Device request");
        DeviceMotionEvent.requestPermission().then(async (state) => {
            if (state === "granted") {
                await this.start();
            }
        });
    }

    async start(){
        console.log("START MOTION");
        window.addEventListener("devicemotion", this.handleMotionEvent.bind(this), true);

        console.log("START BATTERY");
        this.battery = await navigator.getBattery();
        this.battery.addEventListener('levelchange', this.handleBatteryLevelChangeEvent.bind(this));
        this.battery.addEventListener('chargingchange', this.handleBatteryChargingChangeEvent.bind(this));
    }

    handleBatteryLevelChangeEvent(){
        this.emit('battery_level', this.battery.level);
    }

    handleBatteryChargingChangeEvent(){
        this.emit('battery_charging', this.battery.charging);
    }

    handleMotionEvent(event){

        let x = event.acceleration.x;
        let y = event.acceleration.y;
        let z = event.acceleration.z;

        let diff_x = Math.abs(this.x - x);
        let diff_y = Math.abs(this.y - y);
        let diff_z = Math.abs(this.z - z);

        this.x = x;
        this.y = y;
        this.z = z;

        if(this.started && (diff_x > this.threshold || diff_y > this.threshold || diff_z > this.threshold)){
            this.handlePulse({diff_x, diff_y, diff_z});
        }
        else if (!this.started){
            this.started = true;
        }
    }

    handlePulse(message){
        if(this.pulse_timeout){
            //console.log('PULSE SENSOR', 'ClearTimeout');
            clearTimeout(this.pulse_timeout);
        }
        else{
            //console.log('PULSE SENSOR', 'send pulse');
            this.emit('pulse', message);
        }
        this.pulse_timeout = setTimeout(() => {
            console.log('PULSE SENSOR', 'end timeout');
            this.pulse_timeout = null;
        }, 500);
    }
}
