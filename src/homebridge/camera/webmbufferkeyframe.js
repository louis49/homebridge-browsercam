import fs from "fs";
import {spawn} from "child_process";

export class Webmbufferkeyframe {
    constructor(duration, log) {
        this.log = log;
        this.duration = duration;
        this.current_duration = 0;
        this.buffer = new Buffer.from([]);
        this.streaming = false;
        this.debug = false;
    }

    parseHead(buffer){
        let cursor = 0;
        while (cursor < buffer.length){
            if(
                (buffer[cursor] === 0x1a) &&
                (buffer[cursor+1] === 0x45) &&
                (buffer[cursor+2] === 0xdf) &&
                (buffer[cursor+3] === 0xa3)
            ){
                let size = this.readSize(buffer, cursor + 4);
                this.log.debug("Found Main Head", cursor, cursor + size.value + size.length + 4);
                cursor += size.value + size.length + 4;
            }
            //SEGMENT
            else if(
                (buffer[cursor] === 0x18) &&
                (buffer[cursor+1] === 0x53) &&
                (buffer[cursor+2] === 0x80) &&
                (buffer[cursor+3] === 0x67)
            ){
                let size = this.readSize(buffer, cursor + 4);
                this.log.debug("Found Segment", cursor, cursor + size.value + size.length + 4);
                cursor += size.value + size.length + 4;
            }
            // INFO
            else if(
                (buffer[cursor] === 0x15) &&
                (buffer[cursor+1] === 0x49) &&
                (buffer[cursor+2] === 0xa9) &&
                (buffer[cursor+3] === 0x66)
            ){
                let size = this.readSize(buffer, cursor + 4);
                this.log.debug("Found Info", cursor, cursor + size.value + size.length + 4);
                cursor += size.value + size.length + 4;
            }
            // TRACKS
            else if(
                (buffer[cursor] === 0x16) &&
                (buffer[cursor+1] === 0x54) &&
                (buffer[cursor+2] === 0xae) &&
                (buffer[cursor+3] === 0x6b)
            ){
                let size = this.readSize(buffer, cursor + 4);
                this.log.debug("Found Tracks", cursor, cursor + size.value + size.length + 4);
                this.parseTracks(buffer, cursor + size.length + 4, size.value);
                cursor += size.value + size.length + 4;
            }
            //CLUSTER
            else if(
                (buffer[cursor] === 0x1f) &&
                (buffer[cursor+1] === 0x43) &&
                (buffer[cursor+2] === 0xb6) &&
                (buffer[cursor+3] === 0x75)
            ){
                let size = this.readSize(buffer, cursor + 4);
                this.log.debug("Found Cluster", cursor, cursor + size.value + size.length + 4);
                //cursor += size.value + size.length + 4
                return cursor;
            }
            else{
                this.log.error.log(buffer.slice(cursor, cursor+4).toString('hex'));
            }
        }
    }

    parseTracks(buffer, start, length){
        let cursor = start;
        while(cursor < start + length){
            if(
                (buffer[cursor] === 0xae)
            ) {
                let size = this.readSize(buffer, cursor + 1);
                this.log.info("Found Track", cursor, cursor + size.value + size.length + 1);
                this.parseTrackEntry(buffer, cursor + size.length + 1, size.value);
                cursor += size.value + size.length + 1;
            }
        }
    }

