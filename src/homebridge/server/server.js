import EventEmitter from "events";
import https from "https";
import express from "express";
import path, {dirname} from "path";
import {fileURLToPath} from "url";
import fs from "fs";

import {Certificate} from "./certificate.js";
import {Websocket} from './websocket.js';

const directory = dirname(fileURLToPath(import.meta.url));

const cert_file= 'cert.pem';
const key_file = 'key.pem';

export class AdminServer extends EventEmitter {
    constructor(log, config_path, port) {
        super();
        this.log = log;
        this.config_path = config_path;
        this.port = port;

        this.app = express();

        this.app.use('/', express.static(path.join(directory,'../../../dist/static')));

        this.cert_path = path.join(this.config_path, cert_file);
        this.key_path = path.join(this.config_path, key_file);
        try {
            log.info("Checking certificate");
            fs.accessSync(this.cert_path, fs.constants.R_OK);
            fs.accessSync(this.key_path, fs.constants.R_OK);
        } catch (err) {
            log.info("Generate certificate");
            let cert = Certificate.generateFull('BrowserCam', 'FR', 'ST', 'LOC', 'ORG', 'OU');
            fs.writeFileSync(this.cert_path, cert.cert);
            fs.writeFileSync(this.key_path, cert.key);
        }
    }

    async start(){
        this.log.info("Starting Server");
        return new Promise((resolve, reject) => {
            this.server = https.createServer({
                key: fs.readFileSync(this.key_path),
                cert: fs.readFileSync(this.cert_path),
            }, this.app).listen(this.port, () => {
                this.log.info(`Server is running on port ${this.server.address()["port"]}`);
                resolve(true);
            }).on('error', e => {
                this.log.error('Failed to launch the admin server:', e.message);
                reject(e);
            });

            this.websocket = new Websocket(this.server);
            this.websocket.on('open', (id, ws) => this.emit('open', id, ws));
            this.websocket.on('close', (id) => this.emit('close', id));
        });
    }
}
