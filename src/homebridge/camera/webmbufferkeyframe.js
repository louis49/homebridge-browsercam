import fs from "fs";
import {spawn} from "child_process";

export class Webmbufferkeyframe {
    constructor(duration) {
        this.duration = duration
        this.current_duration = 0
        this.buffer = new Buffer.from([])
        this.streaming = false
        this.reduce = true
        this.debug = true
    }

    parseHead(buffer){
        let cursor = 0
        while (cursor < buffer.length){
            if(
                (buffer[cursor] === 0x1a) &&
                (buffer[cursor+1] === 0x45) &&
                (buffer[cursor+2] === 0xdf) &&
                (buffer[cursor+3] === 0xa3)
            ){
                let size = this.readSize(buffer, cursor + 4)
                //console.log("Found Main Head", cursor, cursor + size.value + size.length + 4)
                cursor += size.value + size.length + 4
            }
            //SEGMENT
            else if(
                (buffer[cursor] === 0x18) &&
                (buffer[cursor+1] === 0x53) &&
                (buffer[cursor+2] === 0x80) &&
                (buffer[cursor+3] === 0x67)
            ){
                let size = this.readSize(buffer, cursor + 4)
                //console.log("Found Segment", cursor, cursor + size.value + size.length + 4)
                cursor += size.value + size.length + 4
            }
            // INFO
            else if(
                (buffer[cursor] === 0x15) &&
                (buffer[cursor+1] === 0x49) &&
                (buffer[cursor+2] === 0xa9) &&
                (buffer[cursor+3] === 0x66)
            ){
                let size = this.readSize(buffer, cursor + 4)
                //console.log("Found Info", cursor, cursor + size.value + size.length + 4)
                cursor += size.value + size.length + 4
            }
            // TRACKS
            else if(
                (buffer[cursor] === 0x16) &&
                (buffer[cursor+1] === 0x54) &&
                (buffer[cursor+2] === 0xae) &&
                (buffer[cursor+3] === 0x6b)
            ){
                let size = this.readSize(buffer, cursor + 4)
                //console.log("Found Tracks", cursor, cursor + size.value + size.length + 4)
                this.parseTracks(buffer, cursor + size.length + 4, size.value)
                cursor += size.value + size.length + 4
            }
            //CLUSTER
            else if(
                (buffer[cursor] === 0x1f) &&
                (buffer[cursor+1] === 0x43) &&
                (buffer[cursor+2] === 0xb6) &&
                (buffer[cursor+3] === 0x75)
            ){
                let size = this.readSize(buffer, cursor + 4)
                //console.log("Found Cluster", cursor, cursor + size.value + size.length + 4)
                //cursor += size.value + size.length + 4
                return cursor
            }
            //SEAK Head
            else if(
                (buffer[cursor] === 0x11) &&
                (buffer[cursor+1] === 0x4d) &&
                (buffer[cursor+2] === 0x9b) &&
                (buffer[cursor+3] === 0x74)
            ){
                let size = this.readSize(buffer, cursor + 4)
                //console.log("Found Seak Head", cursor, cursor + size.value + size.length + 4)
                cursor += size.value + size.length + 4
            }
            //void
            else if(
                (buffer[cursor] === 0xec)
            ){
                let size = this.readSize(buffer, cursor + 1)
                //console.log("Found Void", cursor, cursor + size.value + size.length + 1)
                cursor += size.value + size.length + 1
            }
            //Tags
            else if(
                (buffer[cursor] === 0x12) &&
                (buffer[cursor+1] === 0x54) &&
                (buffer[cursor+2] === 0xc3) &&
                (buffer[cursor+3] === 0x67)
            ){
                let size = this.readSize(buffer, cursor + 4)
                //console.log("Found Tags", cursor, cursor + size.value + size.length + 4)
                cursor += size.value + size.length + 4
            }
            // Cues
            else if(
                (buffer[cursor] === 0x1c) &&
                (buffer[cursor+1] === 0x53) &&
                (buffer[cursor+2] === 0xbb) &&
                (buffer[cursor+3] === 0x6b)
            ){
                let size = this.readSize(buffer, cursor + 4)
                //console.log("Found Cues", cursor, cursor + size.value + size.length + 4)
                cursor += size.value + size.length + 4
            }
            else{
                let k = buffer.slice(cursor, cursor+4).toString('hex')
                console.log(k)
            }
        }
    }

