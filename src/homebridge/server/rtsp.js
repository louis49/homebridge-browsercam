import _Mounts from "rtsp-streaming-server/build/lib/Mounts.js";
import _PublishServer from "rtsp-streaming-server/build/lib/PublishServer.js";
import _ClientServer from "rtsp-streaming-server/build/lib/ClientServer.js";

export class Rtsp{
    constructor(client_port, server_port) {
        let mounts = new _Mounts.Mounts({
            rtpPortCount: 10000,
            rtpPortStart: 10000
        });
        let hooks = {checkMount: this.checkMount.bind(this)}
        try{
            this.publishServer = new _PublishServer.PublishServer(server_port, mounts);
            this.clientServer = new _ClientServer.ClientServer(client_port, mounts, hooks);
        }
        catch (e){
            console.log(e);
        }

    }

    async checkMount(req){
        const url = new URL(req.uri);

        if(this.clientServer.mounts.mounts[url.pathname]){
            console.log('mount', url.pathname, 'exist')
            return true
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
