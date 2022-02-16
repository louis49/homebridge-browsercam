import {Device} from "./device/device.js";

export const PLATFORM_NAME = 'HomebridgeBrowserCam';
export const PLUGIN_NAME = 'homebridge-browsercam';

const config_path = "browsercam";
import {AdminServer} from "./server/server.js";
import {Rtsp} from "./server/rtsp.js";
import path from "path";


export class BrowserCam {
    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;

        this.devices = {};
        this.reloaded = {};

        this.api.on("didFinishLaunching" , async () => {
            this.log.info("didFinishLaunching");

            let rtsp = new Rtsp(6554, 5554);
            await rtsp.start();

            let server = new AdminServer(this.log,  path.join(this.api.user.storagePath(), config_path), this.config.port);
            server.on('open', this.open.bind(this));
            server.on('close', this.close.bind(this));

            await server.start();
        });
    }

    addAccessory(device){
        this.log.info('Adding Accessory', device.uuid);
        let displayName = device.settings.name; //`${device.settings.name} | ${device.settings.vendor} | ${device.settings.platform}`
        let accessory = new this.api.platformAccessory(displayName, device.uuid, this.api.hap.Categories.CAMERA);
        accessory.context.device = device;
        accessory.category = this.api.hap.Categories.CAMERA;

        // Torch
        if(device.settings.torch !== null){
            accessory.addService(this.api.hap.Service.Lightbulb, `Torch`, this.api.hap.uuid.generate('Torch'), 'torch');
        }

        // Motion detector
        if(this.config.motion_detector.active) {
            accessory.addService(this.api.hap.Service.MotionSensor, 'Motion sensor', this.api.hap.uuid.generate('Motion Sensor'), 'motion');
        }

        // Noise detector
        if(this.config.noise_detector.active) {
            accessory.addService(this.api.hap.Service.OccupancySensor, 'Noise sensor', this.api.hap.uuid.generate('Noise Sensor'), 'noise');
        }

        // Pulse detector
        if(this.config.pulse_detector.active) {
            accessory.addService(this.api.hap.Service.OccupancySensor, 'Pulse sensor', this.api.hap.uuid.generate('Pulse Sensor'), 'pulse');
        }

        //accessory.addService(this.api.hap.Service, 'Adjust', this.api.hap.uuid.generate('Adjust') , 'adjust')

        this.configureAccessory(accessory);

        //this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.api.publishExternalAccessories(PLUGIN_NAME, [accessory]);
        //this.api.publishCameraAccessories(PLUGIN_NAME, [accessory]);
    }

    configureAccessory(accessory){
        this.log.info('Configuring Accessory', accessory.context.device.uuid);
        accessory
            .getService(this.api.hap.Service.AccessoryInformation)
            .setCharacteristic(this.api.hap.Characteristic.Manufacturer, 'Homebridge')
            .setCharacteristic(this.api.hap.Characteristic.Model, 'browsercam')
            .setCharacteristic(this.api.hap.Characteristic.SerialNumber, accessory.context.device.id)
            .setCharacteristic(this.api.hap.Characteristic.FirmwareRevision, '1.0.0');

        this.torchService = accessory.getService(`Torch`);
        if(this.torchService){
            this.torchService.getCharacteristic(this.api.hap.Characteristic.On)
                .onSet((on) => {
                    this.log.info('Torch set', on?'on':'off');
                    accessory.context.device.torch(on);
                });

            this.torchService.getCharacteristic(this.api.hap.Characteristic.On)
                .on("get", (callback) => {
                    callback(null, accessory.context.device.settings.torch);
                });
        }

        // TEST Threshold
        /*
        this.adjustService = accessory.getService('Adjust');
        this.adjustService.addCharacteristic(new this.api.hap.Characteristic.TargetPosition())

        this.adjustService.getCharacteristic(this.api.hap.Characteristic.TargetPosition)
            .onSet((value) => {
                this.log.info('Adjust set', value);
                //accessory.context.device.torch(on)
            });

        this.adjustService.getCharacteristic(this.api.hap.Characteristic.TargetPosition)
            .on("get", (callback) => {
                callback(null, 100);
            });
*/

        accessory.context.device.motion_detected = false;
        accessory.context.device.noise_detected = false;
        accessory.context.device.pulse_detected = false;

        // MOTION SENSOR
        if(this.config.motion_detector.active){
            this.motion_sensor = accessory.getService('Motion sensor');
            this.motion_sensor.getCharacteristic(this.api.hap.Characteristic.MotionDetected).on("get", (callback => {
                let res = accessory.context.device.motion_detected || accessory.context.device.noise_detected || accessory.context.device.pulse_detected;
                this.log.info('MOTION SENSOR MotionDetected get', res);
                callback(null, res);
            }));

            accessory.context.device.on('motion', async() => {
                //this.log.info('Current duration :', accessory.context.device.recording_buffer.current_duration)
                if(accessory.context.device.recording_buffer.current_duration >= this.config.recording.buffer){
                    if(accessory.context.device.motion_timeout){
                        //this.log.info('MOTION SENSOR', 'ClearTimeout')
                        clearTimeout(accessory.context.device.motion_timeout);
                    }
                    else{
                        this.log.info('MOTION SENSOR', 'updateValue(true)');
                        accessory.context.device.motion_detected = true;
                        this.motion_sensor.getCharacteristic(this.api.hap.Characteristic.MotionDetected).updateValue(true);
                    }
                    accessory.context.device.motion_timeout = setTimeout(() => {
                        this.log.info('MOTION SENSOR', 'updateValue(false)');
                        accessory.context.device.motion_detected = false;
                        this.motion_sensor.getCharacteristic(this.api.hap.Characteristic.MotionDetected).updateValue(false);
                        accessory.context.device.motion_timeout = null;
                        accessory.context.device.stop_record();
                    }, this.config.motion_detector.timeout);
                }
            });
        }


        // NOISE SENSOR
        if(this.config.noise_detector.active){
            this.noise_sensor = accessory.getService('Noise sensor');
            this.noise_sensor.getCharacteristic(this.api.hap.Characteristic.OccupancyDetected).on("get", (callback => {
                this.log.info('NOISE SENSOR OccupancyDetected get', accessory.context.device.noise_detected);
                callback(null, accessory.context.device.noise_detected);
            }));

            accessory.context.device.on('noise', () => {
                if(accessory.context.device.noise_timeout){
                    //this.log.info('NOISE SENSOR', 'ClearTimeout');
                    clearTimeout(accessory.context.device.noise_timeout);
                }
                else{
                    this.log.info('NOISE SENSOR', 'updateValue(true)');
                    accessory.context.device.noise_detected = true;
                    this.noise_sensor.getCharacteristic(this.api.hap.Characteristic.OccupancyDetected).updateValue(true);

                    if(this.config.noise_detector.record && !accessory.context.device.motion_detected && !accessory.context.device.pulse_detected){
                        this.log.info('MOTION SENSOR (NOISE)', 'updateValue(true)');
                        accessory.context.device.motion_detected = true;
                        this.motion_sensor.getCharacteristic(this.api.hap.Characteristic.MotionDetected).updateValue(true);
                    }
                }
                accessory.context.device.noise_timeout = setTimeout(() => {
                    this.log.info('NOISE SENSOR', 'updateValue(false)');
                    accessory.context.device.noise_detected = false;
                    this.noise_sensor.getCharacteristic(this.api.hap.Characteristic.OccupancyDetected).updateValue(false);
                    accessory.context.device.noise_timeout = null;
                    if(this.config.noise_detector.record && !accessory.context.device.motion_detected && !accessory.context.device.pulse_detected){
                        this.log.info('MOTION SENSOR (NOISE)', 'updateValue(false)');
                        accessory.context.device.motion_detected = false;
                        this.motion_sensor.getCharacteristic(this.api.hap.Characteristic.MotionDetected).updateValue(false);
                    }
                }, this.config.noise_detector.timeout);
            });
        }

        // PULSE SENSOR
        if(this.config.pulse_detector.active){
            this.pulse_sensor = accessory.getService('Pulse sensor');
            this.pulse_sensor.getCharacteristic(this.api.hap.Characteristic.OccupancyDetected).on("get", (callback => {
                this.log.info('PULSE SENSOR OccupancyDetected get', accessory.context.device.noise_detected);
                callback(null, accessory.context.device.pulse_detected);
            }));

            accessory.context.device.on('pulse', () => {
                if(accessory.context.pulse_timeout){
                    //this.log.info('NOISE SENSOR', 'ClearTimeout');
                    clearTimeout(accessory.context.pulse_timeout);
                }
                else{
                    this.log.info('PULSE SENSOR', 'updateValue(true)');
                    accessory.context.pulse_detected = true;
                    this.pulse_sensor.getCharacteristic(this.api.hap.Characteristic.OccupancyDetected).updateValue(true);
                    if(this.config.pulse_detector.record && !accessory.context.motion_detected && !accessory.context.noise_detected){
                        this.log.info('MOTION SENSOR (PULSE)', 'updateValue(true)');
                        accessory.context.device.motion_detected = true;
                        this.motion_sensor.getCharacteristic(this.api.hap.Characteristic.MotionDetected).updateValue(true);
                    }
                }
                accessory.context.pulse_timeout = setTimeout(() => {
                    this.log.info('PULSE SENSOR', 'updateValue(false)');
                    accessory.context.pulse_detected = false;
                    this.pulse_sensor.getCharacteristic(this.api.hap.Characteristic.OccupancyDetected).updateValue(false);
                    accessory.context.pulse_timeout = null;
                    if(this.config.pulse_detector.record && !accessory.context.motion_detected && !accessory.context.noise_detected){
                        this.log.info('MOTION SENSOR (PULSE)', 'updateValue(false)');
                        accessory.context.device.motion_detected = false;
                        this.motion_sensor.getCharacteristic(this.api.hap.Characteristic.MotionDetected).updateValue(false);
                    }
                }, this.config.pulse_detector.timeout);
            });
        }


        const options = {
            cameraStreamCount: 2,
            delegate: accessory.context.device.camera,
            sensors : {
                motion: this.motion_sensor,
                occupancy: false//this.noise_sensor
            },
            recording:{
                delegate: accessory.context.device.camera,
                options: {
                    overrideEventTriggerOptions: [this.api.hap.EventTriggerOption.MOTION, this.api.hap.EventTriggerOption.DOORBELL],
                    audio:{
                        codecs: [
                            {
                                type: this.api.hap.AudioRecordingCodecType.AAC_ELD,
                                samplerate: [this.api.hap.AudioRecordingSamplerate.KHZ_48],
                                audioChannels: 1,
                                bitrateMode: this.api.hap.AudioBitrate.VARIABLE,
                            }
                        ]
                    },
                    mediaContainerConfiguration:[{
                        fragmentLength: this.config.recording.buffer,
                        type: this.api.hap.MediaContainerType.FRAGMENTED_MP4
                    }],
                    prebufferLength : this.config.recording.buffer,
                    video:{
                        resolutions: [
                            [320, 180, 30],
                            [320, 240, 15],
                            [320, 240, 30],
                            [480, 270, 30],
                            [480, 360, 30],
                            [640, 360, 30],
                            [640, 480, 30],
                            [1280, 720, 30],
                            [1280, 960, 30],
                            [1920, 1080, 30],
                            [1600, 1200, 30]
                        ],
                        parameters: {
                            profiles: [this.api.hap.H264Profile.BASELINE, this.api.hap.H264Profile.MAIN, this.api.hap.H264Profile.HIGH],
                            levels: [this.api.hap.H264Level.LEVEL3_1, this.api.hap.H264Level.LEVEL3_2, this.api.hap.H264Level.LEVEL4_0]
                        },
                        type: this.api.hap.VideoCodecType.H264
                    }
                }
            },
            streamingOptions: {
                supportedCryptoSuites: [this.api.hap.SRTPCryptoSuites.AES_CM_128_HMAC_SHA1_80],
                video: {
                    resolutions: [
                        [320, 180, 30],
                        [320, 240, 15],
                        [320, 240, 30],
                        [480, 270, 30],
                        [480, 360, 30],
                        [640, 360, 30],
                        [640, 480, 30],
                        [1280, 720, 30],
                        [1280, 960, 30],
                        [1920, 1080, 30],
                        [1600, 1200, 30],
                    ],
                    codec: {
                        profiles: [this.api.hap.H264Profile.BASELINE, this.api.hap.H264Profile.MAIN, this.api.hap.H264Profile.HIGH],
                        levels: [this.api.hap.H264Level.LEVEL3_1, this.api.hap.H264Level.LEVEL3_2, this.api.hap.H264Level.LEVEL4_0]
                    }
                },
                audio: {
                    twoWayAudio: false,
                    codecs: [
                        {
                            /*type: api.hap.AudioStreamingCodecType.AAC_ELD,
                            samplerate: api.hap.AudioStreamingSamplerate.KHZ_16*/
                            type: this.api.hap.AudioStreamingCodecType.OPUS,
                            samplerate: this.api.hap.AudioStreamingSamplerate.KHZ_24
                        }
                    ]
                }
            }
        };

        if(!this.config.recording.active){
            options.recording = {};
        }
        if(!this.config.motion_detector.active){
            options.sensors.motion = false;
        }

        this.controller = new this.api.hap.CameraController(options);

        accessory.configureController(this.controller);
    }

    open(id, ws){
        this.log.info('Open', id);

        if(!this.reloaded[id]){
            ws.send(JSON.stringify({reload : {value:true}, id}));
            this.reloaded[id] = true;
            return;
        }

        if(!this.devices[id]){
            this.log.info('Creating new Device');
            let device = new Device(this.api, this.log, this.config, id);
            device.configure(ws);
            this.devices[id] = device;
            device.on('ready', this.addAccessory.bind(this));
        }
        else {
            this.log.info('Get current Device');
            this.devices[id].configure(ws);
        }
    }

    close(id){
        this.log.info('Close', id);
        this.devices[id]?.close();
    }
}