    parseTracks(buffer, start, length){
        let cursor = start
        while(cursor < start + length){
            if(
                (buffer[cursor] === 0xae)
            ) {
                let size = this.readSize(buffer, cursor + 1)
                //console.log("Found Track", cursor, cursor + size.value + size.length + 1)
                this.parseTrackEntry(buffer, cursor + size.length + 1, size.value)
                cursor += size.value + size.length + 1
            }
        }
    }

    parseTrackEntry(buffer, start, length){
        let cursor = start
        let track_number = 0
        while(cursor < start + length){
            // TRACK NUMBER
            if(
                (buffer[cursor] === 0xd7)
            ){
                let size = this.readSize(buffer, cursor + 1)
                track_number = buffer.readUIntBE(cursor+1 + size.length, size.value)
                //console.log("   Found Track Number", cursor, cursor + size.value + size.length + 1)
                cursor += size.value + size.length + 1
            }
            //TrackUID
            else if(
                (buffer[cursor] === 0x73) &&
                (buffer[cursor+1] === 0xc5)
            ) {
                let size = this.readSize(buffer, cursor + 2)
                //console.log("   Found Track UID", cursor, cursor + size.value + size.length + 2)
                cursor += size.value + size.length + 2
            }
            // TRACK TYPE
            else if(
                (buffer[cursor] === 0x83)
            ){
                let size = this.readSize(buffer, cursor + 1)
                let track_type = buffer.readUIntBE(cursor + 1 + size.length, size.value)
                if(track_type === 1){
                    this.video_track = track_number
                }
                else if(track_type === 2){
                    this.audio_track = track_number
                }
                //console.log("   Found Track Type", cursor, cursor + size.value + size.length + 1)
                cursor += size.value + size.length + 1
            }
            // CODECID
            else if(
                (buffer[cursor] === 0x86)
            ){
                let size = this.readSize(buffer, cursor + 1)
                //console.log("   Found Codec ID", cursor, cursor + size.value + size.length + 1)
                cursor += size.value + size.length + 1
            }
            // TRACK VIDEO
            else if(
                (buffer[cursor] === 0xe0)
            ){
                let size = this.readSize(buffer, cursor + 1)
                //console.log("   Found TrackVideo", cursor, cursor + size.value + size.length + 1)
                //this.parseTrackVideo(buffer, cursor + size.length + 1, size.value)
                cursor += size.value + size.length + 1
            }
            // TRACK Audio
            else if(
                (buffer[cursor] === 0xe1)
            ){
                let size = this.readSize(buffer, cursor + 1)
                //console.log("   Found Track Audio", cursor, cursor + size.value + size.length + 1)
                cursor += size.value + size.length + 1
            }
            // CodecPrivate
            else if(
                (buffer[cursor] === 0x63) &&
                (buffer[cursor+1] === 0xa2)
            ){
                let size = this.readSize(buffer, cursor + 2)
                //console.log("   Found Codec Private", cursor, cursor + size.value + size.length + 2)
                cursor += size.value + size.length + 2
            }
            //MaxBlockAdditionID
            else if(
                (buffer[cursor] === 0x55) &&
                (buffer[cursor+1] === 0xee)
            ){
                let size = this.readSize(buffer, cursor + 2)
                //console.log("   Found MaxBlockAdditionID", cursor, cursor + size.value + size.length + 2)
                cursor += size.value + size.length + 2
            }
            else
            {
                let k = buffer.slice(cursor).toString('hex')
                console.log(k)
                break
            }
        }
    }


