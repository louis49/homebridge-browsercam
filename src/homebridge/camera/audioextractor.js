import {spawn} from "child_process";

export class AudioExtractor{
    constructor(wav_decoder) {
        this.wav_decoder = wav_decoder;

        const args = `-i pipe: -vn -acodec pcm_s16le -ac 1 -f wav -blocksize 128 pipe: -hide_banner`;
        this.ffmpeg = spawn("ffmpeg", args.split(/\s+/), { env: process.env });

        this.ffmpeg.stdin.on('error',  (e) => {});

        this.ffmpeg.stdout.on('data', (data) => {
            this.wav_decoder.append(data);
        });

        this.ffmpeg.stderr.on('data', (data) => {
            //console.log('Audio extract', data.toString());
        });

        this.ffmpeg.on('error', (error) => {
            console.log(error);
        });

        this.ffmpeg.on('close', () => {
            console.log("Audio extract : Fmmpeg closed");
        });
    }

    copy(buffer){
        if(this.ffmpeg.stdin.writable){
            this.ffmpeg.stdin.write(buffer);
        }
    }
}
