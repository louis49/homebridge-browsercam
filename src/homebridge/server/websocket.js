import * as WebSocket from "ws";
import EventEmitter from "events";

const timeout = 10000;
export class Websocket extends EventEmitter{
    constructor(server) {
        super();
        this.server = server;

        this.websocketServer = new WebSocket.WebSocketServer({
            noServer: true,
            path: "/websocket",
        });

        this.server.on("upgrade", (request, socket, head) => {
            this.websocketServer.handleUpgrade(request, socket, head, (websocket) => {
                this.websocketServer.emit("connection", websocket, request);
            });
        });

        this.websocketServer.on(
            "connection",
            (websocketConnection, connectionRequest) => {
                const url = new URL(connectionRequest.url, connectionRequest.headers.origin);
                const id = url.searchParams.get('id');

                this.emit('open', id, websocketConnection);

                //console.log("WS New connection from", id)

                websocketConnection.aliveTimeout = setInterval(async () => {
                    if(websocketConnection.readyState === websocketConnection.OPEN){
                        //console.log("Send ping")
                        websocketConnection.send(JSON.stringify({ping:true, id}));
                        websocketConnection.pingTimeout = setTimeout( () => {
                            console.log("WS Not receiving pong from", id);
                            websocketConnection.close();
                        }, timeout * 1.5);
                    }
                }, timeout);

                websocketConnection.on("message", (message, isBinary) => {
                    if(!isBinary){
                        let json = JSON.parse(message.toString());
                        //console.log("WS: ", json)
                        if(json.ping){
                            //console.log('Receive ping')
                            //console.log('Send pong')
                            websocketConnection.send(JSON.stringify({pong : true, id}));
                        }
                        else if(json.pong){
                            //console.log('Receive pong')
                            clearTimeout(websocketConnection.pingTimeout);
                        }
                    }
                });

                websocketConnection.on('close', () => {
                    console.log('WS Connexion closed from', id);
                    this.emit('close', id);
                });
            }
        );
    }
}
