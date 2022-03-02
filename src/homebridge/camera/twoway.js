import ffmpeg_for_homebridge from "ffmpeg-for-homebridge";
import {spawn} from "child_process";
import EventEmitter from "events";
import {WavDecoder} from "./wavdecoder.js";

export class TwoWay extends EventEmitter{
    constructor(log, audio_port, ipv6, target_address, audio_key, codec, sample_rate) {
        super();
        this.audio_port = audio_port;
        this.ipv6 = ipv6;
        this.codec = codec;
        this.sample_rate = sample_rate;
        this.audio_key = audio_key;
        this.target_address = target_address;
        this.log = log;
        this.wav_decoder = new WavDecoder(this.log);
    }

    start(){
        this.wav_decoder.on('audio_frame', (frame) => {
            this.emit('twoway', frame);
        });

        let csd = 'F8F0212C00BC00';

        let fi = 0;
        switch (this.sample_rate) {
            case 24:
                fi = 6;
                break;
            case 16:
                fi = 8;
                break;
            case 8:
                fi = 11;
                break;
        }
        let csdBuffer = Buffer.from(csd, 'hex');
        let b = csdBuffer[1];
        b &= 0b11100001;
        b |= (fi << 1);
        csdBuffer[1] = b;
        csd = csdBuffer.toString('hex').toUpperCase();

        let sdp  = [
            "v=0",
            "o=- 0 0 IN " + this.ipv6?'IP6':'IP4' + " " + this.target_address,
            "s=" + "HomeKit Audio Talkback",
            "c=IN " + (this.ipv6?'IP6':'IP4') + " " + this.target_address,
            "t=0 0",
            "m=audio " + this.audio_port + " RTP/AVP 110",
            "b=AS:24",
            ...(this.codec === 'OPUS'
                ? [
                    "a=rtpmap:110 opus/24000/2",
                    "a=fmtp:101 minptime=10;useinbandfec=1",
                ]
                : [
                    "a=rtpmap:110 MPEG4-GENERIC/16000/1",
                    "a=fmtp:110 profile-level-id=1;mode=AAC-hbr;sizelength=13;indexlength=3;indexdeltalength=3; config=" + csd,
                ]),
            "a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:" + this.audio_key.toString("base64")
        ].join("\n");

        console.log(sdp);

        let args = [];

        args.push(
            "-protocol_whitelist", "pipe,udp,rtp,file,crypto,tcp",
            "-acodec", this.codec === 'OPUS' ? "libopus" : "libfdk_aac",
            "-f", "sdp",
            "-i", "pipe:",
            "-f", "wav",
            "-acodec", "pcm_s16le",
            '-ac', '1',
            '-ar', this.sample_rate*1000,
            "pipe:"
        );

        console.log(args.join(" "));

        this.ffmpeg = spawn(ffmpeg_for_homebridge??"ffmpeg", args, { env: process.env });

        this.ffmpeg.stdin.on('error',  (e) => {});

        this.ffmpeg.stdout.on('data', (data) => {
            this.wav_decoder.append(data);
            //console.log("TwoWay stdout data :", data.length);
        });

        this.ffmpeg.stderr.on('data', (data) => {
            this.log.info("TwoWay stderr data :", data.toString());
        });

        this.ffmpeg.on('error', (error) => {
            this.log.error("TwoWay error :", error);
        });

        this.ffmpeg.on('close', () => {
            this.ffmpeg.removeAllListeners();
            this.ffmpeg.stdin.removeAllListeners();
            this.ffmpeg.stderr.removeAllListeners();
            this.ffmpeg.stdout.removeAllListeners();
            this.log.info('TWOWAY', 'closing ffmpeg');
        });

        this.ffmpeg.stdin.end(Buffer.from(sdp));
    }

    close(){
        this.log.info('TWOWAY', 'Close - Killing ffmpeg');
        this.ffmpeg?.kill('SIGKILL');
        this.wav_decoder.removeAllListeners();
        this.removeAllListeners();
    }
}
