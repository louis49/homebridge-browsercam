import EventEmitter from "events";
import fs from "fs";

import {Camera} from "../camera/camera.js";
import {Framer} from "../camera/framer.js";
import {Streaming} from "./streaming.js";
import {MotionDetector} from "../sensor/motion.js";
import {AudioExtractor} from "../camera/audioextractor.js";

import {Webmbufferkeyframe} from "../camera/webmbufferkeyframe.js";
import {Mp4Buffer} from "../camera/mp4buffer.js";
import {WavDecoder} from "../camera/wavdecoder.js";
import {Noise} from "../sensor/noise.js";

import {TwoWay} from "../camera/twoway.js";

const prefix = 'homebridge:browsercam-';

export class Device extends EventEmitter{
    constructor(api, log, config, id) {
        super();
        this.api = api;
        this.log = log;
        this.config = config;
        this.id = id;
        this.count = 0;
        this.debug = false;

        if(this.debug) {
            this.debug_file = "debug-" + id + ".webm";
            this.log.debug("Debug file will be", this.debug_file);
            try{
                fs.rmSync(this.debug_file);
            }
            catch (e){}
        }

        this.streaming_sessions = {};

        this.random = false;

        if(this.random){
            const random = Math.random() * 100000 + 100000;
            this.uuid = this.api.hap.uuid.generate(prefix + id + random);
        }
        else{
            this.uuid = this.api.hap.uuid.generate(prefix + id);
        }
        this.ready = false;
    }

    configure(ws){
        this.log.info('CONFIGURE');

        for(let sessionID of Object.keys(this.streaming_sessions)){
            this.stop_stream(sessionID);
        }

        this.ws = ws;
        this.ws.on("message", (message, isBinary) => {
            if(isBinary){
                this.data(message);
            }
            else{
                let json = JSON.parse(message.toString());
                //this.log.info('Receive message:', json);
                if(json.settings){
                    this.log.info('DEVICE', 'Settings received', json.settings);
                    this.settings = json.settings;
                    this.prepare();
                    if(!this.ready){
                        this.ready = true;
                        this.ws.send(JSON.stringify({pulse_detector : {threshold:this.config.pulse_detector.threshold}}));
                        this.emit('ready', this);
                    }
                    this.emit('power', true);
                }
                else if (json.pulse){
                    this.log.info('DEVICE', 'Pulse detected :', `(${json.values.diff_x.toFixed(2)}-${json.values.diff_y.toFixed(2)}-${json.values.diff_z.toFixed(2)})/${this.config.pulse_detector.threshold}`);
                    this.emit('pulse');
                }
                else if (json.battery_level !== undefined){
                    this.log.info('DEVICE', 'Battery level received', json.battery_level);
                    this.settings.battery_level = json.battery_level;
                    this.emit('battery_level', json.battery_level);
                }
                else if (json.battery_charging !== undefined){
                    this.log.info('DEVICE', 'Battery charging received', json.battery_charging);
                    this.settings.battery_charging = json.battery_charging;
                    this.emit('battery_charging', json.battery_charging);
                }
            }
        });
    }

    prepare(){

        switch (this.settings.mimeType){
            case 'video/webm':
                this.streaming_buffer = new Webmbufferkeyframe(this.config.streaming.buffer, this.log);
                this.streaming_buffer.on('reload', this.reload.bind(this));
                if(this.config.recording.active){
                    this.recording_buffer = new Webmbufferkeyframe(this.config.recording.buffer, this.log);
                    this.recording_buffer.on('reload', this.reload.bind(this));
                }
                break;
            case 'video/mp4':
                this.streaming_buffer = new Mp4Buffer(this.config.streaming.buffer, this.log);
                this.streaming_buffer.on('reload', this.reload.bind(this));
                if(this.config.recording.active){
                    this.recording_buffer = new Mp4Buffer(this.config.recording.buffer, this.log);
                    this.recording_buffer.on('reload', this.reload.bind(this));
                }
                break;
            default:
                throw new Error('MimeType not recognized');
        }

        this.camera = new Camera(this.api, this.log, this.config, this);

        this.log.info('FRAMER START');
        this.framer = new Framer(this.log, this.settings.height, this.settings.width);
        this.framer.on('frame',(frame) => {
            this.frame = Buffer.from(frame);
        });

        if(this.config.motion_detector.active) {
            this.log.info('MOTION DETECTOR START');
            this.motion_detector = new MotionDetector(this.log, this.settings.height, this.settings.width, this.config.motion_detector.threshold,this.config.motion_detector.fps, this.id);
            this.motion_detector.on('motion', ()=>this.emit('motion'));
        }

        if(this.config.noise_detector.active) {
            this.log.info('AUDIO EXTRACTOR START');
            this.noise_sensor = new Noise(this.config.noise_detector.threshold, this.log);
            this.noise_sensor.on('noise', ()=>this.emit('noise'));
            this.wav_decoder = new WavDecoder(this.log);
            this.audio_extractor = new AudioExtractor(this.wav_decoder, this.log);
            this.wav_decoder.on('audio_frame', this.noise_sensor.append.bind(this.noise_sensor));
        }

    }

