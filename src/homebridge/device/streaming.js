import {spawn} from "child_process";

import ffmpeg_for_homebridge from "ffmpeg-for-homebridge";

export class Streaming{
    constructor(api, log, config, sessionInfo, request, callback) {

        this.api = api;
        this.log = log;
        this.config = config;
        this.running = true;
        this.callback = callback;

        let profile = "";
        switch (request.video.profile) {
            case this.api.hap.H264Profile.MAIN:
                profile = "main";
                break;
            case this.api.hap.H264Profile.BASELINE:
                profile = "baseline";
                break;
            case this.api.hap.H264Profile.HIGH:
                profile = "high";
                break;
        }

        let level = "";
        switch (request.video.level) {
            case this.api.hap.H264Level.LEVEL3_1:
                level = "3.1";
                break;
            case this.api.hap.H264Level.LEVEL3_2:
                level = "3.2";
                break;
            case this.api.hap.H264Level.LEVEL4_0:
                level = "4.0";
                break;
        }

        let address = sessionInfo.address;
        let video_port = sessionInfo.videoPort;
        let v_srtp = sessionInfo.videoSRTP.toString('base64');
        let v_ssrc = sessionInfo.videoSSRC;
        let mtu = request.video.mtu; // 1316

        let vcodec = this.config.h264??'libx264';
        let encoderOptions = '-preset ultrafast -tune zerolatency';
        let fps = request.video.fps;
        let videoBitrate = request.video.max_bit_rate;
        let v_payload_type = request.video.pt;

        let acodec = 'libopus';
        let sample_rate = request.audio.sample_rate;
        let max_bit_rate = request.audio.max_bit_rate;
        let channel = request.audio.channel;
        let a_payload_type = request.audio.pt;
        let a_srtp = sessionInfo.audioSRTP.toString('base64');
        let a_ssrc = sessionInfo.audioSSRC;
        let audio_port = sessionInfo.audioPort;

        // -analyzeduration 2147483647 -probesize 2147483647
        let ffmpegArgs = `-i pipe:`;
        ffmpegArgs +=   ` -an -sn -dn -codec:v ${vcodec} -pix_fmt yuv420p -color_range mpeg -r ${fps} -f rawvideo ${encoderOptions} -b:v ${videoBitrate}k -profile:v ${profile} -level:v ${level} -payload_type ${v_payload_type}`;
        ffmpegArgs +=   ` -ssrc ${v_ssrc} -f rtp -srtp_out_suite AES_CM_128_HMAC_SHA1_80 -srtp_out_params ${v_srtp} srtp://${address}:${video_port}?rtcpport=${video_port}&pkt_size=${mtu}`;
        ffmpegArgs +=   ` -vn -sn -dn -codec:a ${acodec} -application lowdelay -flags +global_header -f null -ar ${sample_rate}k -b:a ${max_bit_rate}k -ac ${channel} -payload_type ${a_payload_type}`;
        ffmpegArgs +=   ` -ssrc ${a_ssrc} -f rtp -srtp_out_suite AES_CM_128_HMAC_SHA1_80 -srtp_out_params ${a_srtp} srtp://${address}:${audio_port}?rtcpport=${audio_port}&pkt_size=188 -hide_banner`;

        this.ffmpeg_stream = spawn(ffmpeg_for_homebridge??"ffmpeg", ffmpegArgs.split(/\s+/), {env: process.env});

        this.ffmpeg_stream.stdin.on('error',  (e) => {
            //this.log.error(e);
        });

        this.ffmpeg_stream.stdout.on('data', (data) => {
            this.log.debug(data.toString());
            if(this.callback){
                this.callback();
                this.callback = null;
            }
        });

        this.ffmpeg_stream.stderr.on('data', function (data){
            this.log.debug(data.toString());
        }.bind(this));

        this.ffmpeg_stream.on('error', (error) => {
            this.log.error('STREAMING : ', error);
        });

        this.ffmpeg_stream.on('close', () => {
            this.ffmpeg_stream.removeAllListeners();
            this.ffmpeg_stream.stdin.removeAllListeners();
            this.ffmpeg_stream.stderr.removeAllListeners();
            this.ffmpeg_stream.stdout.removeAllListeners();
            this.log.debug('STREAMING : Closing ffmpeg');
        });

        if(this.callback){
            this.callback();
            this.callback = null;
        }
    }

    copy(buffer){
        if(this.ffmpeg_stream.stdin.writable){
            if(this.running === true){
                this.ffmpeg_stream.stdin.write(buffer);
            }
            else{
                this.ffmpeg_stream.stdin.end(buffer);
                this.ffmpeg_stream = null;
            }
        }
    }

    stop(){
        this.running = false;
    }
}
