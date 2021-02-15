"use strict";

//ANIMATE by Javi Agenjo (@tamat) 2018 and modifyed by Eva Valls (2021)
//************************************
//This file contains the code necessary to store and play animations (Intent Node, Project, Tracks and Clips definitions)
//All the editor features are in ANIMED.js

(function(global){

var ANIM = global.ANIM = {};

var DEG2RAD = 0.0174532925;
var RAD2DEG = 57.295779578552306;

//clip types
ANIM.MISSING_CLIP = -1; //used when after loading a clip the type is not found in the system
ANIM.NULL_CLIP = 0;
ANIM.SPEECH = 1;
ANIM.FACE = 2;
ANIM.GAZE = 3;
ANIM.GESTURE = 4;
ANIM.HEAD = 5;
ANIM.LOCOMOTION = 6;
ANIM.POSTURE = 7;
ANIM.CUSTOM = 8;

ANIM.REF_CLIP = 100;

ANIM.LEFT = 1;
ANIM.CENTER = 2;
ANIM.RIGHT = 3;

//inputs
ANIM.LEFT_BUTTON = 1;
ANIM.RIGHT_BUTTON = 2;
ANIM.MIDDLE_BUTTON = 4;

ANIM.clip_types = [];

//player modes
ANIM.PLAYING = 1;
ANIM.PAUSED = 2;

//blend modes
ANIM.NORMAL = 0;
ANIM.SCREEN = 1;
ANIM.OVERLAY = 2;
ANIM.MULTIPLY = 3;
ANIM.DARKEN = 4;
ANIM.HARD_LIGHT = 5;
ANIM.SOFT_LIGHT = 6;
ANIM.BLEND_MODES = ["Normal","Screen","Overlay","Multiply","Darken","Hard Light","Soft Light"];
ANIM.blend_to_operation = {
	0: "source-over",
	1: "screen",
	2: "overlay",
	3: "multiply",
	4: "darken",
	5: "hard-light",
	6: "soft-light"
};


ANIM.clip_types = {};
ANIM.registerClipType = function(ctor)
{
	var name = ctor.name;
	ANIM.clip_types[ ctor.id ] = ctor;
	for(var i in BaseClip.prototype)
		ctor.prototype[i] = BaseClip.prototype[i];
	ANIM[ name ] = ctor;
}

//Intent node with timeline
function TimelineIntent()
{
  var w = 150;
  var h =45;
  this.size = [w,h];
  this.addInput("","path", { pos:[w*0.5, - LiteGraph.NODE_TITLE_HEIGHT], dir:LiteGraph.UP});
  this.addOutput("","path", { pos:[w*0.5, h] , dir:LiteGraph.DOWN});
  this.properties = { precision: 1 };

  this.shape = 2;
  this.horizontal = true;
  this.serialize_widgets = true;
  this.widgets_up = true;

  this.name = "Intent timeline";

	this.behaviour = new Behaviour();
	//timing
	this.mode = ANIM.PAUSED;
	this.current_time = 4;
	this.duration = 60;
	this.framerate = 30;
	this.volume = 1;
	this.type = ANIM.CANVAS2D;
	this.allow_seeking = true;

	//canvas
	//this.size = [1280,720]; //project res

	//tracks: similar to layers
	this.tracks = []; //all tracks
	this.markers = []; //time markers

	//scripts
	this.includes = []; //urls to js files that must be imported
	this.scripts = {}; //scripts that could be used in this project
	this.globals = {}; //container to store global vars between clips
	this.texts = {}; //generic container for text data

	//external
	this.fonts = []; //fonts that must be loaded from Google Fonts

	this.clip_types = []; //list of all available clip types

	this.duration = 120;

  TimelineIntent.instance = this;
}

//name to show
TimelineIntent.title = "Intent";

//function to call when the node is executed
TimelineIntent.prototype.tick = function(agent, dt, info)
{
	if(this.facade == null)
		this.facade = this.graph.context.facade;
    var behaviours = [];
  for(var i in this.tracks)
  {
    var track = this.tracks[i];
    for(var j in track.clips)
    {
      var behaviour = new Behaviour();
      behaviour.type = B_TYPE.intent_timeline || 17;
	    behaviour.STATUS = STATUS.success;
      behaviour.setData(track.clips[j].clipToJSON());
      behaviours.push(behaviour);
      this.graph.evaluation_behaviours.push(behaviour);
    }
  }
  agent.evaluation_trace.push(this.id);

  return behaviours;
}
TimelineIntent.prototype.onDblClick = function()
{
		ANIMED.project = this;
		ANIMED.project.name = name;

		ANIMED.clearUndo();
		ANIMED.setTime(this.current_time)
    ANIMED.showTimeline(true);

}
TimelineIntent.prototype.add = function(track)
{
	if(track.constructor !== ANIM.Track)
		throw("only tracks allowed to be added to project");
	this.tracks.push( track );
	track._project = this;
	return track;
}

TimelineIntent.prototype.getTrack = function( id )
{
	if(id.constructor === String)
	{
		for(var i = 0; i < this.tracks.length; ++i )
			if( this.tracks[i].name == id )
				return this.tracks[i];
		return null;
	}
	return this.tracks[ Number(id) ];
}

TimelineIntent.prototype.clear = function( skip_default_tracks )
{
	this.current_time = 0;

	this.globals = {};
	this.tracks.length = 0;
	this.markers.length = 0;

}
TimelineIntent.prototype.showClipPanel = function()
{

}
LiteGraph.registerNodeType("btree/TimelineIntent", TimelineIntent );
// PROJECT ****************************************************
//a project contains tracks, a track contains clips, and a clip could contain frames
function Project()
{
	this.name = "unnamed";


	//timing
	this.mode = ANIM.PAUSED;
	this.current_time = 0;
	this.duration = 60;
	this.framerate = 30;
	this.volume = 1;
	this.type = ANIM.CANVAS2D;
	this.allow_seeking = true;

	//canvas
	this.size = [1280,720]; //project res

	//tracks: similar to layers
	this.tracks = []; //all tracks
	this.markers = []; //time markers

	//scripts
	this.includes = []; //urls to js files that must be imported
	this.scripts = {}; //scripts that could be used in this project
	this.globals = {}; //container to store global vars between clips
	this.texts = {}; //generic container for text data

	//external
	this.fonts = []; //fonts that must be loaded from Google Fonts

	this.clip_types = []; //list of all available clip types

	this.clear();

	Project.instance = this;
}

ANIM.Project = Project;

Project.prototype.add = function(track)
{
	if(track.constructor !== ANIM.Track)
		throw("only tracks allowed to be added to project");
	this.tracks.push( track );
	track._project = this;
	return track;
}

Project.prototype.getTrack = function( id )
{
	if(id.constructor === String)
	{
		for(var i = 0; i < this.tracks.length; ++i )
			if( this.tracks[i].name == id )
				return this.tracks[i];
		return null;
	}
	return this.tracks[ Number(id) ];
}


Project.prototype.clear = function( skip_default_tracks )
{
	this.current_time = 0;

	this.globals = {};
	this.tracks.length = 0;
	this.markers.length = 0;

	this.includes = [];
	this.scripts = {};
	this.fonts = [];
}


Project.prototype.load = function( url, on_complete )
{
	var that = this;
	fetch(url)
	.then(function(response) {
		if(response.status == 404)
		{
			if(on_complete)
				on_complete(null);
		}
		else
		  return response.json();
	}).then( function(data){
		if(data)
			that.fromJSON(data, on_complete);
	});/*.catch(function(err){
		console.error( "error loading project: " + err );
	});
	*/
}

Project.prototype.toJSON = function()
{
	var json = {};

	json.name = this.name;

	json.current_time = this.current_time;
	json.duration = this.duration;
	json.framerate = this.framerate;
	json.size = this.size;
	json.markers = this.markers;
	json.texts = this.texts;

	json.includes = this.includes;
	json.scripts = [];
	for(var i in this.scripts)
	{
		var script = this.scripts[i];
		json.scripts.push({ name: script.name, code: script.code });
	}



	json.tracks = [];
	for(var i = 0; i < this.tracks.length; ++i)
		json.tracks.push( this.tracks[i].toJSON() );

	json.fonts = this.fonts;

	return json;
}

Project.prototype.fromJSON = function(json, callback)
{

	this.current_time = json.current_time || 0;
	this.duration = json.duration;
	this.framerate = json.framerate;
	this.size = json.size;

	this.tracks.length = 0;
	this.markers = json.markers || [];

	if(json.includes)
		this.includes = json.includes;

	if( !this.includes.length )
		inner.call(this);
	else
		this.loadScripts( inner.bind(this) );

	function inner()
	{
		this.scripts = {};
		if(json.scripts)
		for(var i = 0; i < json.scripts.length; ++i)
		{
			var script = json.scripts[i];
			this.registerScript( script.name, script.code );
		}

		if(json.tracks)
		for(var i = 0; i < json.tracks.length; ++i)
		{
			var track = new Track();
			track.fromJSON( json.tracks[i] );
			this.add( track );
		}

		if(this.fonts.length)
			this.loadFonts();

		if(callback)
			callback();
	}
}

//when coding clips from external scripts, you need a way to ensure clip classes hasnt been modifyed
Project.prototype.checkClips = function()
{
	for(var j = 0; j < this.tracks.length; ++j)
	{
		var track = this.tracks[j];
		for(var i = 0; i < this.clips.length; ++i)
		{
			var clip = this.clips;
			var ctor_class = ANIM.clip_types[ clip.constructor.id ];
			if(clip.constructor === ctor_class)
				continue;
			var new_clip = new ctor_class();
			new_clip.fromJSON( clip.toJSON() );
			new_clip.start = clip.start;
			new_clip.duration = clip.duration;
			new_clip.fadein = clip.fadein;
			new_clip.fadeout = clip.fadeout;
			this.clips[i] = new_clip;
		}
	}
}

function Track( name )
{
	this.name = name || "noname";
	this.clips = [];
	this.hidden = false;
	this.editable = true;
	this._project = null;
	this.current_clip = null;
}

Track.prototype.getIndex = function()
{
	return this._project.tracks.indexOf(this);
}

Track.prototype.toJSON = function()
{
	var json = {
		name: this.name,
		clips: [],
		editable: this.editable,
		hidden: this.hidden
	};
	for(var i = 0; i < this.clips.length; ++i)
	{
		var clip = this.clips[i];
		var data = ANIM.clipToJSON( clip );
		if(data)
			json.clips.push( data );
	}

	return json;
}

ANIM.clipToJSON = function( clip )
{
	var id;
	var data;
	if( clip.constructor === ANIM.MissingClip )
	{
		id = clip.missing_type;
		data = clip.json;
	}
	else if(clip.toJSON)
	{
		id = clip.constructor.id;
		data = clip.toJSON();
	}
	else
	{
		console.warn("Clip without toJSON, data not serialized");
		return null;
	}
	if( clip.fadein )
		data.fadein = clip.fadein;
	if( clip.fadeout )
		data.fadeout = clip.fadeout;
	if( clip.control_channels )
	{
		data.ccs = [];
		for(var i = 0; i < clip.control_channels.length; ++i)
			data.ccs.push( clip.control_channels[i].toJSON() );
	}

	return [ id, clip.start, clip.duration, data ];
}

Track.prototype.fromJSON = function(json)
{
	this.name = json.name;
	this.editable = json.editable;
	this.hidden = json.hidden;

	if(!json.clips)
	{
		console.warn("track without clips");
		return;
	}

	for(var i = 0; i < json.clips.length; ++i)
	{
		var clip_data = json.clips[i];
		var clip = ANIM.clipFromJSON( clip_data );
		this.add( clip );
	}
}

ANIM.clipFromJSON = function( clip_data, clip )
{
	var type = ANIM.clip_types[ clip_data[0] ];
	clip = clip || null;
	if(!clip)
	{
		if(type)
			clip = new type();
		else
		{
			console.error("Clip type id unknown:", clip_data[0] );
			clip = new ANIM.MissingClip();
			clip.missing_type = clip_data[0];
			clip.json = clip_data[3];
		}
	}
	clip.start = clip_data[1];
	clip.duration = clip_data[2];
	if(clip.fromJSON)
		clip.fromJSON( clip_data[3] );
	else if( clip.constructor !== ANIM.MissingClip )
		console.warn("Clip without fromJSON: ", clip_data[0] );
	var data = clip_data[3];
	if( data.fadein )
		clip.fadein = data.fadein;
	if( data.fadeout )
		clip.fadeout = data.fadeout;
	if( data.ccs )
	{
		clip.control_channels = [];
		for(var i = 0; i < data.ccs.length; ++i)
			clip.control_channels.push( new ANIM.ControlChannel( data.ccs[i] ) );
	}

	return clip;
}

//used to render the content of this track so it doesnt have to be rendered constantly
Track.prototype.getTempCanvas = function()
{
	if(!this._temp_canvas)
		this._temp_canvas = document.createElement("canvas");
	return this._temp_canvas;
}

//defined in animate-webgl.js
Track.prototype.getTempTexture = function()
{
	return null;
}

Track.prototype.add = function( clip, time, duration )
{
	if(time !== undefined)
	{
		if(isNaN(time))
		{
			console.error("NaN in time");
			return;
		}
		clip.start = time;
	}
	if(duration !== undefined)
		clip.duration = duration;
	clip._track = this;
	this.clips.push( clip );
	this.sortClips();
}

Track.prototype.remove = function(clip)
{
	var index = this.clips.indexOf(clip);
	if(index != -1)
		this.clips.splice(index,1);
	this.sortClips();
}

Track.prototype.sortClips = function()
{
	this.clips.sort( function(a,b) {return a.start - b.start; });
}

Track.prototype.getClipAtTime = function(time)
{
	for(var i = 0, l = this.clips.length; i < l; ++i)
	{
		var clip = this.clips[i];
		if(clip.start > time || (clip.start + clip.duration) < time )
			continue;
		return clip;
	}
	return null;
}

Track.prototype.getClipsInRange = function(start,end)
{
	var res = [];
	for(var i = 0, l = this.clips.length; i < l; ++i)
	{
		var clip = this.clips[i];
		if(clip.start > end || (clip.start + clip.duration) < start )
			continue;
		res.push(clip);
	}
	return res;
}

ANIM.Track = Track;

// CONTROL CHANNEL : used to store keyframes

function ControlChannel(o)
{
	this.name = "param";
	this.type = ANIM.NUMBER;
	this.values = [];
	this.interpolation_type = ANIM.LINEAR;
	if(o)
		this.fromJSON(o);
}

ANIM.ControlChannel = ControlChannel;

ControlChannel.prototype.fromJSON = function(o)
{
	this.type = o.type;
	this.name = o.name;
	this.values = o.values;
}

ControlChannel.prototype.toJSON = function()
{
	return {
		type: this.type,
		name: this.name,
		values: this.values.concat()
	};
}

ControlChannel.prototype.addKeyframe = function( time, value )
{
	var k = [time,value];
	for(var i = 0; i < this.values.length; ++i)
	{
		if( this.values[i][0] > time )
		{
			this.values.splice(i,0,k);
			return k;
		}
	}
	this.values.push(k);
	return k;
}

ControlChannel.prototype.removeKeyframe = function( keyframe )
{
	for(var i = 0; i < this.values.length; ++i)
	{
		if( this.values[i] == keyframe )
		{
			this.values.splice(i,1);
			return;
		}
	}
}

ControlChannel.prototype.removeKeyframeByTime = function( time )
{
	for(var i = 0; i < this.values.length; ++i)
	{
		if( Math.abs( this.values[i][0] - time ) < 0.001 )
		{
			this.values.splice(i,1);
			return;
		}
	}
}

ControlChannel.prototype.removeKeyframeByIndex = function( index )
{
	this.values.splice(index,1);
}

ControlChannel.prototype.sort = function()
{
	this.values.sort( function(a,b) { return a[0] - b[0]; } );
}

ControlChannel.prototype.getSample = function( time )
{
	if(!this.values.length)
		return null;

	//sample value
	var prev;
	var next;
	for(var j = 0; j < this.values.length; ++j)
	{
		var v = this.values[j];
		if(v[0] < time)
		{
			prev = v;
			continue;
		}
		next = v;
		break;
	}

	if(!prev && !next)
		return 0; //no data

	if(!prev && next)
		return next[1];

	if(prev && !next)
		return prev[1];

	var f = (time - prev[0]) / (next[0] - prev[0]);
	if(this.type == ANIM.NUMBER)
		return prev[1] * (1-f) + next[1] * (f);

	return null;
}


// CLIPS *******************************************************
//-----------------------------Face Behaviour-----------------------------//
//FaceLexemeClip to show captions
function FaceLexemeClip()
{
	this.id= "faceLexeme-"+Math.ceil(getTime());;
	this.amount = 0.5;
	this.start = 0
	this.attackPeak = 0.25;
	this.relax = 0.75;
	this.duration = 1;
	this.lexeme = "";
	this.permanent = false;

	this.color = "black";
	this.font = "40px Arial";

  this.clip_color = "#94e9d9";
  //this.icon_id = 37;
}

FaceLexemeClip.id = ANIM.FACE_LEXEME? ANIM.FACE_LEXEME:1;
FaceLexemeClip.clip_color = "cyan";
ANIM.registerClipType( FaceLexemeClip );

FaceLexemeClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		amount: this.amount,
		start: this.start,
		attackPeak: this.attackPeak,
		relax: this.relax,
		duration: this.duration,
		lexeme: this.lexeme,
		permanent: this.permanent,
	}

	return json;
}

FaceLexemeClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.amount = json.amount;
	this.start = json.start;
	this.attackPeak = json.attackPeak;
	this.relax = json.relax;
	this.duration = json.duration;
	this.lexeme = json.lexeme;
	this.permanent = json.permanent;
}

FaceLexemeClip.prototype.drawTimeline = function( ctx, project, w,h, selected )
{
	//ctx.globalCompositeOperation =  "source-over";
	var text_info = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( text_info.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}

//FaceFACSClip
function FaceFACSClip()
{
	this.id= "faceFACS-"+Math.ceil(getTime());;
	this.amount = 0.5;
	this.start = 0
	this.attackPeak = 0.25;
	this.relax = 0.75;
	this.duration = 1;
	this.au = "";
	this.side ="BOTH"; //[LEFT, RIGHT, BOTH](optional)
	this.permanent = false;

	this.color = "black";
	this.font = "40px Arial";

}

FaceFACSClip.id = ANIM.FACE_FACS? ANIM.FACE_FACS:2;
FaceFACSClip.clip_color = "#00BDFF";
ANIM.registerClipType( FaceFACSClip );

FaceFACSClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		amount: this.amount,
		start: this.start,
		attackPeak: this.attackPeak,
		relax: this.relax,
		duration: this.duration,
		au: this.au,
		side: this.side,
		permanent: this.permanent,

	}

	return json;
}

FaceFACSClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.amount = json.amount;
	this.start = json.start;
	this.attackPeak = json.attackPeak;
	this.relax = json.relax;
	this.duration = json.duration;
	this.au = json.au;
	this.permanent = json.permanent;
	this.side = json.side;
}

FaceFACSClip.prototype.drawTimeline = function( ctx, project, w,h, selected )
{
	ctx.globalCompositeOperation =  "source-over";
	var text_info = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( text_info.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}
/*----------------------------------Gaze Behaviour-----------------------------------*/
//GazeClip
function GazeClip()
{
	this.id= "gaze-"+Math.ceil(getTime());
	this.target = null;
	this.start = 0
	this.ready = 0.25; //if it's not permanent
	this.relax = 0.75; //if it's not permanent
	this.duration = 1;
	this.influence = ""; //[EYES, HEAD, SHOULDER, WAIST, WHOLE](optional)
	this.offsetAngle = 0.0; //(optional)
	this.offsetDirection = "RIGHT"; //[RIGHT, LEFT, UP, DOWN, UPRIGHT, UPLEFT, DOWNLEFT, DOWNRIGHT](optional)
	this.permanent = false;

	this.color = "black";
	this.font = "40px Arial";

}

GazeClip.id = ANIM.GAZE? ANIM.GAZE:3;
GazeClip.clip_color = "fuchsia";
ANIM.registerClipType( GazeClip );

GazeClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		target: this.target,
		start: this.start,
		ready: this.ready,
		relax: this.relax,
		duration: this.duration,
		influence: this.influence,
		offsetAngle: this.offsetAngle,
		offsetDirection: this.offsetDirection,
		permanent: this.permanent
	}

	return json;
}

GazeClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.target = json.target;
	this.start = json.start;
	this.ready = json.ready;
	this.relax = json.relax;
	this.duration = json.duration;
	this.influence = json.influence;
	this.offsetAngle = json.offsetAngle;
	this.offsetDirection = json.offsetDirection;
	this.permanent = json.permanent;
}

GazeClip.prototype.drawTimeline = function( ctx, project, w,h, selected )
{
	ctx.globalCompositeOperation =  "source-over";
	var text_info = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( text_info.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}
/*----------------------------------Gesture Behaviour-----------------------------------*/
//GestureClip
function GestureClip()
{
	this.id= "gesture-"+Math.ceil(getTime());;
	this.lexeme = "";
	this.mode = "";
	this.start = 0
	this.ready = 0.25;
	this.strokeStart = 0.75;
	this.stroke = 1;
	this.strokeEnd = 1.25;
	this.relax = 1.5;
	this.duration = 1.75;
	this.target = null; //gesture is directed towards that target (optional) for pointing

	this.color = "black";
	this.font = "40px Arial";

}

GestureClip.id = ANIM.GESTURE? ANIM.GESTURE:4;
GestureClip.clip_color = "lime";
ANIM.registerClipType( GestureClip );

GestureClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		lexeme: this.lexeme,
		mode: this.mode,
		start: this.start,
		ready: this.ready,
		strokeStart: this.strokeStart,
		stroke: this.stroke,
		strokeEnd: this.strokeEnd,
		relax: this.relax,
		duration: this.duration,
		target: this.target
	}

	return json;
}

GestureClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.lexeme  = json.lexeme;
	this.start = json.start;
	this.ready = json.ready;
	this.strokeStart = json.strokeStart;
	this.stroke = json.stroke;
	this.strokeEnd = json.strokeEnd;
	this.relax = json.relax;
	this.duration = json.duration;
	this.target = json.target;
}

GestureClip.prototype.drawTimeline = function( ctx, project, w,h, selected )
{
	//ctx.globalCompositeOperation =  "source-over";
	var text_info = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( text_info.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}
/*----------------------------------Head Behaviour-----------------------------------*/
//HeadClip
function HeadClip()
{
	this.id= "head-"+Math.ceil(getTime());;
	this.lexeme = ""; //[NOD,SHAKE, TILD...]
	this.repetition = 1; //[1,*] (optional)
	this.amount = 1; //[0,1]
	this.start = 0;
	this.ready = 0.15;
	this.strokeStart = 0.5;
	this.stroke = 0.75;
	this.strokeEnd = 1;
	this.relax = 1.15;
	this.duration = 1.5;


	this.color = "black";
	this.font = "40px Arial";

}

HeadClip.id = ANIM.HEAD? ANIM.HEAD:5;
HeadClip.clip_color = "yellow";
ANIM.registerClipType( HeadClip );

HeadClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		lexeme: this.lexeme,
		repetition: this.repetition,
		amount: this.amount,
		start: this.start,
		ready: this.ready,
		strokeStart: this.strokeStart,
		stroke: this.stroke,
		strokeEnd: this.strokeEnd,
		relax: this.relax,
		duration: this.duration,
	}

	return json;
}

HeadClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.lexeme = json.lexeme;
	this.repetition = json.repetition;
	this.amount = json.amount;
	this.start = json.start;
	this.ready = json.ready;
	this.strokeStart = json.strokeStart;
	this.stroke = json.stroke;
	this.strokeEnd = json.strokeEnd;
	this.relax = json.relax;
	this.duration = json.duration;
}

HeadClip.prototype.drawTimeline = function( ctx, project, w,h, selected )
{
	//ctx.globalCompositeOperation =  "source-over";
	var text_info = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( text_info.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}
//HeadDirectionShiftClip
function HeadDirectionShiftClip()
{
	this.id= "headDir-"+Math.ceil(getTime());
	this.target = "";
	this.start = 0;
	this.duration = 0.5;

	this.color = "black";
	this.font = "40px Arial";

}

HeadDirectionShiftClip.id = ANIM.HEAD_DIRECTION? ANIM.HEAD_DIRECTION:6;
HeadDirectionShiftClip.clip_color = "orange";
ANIM.registerClipType( HeadDirectionShiftClip );

HeadDirectionShiftClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		target: this.target,
		start: this.start,
		duration: this.duration,
	}

	return json;
}

HeadDirectionShiftClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.target = json.target;
	this.start = json.start;
	this.duration = json.duration;
}

