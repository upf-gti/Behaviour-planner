/*Interface- Timeline, Tracs and Clips editors*/
function onResize( element, callback ){
  element.width = element.clientWidth = element.parentElement.clientWidth;
  element.height = element.clientHeight = element.parentElement.clientHeight;
  if(callback)
    callback(element.width,element.height)
}

var MIN_DISTANCE = 6;
var ANIMED = {

  current_mode: 1,
	track_height: 20,
	max_tracks: 8,
	track_height_collapsed: 50,
	track_height_extended: 100,

	selected_object: null,

	timeline_mode: "tracks",
  //internal
	_timeline_visible_clips: [],
	_margin_right: 0,
	_coding_panel_visible: false,
	_visible_tracks: [],
	frame: 0,
	fps: 60,
  clip_editors : [],

init: function()
{

//  this.project = new ANIM.Project();

	//var widgets = this.widgets = new Widgets( canvas, this.onWidgetTrigger.bind(this) );
	//widgets.loadIcons( "imgs/icons.png" );

	//to render the timeline
	var timeline = this.timeline = new Timeline();
	timeline.onSetTime = this.setTime.bind(this);
	timeline.onDrawContent = this.onDrawTimelineContent.bind(this);
	timeline.onMouse = this.onTimelineMouse.bind(this);
	timeline.timeline_extended_height = this.max_tracks * this.track_height_extended;
  timeline.setScale(150.0946352969992);
  //timeline.current_time = this.project.current_time;

//  this.project.demo()
  //this.selected_track = this.project.tracks[0];

  //var dialog = new LiteGUI.Dialog('Intent', { title:'Intent', close: true, minimize: false, width: 700, height: 200, scroll: false, resizable: false, draggable: true });
  LiteGUI.init();
  var area = new LiteGUI.Area();

  var canvas = this.canvas = document.getElementById("timeline-canvas") || document.createElement("CANVAS");
  canvas.id = "timeline-canvas";
  canvas.style.position = "absoulte";
  canvas.style.width="100%";
  canvas.style.height="100%";

  var ctx = this.ctx = canvas.getContext('2d');

  var ds = null;
	var framerate = 16;
	var current_frame_num = 0;
	var selected_track = null;

  var timeline_final_height = timeline.extended ? canvas.height : 100;
//  draw(gl, current_animation, final_anim_time, [x,y width, height])
  this.timeline.draw(ctx, this.project, this.timeline.current_time,  [0, 0, canvas.width, canvas.height] );
  area.add(canvas)
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;
  //INTERFACE


  this.canvas_rect = [0,0, canvas.offsetWidth, canvas.offsetHeight];
  var mouse_callback = this.onMouse.bind(this);
		canvas.addEventListener("mousedown", mouse_callback );
		canvas.addEventListener("mousemove", mouse_callback );
		document.addEventListener("mouseup", mouse_callback );
		canvas.addEventListener("mousewheel", mouse_callback, false);
		canvas.addEventListener("wheel", mouse_callback, false);

		canvas.addEventListener("contextmenu", function(e){ e.preventDefault(); return true; }, false);
		this.ds = new DragAndScale( canvas, true );
    //start
		this._last_time = getTime();

    return area;
},
showTimeline: function(show)
{
  if(show)
  {
  //  CORE.Interface.timeline_dialog.show();
  //CORE.Interface.graphTabs.root.style.height = "calc(100% - 250px)";
  CORE.Interface.graph_area.showSection(1);

  CORE.Interface.graph_area.onResize()

  //CORE.Interface.timeline_dialog.show();
//  document.getElementsByClassName("graph-content")[0].appendChild(CORE.Interface.timeline_dialog.root)
  GraphManager.resize();
    //CORE.Interface.graph_area.add(CORE.Interface.timeline_dialog)
    requestAnimationFrame( this.loop.bind(this) );
    onResize(document.getElementById("timeline-canvas"))
  }else{
    CORE.Interface.graphTabs.root.style.height = "100%"
    CORE.Interface.timeline_dialog.close();
    GraphManager.resize();
  }


},
loop: function()
	{
		requestAnimationFrame( this.loop.bind(this) );
		var now = getTime();
		var dt = (now - this._last_time) * 0.001;
		this._last_time = now;
		if( this.frame % 10 == 0)
			this.fps = (1 / dt);
		this.frame++;
		this.draw();
		//this.update(dt);
	},
draw: function()
{
	var that = this;
	var canvas = this.canvas;
	var ctx = this.ctx;
	var timeline = this.timeline;
	var project = this.project;
	var settings = this.settings;
	var current_time = this.timeline.current_time;

  ctx.restore()
	//editor stuff
/*		var selected_clip = this.selected_clip;
	if( selected_clip && (selected_clip.start > current_time || (selected_clip.start + selected_clip.duration) < current_time))
		selected_clip = null;//avoid editing something that is not visible

	if( selected_clip && selected_clip.constructor.editor && selected_clip.constructor.editor.draw )
		selected_clip.constructor.editor.draw( ctx, selected_clip, current_time );
*/

	//timeline
	timeline.scroll_height =(project.tracks.length+1)*this.track_height+20;
	var timeline_final_height = timeline.height;
	timeline.draw( ctx, project, current_time, [0, 0, canvas.width, timeline_final_height] );
//		this.drawIcon( timeline.extended ? 30 : 29, canvas.width * 0.5 - 16, canvas.height - timeline.height - 20, 32, "extend_timeline" );
  ctx.restore()
},
dragging: false,
pos: [0,0],
panned_pos: [0,0],
last_pos: [0,0],
action: null,
last_click: 0,
buttons: 0,

setTime: function(t)
{
  if(t == null || t.constructor != Number)
    return;
  var time = Math.clamp(t, 0, this.project.duration );
  this.timeline.current_time = time;

  this.project.current_time = time;
},
showRightPanel: function(v)
{
  /*this.sidepanel.visible = v;
  var w = this.sidepanel.root.getBoundingClientRect().width;
  this._margin_right = v ? w : 0;*/
  this.sidepanel = CORE.Interface.graphinspector;
},
undo: [],
clearUndo: function()
{
	this.undo.length = 0;
},

addUndoStep: function( action, target )
{
	console.log(action);
	switch (action)
	{
		case "clip_created":
		case "clip_modified":
		case "clip_deleted":
			var clip = target;
			var data = ANIM.clipToJSON( clip );
			this.undo.push({ action: action, clip: data, clip_index: clip._track.clips.indexOf( clip ), track: clip._track.getIndex() });
			break;
		case "track_moved":
			var track = target;
			this.undo.push({ action: action, track_name: track.name, track_index: track.getIndex() });
			break;
	}
},

redoUndoStep: function()
{
	var undo_data = this.undo.pop();
	if(!undo_data)
		return;
	if( undo_data.action == "clip_deleted" )
	{
		var clip = ANIM.clipFromJSON( undo_data.clip );
		var track = this.project.tracks[ undo_data.track ];
		track.add( clip );
	}
	else if( undo_data.action == "clip_created" )
	{
		var track = this.project.tracks[ undo_data.track ];
		if(track)
		{
			var clip = track.clips[ undo_data.clip_index ];
			if(clip)
				track.remove( clip );
		}
	}
	else if( undo_data.action == "clip_modified" )
	{
		var track = this.project.tracks[ undo_data.track ];
		if(track)
		{
			var clip = track.clips[ undo_data.clip_index ];
			if(clip)
				ANIM.clipFromJSON( undo_data.clip, clip );
		}
	}
	else if( undo_data.action == "track_moved" )
	{
		var track = this.project.getTrack( undo_data.track_name );
		if(track)
		{
			var curr_index = track.getIndex();
			var new_index = undo_data.track_index;
			this.project.tracks.splice( curr_index, 1 );
			this.project.tracks.splice( new_index, 0, track );
		}
	}
},
createClip: function( type )
{
	if( !this.project.tracks.length )
		return;

	var time = Math.floor(this.timeline.current_time * this.project.framerate) / this.project.framerate;
	//check if it overlaps: TODO
	var track = this.selected_track || this.project.tracks[0];
	var clip = new type();
	track.add( clip, time, 1 );
	this.addUndoStep("clip_created", clip );
},
registerClipEditor: function( clip, editor )
{
	var clip_name = clip.name;
	clip.editor = editor;
	this.clip_editors[ clip_name ] = editor;
},
onDrawTimelineContent: function(ctx, start_time, end_time, timeline )
{
	var framerate = this.project.framerate;
	var track_height = this.track_height//ANIMED.track_height;
	var timeline_height = timeline.height;
	var scroll_y = 0;
	var canvas = ctx.canvas;
	var vertical_offset = 20; //20?

	ctx.save();

	if( timeline_height < timeline.scroll_height )
		scroll_y = -timeline.current_scroll_in_pixels;
	if(scroll_y)
	{
		ctx.beginPath();
		ctx.rect(0,0,canvas.width,timeline_height);
		ctx.clip();
	}

	var time_per_frame = 1 / framerate;
	var frame_width = time_per_frame * timeline._seconds_to_pixels;

	ctx.strokeStyle = "#AAA";
	ctx.fillStyle = "#3A3";
	start_time = Math.floor( start_time * framerate) / framerate;

	var project = this.project;
	var framerate = project.framerate;
  var visible_clips = this._timeline_visible_clips;
	visible_clips.length = 0;

	var startx = Math.floor( timeline.timeToX( start_time ) ) + 0.5;
	this.timeline_startx = startx;
	var selected_clip_area = null;

  //compute visible tracks
	var y = scroll_y + 0.5;
	this._visible_tracks.length = 0;
	for(var i = 0; i < project.tracks.length; ++i)
	{
		var track = project.tracks[i];
		track._index = i;
		if(y > timeline.height)
			break;
		if( !track.editable && !this.timeline.extended)
			continue;
		this._visible_tracks.push( track );
		track._visible_index = i;
	}

	if( this.timeline_mode == "tracks" )
	{
		//render selected track
		var selected_track_index = project.tracks.indexOf( this.selected_track );
		if( selected_track_index != -1 && 0 )
		{
			var y = scroll_y + 0.5 + track_height * selected_track_index;
      ctx.lineWidth = 2;
			ctx.globalAlpha = 0.1;
			ctx.fillStyle = this.diagonals_pattern;
			ctx.fillRect( Math.max( startx, 0 ),y,ctx.canvas.width, track_height );
			ctx.globalAlpha = 1;
		}

		ctx.fillStyle = "#123";
		ctx.strokeStyle = "#888";
		ctx.textAlign = "right";

    //render track clips
		var y = scroll_y + 0.5 + vertical_offset;
		for(var i = 0; i < this._visible_tracks.length; ++i)
		{
			var track = this._visible_tracks[i];
			var track_alpha = track.hidden ? 0.5 : 1;

      //background tracks
      var color = "#111111";
      if(i%2==0)
          color = "#232323";
      if(track==this.selected_track)
        color = "gray"
      ctx.save()
      ctx.fillStyle = color;
      ctx.fillRect(0,y,ctx.canvas.width,y+ANIMED.track_height)
      ctx.fillStyle = "black";
      ctx.restore();

      //draw clips
			ctx.textAlign = "left";
			var clips = track.getClipsInRange( start_time, end_time );
			if(clips && clips.length)
			for(var j = 0, l = clips.length; j < l; ++j)
			{
				var clip = clips[j];
				visible_clips.push( clip );

				var frame_num = Math.floor( clip.start * framerate );
				var x = Math.floor( timeline.timeToX( frame_num / framerate) ) + 0.5;
				frame_num = Math.floor( (clip.start + clip.duration) * framerate );
				var x2 = Math.floor( timeline.timeToX( frame_num / framerate) ) + 0.5;
				var w = x2-x;

				if( x2 < 0 || x > canvas.width )
					continue;

				//background rect
				ctx.globalAlpha = track_alpha;
				ctx.fillStyle = clip.constructor.clip_color || "#333";
				ctx.fillRect(x,y,w,track_height);

				//draw clip content
				if( clip.drawTimeline )
				{
					ctx.save();
					ctx.translate(x,y);
					ctx.strokeStyle = "#AAA";
					ctx.fillStyle = "#AAA";
					clip.drawTimeline( ctx, project, x2-x,track_height, this.selected_clip == clip, timeline );
					ctx.restore();

				}
				//draw clip outline
				if(clip.hidden)
					ctx.globalAlpha = track_alpha * 0.5;
				var safex = Math.max(-2, x );
				var safex2 = Math.min( canvas.width + 2, x2 );
        ctx.lineWidth = 0.5;
				ctx.strokeStyle = clip.constructor.color || "black";
				ctx.strokeRect( safex, y, safex2-safex, track_height );
				ctx.globalAlpha = track_alpha;
				if(this.selected_clip == clip)
					selected_clip_area = [x,y,x2-x,track_height ]
			}
			y += track_height;
		}

		//render clip selection area
		if(selected_clip_area)
		{
			ctx.strokeStyle = "white";
      ctx.lineWidth = 2;
			ctx.strokeRect( selected_clip_area[0]-1,selected_clip_area[1]-1,selected_clip_area[2]+2,selected_clip_area[3]+2 );
			ctx.strokeStyle = "#888";
      ctx.lineWidth = 0.5;
		}
	} //end tracks mode
	/*else if( this.timeline_mode == "clip" && this.selected_clip ) //clips mode
	{
		var clip = this.selected_clip;
		var selected_property = "opacity";

		//render click area
		var frame_num = Math.floor( clip.start * framerate );
		var x = Math.floor( timeline.timeToX( frame_num / framerate) ) + 0.5;
		frame_num = Math.floor( (clip.start + clip.duration) * framerate );
		var x2 = Math.floor( timeline.timeToX( frame_num / framerate) ) + 0.5;
		var w = x2-x;

	/*	if( x2 >= 0 && x <= canvas.width )
		{
			var area_height = timeline_height - 40;
			this.drawControlChannels( ctx, clip, x, 20, w, area_height );
		}*/
/*  }*/
  //SIDEBAR
	//track names
	var w = 120;

	if( startx < w )
	{
		ctx.fillStyle = "black";
		ctx.globalAlpha = 0.75;
		ctx.fillRect(0,0,w,this.timeline.size[1]);
		ctx.globalAlpha = 1;
	}
  ctx.fillStyle = "black";
  ctx.fillRect(0,0,timeline.sidebar_width,timeline.size[1] );

	ctx.textAlign = "right";
	var x = startx > w ? startx : w;
	this._timeline_left_panel_x = x;
	var y = scroll_y + 0.5 + vertical_offset;

	var container = null;
	if( this.timeline_mode == "tracks" )
		container = this._visible_tracks;
	else if( this.timeline_mode == "clip" && this.selected_clip )
		container = this.selected_clip.control_channels;

	if( container )
  	for(var i = 0; i < container.length; ++i)
  	{
  		var item = container[i];
  		var icon_num = -1;
  		var name = "";
  		var active = true;
  		var is_selected = false;
  		var color = "#AAA";
  		var selection_color = "white";

  		if( this.timeline_mode == "tracks" )
  		{
  			var track = item;
  			if( !track.editable && !this.timeline.extended)
  				continue;
  			active = this.timeline.extended ? track.editable : !track.hidden; //the same icon changes depending on timeline extended
  			icon_num = this.timeline.extended ? 6 : 7;
  			name = track.name;
  			is_selected = track == this.selected_track;
  		}
  		else if( this.timeline_mode == "clip" )
  		{
  			var cc = item;
  			icon_num = 6;
  			name = cc.name;
  			active = !cc.disabled;
  			is_selected = i == this.selected_cc_index;
  			//color = selection_color = ANIMED.CC_COLORS[ i % ANIMED.CC_COLORS.length];
  		}
  		if( name )
  		{
  			ctx.fillStyle = color;
  			ctx.fillText( name, x - 20, y + track_height * 0.7);
  			ctx.fillStyle = "#123";
  			ctx.globalAlpha = 1;
  		}

  		if( is_selected )
  		{
  			ctx.fillStyle = selection_color;
  			ctx.globalCompositeOperation = "difference";
  			ctx.beginPath();
  			ctx.moveTo(0,y);
  			ctx.lineTo(timeline.sidebar_width-7,y);
  			ctx.lineTo(timeline.sidebar_width-2,y + track_height*0.5);
  			ctx.lineTo(timeline.sidebar_width-7,y + track_height);
  			ctx.lineTo(0,y + track_height);
  			ctx.closePath();
  			ctx.fill();
  			ctx.globalCompositeOperation = "source-over";
  		}

  		if( this.timeline_mode == "clip" )
  		{
  			var cc = item;
  			ctx.fillStyle = "black";
  			ctx.fillRect( x + 4 - 16, y + 4, track_height - 8, track_height - 8 );
  			ctx.fillStyle = ANIMED.CC_COLORS[ i % ANIMED.CC_COLORS.length ];
  			ctx.fillRect( x + 6 - 16, y + 6, track_height - 12, track_height - 12 );
  		}

  		y += track_height;
  	}
	ctx.restore();
},
  //mouse event
	onMouse: function(e)
	{
		var widgets = this.widgets;
		var canvas = this.canvas;
		var ctx = this.ctx;
		var timeline = this.timeline;
		var project = this.project;
		var pos = this.pos;
		var last_pos = this.last_pos;
		var panned_pos = this.panned_pos;
		var current_time = this.timeline.current_time;


		e.preventDefault();
		e.stopPropagation();
		var could_type = e.target.localName == "input" || e.target.localName == "textarea";

		var was_dragging = this.dragging;
		var now = getTime();

		var visible_selected_clip = this.selected_clip;


		//update mouse info
		if(e.type == "mousedown")
		{
			e.click_time = now - this.last_click;
			this.last_click = now;
			this.dragging = true;
			this.buttons |= (1<<(e.button));
			if(!could_type && document.activeElement)
				document.activeElement.blur();
		}
		else if(e.type == "mouseup")
		{
			e.click_time = now - this.last_click;
			this.last_click = now;
			this.dragging = false;
			this.action = null;
			this.buttons = this.buttons & ~(1<<(e.button));
		}

		//extend
		e.dragging = this.dragging;
		//e.buttons = this.buttons;

		if(widgets && widgets.onMouse(e) === true )
		{
			this.widget_clicked = true;
			return;
		}

		//inside timeline? (decided by the timeline)
		if( timeline.processMouse(e) === true )
			return;

		var x = pos[0] = e.offsetX;
		var y = pos[1] = e.offsetY;

		this.ds.convertCanvasToOffset( pos, panned_pos );
		e.canvasX = panned_pos[0];
		e.canvasY = panned_pos[1];



		var selected_clip = this.selected_clip;
		if( selected_clip && (selected_clip.start > current_time || (selected_clip.start + selected_clip.duration) < current_time))
			selected_clip = null;//avoid editing something that is not visible

		if(e.type != "wheel")
		{
			e.deltaX = e.canvasX - last_pos[0];
			e.deltaY = e.canvasY - last_pos[1];
		}


		var inside_canvas = isInsideRect( e.offsetX, e.offsetY, this.canvas_rect );
		canvas.style.cursor = inside_canvas ? "crosshair" : "";
		var clip_editor = this.selected_clip && this.selected_clip.constructor.editor ? this.selected_clip.constructor.editor : null;


		if(e.type == "mousedown")
		{
			if( this.current_mode != 0 && clip_editor && clip_editor.onMouseDown )
				clip_editor.onMouseDown( e, this.selected_clip, project );
			else if( inside_canvas )
			{
				if( this.current_mode == 0 || e.ctrlKey )
					this.ds.onMouse(e);
			}
			else if( panned_pos[0] > 0 && panned_pos[0] < project.size[0] && panned_pos[1] > project.size[1] && panned_pos[1] < (project.size[1] + 20) ) //scrollbar
			{
				this.action = "seeking";
				this.setTime( (panned_pos[0] / project.size[0]) * project.duration );
			}
		}
		else if(e.type == "mousemove")
		{
			if( this.current_mode != 0 && clip_editor && clip_editor.onMouseMove && !e.ctrlKey && !this.widget_clicked )
      {
        clip_editor.onMouseMove( e, this.selected_clip, project,this.timeline );

      }


			if(this.dragging)
			{
				if( (this.current_mode == "pan" || e.ctrlKey) && this.action != "seeking" )
					this.ds.onMouse(e);
				else if( this.action == "seeking" )
				{
					this.setTime( (panned_pos[0] / project.size[0]) * project.duration );
				}
				else if( distance( panned_pos, last_pos ) > MIN_DISTANCE )
				{
					//project.anim_track.addPoint( panned_pos[0], panned_pos[1] );
					last_pos[0] = panned_pos[0];
					last_pos[1] = panned_pos[1];
          if(this.clip_in_panel == this.selected_clip)
          {
            this.showClipInfo(this.selected_clip)
          }
				}
			}
		}
		else if(e.type == "mouseup")
		{
			this.widget_clicked = false;

			if( this.current_mode != 0 && clip_editor && clip_editor.onMouseUp )
				clip_editor.onMouseUp( e, this.selected_clip, project );

			this.action = null;
			if(was_dragging)
			{
				//project.anim_track.addPoint( panned_pos[0], panned_pos[1] );
				//project.anim_track.endLine();
			}
		}
		else if(e.type == "mousewheel" || e.type == "wheel" || e.type == "DOMMouseScroll")
		{
			if( this.current_mode != 0 && clip_editor && clip_editor.onMouseWheel )
				clip_editor.onMouseWheel( e, this.selected_clip );
			this.ds.onMouse(e);
		}

		return true;
	},

  //called from timeline
onTimelineMouse: function( e, time, timeline )
{
  var track_height = ANIMED.track_height;
  var x = e.offsetX - timeline.position[0];
  var vertical_offset = 20;
  var y = e.offsetY + timeline.current_scroll_in_pixels - 20 - vertical_offset - this.timeline.position[1];
  var timeline_height = timeline.height;
  var track_index = Math.floor( y / track_height );
  var track = this._visible_tracks[ track_index ];
  var time = timeline.current_time;
  var clicked_time = timeline.xToTime( x );
  if( e.type == "mousedown" )
  {
    if( e.click_time < 200 ) //double click
    {
      if (this.timeline_mode == "tracks")
      {
        if( this.selected_clip )
        {
          if( this.clip_in_panel != this.selected_clip )
          {
            this.showRightPanel(true);
            this.showClipInfo( this.selected_clip );
          }
          else
            this.timeline_mode = "clip";
          return true;
        }
        else
        {
          console.log("showRightPanel")

            //this.showRightPanel()
          //this.showRightPanel(false);
        }

      }
      else if (this.timeline_mode == "clip" && this.selected_clip && this.selected_clip.control_channels && this.selected_cc_index < this.selected_clip.control_channels.length )
      {
        //insert keyframe
        var clip = this.selected_clip;
        if( clicked_time > this.selected_clip.start && clicked_time < this.selected_clip.start + this.selected_clip.duration )
        {
          var cc = this.selected_clip.control_channels[ this.selected_cc_index ];
          var v = (1 - y / timeline_height) * 2 - 1;
          this.selected_cc_keyframe = cc.addKeyframe( clicked_time - this.selected_clip.start, v );
        }
      }
    }
    else //single click
    {
      /*
      1 for the left button
      2 for the middle button
      3 for the right button
      */
      if(e.which==3)//right click_time
      {
        //getTack()
        //open new clip contextmenu
        if (this.timeline_mode == "tracks")
        {
          console.log("right click")
          var clips_names = [];
          var track = this.getTrackAtTimelinePosition( e, true );
          //Add track
          if(!track)
          {
            var tracks = [];
            for(var i in ANIM.track_types)
              tracks.push(i);
            var ctxmenu = new LiteGUI.ContextMenu(tracks, {title: "Track actions", event:e, callback: function(v)
            {
              var that = this;
              var track = new ANIM.Track(v);
              that.project.tracks.push(track);

            }.bind(this)});

          }
          else if(track.pos[0]<this.timeline.sidebar_width)
          {
            var ctxmenu = new LiteGUI.ContextMenu(["Delete track"], {title: "Track actions", event:e, callback: function(v)
            {
              var that = this;
              if(v=="Delete track")
              {
                that.project.tracks.splice(track._index,1);
                return;
              }
            }.bind(this)});
          }
          else
          {
            var clicked_clip = this.getClipAtTimelinePosition( e, true, 10 );
            if(clicked_clip &&clicked_clip == this.selected_clip)
            {
              var ctxmenu = new LiteGUI.ContextMenu(["Delete clip"], {title: "Clip actions", event:e, callback: function(v)
              {
                var that = this;
                if(v=="Delete clip")
                {
                  var trackId = that.selected_clip._track._index;
                  var idx = that.project.tracks[trackId].clips.indexOf(this.selected_clip);
                  that.project.tracks[trackId].clips.splice(idx,1);
                  return;
                }
              }.bind(this)});
            }
            else
            {
              for(var i in ANIM.track_types[track.name])
              {
                var clip = ANIM.track_types[track.name][i];
                clips_names.push(clip.name);
              }

              var ctxmenu = new LiteGUI.ContextMenu(clips_names, {title: "Clip actions",event: e, callback: function(v)
              {
                var that = this;

                var idx = clips_names.indexOf(v);

                var clip = new ANIM.track_types[track.name][idx];

                that.project.tracks[track._index].add( clip, clicked_time);

              }.bind(this)});
            }
          }
        }
        else{
          var ctxmenu = new LiteGUI.ContextMenu(["Close clip editor"], {title: "Clip actions",event: e, callback: function(v)
          {
            this.timeline_mode = "tracks"
          }.bind(this)})
        }
      }
      else
      {
        this.selected_object = null;
        this.selected_cc_keyframe = null;

        if (this.timeline_mode == "tracks")
        {
          var clicked_clip = this.getClipAtTimelinePosition( e, true, 10 );
          if( clicked_clip && this.selected_clip == clicked_clip ) //modifying clip
          {
            this.timeline_clicked_clip = clicked_clip;
            this.timeline_clicked_clip_time = clicked_time;
            var ending_x = timeline.timeToX( clicked_clip.start + clicked_clip.duration );
            var dist_to_start = Math.abs( timeline.timeToX( clicked_clip.start ) - x );
            var dist_to_end = Math.abs( timeline.timeToX( clicked_clip.start + clicked_clip.duration ) - e.offsetX );
            this.addUndoStep( "clip_modified", clicked_clip );
            if( (e.shiftKey && dist_to_start < 5) || (clicked_clip.fadein && Math.abs( timeline.timeToX( clicked_clip.start + clicked_clip.fadein ) - e.offsetX ) < 5) )
              this.drag_clip_mode = "fadein";
            else if( (e.shiftKey && dist_to_end < 5) || (clicked_clip.fadeout && Math.abs( timeline.timeToX( clicked_clip.start + clicked_clip.duration - clicked_clip.fadeout ) - e.offsetX ) < 5) )
              this.drag_clip_mode = "fadeout";
            else if( Math.abs( ending_x - x ) < 10 )
              this.drag_clip_mode = "duration";
            else
              this.drag_clip_mode = "move";
          }
        }
        else if (y > -2 && this.timeline_mode == "clip" && this.selected_clip && this.selected_clip.control_channels && this.selected_cc_index < this.selected_clip.control_channels.length )
        {
          var clip = this.selected_clip;
          var cc = this.selected_clip.control_channels[ this.selected_cc_index ];
          //search keyframe
          for(var i = 0; i < cc.values.length; ++i)
          {
            var v = cc.values[i];
            var v_x = timeline.timeToX( clip.start + v[0] );
            if( x < v_x - 5 || x > v_x + 5 )
              continue;
            var t = clicked_time - clip.start;
            if( t >= 0 && t <= clip.duration )
            {
              v[0] = t;
              v[1] = (1 - y / timeline_height) * 2 - 1;
            }
            this.selected_cc_keyframe = v;
            this.selected_object = "keyframe";
          }
        }
      }
    }
    return false;
  }
  else if( e.type == "mousemove" )
  {
    if( e.dragging )
    {
      if (this.timeline_mode == "tracks")
      {
        if( this._dragging_track && this._dragging_track != track && this._dragging_track != track && track )
        {
          this.swapTracks( this._dragging_track, track );
        }
        else if( this.timeline_clicked_clip )
        {
          var diff = clicked_time - this.timeline_clicked_clip_time;
          if( this.drag_clip_mode == "move" )
            this.timeline_clicked_clip.start += diff;
          else if( this.drag_clip_mode == "fadein" )
            this.timeline_clicked_clip.fadein = (this.timeline_clicked_clip.fadein || 0) + diff;
          else if( this.drag_clip_mode == "fadeout" )
            this.timeline_clicked_clip.fadeout = (this.timeline_clicked_clip.fadeout || 0) - diff;
          else if( this.drag_clip_mode == "duration" )
            this.timeline_clicked_clip.duration += diff;
          this.timeline_clicked_clip_time = clicked_time;
          return true;
        }
      }
      else if (this.timeline_mode == "clip" && this.selected_clip && this.selected_cc_keyframe != null && this.selected_cc_index < this.selected_clip.control_channels.length )
      {
        //dragging CC
        var clip = this.selected_clip;
        var v = this.selected_cc_keyframe;
        var t = clicked_time - clip.start;
        var cc = clip.control_channels[ this.selected_cc_index ];
        if( v && t >= 0 && t <= clip.duration )
        {
          v[0] = t;
          v[1] = (1 - Math.max(0,y) / timeline_height) * 2 - 1;
          cc.sort();
          return true;
        }
      }
    }
  }
  else if ( e.type == "mouseup" )
  {
    this._dragging_track = null;

    if( e.offsetX < this._timeline_left_panel_x ) //left panel
    {
      if(track)
        this.selected_track = track;
      return true;
    }

    if( this.timeline_clicked_clip )
    {
      if( this.timeline_clicked_clip.fadein && this.timeline_clicked_clip.fadein < 0 )
        this.timeline_clicked_clip.fadein = 0;
      if( this.timeline_clicked_clip.fadeout && this.timeline_clicked_clip.fadeout < 0 )
        this.timeline_clicked_clip.fadeout = 0;
    }
    this.timeline_clicked_clip = null;
    if(e.click_time < 200)
    {
      if( this.timeline_mode == "tracks" )
      {
        this.selected_clip = this.getClipAtTimelinePosition(e, true);
        if(	this.selected_clip )
        {
          this.selected_object = "clip";
          return true;
        }
      }
    }
  }
}
,
getTrackAtTimelinePosition: function( e, reverse, margin )
	{
		margin = margin || 0;

		var track_height = ANIMED.track_height;
		var vertical_offset = 20;
		var x = e.offsetX - this.timeline.position[0];
		var y = e.offsetY + this.timeline.current_scroll_in_pixels - this.timeline.position[1] - vertical_offset - 20;
		if(y < 0)
			return null;
		var clicked_track = this._visible_tracks[ Math.floor( y / track_height) ];
    if(clicked_track)
      clicked_track.pos = [x,y];
    return clicked_track;
  },

getClipAtTimelinePosition: function( e, reverse, margin )
	{
		margin = margin || 0;
		var clips = this._timeline_visible_clips;
		var track_height = ANIMED.track_height;
		var vertical_offset = 20;
		var x = e.offsetX - this.timeline.position[0];
		var y = e.offsetY + this.timeline.current_scroll_in_pixels - this.timeline.position[1] - vertical_offset - 20;
		if(y < 0)
			return null;
		var clicked_track = this._visible_tracks[ Math.floor( y / track_height) ];
		if(!clicked_track)
			return null;
		var start = reverse ? clips.length - 1 : 0;
		var end = reverse ? -1 : clips.length;
		var delta = reverse ? -1 : 1;
		for(var i = start; i != end; i += delta)
		{
			var clip = clips[i];
			var track = clip._track;
			if( track != clicked_track )
				continue;
			var startx = this.timeline.timeToX( clip.start, this.project.framerate );
			var endx = this.timeline.timeToX( clip.start + clip.duration, this.project.framerate );
			if( x < (startx - margin) || x > (endx + margin) )
				continue;
			return clip;
		}
		return null;
	},
  showClipInfo: function(clip)
  	{
  		this.clip_in_panel = clip;
  		var panel = this.sidepanel;

  		panel.clear();
      panel.widgets_per_row = 1;
  		panel.addTitle( clip.constructor.name );
    	panel.addString("Id", clip.id, {callback: function(v)
      {
        this.clip_in_panel.id = v;
      }.bind(this)})
  		panel.addSection("Time");
  		panel.addNumber("Start", clip.start, {min:0, callback: function(v)
      {
        this.clip_in_panel.start = v;
      }.bind(this)})
  		panel.addNumber("Duration", clip.duration, {min:0, callback: function(v)
      {
        this.clip_in_panel.duration = v;
      }.bind(this)})
  		panel.addSection("Content");
      if(clip.showInfo)
      {
        clip.showInfo(panel);
        return;
      }
      for(var i in clip.properties)
      {
        if(clip.showInfo)
        {
          clip.showInfo(panel);
          return;
        }

        var property = clip.properties[i];
        switch(property.constructor)
        {

          case String:
            panel.addString(i, property, {callback: function(i,v)
            {
              this.clip_in_panel.properties[i] = v;
            }.bind(this, i)});
            break;
          case Number:
            if(i=="amount")
            {
              panel.addNumber(i, property, {min:0, max:1,callback: function(i,v)
              {
                this.clip_in_panel.properties[i] = v;
              }.bind(this,i)});
            }
            else{
              panel.addNumber(i, property, {callback: function(i,v)
              {
                this.clip_in_panel.properties[i] = v;
              }.bind(this,i)});
            }
            break;
          case Boolean:
            panel.addCheckbox(i, property, {callback: function(i,v)
            {
              this.clip_in_panel.properties[i] = v;
            }.bind(this,i)});
              break;
          case Array:
            panel.addArray(i, property, {callback: function(i,v)
            {
              this.clip_in_panel.properties[i] = v;
            }.bind(this,i)});
              break;
        }
      }
  		var editor = clip.constructor.editor;
  		/*if(editor && editor.onPanel)
  			editor.onPanel( panel, clip );
*/
  		/*
  		panel.addSection("FX");
  		panel.addProperty( "type",clip, "fx_type", String );
  		panel.addProperty( "param",clip, "fx_param", Number );
  		*/

  		/*panel.addSection("Control Channels");
  		if( clip.control_channels )
  		for(var i = 0; i < clip.control_channels.length; ++i)
  		{
  			var cc = clip.control_channels[i];
  			panel.addString( cc.name, cc, "name");
  		}
  		panel.addButton("Add new control channel",{callback:function(){
  			ANIMED.addControlChannel( clip );
  			ANIMED.showClipInfo(clip);
  		}});
  		if( ANIMED.timeline_mode != "clip" )
  		{
  			panel.addButton("Open Editor", {callback:function(){
  				ANIMED.timeline_mode = "clip";
  				ANIMED.showClipInfo(clip);
  			}});
  		}
  		else
  		{
  			panel.addButton("Exit Editor", {callback:function(){
  				ANIMED.timeline_mode = "tracks";
  				ANIMED.showClipInfo(clip);
  			}});
  		}*/
  	},
}

