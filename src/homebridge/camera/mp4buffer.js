//https://xhelmboyx.tripod.com/formats/mp4-layout.txt
//https://www.ramugedia.com/mp4-container

import fs from "fs";

export class Mp4Buffer{
    constructor(duration) {
        this.duration = duration;
        this.current_duration = 0;
        this.buffer = new Buffer.from([]);
        this.streaming = false;
        this.debug = false;
    }

    append(buffer){

        //console.log("append", buffer.length);
        this.buffer = Buffer.concat([this.buffer, buffer]);

        if(this.buffer.length > 1000){
            if(!this.head_buffer){
                let moof_cursor = this.parseHead(this.buffer);
                this.head_buffer = this.buffer.slice(0, moof_cursor);
                this.buffer = this.buffer.slice(moof_cursor);
            }
            if(!this.streaming){
                this.reduceBuffer();
            }
        }

    }

    parseHead(buffer){
        let cursor = 0;

        while (cursor < buffer.length){
            let start_cursor = cursor;
            const header = buffer.slice(cursor,cursor+=8);
            const length = header.readInt32BE(0) - 8;
            const offset = header.readUIntBE(0, 4);
            const type = header.slice(4).toString();
            const data = buffer.slice(cursor, cursor+=length);

            switch (type){
                case 'ftyp':
                    //console.log(type, data.length);
                    break;
                case 'moov':
                    //console.log(type, data.length);
                    this.parseMoov(data);
                    break;
                case 'moof':
                    //console.log(type, data.length);
                    return start_cursor;
                case 'mdat':
                    //console.log(type, data.length);
                    return start_cursor;
                default:
                    console.log("To analyze : ", type, data.length);
                    break;
            }
        }
    }

    parseMoov(buffer){
        let cursor = 0;

        while (cursor < buffer.length){
            let start_cursor = cursor;
            const header = buffer.slice(cursor,cursor+=8);
            const length = header.readInt32BE(0) - 8;
            const offset = header.readUIntBE(0, 4);
            const type = header.slice(4).toString();
            const data = buffer.slice(cursor, cursor+=length);

            switch (type){
                case 'mvhd':
                    //console.log(type, data.length);
                    this.time_scale = this.parseMvHd(data);
                    break;
                case 'trak':
                    //console.log(type, data.length);
                    let track = this.parseTrak(data);
                    if(track.track_type === 'vide'){
                        this.video_track = track.track_id;
                    }
                    else if(track.track_type === 'soun'){
                        this.audio_track = track.track_id;
                    }
                    break;
                case 'mvex':
                    //console.log(type, data.length);
                    break;
                default:
                    console.log("To analyze : ", type, data.length);
                    break;
            }
        }
    }

    parseMvHd(buffer){
        let cursor = 0;
        let version = buffer.readUIntBE(cursor, 1); cursor+=1;
        let flags = buffer.readUIntBE(cursor, 3); cursor+=3;

        let created_mac_UTC_date;
        let modified_mac_UTC_date;

        if(version === 1){
            created_mac_UTC_date = buffer.readUIntBE(cursor, 8);cursor+=8;
            modified_mac_UTC_date = buffer.readUIntBE(cursor, 8);cursor+=8;
        }
        else{
            created_mac_UTC_date = buffer.readUIntBE(cursor, 4);cursor+=4;
            modified_mac_UTC_date = buffer.readUIntBE(cursor, 4);cursor+=4;
        }

        let time_scale = buffer.readUIntBE(cursor, 4);cursor+=4;

        return time_scale;
    }

    parseTrak(buffer) {
        let cursor = 0;

        let track_id;
        let track_type = "";

        while (cursor < buffer.length){
            const header = buffer.slice(cursor,cursor+=8);
            const length = header.readInt32BE(0) - 8;
            const offset = header.readUIntBE(0, 4);
            const type = header.slice(4).toString();
            const data = buffer.slice(cursor, cursor+=length);

            switch (type){
                case 'tkhd':
                    //console.log(type, data.length);
                    track_id = this.parseTkhd(data);
                    break;
                case 'mdia':
                    //console.log(type, data.length);
                    track_type = this.parseMdia(data);
                    break;
                default:
                    console.log("To analyze : ", type, data.length);
                    break;
            }
        }
        return {track_id, track_type};
    }

