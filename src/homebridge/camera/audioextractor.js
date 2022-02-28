import {spawn} from "child_process";
import ffmpeg_for_homebridge from "ffmpeg-for-homebridge";

export class AudioExtractor{
    constructor(wav_decoder, log) {
        this.wav_decoder = wav_decoder;
        this.log = log;

        const args = `-i pipe: -vn -acodec pcm_s16le -ac 1 -f wav -blocksize 128 pipe: -hide_banner`;
        this.ffmpeg = spawn(ffmpeg_for_homebridge??"ffmpeg", args.split(/\s+/), { env: process.env });

        this.ffmpeg.stdin.on('error',  (e) => {});

        this.ffmpeg.stdout.on('data', (data) => {
            this.wav_decoder.append(data);
        });

        this.ffmpeg.stderr.on('data', (data) => {
            this.log.debug('Audio extract', data.toString());
        });

        this.ffmpeg.on('error', (error) => {
            this.log.error(error);
        });

        this.ffmpeg.on('close', () => {
            this.ffmpeg.removeAllListeners();
            this.ffmpeg.stdin.removeAllListeners();
            this.ffmpeg.stderr.removeAllListeners();
            this.ffmpeg.stdout.removeAllListeners();
            this.log.debug("Audio extract : Fmmpeg closed");
        });
    }

    copy(buffer){
        if(this.ffmpeg.stdin.writable){
            this.ffmpeg.stdin.write(buffer);
        }
    }
}
