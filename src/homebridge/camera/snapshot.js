import {spawn} from "child_process";
import Fifo from "fifo-buffer";
import ffmpeg_for_homebridge from "ffmpeg-for-homebridge";

export class Snapshot{
    constructor(log, current_height,current_width, height, width) {
        this.log = log;
        this.current_height = current_height;
        this.current_width = current_width;
        this.height = height;
        this.width = width;
    }

    snap(frame){
        this.promise = new Promise((resolve, reject) => {
            let resizeFilter = `-vf scale=${this.width}:${this.height}`;

            const args = `-f rawvideo -s ${this.current_width}x${this.current_height} -pix_fmt bgr24  -i pipe: -f mjpeg ${resizeFilter} -frames:v 1 pipe: -hide_banner`;
            this.ffmpeg = spawn(ffmpeg_for_homebridge??"ffmpeg", args.split(/\s+/), { env: process.env });

            this.ffmpeg.stdin.on('error',  (e) => {
                this.log.error(e);
            });

            let buffer = new Fifo(this.width*this.height*3*2);
            let size = 0;
            this.ffmpeg.stdout.on('data', (data) => {
                buffer.enq(data);
                size += data.length;
            });
            this.ffmpeg.on('error', (error) => {
                this.log.error(error);
            });

            this.ffmpeg.stderr.on('data', (data) => {
                this.log.debug("SNAPSHOT", data.toString());
            });

            this.ffmpeg.on('close', async () => {
                this.log.debug('SNAPSHOT closing ffmpeg');
                if(buffer.size > 0){
                    this.log.debug('SNAPSHOT resolve ffmpeg', buffer.size, size);
                    let snapshot = buffer.drain();
                    resolve(snapshot);
                }
                else {
                    this.log.debug('SNAPSHOT reject ffmpeg');
                    reject('Failed to fetch snapshot.');
                }
                setTimeout(() => {
                    this.log.debug('SNAPSHOT timeout ffmpeg');
                    this.promise = undefined;
                }, 3 * 1000);
            });

            if(this.ffmpeg.stdin.writable){
                this.ffmpeg.stdin.end(frame);
            }
        });
        return this.promise;
    }
}
