import pickPort from 'pick-port'

import ffmpeg_for_homebridge from "ffmpeg-for-homebridge";

import {Snapshot} from "./snapshot.js";
import {Recording} from "../device/recording.js";

export class Camera{

    constructor(api, log, device) {
        this.api = api
        this.log = log
        this.device = device
    }

    /* CameraStreamingDelegate */
    async handleSnapshotRequest(request, callback){
        let snapshot = new Snapshot(this.log, this.device.settings.height, this.device.settings.width, request.height, request.width)
        let snap;
        try{
            snap = await snapshot.snap(this.device.frame)
            //this.log.info('Sending Snap', snap.length)
        }
        catch (e){
            this.log.error(e)
        }
        callback(null, snap);
    }

    async prepareStream(request, callback){
        this.log.info("prepareStream")

        const ipv6 = request.addressVersion === 'ipv6';

        const options = {
            type: 'udp',
            ip: ipv6 ? '::' : '0.0.0.0',
            reserveTimeout: 15
        };
        const videoReturnPort = await pickPort(options);
        const videoSSRC = this.api.hap.CameraController.generateSynchronisationSource();
        const audioReturnPort = await pickPort(options);
        const audioSSRC = this.api.hap.CameraController.generateSynchronisationSource();

        const sessionInfo = {
            address: request.targetAddress,
            ipv6: ipv6,
            videoPort: request.video.port,
            videoReturnPort: videoReturnPort,
            videoCryptoSuite: request.video.srtpCryptoSuite,
            videoSRTP: Buffer.concat([request.video.srtp_key, request.video.srtp_salt]),
            videoSSRC: videoSSRC,
            audioPort: request.audio.port,
            audioReturnPort: audioReturnPort,
            audioCryptoSuite: request.audio.srtpCryptoSuite,
            audioSRTP: Buffer.concat([request.audio.srtp_key, request.audio.srtp_salt]),
            audioSSRC: audioSSRC
        };

        const response = {
            video: {
                port: videoReturnPort,
                ssrc: videoSSRC,
                srtp_key: request.video.srtp_key,
                srtp_salt: request.video.srtp_salt
            },
            audio: {
                port: audioReturnPort,
                ssrc: audioSSRC,
                srtp_key: request.audio.srtp_key,
                srtp_salt: request.audio.srtp_salt
            }
        };

        this.device.pendingSessions[request.sessionID] = {session : sessionInfo};
        callback(undefined, response);
    }

    handleStreamRequest(request, callback){
        this.log.info("handleStreamRequest")
        let session = this.device.pendingSessions[request.sessionID].session;
        switch (request.type) {
            case this.api.hap.StreamRequestTypes.START:
                this.log.info('START stream : ' + request.video.width + ' x ' + request.video.height + ', ' +
                    request.video.fps + ' fps, ' + request.video.max_bit_rate + ' kbps');
                this.device.stream(request.sessionID, session, request, callback)
                break;
            case this.api.hap.StreamRequestTypes.RECONFIGURE:
                this.log.info('Received request to reconfigure: ' + request.video.width + ' x ' + request.video.height + ', ' +
                    request.video.fps + ' fps, ' + request.video.max_bit_rate + ' kbps (Ignored)');
                callback();
                break;
            case this.api.hap.StreamRequestTypes.STOP:
                this.log.info("STOP Stream")
                this.device.stop_stream(request.sessionID)
                if (session.timeout) {
                    clearTimeout(session.timeout);
                }
                delete this.device.pendingSessions[request.sessionID];
                callback();
                break;
        }
    }

    /* CameraRecordingDelegate */
    // https://developers.homebridge.io/HAP-NodeJS/interfaces/CameraRecordingDelegate.html#updateRecordingActive
    updateRecordingActive(active){
        this.log.info('updateRecordingActive', active);
    }

    // https://developers.homebridge.io/HAP-NodeJS/interfaces/CameraRecordingDelegate.html#updateRecordingConfiguration
    updateRecordingConfiguration(configuration){
        this.configuration = configuration;
        this.log.info('updateRecordingConfiguration', configuration)
    }

