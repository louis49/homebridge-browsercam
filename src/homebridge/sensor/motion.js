import {Worker} from "worker_threads";
import EventEmitter from "events";
import path, {dirname} from "path";
import {fileURLToPath} from "url";

const directory = dirname(fileURLToPath(import.meta.url));

export class MotionDetector extends EventEmitter{
    constructor(log, height, width, threshold, fps, id) {
        super();
        this.log = log;
        this.height = height;
        this.width = width;
        this.threshold = threshold;
        this.fps = fps;
        this.id = id;
        this.demo = false;

        let worker_path = path.join(directory, "worker_motion.js");
        this.worker = new Worker(worker_path, {workerData:{height : this.height, width : this.width, demo:this.demo, threshold:this.threshold, fps:this.fps, id:this.id}, stdin: true});

        this.worker.stdin.on('error',  (e) => {});

        this.worker.on('message', (message) => {
            this.log.debug(message);
            if(message.moving){
                this.log.info('Motion detected :', `${message.value.toFixed(2)}/${this.threshold}`);
                this.emit('motion');
            }
            else if(message.fps){
                if(message.fps < this.fps){
                    this.log.warn('You CPU is too slow, please reduce FPS setting to', message.fps, 'in you config');
                }
                else{
                    this.log.info('FPS is Ok', message.fps, '/', this.fps);
                }
            }
        });

        this.worker.stderr.on('data', (data) => {
            this.log.debug('MOTION', data.toString());
        });

        this.worker.stdout.on('data', (data) => {
            this.log.debug('MOTION', data.toString());
        });

        this.worker.on('close',() => {
            this.log.info('MOTION', 'closing worker');
            this.worker.removeAllListeners();
            this.worker.stdin.removeAllListeners();
            this.worker.stderr.removeAllListeners();
            this.worker.stdout.removeAllListeners();
        });
    }

    copy(buffer){
        if(this.worker.stdin.writable){
            this.worker.stdin.write(buffer);
        }
    }

    async close(){
        this.log.info('MOTION', 'Close - Killing worker');
        await this.worker?.terminate();
        this.worker.removeAllListeners();
        this.worker.stdin.removeAllListeners();
        this.worker.stderr.removeAllListeners();
        this.worker.stdout.removeAllListeners();
        this.removeAllListeners();
    }
}
