import ffmpeg_for_homebridge from "ffmpeg-for-homebridge";
import {spawn} from "child_process";

export class TwoWay{
    constructor(audio_port, ipv6, target_address, audio_key, codec, sample_rate, pt) {
        this.audio_port = audio_port;
        this.ipv6 = ipv6;
        this.pt = pt;
        this.codec = codec;
        this.sample_rate = sample_rate;
        this.audio_key = audio_key;
        this.target_address = target_address;
    }

    start(){
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
            "-f", this.codec === 'OPUS' ? "opus":'aac',
            "-acodec", "copy",
            '-ac', '1',
            //"-loglevel", "56",
            "pipe:"
        );

        console.log(args.join(" "));

        this.ffmpeg = spawn(ffmpeg_for_homebridge??"ffmpeg", args, { env: process.env });

        this.ffmpeg.stdin.on('error',  (e) => {});

        this.ffmpeg.stdout.on('data', (data) => {
            //console.log("TwoWay stdout data :", data.length);
        });

        this.ffmpeg.stderr.on('data', (data) => {
            console.log("TwoWay stderr data :", data.toString());
        });

        this.ffmpeg.on('error', (error) => {
            console.log("TwoWay error :", error);
        });

        this.ffmpeg.on('close', () => {
            console.log("TwoWay : Fmmpeg closed");
        });

        this.ffmpeg.stdin.end(Buffer.from(sdp));
    }
}