HeadDirectionShiftClip.prototype.drawTimeline = function( ctx, project, w,h, selected )
{
	ctx.globalCompositeOperation =  "source-over";
	var text_info = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( text_info.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}
/*----------------------------------Posture Behaviour-----------------------------------*/
//pOSTUREClip
function PostureClip()
{
	this.id= "posture-"+Math.ceil(getTime());
	this.lexeme = ""; //[ARMS_CROSSED,...]
	this.part = ""; //[ARMS, LEFT_ARM, RIGHT_ARM, LEGS...]
	this.stance = ""; //[SITTING, CROUNCHING, STANDING, LYING]
	this.start = 0;
	this.ready = 0.25; //if it's not permanent
	this.relax = 0,75; //if it's not permanent
	this.duration = 1;
	this.permanent = false;

	this.color = "black";
	this.font = "40px Arial";

}

PostureClip.id = ANIM.POSTURE? ANIM.POSTURE:7;
PostureClip.clip_color = "#7CFF00";
ANIM.registerClipType( PostureClip );

PostureClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		lexeme: this.lexeme,
		part: this.part,
		stance: this.stance,
		start: this.start,
		ready: this.ready,
		relax: this.relax,
		duration: this.duration,
		permanent: this.permanent
	}

	return json;
}

PostureClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.lexeme = json.lexeme;
	this.part = json.part;
	this.stance = json.stance;
	this.start = json.start;
	this.ready = json.ready;
	this.relax = json.relax;
	this.duration = json.duration;
	this.permanent = json.permanent;
}

PostureClip.prototype.drawTimeline = function( ctx, project, w,h, selected )
{
	ctx.globalCompositeOperation =  "source-over";
	var text_info = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( text_info.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}

/*-------------------------Speech Behaviour---------------------------------*/
//Speech to show captions
function SpeechClip()
{
	this.id= "speech-"+Math.ceil(getTime());
	this.start = 0
	this.duration = 1;
	this.text = "";
	this.aduioId = null;
	this.color = "black";
	this.blend_mode = ANIM.NORMAL;
	this._width = 0;

  this.clip_color = "#94e9d9";
  //this.icon_id = 37;
}

SpeechClip.id = ANIM.SPEECH;
SpeechClip.clip_color = "#FF0046";
ANIM.registerClipType( SpeechClip );


SpeechClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		duration: this.duration,
		text: this.text,
	}
	return json;
}

SpeechClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.start = json.start;
	this.duration = json.duration;
	this.text = json.text;
	if(json.audioId)
		this.audioId = json.audioId;
}

SpeechClip.prototype.drawTimeline = function( ctx, project, w,h, selected )
{
	if(this.id == "")
		this.id = this.text;
	var text_info = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
/*	if( text_info.width < (w - 24) )*/
		ctx.fillText( this.id, 24,h * 0.7 );
}


function BaseClip()
{
}

BaseClip.prototype.getProject = function()
{
	if(!this._track)
		return null;
	return this._track._project;
}

BaseClip.prototype.addControlChannel = function(name, type)
{
	if(!this.control_channels)
		this.control_channels = [];
	var cc = new ANIM.ControlChannel();
	cc.name = name;
	cc.type = type;
	this.control_channels.push(cc);
	return cc;
}

//returns value of a CC given a local_time
BaseClip.prototype.getCC = function(name, time, default_value )
{
	if(!this.control_channels)
		return default_value;

	for(var i = 0; i < this.control_channels.length;++i)
	{
		var cc = this.control_channels[i];
		if( cc.name != name )
			continue;
		//sample value
		var prev = null;
		var next = null;
		for(var j = 0; j < cc.values.length; ++j)
		{
			var v = cc.values[j];
			if(v[0] < time)
			{
				prev = v;
				continue;
			}
			next = v;
			break;
		}

		if(!prev && !next)
			return 0; //no data

		if(!prev && next)
			return next[1];

		if(prev && !next)
			return prev[1];

		var f = (time - prev[0]) / (next[0] - prev[0]);
		if(cc.type == ANIM.NUMBER)
			return prev[1] * (1-f) + next[1] * (f);
	}

	return default_value;
}



