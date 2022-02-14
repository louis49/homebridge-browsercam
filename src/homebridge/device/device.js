import EventEmitter from "events";
import fs from "fs"

import {Camera} from "../camera/camera.js";
import {Framer} from "../camera/framer.js";
import {Streaming} from "./streaming.js";
import {MotionDetector} from "../sensor/motion.js";

import {Webmbufferkeyframe} from "../camera/webmbufferkeyframe.js";

const prefix = 'homebridge:browsercam-'

export class Device extends EventEmitter{
    constructor(api, log, config, id) {
        super();
        this.api = api
        this.log = log
        this.config = config
        this.id = id
        this.count = 0
        this.streaming_buffer = new Webmbufferkeyframe(this.config.streaming.buffer)
        if(this.config.recording.active){
            this.recording_buffer = new Webmbufferkeyframe(this.config.recording.buffer)
        }

        this.pendingSessions = {}

        this.random = false

        if(this.random){
            const random = Math.random() * 100000 + 100000;
            this.uuid = this.api.hap.uuid.generate(prefix + id + random);
        }
        else{
            this.uuid = this.api.hap.uuid.generate(prefix + id);
        }
        this.ready = false
    }

    configure(ws){
        // En cas de déconnexion, il faut purger tous les buffers car un nouveau header va arriver
        this.log.info('CONFIGURE')
        this.streaming_buffer = new Webmbufferkeyframe(this.config.streaming.buffer)
        if(this.config.recording.active){
            this.recording_buffer = new Webmbufferkeyframe(this.config.recording.buffer)
        }

        for(let sessionID of Object.keys(this.pendingSessions)){
            this.stop_stream(sessionID)
        }

        this.ws = ws
        this.ws.on("message", (message, isBinary) => {
            if(isBinary){
                this.data(message)
            }
            else{
                let json = JSON.parse(message.toString('utf-8'))
                //this.log.debug(json)
                if(json.settings){
                    this.log.info('DEVICE', 'Settings received')
                    this.settings = json.settings
                    this.prepare()
                    if(!this.ready){
                        this.ready = true
                        this.emit('ready', this)
                    }
                }
            }
        })
    }

    prepare(){
        this.camera = new Camera(this.api, this.log, this)

        this.log.info('FRAMER START')
        this.framer = new Framer(this.log, this.settings.height, this.settings.width)
        this.framer.on('frame', async (frame) => {
            this.frame = Buffer.from(frame)
        })

        if(this.config.motion_detector.active) {
            this.log.info('MOTION DETECTOR START')
            this.motion_detector = new MotionDetector(this.settings.height, this.settings.width, this.config.motion_detector.threshold)
            this.motion_detector.on('motion', ()=>this.emit('motion'))
        }

    }

    torch(value){
        this.settings.torch = value
        this.ws.send(JSON.stringify({torch : {value}, id : this.id}))
    }

    data(buffer){
        this.framer.copy(buffer)

        this.streaming_buffer.append(buffer)
        for(let sessionID of Object.keys(this.pendingSessions)){
            if(this.pendingSessions[sessionID].buffer){
                this.pendingSessions[sessionID].buffer.append(buffer)
            }
        }

        if(this.config.recording.active) {
            this.recording_buffer.append(buffer)
        }

        if(this.config.motion_detector.active) {
            this.motion_detector.copy(buffer)
        }
    }

    stream(sessionID, sessionInfo, request, callback) {
        this.pendingSessions[sessionID].streaming = new Streaming(this.api, sessionInfo, request, callback)
        this.pendingSessions[sessionID].buffer = this.streaming_buffer.clone()
        this.pendingSessions[sessionID].buffer.consume(this.pendingSessions[sessionID].streaming.ffmpeg_stream.stdin)
    }

    stop_stream(sessionID){
        this.pendingSessions[sessionID].streaming.stop()
        this.pendingSessions[sessionID].buffer.stop()
        this.pendingSessions[sessionID].streaming = null
        this.pendingSessions[sessionID].buffer = null
    }

    record(stdin){
        this.recording_buffer.consume(stdin)
    }

    stop_record(){
        this.recording_buffer.stop()
    }

    close(){
        this.emit('close',this.id)
    }
}