    clone(){
        let webmbuffer = new Webmbufferkeyframe(this.duration)

        webmbuffer.streaming = false
        webmbuffer.head_buffer = Buffer.from(this.head_buffer)
        webmbuffer.buffer = Buffer.from(this.buffer)

        return webmbuffer
    }

    append(buffer){

        this.buffer = Buffer.concat([this.buffer, buffer])

        if(this.buffer.length > 1000){
            if(!this.head_buffer){

                let cluster_cursor = this.parseHead(this.buffer)
                this.head_buffer = this.buffer.slice(0, cluster_cursor)
                this.buffer = this.buffer.slice(cluster_cursor)
            }
            if(this.reduce){
                this.reduceBuffer()
            }
        }
    }

    reduceBuffer() {
        let current_cluster = this.findNextBlock(this.buffer, 0)
        let current_block = this.findNextBlock(this.buffer, current_cluster.next_cursor, current_cluster.time_code)
        let last_block = this.findLastBlock(this.buffer, current_block.next_cursor, current_cluster.time_code)

        let current_block_keyframe = null

        if(last_block){
            //console.log("Current duration :", last_block.time_code - current_cluster.time_code)

            while( (last_block.time_code - current_cluster.time_code) > this.duration) {
                let block = this.findNextBlock(this.buffer, current_block.next_cursor, current_cluster.time_code)

                if ((last_block.time_code - block.time_code) > this.duration){
                    if(block.cluster){
                        current_cluster = block
                        current_block_keyframe = null
                    }
                    if(block.keyframe && block.track_number === this.video_track){
                        current_block_keyframe = block
                    }
                    current_block = block
                }
                else{
                    break
                }
            }

            if(current_cluster.start_cursor !== 0 && this.streaming === false){
                //console.log("New duration :", last_block.time_code - current_block.time_code)
                let cluster_buffer = this.buffer.slice(current_cluster.start_cursor, current_cluster.next_cursor)

                let block
                if(current_block_keyframe){
                    block = current_block_keyframe
                    //console.log("Duration beetween keyframe and new frame", current_block.time_code - block.time_code, block.time_code - current_cluster.time_code)
                }
                else{
                    block = this.findNextBlock(this.buffer, current_cluster.next_cursor, current_cluster.time_code)
                    //console.log("Duration beetween keyframe and new frame (Next)", current_block.time_code - block.time_code)
                }

                let concat = [cluster_buffer]
                let block_buffer = this.buffer.slice(block.start_cursor, block.next_cursor)
                concat.push(block_buffer)

                while(block.track_number !== this.video_track && !block.keyframe){
                    block = this.findNextBlock(this.buffer, block.next_cursor, current_cluster.time_code)
                    block_buffer = this.buffer.slice(block.start_cursor, block.next_cursor)
                    concat.push(block_buffer)
                    console.log("Seek next keyframe")
                }

                /*
                // Pour certains flux, la video keyframe est envoyée en second
                let block1 = this.findNextBlock(this.buffer, current_cluster.next_cursor, current_cluster.time_code)
                let block1_buffer = this.buffer.slice(block1.start_cursor, block1.next_cursor)

                concat.push(block1)

                let block2 = this.findNextBlock(this.buffer, block1.next_cursor, current_cluster.time_code)
                let block2_buffer = this.buffer.slice(block2.start_cursor, block2.next_cursor)
*/
                let remain = this.buffer.slice(current_block.next_cursor)
                concat.push(remain)

                this.current_duration = (last_block.time_code) - (current_block.time_code)
                //console.log(cluster_buffer.length + block1_buffer.length + block2_buffer.length + reste.length)
                this.buffer=Buffer.concat(concat)
            }
        }
    }