    torch(value){
        this.settings.torch = value;
        this.ws.send(JSON.stringify({torch : {value}, id : this.id}));
    }

    data(buffer){

        if(this.debug) {
            fs.writeFileSync(this.debug_file, buffer, {flag: 'a'});
        }

        this.framer.copy(buffer);

        this.streaming_buffer.append(buffer);
        for(let sessionID of Object.keys(this.streaming_sessions)){
            if(this.streaming_sessions[sessionID].buffer){
                this.streaming_sessions[sessionID].buffer.append(buffer);
            }
        }

        if(this.config.recording.active) {
            this.recording_buffer.append(buffer);
        }

        if(this.config.motion_detector.active) {
            this.motion_detector.copy(buffer);
        }

        if(this.config.noise_detector.active) {
            this.audio_extractor.copy(buffer);
        }
    }

    stream(sessionID, sessionInfo, request, callback) {
        this.streaming_sessions[sessionID].streaming = new Streaming(this.api, this.log, this.config, sessionInfo, request, callback);
        this.streaming_sessions[sessionID].buffer = this.streaming_buffer.clone();
        this.streaming_sessions[sessionID].buffer.on('reload', this.reload.bind(this));
        this.streaming_sessions[sessionID].buffer.consume(this.streaming_sessions[sessionID].streaming.ffmpeg_stream.stdin);
    }

    stop_stream(sessionID){
        if(this.streaming_sessions[sessionID] && this.streaming_sessions[sessionID].streaming) {
            this.streaming_sessions[sessionID].streaming.stop();
            this.streaming_sessions[sessionID].streaming = null;
        }
        if(this.streaming_sessions[sessionID] && this.streaming_sessions[sessionID].buffer){
            this.streaming_sessions[sessionID].buffer.stop();
            this.streaming_sessions[sessionID].buffer.removeAllListeners();
            this.streaming_sessions[sessionID].buffer = null;
        }
    }

    record(stdin){
        this.recording_buffer.consume(stdin);
    }

    stop_record(){
        this.recording_buffer.stop();
    }

    async close(){
        this.ready = false;
        this.emit('power', false);

        this.recording_buffer.stop();
        this.recording_buffer.removeAllListeners();
        this.streaming_buffer.stop();
        this.streaming_buffer.removeAllListeners();
        for(let sessionID of Object.keys(this.streaming_sessions)){
            if(this.streaming_sessions[sessionID].buffer){
                this.streaming_sessions[sessionID].buffer.stop();
                this.streaming_sessions[sessionID].buffer.removeAllListeners();
            }
        }

        this.framer?.close();
        this.audio_extractor?.close();
        this.noise_sensor?.removeAllListeners();
        this.wav_decoder?.removeAllListeners();
        await this.motion_detector?.close();
    }

    reload(){
        this.log.info('Sending Reload');
        this.ws.send(JSON.stringify({reload : {value:true}, id:this.id}));
    }

    start_twowayaudio(audio_port, video_port, ipv6, target_address, audio_key, codec, sample_rate){
        this.log.info('Starting Two Way Audio Server');
        this.twoway = new TwoWay(this.log, audio_port, ipv6, target_address, audio_key, codec, sample_rate);
        this.ws.send(JSON.stringify({twoway_init:{sample_rate:sample_rate*1000}, id:this.id}));
        this.twoway.on('twoway', this.send_audio_buffer.bind(this));
        this.twoway.start();
    }

    stop_twowayaudio(){
        this.twoway?.close();
    }

    send_audio_buffer(buffer){
        this.ws.send(buffer, {binary:true});
    }
}
