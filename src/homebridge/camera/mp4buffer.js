//https://xhelmboyx.tripod.com/formats/mp4-layout.txt
//https://www.ramugedia.com/mp4-container

export class Mp4Buffer{
    constructor(duration) {
        this.duration = duration;
        this.current_duration = 0;
        this.buffer = new Buffer.from([]);
        this.streaming = false;
    }

    append(buffer){
        let cursor = 0;

        while (cursor < buffer.length){
            const header = buffer.slice(cursor,cursor+=8);
            const length = header.readInt32BE(0) - 8;
            const type = header.slice(4).toString();
            const data = buffer.slice(cursor, cursor+=length);

            console.log(type, data.length);
        }
    }

    parse(buffer, start, size){

    }

    clone(){

    }

    consume(writer){

    }
}
