var UTILS = {

	/**
	* MODIFIED FROM LITEGUI.JS
	* Request file from url (it could be a binary, text, etc.). If you want a simplied version use
	* @method request
	* @param {Object} request object with all the parameters like data (for sending forms), dataType, success, error
	* @param {Function} on_complete
	**/
	request: function(request)
	{
		var dataType = request.dataType || "text";
		if(dataType == "json") //parse it locally
			dataType = "text";
		else if(dataType == "xml") //parse it locally
			dataType = "text";
		else if (dataType == "binary")
		{
			//request.mimeType = "text/plain; charset=x-user-defined";
			dataType = "arraybuffer";
			request.mimeType = "application/octet-stream";
		}

		//regular case, use AJAX call
        var xhr = new XMLHttpRequest();
		var method = request.data ? 'POST' : 'GET';

		if(request.method && request.method.length)
			method = request.method;

		var asyncRequest = true;

		if(request.async !== undefined)
			asyncRequest = request.async;

        xhr.open( method, request.url, asyncRequest);
        if(dataType)
            xhr.responseType = dataType;
        if (request.mimeType)
            xhr.overrideMimeType( request.mimeType );

		// Set other headers
		for(var h in request)
		{
			// search for headers
			if(h.length > 0 && h[0] != "#")
			continue;

			var cleanHeaderName = h.substr(1);
			xhr.setRequestHeader(cleanHeaderName, request[h]);
		}

		// if( request.nocache )
		// 	xhr.setRequestHeader('Cache-Control', 'no-cache');

        xhr.onload = function(load)
		{
			var response = this.response;
			if(this.status != 200)
			{
				var err = "Error " + this.status;
				if(request.error)
					request.error(err);
				LEvent.trigger(xhr,"fail", this.status);
				return;
			}

			if(request.dataType == "json") //chrome doesnt support json format
			{
				try
				{
					response = JSON.parse(response);
				}
				catch (err)
				{
					if(request.error)
						request.error(err);
					else
						throw err;
				}
			}
			else if(request.dataType == "xml")
			{
				try
				{
					var xmlparser = new DOMParser();
					response = xmlparser.parseFromString(response,"text/xml");
				}
				catch (err)
				{
					if(request.error)
						request.error(err);
					else
						throw err;
				}
			}
			if(request.success)
				request.success.call(this, response, this);
		};
        xhr.onerror = function(err) {
			if(request.error)
				request.error(err);
		}

		var data = new FormData();
		if( request.data )
		{
			for(var i in request.data)
				data.append(i,request.data[i]);
		}

        xhr.send( data );
		return xhr;
	},

    arrayToString: function(array)
    {
        var str = "";
        for(var i = 0; i < array.length; i++)
            str += String.fromCharCode(array[i]);
        return str;
    },

    rand : function() {
      return Math.random().toString(36).substr(2); // remove `0.`
    },

    getFileExtension(filename) {

        var tkn = filename.split(".");
        return tkn.pop().toLowerCase();
    },

    replaceAll(str, find, replace) {
        return str.replace(new RegExp(find, 'g'), replace);
    },

    includes(str, find)
    {
        find = [].concat(find);

        for(var i = 0; i < find.length; i++)
            if( str.toLowerCase().includes(find[i]) )
                return true;
    },

	getObjectClassName(obj)
	{
		if (!obj)
			return;

		if(obj.constructor.fullname) //this is to overwrite the common name "Prefab" for a global name "ONE.Prefab"
			return obj.constructor.fullname;

		if(obj.constructor.name)
			return obj.constructor.name;

		var arr = obj.constructor.toString().match(
			/function\s*(\w+)/);

		if (arr && arr.length == 2) {
			return arr[1];
		}
	}
}

//Scale and Offset
function DragAndScale( element, skip_events )
{
	this.offset = new Float32Array([0,0]);
	this.scale = 1;
	this.min_scale = 0.2;
	this.max_scale = 8;
	this.onredraw = null;
	this.enabled = true;
	this.last_mouse = [0,0];

	if(element)
	{
		this.element = element;
		if(!skip_events)
			this.bindEvents( element );
	}
}

DragAndScale.prototype.bindEvents = function( element )
{
	this.last_mouse = new Float32Array(2);

	this._binded_mouse_callback = this.onMouse.bind(this);

	element.addEventListener("mousedown", this._binded_mouse_callback );
	element.addEventListener("mousemove", this._binded_mouse_callback );

	element.addEventListener("mousewheel", this._binded_mouse_callback, false);
	element.addEventListener("wheel", this._binded_mouse_callback, false);
}