    parseTkhd(buffer){
        let cursor = 0;
        let version = buffer.readUIntBE(cursor, 1); cursor+=1;
        let flags = buffer.readUIntBE(cursor, 3); cursor+=3;

        let created_mac_UTC_date;
        let modified_mac_UTC_date;

        if(version === 1){
            created_mac_UTC_date = buffer.readUIntBE(cursor, 8);cursor+=8;
            modified_mac_UTC_date = buffer.readUIntBE(cursor, 8);cursor+=8;
        }
        else{
            created_mac_UTC_date = buffer.readUIntBE(cursor, 4);cursor+=4;
            modified_mac_UTC_date = buffer.readUIntBE(cursor, 4);cursor+=4;
        }

        let track_id = buffer.readUIntBE(cursor, 4); cursor+=4;

        return track_id;
    }

    parseMdia(buffer){
        let cursor = 0;

        let track_type;
        while (cursor < buffer.length){
            const header = buffer.slice(cursor,cursor+=8);
            const length = header.readInt32BE(0) - 8;
            const offset = header.readUIntBE(0, 4);
            const type = header.slice(4).toString();
            const data = buffer.slice(cursor, cursor+=length);

            switch (type){
                case 'mdhd':
                    //console.log(type, data.length);
                    break;
                case 'hdlr':
                    //console.log(type, data.length);
                    track_type = this.parseHdlr(data);
                    break;
                case 'minf':
                    //console.log(type, data.length);
                    break;
                default:
                    console.log("To analyze : ", type, data.length);
                    break;
            }
        }
        return track_type;
    }

    parseHdlr(buffer){
        let cursor = 0;
        let version = buffer.readUIntBE(cursor, 1); cursor+=1;
        let flags = buffer.readUIntBE(cursor, 3); cursor+=3;
        let reserved = buffer.readUIntBE(cursor, 4); cursor+=4;
        let handler_type = buffer.slice(cursor, cursor+4).toString(); cursor+=4;
        return handler_type;
    }

    reduceBuffer() {
        let block = this.findLastBlocks(this.buffer, 0);
        if(block){
            this.buffer = this.buffer.slice(block.start);
        }
    }

    findFirstBlocks(buffer, cursor){
        let blocks = [];
        let block = this.findNextBlock(this.buffer, cursor);
        let first_block = Object.assign({}, block);
        blocks.push(block);
        while(cursor < this.buffer.length){
            block = this.findNextBlock(this.buffer, block.end);
            if(block.end < this.buffer.length){
                blocks.push(block);
            }
            cursor = block.end;
        }
        let duration = 0;
        for(let index = 0; index < blocks.length ; index++){
            let block = blocks[index];
            duration += block.duration;
            if(duration > (this.duration * (this.time_scale/1000))){
                console.log('Sending', duration);
                return block;
            }
        }
        return first_block;
    }

    findLastBlocks(buffer, cursor){
        let total = 0;
        let blocks = [];
        let block = this.findNextBlock(this.buffer, cursor);
        blocks.push(block);
        total += block.duration;
        while(cursor < this.buffer.length){
            block = this.findNextBlock(this.buffer, block.end);
            if(!block || block.end >= buffer.length){
                break;
            }
            blocks.push(block);
            total += block.duration;
            cursor = block.end;
        }
        let duration = 0;
        for(let index=blocks.length-1; index >=0 ; index--){
            let block = blocks[index];
            duration += block.duration;
            //console.log(duration, block.keyframe);
            if(duration > ((this.duration)* (this.time_scale/1000)) && block.keyframe){
                this.current_duration = (duration * 1000 / this.time_scale);
                //console.log('Reduce to', this.current_duration);
                return block;
            }
        }
        return null;
    }

