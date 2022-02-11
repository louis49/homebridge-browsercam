import EventEmitter from "events"

const resolutions = [
    //{width: 640, height : 360},
    {width: 4160, height : 3120}, // Huawei
    {width: 4032, height : 3024}, // 4/3 iPhone Max
    {width: 4032, height : 2268}, // 16/9 iPhone Max
    {width: 3840, height : 2180},
    {width: 1920, height : 1080},
    {width: 1280, height : 720},
    {width: 640, height : 360},
    {width: 320, height : 180},
]

export class Video extends EventEmitter {

    constructor(time_slice) {
        super()
        this.time_slice = time_slice
    }

    async init() {
        console.log("VIDEO INIT")

        if(!MediaRecorder.isTypeSupported('video/webm')){
            console.error("Unsuppported Browser (for now)")
            document.body.style.backgroundColor = "#B93129"

            let message = document.getElementById("message")
            message.innerHTML = "<p>Unsuppported Browser (for now)</p>"
            message.style["color"] = "#FFFFFF"
            return null
        }

        let constraints = {
            video: {
                facingMode: 'environment',
                width: {
                    ideal: 10000 * 16/9 // iPhone : 4032
                },
                height: {
                    ideal: 10000 // iPhone : 2268
                },
                frameRate: {
                    ideal: 30,
                    max: 30
                },
                aspectRatio: {
                    exact : 16/9
                }
            },
            audio: true
        }

        for(let res of resolutions){
            console.log('Trying ', res)
            constraints.video.height.ideal = res.height
            constraints.video.width.ideal = res.width
            let current_stream
            try{
                current_stream = await navigator.mediaDevices.getUserMedia(constraints)
            }
            catch (_){}

            if(current_stream){
                this.stream = current_stream
                break
            }
        }

        if(this.stream){
            let settings = this.stream.getVideoTracks()[0].getSettings()
            let devices = await navigator.mediaDevices.enumerateDevices()
            let device = devices.find((device) => device.deviceId===settings.deviceId && device.kind === 'videoinput')
            let capabilities = this.stream.getVideoTracks()[0].getCapabilities()

            this.settings = {
                settings: {
                    deviceId:settings.deviceId,
                    name:device.label,
                    vendor:navigator.vendor,
                    platform:navigator.platform,
                    height:settings.height,
                    width:settings.width,
                    frameRate:settings.frameRate,
                    torch:(capabilities.torch === undefined)?null:capabilities.torch
                }}

            this.mediaRecorder = new MediaRecorder(this.stream)
            this.mediaRecorder.ondataavailable = this.send_data.bind(this)
            return settings.deviceId
        }
        else
        {
            return null
        }
    }

    send_data(event){
        console.log(this.mediaRecorder.mimeType)
        if(event.data && event.data.size > 0){
            //console.log('Emit data', event.data.size)
            this.emit('data', event.data)
        }
    }

    start(){
        console.log("VIDEO START")
        document.body.style.backgroundColor = "#000000"
        let message = document.getElementById("message")
        message.innerHTML = "<p>Recording</p>"
        message.style["color"] = "#FFFFFF"

        this.emit('settings', this.settings)
        this.mediaRecorder.start(this.time_slice)
    }

    stop(){
        console.log("VIDEO STOP")

        document.body.style.backgroundColor = "#FFFFFF"
        let message = document.getElementById("message")
        message.innerHTML = "<p>Waiting for Server</p>"
        message.style["color"] = "#000000"

        if(this.mediaRecorder.state !== "inactive"){
            this.mediaRecorder.stop()
        }
    }

    async torch(value){
        try{
            await this.stream.getVideoTracks()[0].applyConstraints({advanced: [{torch: value}]})
        }
        catch (_) {}
    }
}
