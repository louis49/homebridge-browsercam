import EventEmitter from "events";
export class Noise extends EventEmitter {
    constructor(threshold) {
        super();
        this.threshold = threshold;
    }

    append(frame){
        let sumOfSquares = frame.reduce((acc, val) => acc + val**2, 0);
        let rms = Math.sqrt(sumOfSquares/frame.length);
        let compressedRMS = (6 + Math.log10(rms) / Math.log(2)) / 6;
        if (compressedRMS < 0) {
            compressedRMS = 0;
        }
        if(compressedRMS * 100 > this.threshold){
            this.emit('noise');
        }
    }
}