    consume(writer){
        this.streaming = true
        console.log("START STREAMING : this.streaming = true")

        if(this.debug) {
            this.debug_file = "debug-" + new Date().getTime() + ".webm"
        }
        let current_cluster = this.findNextBlock(this.buffer, 0)
        let next = this.findNextBlock(this.buffer, current_cluster.next_cursor, current_cluster.time_code)

        let time_out = current_cluster.time_code - next.time_code

        let head = Buffer.concat([this.head_buffer, this.buffer.slice(current_cluster.start_cursor, current_cluster.next_cursor)])
        let first_frame = this.buffer.slice(next.start_cursor, next.next_cursor)

        if(this.debug){
            fs.writeFileSync(this.debug_file, head, {flag:'a'})
            fs.writeFileSync(this.debug_file, first_frame, {flag:'a'})
        }

        writer.write(head)
        writer.write(first_frame)
        this.tick(writer, next, 0, current_cluster.time_code, time_out)
    }

    tick(writer, current, total, cluster_timecode, time_out){
        setTimeout(() => {
            let next = this.findNextBlock(this.buffer, current.next_cursor, cluster_timecode)

            if(!next){
                console.log("Fin du flux")
                this.streaming = false
                this.reduce = true
                writer.end(new Buffer.from([]))
                return
            }

            if(next.cluster){
                cluster_timecode =  next.time_code
            }

            if(this.streaming === false){
                console.log("STOP STREAMING")
                writer.end(this.buffer.slice(next.start_cursor, next.next_cursor))
                this.reduce = true
                return;
            }
            else{
                let frame = this.buffer.slice(next.start_cursor, next.next_cursor)
                if(this.debug) {
                    fs.writeFileSync(this.debug_file, frame, {flag:'a'})
                }
                writer.write(frame)
            }

            // on Nettoie
            if(next.cluster) {
                this.buffer = this.buffer.slice(next.start_cursor)
                next.next_cursor -= next.start_cursor
                next.start_cursor = 0
                console.log("CLEANING")
            }

            time_out = (next.time_code - current.time_code)
            total += time_out

            //console.log('Timeout', time_out, next.track_number, next.time_code, total)
            this.tick(writer, next, total, cluster_timecode, time_out)
        }, time_out)
    }

    stop(){
        this.streaming = false
    }

    findLastBlock(buffer, cursor, time_code_cluster){
        let current_cluster = null
        let found_block = null
        while (cursor < this.buffer.length){
            let block = this.findNextBlock(this.buffer, cursor, time_code_cluster)

            if(block){
                if(block.cluster){
                    current_cluster = block
                    time_code_cluster = block.time_code
                }

                cursor = block.next_cursor
                if(cursor < buffer.length){
                    found_block = block
                }
            }
            else{
                break
            }
        }
        return found_block
    }

