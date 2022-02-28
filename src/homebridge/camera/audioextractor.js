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
            this.log.debug('AUDIO EXTRACTOR', data.toString());
        });

        this.ffmpeg.on('error', (error) => {
            this.log.error('AUDIO EXTRACTOR', error);
        });

        this.ffmpeg.on('close', () => {
            this.ffmpeg.removeAllListeners();
            this.ffmpeg.stdin.removeAllListeners();
            this.ffmpeg.stderr.removeAllListeners();
            this.ffmpeg.stdout.removeAllListeners();
            this.log.debug('AUDIO EXTRACTOR', 'closing ffmpeg');
        });
    }

    copy(buffer){
        if(this.ffmpeg.stdin.writable){
            this.ffmpeg.stdin.write(buffer);
        }
    }

    close(){
        this.log.info('AUDIO EXTRACTOR', 'Close - Killing ffmpeg');
        this.ffmpeg?.kill();
        this.ffmpeg.removeAllListeners();
        this.ffmpeg.stdin.removeAllListeners();
        this.ffmpeg.stderr.removeAllListeners();
        this.ffmpeg.stdout.removeAllListeners();
    }
}