    // https://developers.homebridge.io/HAP-NodeJS/interfaces/CameraRecordingDelegate.html#handleRecordingStreamRequest
    async *handleRecordingStreamRequest(streamId) {
        this.log.info('handleRecordingStreamRequest', streamId)

        const STOP_AFTER_MOTION_STOP = false;

        this.handlingStreamingRequest = true;

        let size = `s=${this.configuration.videoCodec.resolution[0]}x${this.configuration.videoCodec.resolution[1]}:r=${this.configuration.videoCodec.resolution[2]}`
        //console.log(size)
        const input = ["-i", "pipe:"]

        let profile = ""
        switch (this.configuration.videoCodec.parameters.profile) {
            case this.api.hap.H264Profile.MAIN:
                profile = "main"
                break
            case this.api.hap.H264Profile.BASELINE:
                profile = "baseline"
                break
            case this.api.hap.H264Profile.HIGH:
                profile = "high"
                break
        }

        let level = ""
        switch (this.configuration.videoCodec.parameters.level) {
            case this.api.hap.H264Level.LEVEL3_1:
                level = "3.1"
                break
            case this.api.hap.H264Level.LEVEL3_2:
                level = "3.2"
                break
            case this.api.hap.H264Level.LEVEL4_0:
                level = "4.0"
                break
        }

        const video = [
//            "-an",
//            "-sn",
//            "-dn",
            "-codec:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-profile:v", profile,
            "-level:v", level,
            "-b:v", `${this.configuration.videoCodec.parameters.bitRate}k`,
            "-vf",
            `framerate=fps=25,scale=w=${this.configuration.videoCodec.resolution[0]}:h=${this.configuration.videoCodec.resolution[1]}:force_original_aspect_ratio=1,pad=${this.configuration.videoCodec.resolution[0]}:${this.configuration.videoCodec.resolution[1]}:(ow-iw)/2:(oh-ih)/2`,
            "-force_key_frames", `expr:eq(t,n_forced*${this.configuration.videoCodec.parameters.iFrameInterval / 1000})`,
            //"-r", this.configuration.videoCodec.resolution[2].toString(),
        ]
        // https://github.com/seydx/homebridge-camera-ui/blob/eb00a33155f2d5c107cd21d53ba645f309bc5aca/src/services/recording.service.js#L168
        // https://github.com/homebridge/HAP-NodeJS/blob/00d8a11b92f3812302c7b23303139f82fd7f9b97/src/accessories/Camera_accessory.ts#L350

        let samplerate = "";
        switch (this.configuration.audioCodec.samplerate) {
            case this.api.hap.AudioRecordingSamplerate.KHZ_8:
                samplerate = "8";
                break;
            case this.api.hap.AudioRecordingSamplerate.KHZ_16:
                samplerate = "16";
                break;
            case this.api.hap.AudioRecordingSamplerate.KHZ_24:
                samplerate = "24";
                break;
            case this.api.hap.AudioRecordingSamplerate.KHZ_32:
                samplerate = "32";
                break;
            case this.api.hap.AudioRecordingSamplerate.KHZ_44_1:
                samplerate = "44.1";
                break;
            case this.api.hap.AudioRecordingSamplerate.KHZ_48:
                samplerate = "48";
                break;
            default:
                throw new Error("Unsupported audio samplerate: " + this.configuration.audioCodec.samplerate);
        }

        // Gérer Opus ?
        const audio = [
            "-acodec", "libfdk_aac",
            ...(this.configuration.audioCodec.type === this.api.hap.AudioRecordingCodecType.AAC_LC ?
                ["-profile:a", "aac_low"] :
                ["-profile:a", "aac_eld"]),
            "-ar", `${samplerate}k`,
            "-b:a", `${this.configuration.audioCodec.bitrate}k`,
            "-ac", `${this.configuration.audioCodec.audioChannels}`,
        ]

        this.server = new Recording(this.log, input, audio, video, this.device)

        await this.server.start();
        if (!this.server || this.server.destroyed) {
            return; // early exit
        }

        const pending = [];

        try {
            for await (const box of this.server.generator()) {
                pending.push(box.header, box.data);

                //const motionDetected = camera.getService(Service.MotionSensor)?.getCharacteristic(Characteristic.MotionDetected).value;

                //console.log("mp4 box type " + box.type + " and length " + box.length);
                if (box.type === "moov" || box.type === "mdat") {
                    const fragment = Buffer.concat(pending);
                    pending.splice(0, pending.length);

                    //&& !this.device.motiondetected

                    const isLast = STOP_AFTER_MOTION_STOP && !this.device.recording_buffer.streaming;

                    if(isLast){
                        console.log("isLast")
                    }

                    yield {
                        data: fragment,
                        isLast: isLast,
                    };

                    if (isLast) {
                        this.log.info("Ending session due to motion stopped!");
                        break;
                    }
                }
            }
        } catch (error) {
            if (!error.message.startsWith("FFMPEG")) { // cheap way of identifying our own emitted errors
                console.error("Encountered unexpected error on generator " + error.stack);
            }
        }
    }

    // https://developers.homebridge.io/HAP-NodeJS/interfaces/CameraRecordingDelegate.html#acknowledgeStream
    acknowledgeStream(streamId){
        this.log.info('acknowledgeStream', streamId)
    }

    // https://developers.homebridge.io/HAP-NodeJS/interfaces/CameraRecordingDelegate.html#closeRecordingStream
    closeRecordingStream(streamId, reason){
        this.log.info('closeRecordingStream', streamId, this.api.hap.HDSProtocolSpecificErrorReason[reason])
        if (this.server) {
            this.server.destroy();
            this.server = undefined;
        }
        this.handlingStreamingRequest = false;
        this.device.stop_record()
    }
}
