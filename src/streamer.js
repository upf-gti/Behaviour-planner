
(function(global) {

/**
 * Websocket client
 */

function Streamer(url)
{
	if (this.constructor !== Streamer)
		throw ("You must use new to create an Streamer");

	this.client_id = 1;

	this.is_connected = false;

	this.onConnect = null;
	this.onDataReceived = null; //callback to receive data from the server
	this.onClose = null; //callback when connection closed
	this.streaming = false;
	this.ws = null;
	this.headersize = 18;
	if(url)
		this.connect(url)

}
global.Streamer = Streamer;

Streamer.prototype.connect = function( url, on_connected, on_error )
{
    var that = this;
	var protocol = "";
	if(url.indexOf("://") == -1)
		protocol = location.protocol == "https:" ? "wss://" : "ws://";

	this.ws = new WebSocket( protocol + url );
	this.ws.binaryType = 'arraybuffer';
	this.ws.onopen = function(event) {
		console.log("Streamer connected");

        that.is_connected = true;
        /*var button = document.getElementById("btn-connect")
        button.className+=" play";*/
		if(on_connected)
			on_connected(url);
		if(that.onConnect)
			that.onConnect();
	};

	this.ws.onmessage = function(event)
	{
		var that = this;
		that.processMessage(event.data);
	}.bind(this)

	this.ws.onerror = function(event) {
		console.log("error connecting with streamer server");
		that.is_connected = false;
		if(on_error)
			on_error(event);
	}

	this.ws.onclose = function(event) {
		console.log("disconnected", event);
		that.is_connected = false;
		if(	that.onClose )
            that.onClose();
	}
}

Streamer.prototype.close = function()
{
	if(!this.ws || this.ws.readyState != WebSocket.OPEN )
	{
		console.error("no connected to server");
		return;
	}
	this.ws.close();
}

Streamer.prototype.processMessage = function(data)
{
	if( data.constructor === ArrayBuffer )
		{
			var buffer = msg.data;
			processArrayBuffer( buffer );
		}
	else if(data.constructor === String )
	{
		var tokens = data.split("|"); //author id | cmd | data
		if(tokens.length < 3)
		{
			console.log("Received: " + data); //Awesome!
		}else if (CORE.App.onDataRecvieved)
		{
			console.log(data);
			this.onDataReceived(data);
		}

	}
	else
		console.warn("Unknown message type");


}
function processArrayBuffer( buffer )
{
	var buffer_array = new Uint8Array( buffer );
	var header = buffer_array.subarray(0,32);
	var data = buffer.slice(32);
	var header_str = UTILS.arrayToString( new Uint8Array(header) );
	var tokens = header_str.split("|"); //author id | cmd | data
	//author_id, cmd, data, on_message

}

Streamer.prototype.sendData = function(msg)
{
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

	if(!this.ws || this.ws.readyState !== WebSocket.OPEN)
	{
		console.error("Not connected, cannot send info");
		return;
	}

	this.ws.send(msg);
}

})(this);