    parseTrackEntry(buffer, start, length){
        let cursor = start;
        let track_number = 0;
        while(cursor < start + length){
            // TRACK NUMBER
            if(
                (buffer[cursor] === 0xd7)
            ){
                let size = this.readSize(buffer, cursor + 1);
                track_number = buffer.readUIntBE(cursor+1 + size.length, size.value);
                this.log.debug("   Found Track Number", cursor, cursor + size.value + size.length + 1);
                cursor += size.value + size.length + 1;
            }
            //TrackUID
            else if(
                (buffer[cursor] === 0x73) &&
                (buffer[cursor+1] === 0xc5)
            ) {
                let size = this.readSize(buffer, cursor + 2);
                this.log.debug("   Found Track UID", cursor, cursor + size.value + size.length + 2);
                cursor += size.value + size.length + 2;
            }
            // TRACK TYPE
            else if(
                (buffer[cursor] === 0x83)
            ){
                let size = this.readSize(buffer, cursor + 1);
                let track_type = buffer.readUIntBE(cursor + 1 + size.length, size.value);
                if(track_type === 1){
                    this.video_track = track_number;
                }
                else if(track_type === 2){
                    this.audio_track = track_number;
                }
                this.log.debug("   Found Track Type", cursor, cursor + size.value + size.length + 1);
                cursor += size.value + size.length + 1;
            }
            // CODECID
            else if(
                (buffer[cursor] === 0x86)
            ){
                let size = this.readSize(buffer, cursor + 1);
                this.log.debug("   Found Codec ID", cursor, cursor + size.value + size.length + 1);
                cursor += size.value + size.length + 1;
            }
            // TRACK VIDEO
            else if(
                (buffer[cursor] === 0xe0)
            ){
                let size = this.readSize(buffer, cursor + 1);
                this.log.debug("   Found TrackVideo", cursor, cursor + size.value + size.length + 1);
                //this.parseTrackVideo(buffer, cursor + size.length + 1, size.value)
                cursor += size.value + size.length + 1;
            }
            // TRACK Audio
            else if(
                (buffer[cursor] === 0xe1)
            ){
                let size = this.readSize(buffer, cursor + 1);
                this.log.debug("   Found Track Audio", cursor, cursor + size.value + size.length + 1);
                cursor += size.value + size.length + 1;
            }
            // CodecPrivate
            else if(
                (buffer[cursor] === 0x63) &&
                (buffer[cursor+1] === 0xa2)
            ){
                let size = this.readSize(buffer, cursor + 2);
                this.log.debug("   Found Codec Private", cursor, cursor + size.value + size.length + 2);
                cursor += size.value + size.length + 2;
            }
            //MaxBlockAdditionID
            else if(
                (buffer[cursor] === 0x55) &&
                (buffer[cursor+1] === 0xee)
            ){
                let size = this.readSize(buffer, cursor + 2);
                this.log.debug("   Found MaxBlockAdditionID", cursor, cursor + size.value + size.length + 2);
                cursor += size.value + size.length + 2;
            }
            else
            {
                this.log.error(buffer.slice(cursor,cursor+4).toString('hex'));
                break;
            }
        }
    }


    clone(){
        let webmbuffer = new Webmbufferkeyframe(this.duration, this.log);
        webmbuffer.streaming = false;
        webmbuffer.head_buffer = Buffer.from(this.head_buffer);
        webmbuffer.buffer = Buffer.from(this.buffer);
        webmbuffer.current_duration = this.current_duration;
        webmbuffer.video_track = this.video_track;

        return webmbuffer;
    }

    append(buffer){

        this.buffer = Buffer.concat([this.buffer, buffer]);
        if(this.buffer.length > 1000){
            if(!this.head_buffer){
                let cluster_cursor = this.parseHead(this.buffer);
                this.head_buffer = this.buffer.slice(0, cluster_cursor);
                this.buffer = this.buffer.slice(cluster_cursor);
            }
            if(!this.streaming){
                this.reduceBuffer();
            }
        }
    }

    reduceBuffer() {
        // START
        let current_cluster = this.findNextBlock(this.buffer, 0, 0);
        let current_block = this.findNextBlock(this.buffer, current_cluster.next_cursor, current_cluster.time_code);

        // END
        let last_block = this.findLastBlock(this.buffer, current_block.next_cursor, current_cluster.time_code);

        if(last_block){
            let current_cluster_keyframe = Object.assign({}, current_cluster);
            let current_block_keyframe = Object.assign({}, current_block);
            while( (last_block.time_code - current_cluster.time_code) > this.duration ) {
                let block = this.findNextBlock(this.buffer, current_block.next_cursor, current_cluster.time_code);

                if ((last_block.time_code - block.time_code) > this.duration ){
                    if(block.cluster){
                        current_cluster = block;
                    }
                    else if(block.keyframe && block.track_number === this.video_track){
                        current_block_keyframe = block;
                        current_cluster_keyframe = current_cluster;
                    }
                    current_block = block;
                }
                else {
                    break;
                }
            }

            if(current_cluster_keyframe.start_cursor !== 0){
                this.buffer=this.buffer.slice(current_cluster_keyframe.start_cursor);
                this.current_duration = (last_block.time_code) - (current_cluster_keyframe.time_code);
            }
        }
    }

    map(buffer){
        let buffer_map = [];
        let cursor = 0;
        let cluster = this.findNextBlock(buffer, cursor, 0);
        cursor += cluster.next_cursor;
        buffer_map.push(cluster);
        while(cursor < buffer.length){
            let block = this.findNextBlock(buffer, cursor, cluster.time_code);

            if(!block){
                break;
            }

            if(block.cluster){
                cluster = block;
            }
            buffer_map.push(block);
            cursor = block.next_cursor;
        }

        let current_block;
        let duration = 0;

        for(let block of buffer_map){
            if(current_block){
                let diff = block.time_code - current_block.time_code;

                if(block.cluster){
                    this.log.info("CLUSTER", block.time_code, diff);
                }
                else{
                    this.log.info("BLOCK", block.track_number===this.video_track?"VIDEO":"AUDIO", (block.keyframe && block.track_number===this.video_track)?"KEYFRAME":"",block.time_code, diff);
                }
                duration += diff;
            }
            else{
                if(block.cluster){
                    this.log.info("CLUSTER", block.time_code, 0);
                }
                else{
                    this.log.info("BLOCK", block.track_number===this.video_track?"VIDEO": "AUDIO", (block.keyframe && block.track_number===this.video_track)?"KEYFRAME":"", block.time_code, 0);
                }
            }
            current_block = block;
        }
    }