    findLastBlock(buffer, block){
        let cursor = block.start;
        while(cursor < this.buffer.length){
            block = this.findNextBlock(this.buffer, block.end);
            cursor = block.end;
        }
        return block;
    }

    findNextBlock(buffer, cursor){
        let start_cursor = cursor;
        let moof = null;
        while (cursor < buffer.length){

            const header = buffer.slice(cursor,cursor+=8);
            const length = header.readInt32BE(0) - 8;
            const offset = header.readUIntBE(0, 4);
            const type = header.slice(4).toString();
            const data = buffer.slice(cursor, cursor+=length);

            switch (type){
                case 'moof':
                    //console.log(type, data.length);
                    moof = this.parseMoof(data);
                    moof.start = start_cursor;
                    moof.end = start_cursor + length + 8;
                    break;
                case 'mdat':
                    //console.log(type, data.length);
                    moof.end += length + 8;
                    return moof;
                    //console.log(type, data.length);
                    break;
                default:
                    console.log("To analyze : ", type, data.length);
                    break;
            }
        }

        return null;
    }

    parseMoof(buffer) {
        let cursor = 0;
        let video_traf;
        while (cursor < buffer.length){
            let start_cursor = cursor;
            const header = buffer.slice(cursor,cursor+=8);
            const length = header.readInt32BE(0) - 8;
            const offset = header.readUIntBE(0, 4);
            const type = header.slice(4).toString();
            const data = buffer.slice(cursor, cursor+=length);

            switch (type){
                case 'mfhd':
                    //console.log(type, data.length);
                    break;
                case 'traf':
                    //console.log(type, data.length);
                    let traf = this.parseTraf(data);
                    if(traf.track_id === this.video_track){
                        video_traf = traf;
                    }
                    break;
                default:
                    console.log("To analyze : ", type, data.length);
                    break;
            }

        }
        return video_traf;
    }

    parseTraf(buffer) {
        let cursor = 0;

        let track_id = 0;

        let duration = 0;
        let keyframe = false;
        while (cursor < buffer.length){
            let start_cursor = cursor;
            const header = buffer.slice(cursor,cursor+=8);
            const length = header.readInt32BE(0) - 8;
            const offset = header.readUIntBE(0, 4);
            const type = header.slice(4).toString();
            const data = buffer.slice(cursor, cursor+=length);

            switch (type){
                case 'tfhd':
                    //console.log(type, data.length);
                    track_id = this.parseTfhd(data);
                    break;
                case 'tfdt':
                    //console.log(type, data.length);
                    break;
                case 'trun':
                    //console.log(type, data.length);
                    let trun = this.parseTrun(data);
                    duration += trun.duration;
                    if(trun.keyframe){
                        keyframe = true;
                    }
                    break;
                default:
                    console.log("To analyze : ", type, data.length);
                    break;
            }
        }

        return {track_id, duration, keyframe};
    }

