import {spawn} from "child_process";
import Fifo from "fifo-buffer";
import EventEmitter from "events";

import ffmpeg_for_homebridge from "ffmpeg-for-homebridge";

export class Framer extends EventEmitter {
    constructor(log, height, width) {
        super()
        this.log = log
        this.height = height
        this.width = width

        const args = `-i pipe: -f rawvideo -pix_fmt bgr24 pipe: -hide_banner`
        this.ffmpeg = spawn(ffmpeg_for_homebridge??"ffmpeg", args.split(/\s+/), { env: process.env })

        let buffer = new Fifo(this.height*this.width*3*2)
        this.ffmpeg.stdout.on('data', (data) => {
            let k = buffer.enq(data)
            if(k === false){
                this.log.error("Error : Not enqueued")
            }
            //console.log("Enqueue", buffer.size, "/", this.height*this.width*3)
            if(buffer.size >= this.height*this.width*3){
                //console.log('Buffer ', buffer.size, this.height*this.width*3)
                let frame = buffer.deq(this.height*this.width*3)
                //console.log('Frame available with ', frame.length, buffer.size)
                this.emit('frame', frame)
            }
        });
        this.ffmpeg.on('error', (error) => {
            //this.log.debug('FRAMER', error);
        });

        this.ffmpeg.stderr.on('data', (data) => {
            //this.log.debug('FRAMER',data.toString())
        });

        this.ffmpeg.on('close', async () => {
            this.log.debug('FRAMER', 'closing ffmpeg')
        });
    }

    copy(buffer){
        if(this.ffmpeg.stdin.writable){
            this.ffmpeg.stdin.write(buffer)
        }
    }
}
