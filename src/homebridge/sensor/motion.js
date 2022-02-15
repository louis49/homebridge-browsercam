import {Worker} from "worker_threads";
import EventEmitter from "events";
import path, {dirname} from "path";
import {fileURLToPath} from "url";

const directory = dirname(fileURLToPath(import.meta.url));

export class MotionDetector extends EventEmitter{
    constructor(height, width, threshold) {
        super();
        this.height = height;
        this.width = width;
        this.threshold = threshold;
        this.demo = true;

        let worker_path = path.join(directory, "worker_motion.js");
        this.worker = new Worker(worker_path, {workerData:{height : this.height, width : this.width, demo:this.demo, threshold:this.threshold}, stdin: true});

        this.worker.stdin.on('error',  (e) => {});

        this.worker.on('message', (message) => {
            //console.log(message)
            if(message.moving){
                this.emit('motion');
            }
        });

        this.worker.stderr.on('data', (data) => {
            console.log(data.toString());
        });

        this.worker.stdout.on('data', (data) => {
            //console.log(data.toString())
        });

        this.worker.on('close',() => {
            console.log('close motion detector');
        });
    }

    copy(buffer){
        if(this.worker.stdin.writable){
            this.worker.stdin.write(buffer);
        }
    }
}