    parseTrun(buffer){
        let cursor = 0;
        let version = buffer.readUIntBE(cursor, 1); cursor+=1;

        let flag1 = buffer.readUIntBE(cursor, 1); cursor+=1;
        let flag2 = buffer.readUIntBE(cursor, 1); cursor+=1;
        let flag3 = buffer.readUIntBE(cursor, 1); cursor+=1;

        let dataOffsetPresent = (flag3 & 0x01)>0;
        let firstSampleFlagsPresent = (flag3 & 0x04)>0;
        let sampleDurationPresent = (flag2 & 0x01)>0;
        let sampleSizePresent = (flag2 & 0x02)>0;
        let sampleFlagsPresent = (flag2 & 0x04)>0;
        let sampleCompositionTimeOffsetPresent = (flag2 & 0x08)>0;
        let keyframe = (flag3 & 0x04)>0;

        let sample_length = buffer.readUIntBE(cursor, 4);cursor+=4;

        if(dataOffsetPresent){
            let offset = buffer.readUIntBE(cursor, 4); cursor+=4;
        }

        let duration = 0;
        if (firstSampleFlagsPresent && sample_length) {
            let flags = buffer.readUIntBE(cursor, 4); cursor+=4;

            if (sampleDurationPresent) {
                let dur = buffer.readUIntBE(cursor, 4); cursor+=4;
                duration += dur;
            }

            if (sampleSizePresent) {
                let sample_size = buffer.readUIntBE(cursor, 4); cursor+=4;
            }

            if (sampleCompositionTimeOffsetPresent) {
                if (version === 1) {
                    let compositionTimeOffset = buffer.readUIntBE(cursor, 4); cursor+=4;
                } else {
                    let compositionTimeOffset = buffer.readUIntBE(cursor, 4); cursor+=4;
                }
            }
        }
        sample_length--;

        for(let index = 0; index < sample_length; index++){

            if (sampleDurationPresent) {
                let dur = buffer.readUIntBE(cursor, 4); cursor+=4;
                duration += dur;
            }

            if (sampleSizePresent) {
                let sample_size = buffer.readUIntBE(cursor, 4); cursor+=4;
            }

            if(sampleFlagsPresent) {
                let flags = buffer.readUIntBE(cursor, 4); cursor+=4;
            }

            if (sampleCompositionTimeOffsetPresent) {
                if (version === 1) {
                    let compositionTimeOffset = buffer.readUIntBE(cursor, 4); cursor+=4;
                } else {
                    let compositionTimeOffset = buffer.readUIntBE(cursor, 4); cursor+=4;
                }
            }
        }

        return {duration, keyframe};
    }

    parseTfhd(buffer){
        let cursor = 0;
        let version = buffer.readUIntBE(cursor, 1); cursor+=1;
        let flags = buffer.readUIntBE(cursor, 3); cursor+=3;
        let track_id = buffer.readUIntBE(cursor, 4); cursor+=4;

        return track_id;
    }

    clone(){
        let mp4buffer = new Mp4Buffer(this.duration);

        mp4buffer.streaming = false;
        mp4buffer.head_buffer = Buffer.from(this.head_buffer);
        mp4buffer.buffer = Buffer.from(this.buffer);
        mp4buffer.current_duration = this.current_duration;
        mp4buffer.video_track = this.video_track;
        mp4buffer.time_scale = this.time_scale;

        return mp4buffer;
    }

    consume(writer){
        this.streaming = true;
        console.log("START STREAMING");

        if(this.debug) {
            this.debug_file = "debug-" + new Date().getTime() + ".mp4";
            console.log("Debug file will be", this.debug_file);
        }

        let block = this.findFirstBlocks(this.buffer, 0);

        let head = this.head_buffer;
        let first_frame = this.buffer.slice(0, block.end);

        if(this.debug){
            fs.writeFileSync(this.debug_file, head, {flag:'a'});
            fs.writeFileSync(this.debug_file, first_frame, {flag:'a'});
        }

        writer.write(head);
        writer.write(first_frame);
        this.tick(writer, block);
    }

    tick(writer, block){
        setTimeout(() => {
            if(this.streaming === false){
                console.log("WRITING END STREAMING");
                if(writer.writable){
                    writer.end(Buffer.from([]));
                }
                return;
            }
            block = this.findNextBlock(this.buffer, block.end);
            if(!block || block.end > this.buffer.length){
                console.log("FLUX END : WRITING END STREAMING");
                this.streaming = false;
                if(writer.writable){
                    writer.end(new Buffer.from([]));
                }
                return;
            }

            let frame = this.buffer.slice(block.start, block.end);

            if(this.debug) {
                fs.writeFileSync(this.debug_file, frame, {flag:'a'});
            }
            if(writer.writable){
                writer.write(frame);
            }

            this.tick(writer, block);
        },block.duration*1000/this.time_scale);
        //console.log('timeout :', block.duration, block.duration*1000/this.time_scale);
    }

    stop(){
        console.log("STOP STREAMING : this.streaming = false");
        this.streaming = false;
    }
}
