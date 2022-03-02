import EventEmitter from "events";

export class WavDecoder extends EventEmitter {
    constructor(log) {
        super();
        this.log = log;
        this.buffer = Buffer.from([]);
        this.cursor = 0;
        this.head = false;
        this.remain = 0;
        this.count = 0;
    }

    append(buffer){
        this.buffer = Buffer.concat([this.buffer, buffer]);
        if(this.head === false){
            this.cursor = this.parseHead(this.buffer);
            if(this.cursor !== 0){
                this.head = true;
                this.buffer = this.buffer.slice(this.cursor);
                this.remain = this.chunk_size;
                this.cursor = 0;
            }
        }

        // On démarre direct par de la data
        if(this.head){
            this.parseBody();
            this.buffer = this.buffer.slice(this.cursor);
            this.cursor = 0;
        }
    }

    parseBody(){

        let max = Math.min(this.buffer.length, this.remain);
        let array = new Float32Array(max/this.block_size);
        while(this.cursor < this.buffer.length){

            if(this.remain === 0){
                let chunk_type = this.buffer.slice(this.cursor, this.cursor+=4).toString('utf-8');
                if(chunk_type !== 'data'){
                    this.log.error("ERROR", "chunk_type is not 'data'");
                }
                this.chunk_size = this.buffer.readUIntLE(this.cursor, 4);this.cursor += 4;
                this.remain = this.chunk_size;
                break;
            }

            let data = this.buffer.readIntLE(this.cursor, this.block_size);
            array[this.cursor/this.block_size] = data < 0 ? data / 32768 : data / 32767;
            this.cursor += this.block_size;
            this.remain -= this.block_size;
        }
        this.count+=array.length;
        if(array.length>0){
            this.log.debug("Publish new Audio Array", array.length);
            this.emit('audio_frame', array);
        }
    }

    parseHead(buffer){
        let cursor = 0;

        // ChunkID
        if(buffer.slice(cursor, cursor += 4).toString('utf-8') !== 'RIFF'){
            throw new Error("Not Wav file");
        }

        // ChunkSize
        let file_length = buffer.readUIntLE(cursor, 4);cursor+=4;

        // Format
        if(buffer.slice(cursor, cursor += 4).toString('utf-8') !== 'WAVE'){
            throw new Error("Not Wav file");
        }

        while(cursor < buffer.length){
            // Subchunk1ID
            let chunk_type = buffer.slice(cursor, cursor+=4).toString('utf-8');

            // Subchunk1Size
            let chunk_size = buffer.readUIntLE(cursor, 4);cursor += 4;

            switch (chunk_type){
                case 'fmt ':{
                    this.format_id = buffer.readUIntLE(cursor, 2);cursor += 2;
                    this.floating_point = (this.format_id===0x0003);
                    this.channels = buffer.readUIntLE(cursor, 2);cursor += 2;
                    this.sample_rate = buffer.readUIntLE(cursor, 4);cursor += 4;
                    this.bit_rate = buffer.readUIntLE(cursor, 4);cursor += 4;
                    this.block_size = buffer.readUIntLE(cursor, 2);cursor += 2;
                    this.bit_depth = buffer.readUIntLE(cursor, 2);cursor += 2;
                    break;
                }
                case 'data':{
                    this.chunk_size = chunk_size;
                    return cursor;
                }
                default:{
                    cursor += chunk_size;
                    break;
                }
            }
        }
        return 0;
    }
}
