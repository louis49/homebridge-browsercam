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

const prefix = 'homebridge:browsercam-';

export class Device extends EventEmitter{
    constructor(api, log, config, id) {
        super();
        this.api = api;
        this.log = log;
        this.config = config;
        this.id = id;
        this.count = 0;
        
        this.pendingSessions = {};

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

        for(let sessionID of Object.keys(this.pendingSessions)){
            this.stop_stream(sessionID);
        }

        this.ws = ws;
        this.ws.on("message", (message, isBinary) => {
            if(isBinary){
                this.data(message);
            }
            else{
                //console.log(message.toString());
                let json = JSON.parse(message.toString());
                //this.log.debug(json)
                if(json.settings){
                    this.log.info('DEVICE', 'Settings received');
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
                    this.emit('pulse');
                }
            }
        });
    }

    prepare(){

        // En cas de déconnexion, il faut purger tous les buffers car un nouveau header va arriver
        switch (this.settings.mimeType){
            case 'video/webm':
                this.streaming_buffer = new Webmbufferkeyframe(this.config.streaming.buffer);
                if(this.config.recording.active){
                    this.recording_buffer = new Webmbufferkeyframe(this.config.recording.buffer);
                }
                break;
            case 'video/mp4':
                this.streaming_buffer = new Mp4Buffer(this.config.streaming.buffer);
                if(this.config.recording.active){
                    this.recording_buffer = new Mp4Buffer(this.config.recording.buffer);
                }
                break;
            default:
                throw new Error('MimeType not recognized');
        }

        this.camera = new Camera(this.api, this.log, this);

        this.log.info('FRAMER START');
        this.framer = new Framer(this.log, this.settings.height, this.settings.width);
        this.framer.on('frame',(frame) => {
            this.frame = Buffer.from(frame);
        });

        if(this.config.motion_detector.active) {
            this.log.info('MOTION DETECTOR START');
            this.motion_detector = new MotionDetector(this.settings.height, this.settings.width, this.config.motion_detector.threshold, this.id);
            this.motion_detector.on('motion', ()=>this.emit('motion'));
        }

        if(this.config.noise_detector.active) {
            this.log.info('AUDIO EXTRACTOR START');
            this.wav_decoder = new WavDecoder();
            this.noise_sensor = new Noise(this.config.noise_detector.threshold);
            this.noise_sensor.on('noise', ()=>this.emit('noise'));
            this.audio_extractor = new AudioExtractor(this.wav_decoder);
            this.wav_decoder.on('audio_frame', this.noise_sensor.append.bind(this.noise_sensor));
        }

    }

    torch(value){
        this.settings.torch = value;
        this.ws.send(JSON.stringify({torch : {value}, id : this.id}));
    }

    data(buffer){
        this.framer.copy(buffer);

        this.streaming_buffer.append(buffer);
        for(let sessionID of Object.keys(this.pendingSessions)){
            if(this.pendingSessions[sessionID].buffer){
                this.pendingSessions[sessionID].buffer.append(buffer);
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
        this.pendingSessions[sessionID].streaming = new Streaming(this.api, sessionInfo, request, callback);
        this.pendingSessions[sessionID].buffer = this.streaming_buffer.clone();
        this.pendingSessions[sessionID].buffer.consume(this.pendingSessions[sessionID].streaming.ffmpeg_stream.stdin);
    }

    stop_stream(sessionID){
        if(this.pendingSessions[sessionID] && this.pendingSessions[sessionID].streaming) {
            this.pendingSessions[sessionID].streaming.stop();
            this.pendingSessions[sessionID].streaming = null;
        }
        if(this.pendingSessions[sessionID] && this.pendingSessions[sessionID].buffer){
            this.pendingSessions[sessionID].buffer.stop();
            this.pendingSessions[sessionID].buffer = null;
        }
    }

    record(stdin){
        this.recording_buffer.consume(stdin);
    }

    stop_record(){
        this.recording_buffer.stop();
    }

    close(){
        this.emit('power', false);
        this.emit('close',this.id);
    }
}