DragAndScale.prototype.onMouse = function(e)
{
	if(!this.enabled)
		return;

	var canvas = this.element;
	var rect = canvas.getBoundingClientRect();
	var x = e.clientX - rect.left;
	var y = e.clientY - rect.top;
	e.canvasx = x;
	e.canvasy = y;
	e.dragging = this.dragging;

	var ignore = false;
	if(this.onmouse)
		ignore = this.onmouse(e);

	if(e.type == "mousedown")
	{
		this.dragging = true;
		canvas.removeEventListener("mousemove", this._binded_mouse_callback );
		document.body.addEventListener("mousemove", this._binded_mouse_callback  );
		document.body.addEventListener("mouseup", this._binded_mouse_callback );
	}
	else if(e.type == "mousemove")
	{
		if(!ignore)
		{
			var deltax = x - this.last_mouse[0];
			var deltay = y - this.last_mouse[1];
			if( this.dragging )
				this.mouseDrag( deltax, deltay );
		}
	}
	else if(e.type == "mouseup")
	{
		this.dragging = false;
		document.body.removeEventListener("mousemove", this._binded_mouse_callback );
		document.body.removeEventListener("mouseup", this._binded_mouse_callback );
		canvas.addEventListener("mousemove", this._binded_mouse_callback  );
	}
	else if(e.type == "mousewheel" || e.type == "wheel" || e.type == "DOMMouseScroll")
	{
		e.eventType = "mousewheel";
		if(e.type == "wheel")
			e.wheel = -e.deltaY;
		else
			e.wheel = (e.wheelDeltaY != null ? e.wheelDeltaY : e.detail * -60);

		//from stack overflow
		e.delta = e.wheelDelta ? e.wheelDelta/40 : e.deltaY ? -e.deltaY/3 : 0;
		this.changeDeltaScale(1.0 + e.delta * 0.05);
	}

	this.last_mouse[0] = x;
	this.last_mouse[1] = y;

	e.preventDefault();
	e.stopPropagation();
	return false;
}

DragAndScale.prototype.toCanvasContext = function( ctx )
{
	ctx.scale( this.scale, this.scale );
	ctx.translate( this.offset[0], this.offset[1] );
}

DragAndScale.prototype.convertOffsetToCanvas = function(pos)
{
	//return [pos[0] / this.scale - this.offset[0], pos[1] / this.scale - this.offset[1]];
	return [ (pos[0] + this.offset[0]) * this.scale, (pos[1] + this.offset[1]) * this.scale ];
}

DragAndScale.prototype.convertCanvasToOffset = function(pos, out)
{
	out = out || [0,0];
	out[0] = pos[0] / this.scale - this.offset[0];
	out[1] = pos[1] / this.scale - this.offset[1];
	return out;
}

DragAndScale.prototype.mouseDrag = function(x,y)
{
	this.offset[0] += x / this.scale;
	this.offset[1] += y / this.scale;

	if(	this.onredraw )
		this.onredraw( this );
}

DragAndScale.prototype.changeScale = function( value, zooming_center )
{
	if(value < this.min_scale)
		value = this.min_scale;
	else if(value > this.max_scale)
		value = this.max_scale;

	if(value == this.scale)
		return;

	if(!this.element)
		return;

	var rect = this.element.getBoundingClientRect();
	if(!rect)
		return;

	zooming_center = zooming_center || [rect.width * 0.5,rect.height * 0.5];
	var center = this.convertCanvasToOffset( zooming_center );
	this.scale = value;
	if( Math.abs( this.scale - 1 ) < 0.01 )
		this.scale = 1;

	var new_center = this.convertCanvasToOffset( zooming_center );
	var delta_offset = [new_center[0] - center[0], new_center[1] - center[1]];

	this.offset[0] += delta_offset[0];
	this.offset[1] += delta_offset[1];

	if(	this.onredraw )
		this.onredraw( this );
}

DragAndScale.prototype.changeDeltaScale = function( value, zooming_center )
{
	this.changeScale( this.scale * value, zooming_center );
}

DragAndScale.prototype.reset = function()
{
	this.scale = 1;
	this.offset[0] = 0;
	this.offset[1] = 0;
}
