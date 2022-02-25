import EventEmitter from "events";
export class Noise extends EventEmitter {
    constructor(threshold, log) {
        super();
        this.threshold = threshold;
        this.log = log;
    }

    append(frame){
        let sumOfSquares = frame.reduce((acc, val) => acc + val**2, 0);
        let rms = Math.sqrt(sumOfSquares/frame.length);
        let compressedRMS = (6 + Math.log10(rms) / Math.log(2)) / 6;
        if (compressedRMS < 0) {
            compressedRMS = 0;
        }
        if(compressedRMS * 100 > this.threshold){
            this.log.info('Noise detected :', `${(compressedRMS*100).toFixed(2)}/${this.threshold}`);
            this.emit('noise');
        }
    }
}
