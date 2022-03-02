export class Audio{
    constructor(conf) {
        console.log('START AUDIO');
        this.audio_context = new (window.AudioContext || window.webkitAudioContext)({sampleRate : conf.sample_rate});
        this.array_buffer = null;
        this.total_time = 0;
        this.sample_rate = conf.sample_rate;
        this.startedAt = null;
    }

    append(buffer){

        let to_copy = new Float32Array(buffer);
        let startDelay = 0;
        if(!this.startedAt){
            startDelay = 100 / 1000;
            this.startedAt = this.audio_context.currentTime + startDelay;
        }

        if(to_copy.length > 0){
            let source = this.audio_context.createBufferSource();
            source.channelCount = 1;
            let audioBuffer = this.audio_context.createBuffer(1, to_copy.length, this.sample_rate);
            audioBuffer.copyToChannel(to_copy, 0);
            source.buffer = audioBuffer;
            source.connect(this.audio_context.destination);
            source.start(this.total_time + this.startedAt);
            this.total_time += audioBuffer.duration;
        }
    }
}