    consume(writer){
        this.streaming = true;
        this.log.info("START STREAMING");

        if(this.debug) {
            this.debug_file = "debug-" + new Date().getTime() + ".webm";
            this.log.debug("Debug file will be", this.debug_file);
        }

        let current_cluster = this.findNextBlock(this.buffer, 0);
        let current_block = this.findNextBlock(this.buffer, current_cluster.next_cursor, current_cluster.time_code);

        if(current_block.keyframe === true && current_block.track_number === this.video_track){
            this.log.debug("SENDING FIRST A VIDEO FRAME");
        }
        if(current_block.keyframe === true && current_block.track_number !== this.video_track){
            this.log.debug("SENDING FIRST AN AUDIO FRAME");
        }


        let init_cluster = Object.assign({}, current_cluster);

        let index = 0;
        while( (current_block.time_code - init_cluster.time_code) < this.duration ) {
            let block = this.findNextBlock(this.buffer, current_block.next_cursor, current_cluster.time_code);

            if(index === 0 && block.keyframe === true && block.track_number === this.video_track){
                this.log.debug("SENDING 2ND A VIDEO FRAME");
            }
            else  if(index === 0 && block.keyframe === true && block.track_number !== this.video_track){
                this.log.debug("SENDING 2ND AN AUDIO FRAME");
            }

            if(!block){
                break;
            }
            if ((block.time_code - init_cluster.time_code) < this.duration ){
                if(block.cluster){
                    current_cluster = block;
                }
                current_block = block;
            }
            else {
                break;
            }
            index++;
        }

        this.log.debug("Sending", (current_block.time_code - init_cluster.time_code), "Rest length:", this.buffer.length - current_block.start_cursor);

        let head = this.head_buffer;
        let first_frame = this.buffer.slice(current_cluster.start_cursor, current_cluster.next_cursor);

        if(this.debug){
            fs.writeFileSync(this.debug_file, head, {flag:'a'});
            fs.writeFileSync(this.debug_file, first_frame, {flag:'a'});
        }

        writer.write(head);
        writer.write(first_frame);
        this.tick(writer, current_cluster, current_cluster.start_cursor, current_cluster.time_code, 0);
    }

    tick(writer, current, cluster_keyframe_start, cluster_timecode, time_out){
        setTimeout(() => {
            if(this.streaming === false){
                this.log.debug("WRITING END STREAMING");
                writer.end(Buffer.from([]));
                return;
            }
            let next = this.findNextBlock(this.buffer, current.next_cursor, cluster_timecode);

            if(!next){
                this.log.debug("FLUX END : WRITING END STREAMING");
                this.streaming = false;
                writer.end(new Buffer.from([]));
                return;
            }

            if(next.cluster){
                cluster_timecode =  next.time_code;
                cluster_keyframe_start = next.start_cursor;
            }

            let frame = this.buffer.slice(next.start_cursor, next.next_cursor);
            if(this.debug) {
                fs.writeFileSync(this.debug_file, frame, {flag:'a'});
            }
            writer.write(frame);

            // on Nettoie
            if(next.keyframe && next.track_number === this.video_track) {
                this.log.debug("CLEANING", cluster_keyframe_start);
                this.buffer = this.buffer.slice(cluster_keyframe_start);
                next.next_cursor -= cluster_keyframe_start;
                next.start_cursor -= cluster_keyframe_start;
                cluster_keyframe_start = 0;
            }

            time_out = (next.time_code - current.time_code);
            if(time_out < 0){
                time_out = 10;
            }

            //console.log('Timeout', time_out, next.track_number, next.time_code, total)
            this.tick(writer, next, cluster_keyframe_start, cluster_timecode, time_out);
        }, time_out);
    }

    stop(){
        this.log.info("STOP STREAMING : this.streaming = false");
        this.streaming = false;
    }

    findLastBlock(buffer, cursor, time_code_cluster){
        let current_cluster = null;
        let found_block = null;
        while (cursor < this.buffer.length){
            let block = this.findNextBlock(this.buffer, cursor, time_code_cluster);

            if(block){
                if(block.cluster){
                    current_cluster = block;
                    time_code_cluster = block.time_code;
                }

                cursor = block.next_cursor;
                if(cursor < buffer.length){
                    found_block = block;
                }
            }
            else{
                break;
            }
        }
        return found_block;
    }

