import * as RTSP from "rtsp-streaming-server";

export class Rtsp{
    constructor(client_port, server_port) {
        let mounts = new RTSP.Mounts({
            rtpPortCount: 10000,
            rtpPortStart: 10000
        });

        let hooks = {checkMount: this.checkMount.bind(this)};
        try{
            this.publishServer = new RTSP.PublishServer(server_port, mounts);
            this.clientServer = new RTSP.ClientServer(client_port, mounts, hooks);
        }
        catch (e){
            console.log(e);
        }

    }

    checkMount(req){
        const url = new URL(req.uri);

        if(this.clientServer.mounts.mounts[url.pathname]){
            console.log('mount', url.pathname, 'exist');
            return true;
        }
        return 404;
    }

    async start(){
        try{
            await this.publishServer.start();
            await this.clientServer.start();
        }
        catch (e){
            console.log(e);
        }
    }
}