    findNextBlock(buffer, cursor, time_code_cluster){
        while (cursor < buffer.length - 8){
            if(
                (buffer[cursor] === 0x1f) &&
                (buffer[cursor+1] === 0x43) &&
                (buffer[cursor+2] === 0xb6) &&
                (buffer[cursor+3] === 0x75)
            ){
                let start_cursor = cursor
                let size = this.readSize(buffer, cursor + 4)
                //console.log("Found Cluster", cursor, cursor + size.value + size.length + 4)
                let cluster_cursor = cursor + size.value + size.length + 4
                cursor += size.length + 4 // size.length
                let time_code = this.readClusterTimeCode(buffer, cursor)
                return {start_cursor, next_cursor : time_code.next_cursor, time_code : time_code.time_code, cluster:true}
            }
            else if(
                (buffer[cursor] === 0xa3)
            ){
                let size = this.readSize(buffer, cursor + 1)

                let track_number = this.readSize(buffer, cursor+size.length+1)
                let time_code = buffer.readInt16BE(cursor+track_number.length+size.length+1)
                let keyframe = buffer.readUInt8(cursor+track_number.length+size.length+1+2)
                if(keyframe >= 0b1){
                    //console.log("Keyframe")
                }
                //console.log("Found Block", cursor, size.value + size.length + 1, time_code_cluster+time_code, (track_number.value === this.video_track)?"video":"audio", (keyframe >= 0b1)?"Keyframe":"Not Keyframe")
                //console.log(time_code, keyframe.toString(2), keyframe >= 0b1)
                //cursor += size.value + size.length + 1
                return {start_cursor:cursor, next_cursor : cursor + size.value + size.length + 1, time_code : time_code+time_code_cluster, cluster:false, track_number:track_number.value, keyframe:keyframe >= 0b1}
            }
            else if(
                (buffer[cursor] === 0x1c) &&
                (buffer[cursor+1] === 0x53) &&
                (buffer[cursor+2] === 0xbb) &&
                (buffer[cursor+3] === 0x6b)
            ){
                let size = this.readSize(buffer, cursor + 4)
                console.log("Found Cues", cursor, size.value + size.length + 4)
                cursor += size.value + size.length + 4
            }
            else if(
                (buffer[cursor] === 0xa0)
            ){
                let size = this.readSize(buffer, cursor + 1)
                console.log("Found BlockGroup", cursor, cursor + size.value + size.length + 4)
                cursor += size.value + size.length + 1
            }
            else if(
                (buffer[cursor] === 0xbb)
            ){
                let size = this.readSize(buffer, cursor + 1)
                console.log("Found CuePoint", cursor, cursor + size.value + size.length + 4)
                cursor += size.value + size.length + 1
            }
            else{
                console.log(buffer.slice(cursor, cursor+4).toString('hex'))
            }
        }
    }

    readClusterTimeCode(buffer, cursor){
        if(
            (buffer[cursor] === 0xe7)
        ){
            let size = this.readSize(buffer, cursor + 1)
            let time_code = buffer.readUIntBE(cursor + 1 + size.length, size.value)
            //console.log("    Found TimeCode", time_code, cursor, size.value + size.length + 1)
            return {time_code, next_cursor:cursor+size.length+size.value+1}
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

/*
let buffer = fs.readFileSync("huawei.webm")
let parsing = new Webmbufferkeyframe(8000)
parsing.append(buffer)

let step = 10000000
for(let i= 0; i< buffer.length - step; i+=step){
    console.log(i)
    let buff = buffer.slice(i, i + step)
    parsing.append(buff)
}

//let args = "-i pipe: -codec:v libx264 -pix_fmt yuv420p -profile:v baseline -level:v 4.0 -b:v 2000k -force_key_frames expr:eq(t,n_forced*4) -r 30 -fflags +genpts -reset_timestamps 1 -movflags frag_keyframe+empty_moov+default_base_moof -hide_banner -f mp4 -acodec libfdk_aac -profile:a aac_eld -ar 48k -b:a 64k -ac 1 -hide_banner result.mp4 -y"
let args = "-i pipe: -codec:v libx264 -pix_fmt yuv420p -profile:v baseline -level:v 4.0 -b:v 2000k -x264opts keyint=20:min-keyint=20:scenecut=-1 -r 30 -fflags +genpts -reset_timestamps 1 -movflags frag_keyframe+empty_moov+default_base_moof -acodec libfdk_aac -profile:a aac_low -ar 48k -b:a 64k -ac 1 -f mp4  -hide_banner result.mp4 -y"

let ffmpeg_process = spawn("ffmpeg", args.split(/\s+/), { env: process.env });

ffmpeg_process.stdin.on('error',  (e) => {
    console.log('RECORDING', e)
})

ffmpeg_process.on('error', (error) => {
    console.log(error);
})

ffmpeg_process.stderr.on('data', (data) => {
    console.log('RECORDING', data.toString())
})

ffmpeg_process.stdout.on('data', (data) => {
    console.log('RECORDING', data.toString())
})

ffmpeg_process.on('close', () => {
    console.log("RECORDING : Fmmpeg closed");
})

parsing.consume(ffmpeg_process.stdin)*/
//ffmpeg_process.stdin.write(buffer)
//ffmpeg_process.stdin.end(Buffer.from([]))