//clip editors ****************************************************
var SpeechClipEditor = {
	init: function()
	{

	},

	draw: function(ctx)
	{
	},

	onMouseMove: function( e, clip, project, timeline )
	{

		if( e.dragging )
		{
			/*clip.position[0] = Math.round( e.canvasX - clip._width * 0.5 );
			clip.position[1] = Math.round( e.canvasY );*/
      if(!clip._width)
        clip._width = clip.duration;
      var x = Math.round( e.canvasX - clip._width * 0.5 );
      var y = Math.round( e.canvasY );
      clip.start = timeline.xToTime(x)
      if(project.clip_in_panel == clip)
        project.showClipInfo(clip)
		}
	},

	onTrigger: function( project, action, params )
	{
	},

	onPanel: function( panel, clip )
	{
    panel.addProperty("id",clip,"id");
		panel.addProperty("text",clip,"text");
		panel.addProperty("opacity",clip,"opacity");
		panel.addProperty("blend_mode", clip, "blend_mode", BlendValues );

	}
};


//helpers *********************************************************

function isInsideRect( x,y, rect )
{
	return (x >= rect[0] && x < (rect[0] + rect[2]) && y >= rect[1] && y < (rect[1] + rect[3]));
}

function distance(a,b)
{
	var x = b[0] - a[0];
	var y = b[1] - a[1];
	return Math.sqrt(x*x+y*y);
}
