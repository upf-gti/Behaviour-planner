var WebSocketClient = require('websocket').client;

var bp_client = new WebSocketClient();
var io_client1 = new WebSocketClient();
var io_client2 = new WebSocketClient();

function initClient(client, name){
    client.on('connectFailed', function(error) {
        console.log('Connect Error: ' + error.toString());
    });
    
    client.on('connect', function(connection) {
        console.log('WebSocket Client Connected');
        connection.on('error', function(error) {
            console.log("Connection Error: " + error.toString());
        });
        connection.on('close', function() {
            console.log('echo-protocol Connection Closed');
        });

        connection.on('message', function(message) {
            if (message.type === 'utf8') {
                var received_message = JSON.parse(message.utf8Data);
                console.log(name, ": ", received_message.type, received_message.data);
            }
        });

        function sendMessage(t, d){
            connection.sendUTF(JSON.stringify({type: t, data: d}));
        }

        if(name == "bp"){
            sendMessage("session", {token: 1234, action: "bp_create"});

            function sendBehvior() {
                if (connection.connected) {
                    sendMessage("behavior", {type: "speech", text: "blabla"});
                    setTimeout(sendBehvior, 1000);
                }
            }
            sendBehvior();

            setTimeout(function(){
                sendMessage("session", {token: 5678, action: "bp_create"});
            }, 10000);
        }else{
            sendMessage("session", {token: 1234, action: "connect"});

            function sendData() {
                if (connection.connected) {
                    sendMessage("data", {user: {text: "blabla", valence: 0.3}});
                    setTimeout(sendData, 1000);
                }
            }
            sendData();
        }
        
        
    });
}

initClient(bp_client, "bp");
initClient(io_client1, "io1");
initClient(io_client2, "io2");

bp_client.connect('ws://localhost:9003/');
setTimeout(function(){
    io_client1.connect('ws://localhost:9003/');
    io_client2.connect('ws://localhost:9003/');
}, 2000);


