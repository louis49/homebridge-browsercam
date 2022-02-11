import EventEmitter from "events";

export class Client extends EventEmitter {
    constructor(host, port, timeout, identifier) {
        super()
        this.host = host
        this.port = port
        this.timeout = timeout
        this.identifier = identifier

        setInterval(async () => {
            if(this.socket && this.socket.readyState === this.socket.OPEN){
                //console.log("Send ping")
                this.socket.send(JSON.stringify({ping:true, id:this.identifier}))
            }
            else if(this.socket && this.socket.readyState === this.socket.CLOSED){
                await this.start();
            }
        }, this.timeout);

    }

    heartbeat() {
        clearTimeout(this.pingTimeout);
        this.pingTimeout = setTimeout(function (){
            console.log("Not receiving pong")
            this.socket.close();
        }.bind(this), this.timeout * 1.5);
    }

    async start() {
        console.log("WS START", this.identifier)
        return new Promise(function (resolve, reject) {
            console.log("New WS", this.identifier)
            this.socket = new WebSocket(`wss://${this.host}:${this.port}/websocket?id=${this.identifier}`)
            this.socket.addEventListener('open',  function (event) {
                console.log("WS OPEN")
                this.heartbeat()
                this.emit('start')
                resolve(event);
            }.bind(this));

            this.socket.addEventListener('close',  function (event) {
                console.log("WS CLOSE")
                this.emit('stop');
            }.bind(this));

            this.socket.addEventListener('message',  function (event){
                let json = JSON.parse(event.data)
                //console.log('Receive', json)
                if(json.ping){
                    this.socket.send(JSON.stringify({'pong':true, id:this.identifier}));
                }
                else if(json.pong){
                    //console.log("Receiving pong")
                    this.heartbeat()
                }
                else if(json.torch){
                    console.log('receive torch', json.torch)
                    this.emit('torch', json.torch.value)
                }
                else if(json.reload){
                    console.log("Reload")
                    document.location.reload()
                }
            }.bind(this));
        }.bind(this));
    }

    async send_data(data){

        if(this.socket.readyState === this.socket.OPEN){
            this.socket.send(data);
        }
        else{
            console.log('Socket is closed')
        }
    }

    send_message(message){
        let string = JSON.stringify(message)
        console.log(`Sending ${string}`)
        if(this.socket.readyState === this.socket.OPEN){
            this.socket.send(string);
        }
    }
}