    findNextBlock(buffer, cursor, time_code_cluster){
        while (cursor < buffer.length - 8){

            if(
                (buffer[cursor] === 0x1f) &&
                (buffer[cursor+1] === 0x43) &&
                (buffer[cursor+2] === 0xb6) &&
                (buffer[cursor+3] === 0x75)
            ){
                let start_cursor = cursor;
                let size = this.readSize(buffer, cursor + 4);
                this.log.debug("Found Cluster", cursor, cursor + size.value + size.length + 4);
                let cluster_cursor = cursor + size.value + size.length + 4;
                cursor += size.length + 4; // size.length
                let time_code = this.readClusterTimeCode(buffer, cursor);
                if(time_code === undefined || time_code === null){
                    this.log.error("Void Time Code", size.length);
                }
                return {start_cursor, next_cursor : time_code.next_cursor, time_code : time_code.time_code, cluster:true};
            }
            else if(
                (buffer[cursor] === 0xa3)
            ){
                let size = this.readSize(buffer, cursor + 1);

                let track_number = this.readSize(buffer, cursor+size.length+1);
                let time_code = buffer.readInt16BE(cursor+track_number.length+size.length+1);
                let keyframe = buffer.readUInt8(cursor+track_number.length+size.length+1+2);

                let start_cursor = cursor;
                this.log.debug("Found Block", cursor, size.value + size.length + 1, time_code_cluster+time_code, (track_number.value === this.video_track)?"video":"audio", (keyframe >= 0b1)?"Keyframe":"Not Keyframe");
                cursor += size.value + size.length + 1;


                return {start_cursor, next_cursor : cursor, time_code : time_code+time_code_cluster, cluster:false, track_number:track_number.value, keyframe:keyframe >= 0b1};

            }
            else{
                this.log.error(buffer.slice(cursor, cursor+4).toString('hex'));
            }
        }
    }

    parseBody(buffer, cursor){
        let cluster_time_code = 0;
        let current_timecode = 0;
        let count = 0;
        while (cursor < buffer.length - 8){
            // Cluster
            if(
                (buffer[cursor] === 0x1f) &&
                (buffer[cursor+1] === 0x43) &&
                (buffer[cursor+2] === 0xb6) &&
                (buffer[cursor+3] === 0x75)
            ){
                let size = this.readSize(buffer, cursor + 4);
                cursor += size.length + 4;
                let time_code = this.readClusterTimeCode(buffer, cursor);
                cluster_time_code = time_code.time_code;
                this.log.debug("Found Cluster",  cursor-size.length - 4, size.value + (cursor - size.length - 4), time_code.time_code);
                cursor = time_code.next_cursor;
            }
            // Block
            else if(
                (buffer[cursor] === 0xa3)
            ){
                let size = this.readSize(buffer, cursor + 1);
                let track_number = this.readSize(buffer, cursor+size.length+1);
                let time_code = buffer.readInt16BE(cursor+track_number.length+size.length+1);
                let keyframe = buffer.readUInt8(cursor+track_number.length+size.length+1+2);
                this.log.debug("Found Block", cursor, cursor + size.value + size.length + 1, time_code + cluster_time_code, (track_number.value === this.video_track)?"video":"audio", (keyframe >= 0b1)?"Keyframe":"Not Keyframe");
                current_timecode = time_code + cluster_time_code;
                count ++;
                cursor += size.value + size.length + 1;
            }
            else{
                this.log.error(buffer.slice(cursor, cursor+4).toString('hex'));
            }
        }
        return cursor;
    }

    readClusterTimeCode(buffer, cursor){
        if(
            (buffer[cursor] === 0xe7)
        ){
            let size = this.readSize(buffer, cursor + 1);
            // TODO : size.value may be 0 ???
            if(size.value === 0){
                this.log.error(buffer.slice(cursor-10, cursor+10).toString('hex'));
            }
            let time_code = buffer.readUIntBE(cursor + 1 + size.length, size.value);
            if(time_code === undefined || time_code === null){
                this.log.error(size.length);
            }
            this.log.debug("    Found TimeCode", time_code, cursor, size.value + size.length + 1);
            return {time_code, next_cursor:cursor+size.length+size.value+1};
        }
    }

    readSize(buffer, start){
        const length = 8 - Math.floor(Math.log2(buffer[start]));
        if (length > 8) {
            throw new Error(`Unrepresentable length: ${length}`);
        }

        if (start + length > buffer.length) {
            return null;
        }

        let value = buffer[start] & ((1 << (8 - length)) - 1);
        for (let i = 1; i < length; i += 1) {
            if (i === 7) {
                if (value >= 2 ** 8 && buffer[start + 7] > 0) {
                    return { length, value: 0 };
                }
            }
            value *= 2 ** 8;
            value += buffer[start + i];
        }
        return { length, value };
    }
}

