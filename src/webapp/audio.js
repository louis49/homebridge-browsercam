export class Audio{
    constructor() {
        this.audio_context = new (window.AudioContext || window.webkitAudioContext)();
        this.array_buffer = null;
        this.total_time = 0;
        this.sample_rate = 48000;
    }

    merge_buffer(buffer1, buffer2) {
        let tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
        tmp.set(new Uint8Array(buffer1), 0);
        tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
        return tmp.buffer;
    };

    append(buffer){

        if(!this.array_buffer){
            let buf = new Uint8Array(buffer.length);
            buf.set(buffer, 0);
            this.array_buffer = buf.buffer;
        }
        else{
            this.array_buffer = this.merge_buffer(this.array_buffer, buffer);
        }

        let rest = this.array_buffer.byteLength % 4;
        let to_copy = this.array_buffer.slice(0, this.array_buffer.byteLength-rest);
        this.array_buffer = this.array_buffer.slice(this.array_buffer.byteLength-rest);

        console.log('Playing : ', to_copy.byteLength);

        if(to_copy.byteLength > 0){
            let source = this.audio_context.createBufferSource();
            let audioBuffer = this.audio_context.createBuffer(1, to_copy.byteLength, this.sample_rate);
            audioBuffer.copyToChannel(new Float32Array(to_copy), 0);
            source.buffer = audioBuffer;
            source.connect(this.audio_context.destination);
            source.start(this.total_time);
            this.total_time += (to_copy.byteLength)/this.sample_rate;
        }
    }
}