//AudioClip to playback audios ******************************
function AudioClip()
{
	this._src = "";
	this.start = 0;
	this.duration = 1;
	this.volume = 0.5;
	this.offset_time = 0;
	this.position = new Float32Array(2);
	this.scale = new Float32Array([1,1]);

	this._audio = new Audio();
}

Object.defineProperty( AudioClip.prototype, "src", {
	set: function(v){
		this._src = v;
		this._audio.src = v;
	},
	get: function(){
		return this._src;
	}
});

AudioClip.id = ANIM.AUDIO_CLIP;
ANIM.registerClipType( AudioClip );

AudioClip.prototype.drawCanvas = function( ctx, local_time, track, project )
{
	if( ctx.constructor !== CanvasRenderingContext2D )
		return;
	if(!this.src)
		return;

	if( project.mode == ANIM.PAUSED )
		this._audio.pause();
	else
		this._audio.play();

	var volume = this.volume;
	var cc_volume = this.getCC("volume",local_time);
	if(cc_volume != null)
		volume *= cc_volume;
	volume = project.volume * (project.mode == ANIM.PAUSED ? 0 : (volume * this.fade));
	this._audio.volume = Math.clamp( volume, 0, 1);
	var diff = Math.abs( local_time - this._audio.currentTime + this.offset_time );
	if( project.mode == ANIM.PAUSED || diff > 0.1 )
		this._audio.currentTime = local_time + this.offset_time;
}

AudioClip.prototype.preload = function( time, is_visible )
{
	if(!is_visible)
		this._audio.currentTime = this.offset_time;
}

AudioClip.prototype.drawTimeline = function( ctx, project, w,h, selected )
{
	//draw waveform...
}

AudioClip.prototype.onLeave = function( project, player )
{
	this._audio.volume = 0;
}

AudioClip.prototype.isLoading = function()
{
	return this._audio.seeking;
}

AudioClip.prototype.toJSON = function()
{
	return {
		src: this.src,
		offset: this.offset_time,
		volume: this.volume
	}
}

AudioClip.prototype.fromJSON = function(json)
{
	this.src = json.src;
	this.offset_time = json.offset;
	this.volume = json.volume;
}


ANIM.clip_types = {"Speech": [ SpeechClip, AudioClip], "Face": [FaceLexemeClip, FaceFACSClip], "Gaze": [GazeClip], "Gesture":[GestureClip], "Head": [HeadClip, HeadDirectionShiftClip], "Posture": [PostureClip] };
ANIM.track_types = ["Speech","Face","Gaze","Gesture", "Head", "Posture"];

//helpers **************************

var seed = 123;
function random() {
    var x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}
var noise_data = new Float32Array(1024);
for(var i = 0; i < noise_data.length; ++i)
	noise_data[i] = random();

function noise(t)
{
	var i = (t|0) % 1024;
	if(i < 0) i = 1024 + i;
	var i2 = (i+1) % 1024;
	var f = t-(t|0);
	f = f*f*f*(f*(f*6.0-15.0)+10.0); //exp
	return noise_data[i] * (1-f) + noise_data[i2] * f;
}

ANIM.noise = noise;

function distance(a,b)
{
	var x = b[0] - a[0];
	var y = b[1] - a[1];
	return Math.sqrt(x*x+y*y);
}

function vec2Length(x,y)
{
	return Math.sqrt(x*x+y*y);
}

function replace(target, search, replacement) {
    return target.replace(new RegExp(search, 'g'), replacement);
};

global.getTime = performance.now.bind(performance);


function RGB(r,g,b) { return "rgb(" + Math.floor(Math.clamp(r,0,1)*255) + "," + Math.floor(Math.clamp(g,0,1)*255) + "," + Math.floor(Math.clamp(b,0,1)*255) + ")"; }
function HSL(h,s,L) { return "hsl(" + Math.floor(h*360) + "," + Math.floor(Math.clamp(s,0,1)*100) + "%," + Math.floor(Math.clamp(v,0,1)*100) + "%)"; }
global.RGB = RGB;
global.HSL = HSL;


})(this);