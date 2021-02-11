var WebSocket = require('ws');
var http = require('http');
const { info } = require('console');

var server = http.createServer();

server.listen(9003, function() {
      console.log("Server ready!");

});

var wss = new WebSocket.Server({ server: server }); /*new WebSocketServer({
  httpServer: server,
  autoAcceptConnections: false
});*/
/*var WebSocketServer = require('websocket').server;*/

var clients = [];
/*var socket = new WebSocketServer({
  httpServer: server,
  autoAcceptConnections: false
});*/

var sessions = {};
/*
To connect to session send a message like:
{
  type: "session",
  data: {
    token: "",
    action: "" <- "bp_create" assumes client is bp_client,
                  "connect" assumes client is io_client,
                  *in the future there will be an option to create from the io side and run bp in the server
  }
}
*/
function Session(token, bp_client){
  this.token = token;
  this.bp_client = bp_client; //ws client running the BP
  this.io_clients = [];       //ws clients implementing user input / agent output
  bp_client.session = this;
  sendInfo(bp_client, "Info: session with token '" + this.token + "' created.");
}

Session.prototype.connect = function(io_client){
  if(io_client.session == this){
    sendInfo(io_client, "Warn: already connected to this session.");
  }else{
    if(io_client.session){
      //In another session
      io_client.session.disconnect(io_client);
    }
    
    io_client.session = this;
    this.io_clients.push(io_client);
    sendInfo(io_client, "Info: connected to session with token '" + this.token + ".");
  }
}

Session.prototype.disconnect = function(client){
  client.session = null;
  if(client == this.bp_client){
    this.bp_client = null;
    removeSession(this, "Info: session has been terminated because the BP client has disconnected.");
  }else{
    this.io_clients.splice(this.io_clients.indexOf(client), 1);
  }
  sendInfo(client, "Info: succesfully disconnected from session " + this.token + ".");
}

Session.prototype.sendToBP = function(message){
  if(this.bp_client) this.bp_client.send(message);
}

Session.prototype.sendToIO = function(message){
  this.io_clients.forEach(function(client){
    client.send(message);
  });
}

function removeSession(session, msg){
  if(sessions[session.token]){
    delete sessions[session.token];

    //Session should only be removed when bp_client has disconnected, but for precaution
    if(session.bp_client){
      sendInfo(session.bp_client, msg);
      session.bp_client.session = null;
    }

    session.io_clients.forEach(function(client){
      sendInfo(client, msg);
      client.session = null;
    });
  }
}

wss.on('connection', function connection(ws) {

    console.log("User connected");
    clients.push(ws);

    ws.on('message', function incoming(message) {

      console.log('received: %s', message);

      var received_message = null;

      try{
        received_message = JSON.parse(message);
      }catch{
        //Not a JSON, return a warn
        sendInfo(ws, "Warn: the message is not a JSON, ignoring it.");
        return;
      }

      if(!received_message.type || !received_message.data){
        sendInfo(ws, "Warn: the message has to contain type and data.");
        return;
      }

      switch(received_message.type){
        case "session":
          var token = received_message.data.token;
          var action = received_message.data.action;

          var session = sessions[token];

          if(action == "bp_create"){
            if(session){
              sendInfo(ws, "Warn: there is already a session with this token.");
            }else{
              //Create a session
              sessions[token] = new Session(token, ws);
            }
          }else if(action == "connect"){
            if(session){
              session.connect(ws);
            }else{
              sendInfo(ws, "Session does not exist.");
            }
          }
          return;
        case "info":
          //Client should not send info messages
          sendInfo(ws, "Warn: info messages are reserved for the server.");
          return;
        default:
          //Send original message to session
          if(ws.session){
            if(ws.session.bp_client == ws){
              //BP to IOs
              ws.session.sendToIO(message);
            }else{
              ws.session.sendToBP(message);
            }
          }else{
            //Client not in any session
            sendInfo(ws, "Warn: client must connect to a session first.");
          }
          
      }
      return;
    });

    ws.on("close", function(message) {
        var index = clients.indexOf(ws);
        clients.splice(index, 1);
        
        //Remove from session
        if(ws.session){
          ws.session.disconnect(ws);
        }

        console.log("User disconnected");
        ws.close();
    });
    ws.on('error', function(err) {
        console.log(err);
    });

    sendInfo(ws, "Info: connection established.");

});

function sendInfo(ws, msg){
  ws.send(JSON.stringify({type: "info", data: msg}));
}