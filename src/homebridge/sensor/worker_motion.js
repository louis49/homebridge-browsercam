import {workerData, parentPort} from "worker_threads";
import cv from "./opencv.cjs";
import {spawn} from "child_process";
import Fifo from "fifo-buffer";
import ffmpeg_for_homebridge from "ffmpeg-for-homebridge";

class WorkerMotionDetector{
    constructor() {

        this.input_height = workerData.height;
        this.input_width = workerData.width;
        this.threshold = workerData.threshold;

        this.output_height = 240;
        this.output_width = 320;

        this.demo = workerData.demo;

        this.mounted = false;

        if(this.demo){
            const ffmpegArgs_demo = `-f rawvideo -pix_fmt bgr24 -s ${this.output_width}x${this.output_height} -i pipe: -c:v mpeg1video -f rtsp -rtsp_transport udp rtsp://127.0.0.1:5554/demo -hide_banner`;
            this.ffmpeg_demo = spawn(ffmpeg_for_homebridge??"ffmpeg", ffmpegArgs_demo.split(/\s+/), { env: process.env });

            this.ffmpeg_demo.stdin.on('error',  (e) => {});

            this.ffmpeg_demo.stderr.on('data', (data) => {
                //console.log('MOTION DETECTOR', data.toString())
            });

            this.ffmpeg_demo.on('error', (error) => {
                console.log(error);
            });

            this.ffmpeg_demo.on('close', () => {
                console.log("MOTION DETECTOR : Fmmpeg closed");
            });
        }


    }

    async init(){
        this.cv = await cv;

        //this.height = 240 //workerData.height
        //this.width = 320 //workerData.width

        this.frame = new this.cv.Mat(this.output_height, this.output_width, this.cv.CV_8UC3);
        this.color_image = new this.cv.Mat(this.output_height, this.output_width, this.cv.CV_8UC3);
        this.difference = new this.cv.Mat(this.output_height, this.output_width, this.cv.CV_8UC3);
        this.moving_average = new this.cv.Mat(this.output_height, this.output_width, this.cv.CV_8UC3);
        this.temp = new this.cv.Mat(this.output_height, this.output_width, this.cv.CV_8UC3);
        this.grey_image = new this.cv.Mat(this.output_height, this.output_width, this.cv.CV_8UC1);
        this.cursurface = 0;


        let resizeFilter = `scale=${this.output_width}:${this.output_height}`;

        const ffmpegArgs_framer = `-i pipe: -pix_fmt bgr24 -vf ${resizeFilter} -f rawvideo pipe: -hide_banner`;
        this.ffmpeg_framer = spawn(ffmpeg_for_homebridge??"ffmpeg", ffmpegArgs_framer.split(/\s+/), { env: process.env });

        this.ffmpeg_framer.stdin.on('error',  (e) => {
            console.log(e);
        });

        this.ffmpeg_framer.stderr.on('data', (data) => {
            //console.log('WORKER MOTION', data.toString())
        });

        this.ffmpeg_framer.stdout.on('data', (data) => {
            //console.log(data.toString())
        });
        this.ffmpeg_framer.on('close', async () => {
            console.log('closing ffmpeg');
        });

        let fifo = new Fifo();
        this.ffmpeg_framer.stdout.on('data', (data) => {
            fifo.enq(data);
            if(fifo.size >= this.output_width*this.output_height*3){
                this.frame = fifo.deq(this.output_width*this.output_height*3);
                this.analyse(this.frame);
            }
        });

        process.stdin.on('data', (buffer) => {
            this.ffmpeg_framer.stdin.write(buffer);
        });
    }

    analyse(buffer){

        if(buffer && buffer.length > 0){
            let array = Array.prototype.slice.call(buffer);

            this.initial_image = this.cv.matFromArray(this.output_height,this.output_width, this.cv.CV_8UC3, array);

            this.color_image = this.initial_image.clone();

            this.cv.GaussianBlur(this.color_image, this.color_image, new this.cv.Size(3, 3), 0, 0, this.cv.BORDER_DEFAULT);

            if(!this.difference){
                this.difference = this.color_image.clone();
                this.temp = this.color_image.clone();
                this.cv.convertScaleAbs(this.color_image, this.moving_average, 1.0, 0.0);
            }
            else {
                let alpha = 0.80;
                this.cv.addWeighted(this.color_image, alpha, this.moving_average, 1-alpha, 0.0, this.moving_average);
            }

            this.cv.convertScaleAbs(this.moving_average, this.temp, 1.0, 0.0);
            this.cv.absdiff(this.color_image, this.temp, this.difference);

            this.cv.cvtColor(this.difference, this.grey_image, this.cv.COLOR_RGB2GRAY);
            this.cv.threshold(this.grey_image, this.grey_image, 2, 255, this.cv.THRESH_BINARY);

            let M1 = this.cv.getStructuringElement(this.cv.MORPH_ELLIPSE, new this.cv.Size(30, 30), new this.cv.Point(-1, -1));
            this.cv.dilate(this.grey_image, this.grey_image, M1);

            let M2 = this.cv.getStructuringElement(this.cv.MORPH_ELLIPSE, new this.cv.Size(30, 30), new this.cv.Point(-1, -1));
            this.cv.erode(this.grey_image, this.grey_image, M2);

            let contours = new this.cv.MatVector();
            let hierarchy = new this.cv.Mat();
            this.cv.findContours(this.grey_image, contours, hierarchy, this.cv.RETR_EXTERNAL, this.cv.CHAIN_APPROX_TC89_L1);

            let color = new this.cv.Scalar(0, 0, 255, 255);
            for (let i = 0; i < contours.size(); ++i) {
                this.cursurface += this.cv.contourArea(contours.get(i), false);
                if(this.demo) {
                    this.cv.drawContours(this.initial_image, contours, i, color, 3, this.cv.LINE_AA, hierarchy, 100);
                }
            }

            if(this.demo){
                this.ffmpeg_demo.stdin.write(this.initial_image.data);
                if(this.mounted === false){
                    this.mounted = true;
                    console.log("mounted : rtsp://127.0.0.1:6554/demo");
                }
            }

            if((this.cursurface*100)/(this.output_height*this.output_width) >= this.threshold){
                parentPort.postMessage({ moving: true });
            }

            hierarchy.delete();
            contours.delete();
            this.initial_image.delete();
            this.color_image.delete();
            this.cursurface = 0;
        }
    }
}

async function start(){
    let workerMotionDetector = new WorkerMotionDetector();
    await workerMotionDetector.init();
}

start().then((res) => console.log(res));
