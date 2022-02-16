import {createServer} from "net";
import {once} from "events";
import {spawn} from "child_process";

import ffmpeg_for_homebridge from "ffmpeg-for-homebridge";

export class Recording{
    constructor(log, input, audio, video, device) {
        this.log = log;
        this.device = device;
        this.connectPromise = new Promise(resolve => this.connectResolve = resolve);
        this.server = createServer(this.handleConnection.bind(this));

        this.input = input;
        this.audio = audio;
        this.video = video;

        this.args  = [];

        this.args.push(...input);
        this.args.push(...video);
        this.args.push("-fflags",
            "+genpts",
            "-reset_timestamps",
            "1");

        this.args.push(
            "-movflags", "frag_keyframe+empty_moov+default_base_moof", "-hide_banner"
        );
        this.args.push("-f", "mp4");
        this.args.push(...audio);

    }

    handleConnection(socket) {
        this.server.close(); // don't accept any further clients
        this.socket = socket;
        this.connectResolve?.();
    }

    destroy() {
        this.socket?.destroy();
        this.ffmpeg_process?.kill();

        this.socket = undefined;
        this.ffmpeg_process = undefined;
        this.destroyed = true;
    }

    async start(){
        const promise = once(this.server, "listening");
        this.server.listen();
        await promise;

        if (this.destroyed) {
            return;
        }

        const port = this.server.address()["port"];
        this.args.push("tcp://127.0.0.1:" + port);

        //this.log.info('RECORDING', ffmpeg_for_homebridge??"ffmpeg" + " " + this.args.join(" "));

        this.ffmpeg_process = spawn(ffmpeg_for_homebridge??"ffmpeg", this.args, { env: process.env });

        this.ffmpeg_process.stdin.on('error',  (error) => {
            this.log.error('RECORDING', error);
        });

        this.ffmpeg_process.on('error', (error) => {
            this.log.error('RECORDING', error);
        });

        this.ffmpeg_process.stderr.on('data', (data) => {
            //this.log.info('RECORDING', data.toString())
        });

        this.ffmpeg_process.stdout.on('data', (data) => {
            //this.log.info('RECORDING', data.toString())
        });

        this.ffmpeg_process.on('close', () => {
            this.log.debug("RECORDING : Fmmpeg closed");
        });

        this.device.record(this.ffmpeg_process.stdin);
    }

    async* generator(){
        await this.connectPromise;

        if (!this.socket || !this.ffmpeg_process) {
            this.log.error("Socket undefined " + !!this.socket + " ffmpeg_process undefined " + !!this.ffmpeg_process);
            throw new Error("Unexpected state!");
        }

        while (true) {
            const header = await this.read(8);
            const length = header.readInt32BE(0) - 8;
            const type = header.slice(4).toString();
            const data = await this.read(length);

            yield {
                header: header,
                length: length,
                type: type,
                data: data,
            };
        }
    }

    async read(length){
        if (!this.socket) {
            throw Error("FFMPEG tried reading from closed socket!");
        }

        if (!length) {
            return Buffer.alloc(0);
        }

        const value = this.socket.read(length);
        if (value) {
            return value;
        }

        return new Promise((resolve, reject) => {
            const readHandler = () => {
                const value = this.socket.read(length);
                if (value) {
                    cleanup();
                    resolve(value);
                }
            };

            const endHandler = () => {
                cleanup();
                reject(new Error(`FFMPEG socket closed during read for ${length} bytes!`));
            };

            const cleanup = () => {
                this.socket?.removeListener("readable", readHandler);
                this.socket?.removeListener("close", endHandler);
            };

            if (!this.socket) {
                throw new Error("FFMPEG socket is closed now!");
            }

            this.socket.on("readable", readHandler);
            this.socket.on("close", endHandler);
        });
    }
}
