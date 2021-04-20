function Streamer(url){
	if (this.constructor !== Streamer){
		throw ("You must use new to create an Streamer");
	}

	this.client_id = 1;

	this.is_connected = false;

	//Callbacks
	this.onConnect = null;
	this.onDataReceived = null; //callback to receive data from the server
	this.onArrayDataReceived = null;
	this.onDisconnect = null; //callback when connection lost
	this.onClose = null;
	this.onError = null;

	this.streaming = false;
	this.ws = null;
	this.headersize = 18;
	
	if(url){
		this.connect(url)
	}

}

Streamer.prototype.connect = function( url, on_connected, on_error ){
	var protocol = "";
	
	if(url.indexOf("://") == -1){
		protocol = location.protocol == "https:" ? "wss://" : "ws://";
	}

	this.ws = new WebSocket( protocol + url );
	this.ws.binaryType = 'arraybuffer';
	this.ws.onopen = function(event){
		console.log("Streamer connected");

        this.is_connected = true;
		
		if(on_connected) on_connected(url);
		if(this.onConnect) this.onConnect();
	}.bind(this);

	this.ws.onmessage = function(event){
		this.processMessage(event.data);
	}.bind(this);

	this.ws.onerror = function(event){
		console.log("error connecting with streamer server");
		this.is_connected = false;
		if(on_error) on_error(event);
		if(this.onError) this.onError(event);
	}.bind(this);

	this.ws.onclose = function(event){
		console.log("disconnected", event);
		this.is_connected = false;
		if(this.onClose) this.onClose();
	}.bind(this);
}

Streamer.prototype.close = function(){
	if(!this.ws || this.ws.readyState != WebSocket.OPEN ){
		console.error("no connected to server");
		return;
	}
	this.ws.close();
}

Streamer.prototype.processMessage = function(data){
	if( data.constructor === ArrayBuffer ){
		if(this.onArrayDataReceived) this.onArrayDataReceived(data);
	}else if(data.constructor === String ){
		if(this.onDataReceived) this.onDataReceived(JSON.parse(data));
	}else{
		console.warn("Unknown message type");
	}
}

Streamer.prototype.createRoom = function(token){
	if(!this.ws || this.ws.readyState !== WebSocket.OPEN){
		setTimeout(100000, this.createRoom(token));
	}
	this.ws.send( JSON.stringify({type:"session", data: {token: token, action: "bp_create"}}));
}

Streamer.prototype.sendData = function(msg){
	if(msg === null)
		return;
	if(msg.constructor === Array)
	{
		var arr = msg;
		msg = {"channel":1,"type":0,"action":"send","data":{}}

		for(var i in arr)
		{
			var idx = "behaviour-"+i;
			msg.data[idx] = arr[i];
		}
		msg.data = JSON.stringify(msg.data);
	}
	if(msg.constructor === Object)
		msg = JSON.stringify(msg);

	if(!this.ws || this.ws.readyState !== WebSocket.OPEN){
		console.error("Not connected, cannot send info");
		return;
	}

	this.ws.send(msg);
}

Streamer.prototype.sendMessage = function(type, data){
	if(!type) return;

	console.log("Streamer: message sended: ", type, data);
	this.ws.send(JSON.stringify({
		type: type,
		data: data || null,
	}));
}
