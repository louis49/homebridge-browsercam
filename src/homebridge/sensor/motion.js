import {Worker} from "worker_threads";
import EventEmitter from "events";
import path, {dirname} from "path";
import {fileURLToPath} from "url";

const directory = dirname(fileURLToPath(import.meta.url));

export class MotionDetector extends EventEmitter{
    constructor(log, height, width, threshold, id) {
        super();
        this.log = log;
        this.height = height;
        this.width = width;
        this.threshold = threshold;
        this.id = id;
        this.demo = false;

        let worker_path = path.join(directory, "worker_motion.js");
        this.worker = new Worker(worker_path, {workerData:{height : this.height, width : this.width, demo:this.demo, threshold:this.threshold, id:this.id}, stdin: true});

        this.worker.stdin.on('error',  (e) => {});

        this.worker.on('message', (message) => {
            this.log.debug(message);
            if(message.moving){
                this.log.info('Motion detected :', `${message.value.toFixed(2)}/${this.threshold}`);
                this.emit('motion');
            }
        });

        this.worker.stderr.on('data', (data) => {
            this.log.debug(data.toString());
        });

        this.worker.stdout.on('data', (data) => {
            this.log.debug(data.toString());
        });

        this.worker.on('close',() => {
            this.worker.removeAllListeners();
            this.worker.stdin.removeAllListeners();
            this.worker.stderr.removeAllListeners();
            this.worker.stdout.removeAllListeners();
            this.log.info('CLOSE motion detector');
        });
    }

    copy(buffer){
        if(this.worker.stdin.writable){
            this.worker.stdin.write(buffer);
        }
    }
}
