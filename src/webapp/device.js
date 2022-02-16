import EventEmitter from "events";

export class Device extends EventEmitter {
    constructor(threshold) {
        super();
        console.log('Device Init');
        this.threshold = threshold;

        if (DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === "function") {
            window.addEventListener("touchstart", this.request.bind(this), true);
        }
        else{
            this.start();
        }

        this.x = 0;
        this.y = 0;
        this.z = 0;

        this.started = false;
    }

    request(){
        console.log("request");
        DeviceMotionEvent.requestPermission().then((state) => {
            if (state === "granted") {
                this.start();
            }
        });
    }

    start(){
        console.log("START MOTION");

        window.addEventListener("devicemotion", this.handleMotionEvent.bind(this), true);
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
            this.emit('pulse');
        }
        this.pulse_timeout = setTimeout(() => {
            console.log('PULSE SENSOR', 'end timeout');
            this.pulse_timeout = null;
        }, 500);
    }
}
