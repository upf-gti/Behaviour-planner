//BehaviourPlanner manages the core logic of Behaviour Graphs


/**
 * Dependencies:
 *  HBTree
 */
(function _behaviourPlanner(global)
{
   /* var HBTree = global.HBTree;
    var HBTGraph = HBTree.HBTGraph;
    var HBTContext = HBTree.HBTContext;
    entitiesManager = global.EntitiesManager;*/
    class Agent{
        constructor(o ,pos){
            this.uid =  "Agent-" + Date.now();
    
            this.initProperties();
            if(o){
                this.configure(o);
            }
    
            //Legacy in constructor pos
            this.position = pos;
    
            this.onUpdate = null;
    
            //this.hbtgraph is not used in HBTree
        }
    
        initProperties(){
            this.properties = {
                name: this.uid,
                valence:0,
                arousal:0,
                age: 35,
    
                target: null,
                look_at_pos: [0,0,10000],
                position: [0,0,0],
                orientation: [0,0,0,1],
                state: "waiting",
    
                //Internal for hbt
                bt_info: {running_data: {}},
            };
        }
    
        configure(o){
            if(o.uid){
                this.uid = o.uid;
                this.properties.name = o.uid;
            }
    
            if(o.properties){
                for(let k in o.properties){
                    this.properties[k] = o.properties[k];
                }
            }
        }
    
        //For HBT where is expected to be outside properties
        get position(){return this.properties.position;}
        set position(p){this.properties.position = p;}
        get bt_info(){return this.properties.bt_info;}
    
        serialize(){
            var o = {};
            o.uid = this.uid;
            o.properties = this.properties;
    
            return o;
        }
    }
    global.Agent = Agent;

    class User{
        constructor(o, pos){
            this.uid =  "User-"+ Date.now();
            this.initProperties();
            if(o){
                this.configure(o);
            }
    
            //Legacy in constructor pos
            this.position = pos;
    
            this.onUpdate = null;
        }
    
        initProperties(){
            this.properties = {
                name: this.uid,
                is_in_front: false,
                  is_speaking: false,
                valence: 0,
                arousal: 0,
                look_at_pos: [0,0,0],
                position: [0,0,0],
                orientation: [0,0,0,1],
                text: ""
            }
        }
    
        configure(o){
            if(o.uid){
                this.uid = o.uid;
                this.properties.name = o.uid;
            }
    
            if(o.properties){
                for(let k in o.properties){
                    this.properties[k] = o.properties[k];
                }
            }
        }
    
        //For HBT where is expected to be outside properties:
        get position(){return this.properties.position;}
        set position(p){this.properties.position = p;}
    
        serialize(){
            var o = {};
            o.uid = this.uid;
            o.properties = this.properties;
            return o;
        }
        // Delete "#" properties to discard unnecessary data
        cleanUserProperties()
        {
            var clean_user = Object.assign({}, this);
            for(var i in clean_user.properties)
                if(i.includes("#"))
                    clean_user.properties[i] = "";
            // Shallow copy does not keep the methods, so I need to add it
            clean_user.serialize = this.serialize;
            return clean_user;
            
        }
    }
    global.User = User;

    var BP_STATE = {
        STOP: 0,
        PLAYING: 1,
    };
    

    var EVENTS = {
        textRecieved: 0,
        imageRecieved: 1,
        faceDetected: 2,
        codeRecieved: 3
    };

    var last = now = 0;
    var accumulate_time = 0;
    var execution_t = 1;
    var triggerEvent = false;
    var corpus;

    var tmp = {
      /*  vec: vec3.create(),
        axis: vec3.create(),
        axis2: vec3.create(),
        inv_mat: mat4.create(),*/
        agent_anim: null,
        behaviours: null
    };

    //var userText = false;
    //var currentContext = null;
    //var currentHBTGraph = null;

    class BehaviourPlanner{

        constructor(o, options){
            this._user = null;
            this._agent = null;
            this._corpus = null;
            this._entities = null;
    
            this._hbt_graph = null;
    
            this.state = BP_STATE.STOP;
            this.accumulate_time = 0;
            this.execution_t = 1;
    
    
            //Callbacks
            this.onStateChange = null; //Not used
            this.onBehaviours = null; //Raw behaviour objects
            this.onActions = null; //Action objects (protocol) from processing behaviours
    
            //Init and configure
            this.init();
            if(o) this.configure(o);
            if(options) this.options = options;
        }
    
        set user(o){
            if(o.constructor !== User){
                console.log("Error while assigning User");
                return;
            }
    
            this._user = o;
    
            if(this.hbt_graph){
                this.blackboard.user = o;
            }
        }
    
        get user(){return this._user;}
    
        set agent(o){
            if(o.constructor !== Agent){
                console.log("Error while assigning Agent");
                return;
            }
    
            this._agent = o;
    
            if(this.hbt_graph){
                this.context.agent_evaluated = o;
                this.blackboard.agent = o;
            }
        }
    
        get agent(){return this._agent;}
        set corpus(o){this._corpus = o;}
        get corpus(){return this._corpus || null;}
    
        set hbt_graph(o){
            if(o.constructor !== HBTGraph){
                console.log("Graph must be HBTGraph");
                return;
            }
    
            this._hbt_graph = o;
    
            //Be sure that graph has context (it should be already set)
            if(!this._hbt_graph.graph.context){
                this._hbt_graph.graph.context = new HBTContext();
            }
    
            this.context.agent_evaluated = this.agent;
        
            //LAST: Set attributes of graph blackboard
            this.blackboard.configure({
                user: this.user,
                agent: this.agent,
                corpus: this.corpus,
                entities: this.entities,
            });
        }
    
        get hbt_graph(){return this._hbt_graph;}
        get context(){return this._hbt_graph ? this._hbt_graph.graph.context : null;}
        get blackboard(){return this._hbt_graph ? this._hbt_graph.graph.context.blackboard : null;}
    
        init(){
            this.user = new User();
            this.agent = new Agent();
            this.entitiesManager = EntitiesManager;
            this.state = BP_STATE.STOP;
            this.accumulate_time = 0;
            this.execution_t = 1;
        }
    
        configure(o){
            if(o.user) this.user = o.user;
            if(o.agent) this.agent = o.agent;
    
            if(o.hbt_graph) this.hbt_graph = o.hbt_graph;
        }
    
        play(){
            this.state = BP_STATE.PLAYING;
        }
    
        stop(){
            this.state = BP_STATE.STOP;
            this.context.last_event_node = null;
            this.context.running_nodes = null
        }
    
        update(dt){
            if(this.state == BP_STATE.PLAYING){
                this.accumulate_time += dt;
                if(this.accumulate_time >= this.execution_t){
                    //Evaluate agent on the graph
                    if(this.agent && this.hbt_graph){
                        let context = this.context;
    
                        if(context.running_nodes && context.running_nodes.length){
                            var behaviours = this.hbt_graph.runBehaviour(this.agent, this.context, this.accumulate_time, context.running_nodes[0]);
                            this.accumulate_time = 0; //runBehaviour expects time between calls
                            if(this.onBehaviours) this.onBehaviours(behaviours);
                            this.processBehaviours(behaviours);
                            if(!context.running_nodes || !context.running_nodes[0])
                                this.hbt_graph.graph.evaluation_behaviours = []; //TODO are subgraphs evaluation_behaviours emptied?
                        }
                        else if(context.last_event_node == null || context.last_event_node == undefined){
                            var behaviours = this.hbt_graph.runBehaviour(this.agent, context, this.accumulate_time);
                            this.accumulate_time = 0; //runBehaviour expects time between calls
    
                            if(this.onBehaviours) this.onBehaviours(behaviours);
                            this.processBehaviours(behaviours);
                            this.hbt_graph.graph.evaluation_behaviours = []; //TODO are subgraphs evaluation_behaviours emptied?
                        }
                    }
                }
            }
        }
    
        onEvent(e){
            if(this.state == BP_STATE.PLAYING){
                var node = this.hbt_graph.processEvent(e);
                if(node){
                    var behaviours = this.hbt_graph.runBehaviour(this.agent, this.context, this.accumulate_time, node);
                    this.accumulate_time = 0; //runBehaviour expects time between calls
    
                    if(this.onBehaviours) this.onBehaviours(behaviours);
                    this.processBehaviours(behaviours);
                    this.hbt_graph.graph.evaluation_behaviours = []; //TODO are subgraphs evaluation_behaviours emptied?
                }
            }
        }
    
        processBehaviours(behaviours){
            if(!behaviours || behaviours.length == 0) return;
            if(!this.onActions) return; //If no callback for actions do nothing
    
            //Temp to manage action messages
            let behaviours_message = {type: "behaviours", data: []};
            let actions = [];
    
            //Process all behaviours from HBT graph
            for(var b in behaviours){
                var behaviour = behaviours[b];
    
                switch(behaviour.type){
                    case B_TYPE.setProperty:
                        var data = behaviour.data;
                        let o = {};
                        o[data.name] = data.value;
                        this.blackboard.applyOn(o, data.type || "agent"); //TODO callback to refresh interface like in Agent.applyBehaviour (agent.js)
                        break;
    
                    case B_TYPE.intent:
                        var obj = {};
                        //TODO properly process intents and timetables to generate behaviours in protocol format
                        var data = behaviour.data;
    
                        if(data.text){
                            data.type = "speech";
                            var obj = { "speech": { text: data.text } }; //speaking
                        }else{
                            data.type = "anAnimation";
                            var obj = { type: data };
                        }
                        behaviours_message.data.push(data);
                        break;
    
                  case B_TYPE.timeline_intent:
                        var obj = {};
                        //TODO properly process intents and timetables to generate behaviours in protocol format
                        var bh = behaviour.data;
                        if(bh.data){
                            for(var i in bh.data){
                                var data = bh.data[i];
    
                                var obj = { type: data };
    
                                behaviours_message.data.push(data);
                            }
                        }else{
                            for(var i in bh){
                                var data = bh[i];
                                if(data.type == "speech"){
                                    var obj = { "speech": { text: data.text } }; //speaking
                                }else{
                                    var obj = { type: data };
                                }
                                behaviours_message.data.push(data);
                            }
                        }
                        break;
    
                    case B_TYPE.action:
                        //HARCODED
                        var expressions = {
                            angry:[-0.76,-0.64],
                            happy:[0.95,-0.25],
                            sad:[-0.81,0.57],
                            surprised:[0.22,-0.98],
                            sacred:[-0.23,-0.97],
                            disgusted:[-0.97,-0.23],
                            contempt:[-0.98,0.21],
                            neutral:[0,0]
                        };
                        var va = [0,0];
                        if(behaviour.data.animation_to_merge){
                            var g = behaviour.data.animation_to_merge.toLowerCase();
                            va = expressions[g];
                        }
                        var obj = {facialExpression: {va: va}}
                        if(behaviour.data.speed){
                            obj.facialExpression.duration = behaviour.data.speed;
                        }
    
                        //TODO properly process intents and timetables to generate behaviours in protocol format
                        var data = behaviour.data;
                        data.type = "facialLexeme";
                        data.lexeme = data.animation_to_merge; //Wrong, just a placeholder
                        behaviours_message.data.push(data);
                        break;
    
                    case B_TYPE.request:
                        if(behaviour.data.type.length != 0){
                            actions.push({type: "custom_action", data: behaviour.data});
                        }
                        break;
                }
            }
    
            if(behaviours_message.data.length) actions.push(behaviours_message);
    
            if(actions.length) this.onActions(actions);
        }
        
        //Process data message following protocol
        onData(msg){
            if(typeof(msg)=="string")
                msg = JSON.parse(msg);
                
            var type = msg.type;
            var data = msg.data;
    
            if(type != "data") return null;
    
            //Always updates data inside blackboard
            this.blackboard.apply(data); //Defined in behaviourGraph.js
    
            //Create event and process it in Graph
            this.onEvent(data);
        }
    
        //o must be graph data (data.behaviour)
        loadGraph(o){
            let graph = new HBTGraph();
            let context = new HBTContext();
            graph.graph.context = context;
            graph.graph.configure(o);

            this.hbt_graph = graph;

            return graph;
        }

        loadCorpus(o){
            o.array = [];
            for(var i in o.data){
                o.array.push(i);
            }
            this.corpus = o;

            return o;
        }
        loadPlanner(url, on_complete){
            var that = this;
            this.load( url, loadEnvironment.bind(this), null, null, null );
            
        }
        loadEnvironment(data)
        {
            var env = data.env;
            
            //Graphs
            for(var i in env.graphs){
                var graph = env.graphs[i];
                if(graph.behaviour){
                    if(graph.behaviour){
                        let hbt_graph = this.loadGraph(graph.behaviour);
                    }
                }
            }

            //Agent
            let agent = null;
            for(var i in env.agents){
                var data = env.agents[i];
                agent = new Agent(data);
            }

            if(agent){
                agent.is_selected = true;
                this.agent = agent;

        
            }

            //User
            if(env.user){
                let user = new User(env.user);
                this.user = user;
            }

            //Entities
            if(env.entities){
                for(var tag in env.entities){
                    this.entitiesManager.addWordsToWorld(tag,env.entities[tag]);
                }
            }
        }
        load( url, on_complete, on_error, on_progress, on_resources_loaded, on_loaded )
        {
            if(!url)
                return;
    
            var that = this;
    
            var extension = ONE.ResourcesManager.getExtension( url );
            var format_info = ONE.Formats.getFileFormatInfo( extension );
            if(!format_info) //hack, to avoid errors
                format_info = { dataType: "json" };
            
            
            //request scene file using our own library
            ONE.Network.request({
                url: url,
                nocache: true,
                dataType: extension == "json" ? "json" : (format_info.dataType || "text"), //datatype of json is text...
                success: extension == "json" ? inner_json_loaded : inner_data_loaded,
                progress: on_progress,
                error: inner_error
            });
    
            this._state = ONE.LOADING;
    
            /**
             * Fired before loading scene
             * @event beforeLoad
             */
           // LEvent.trigger(this,EVENT.BEFORE_LOAD);
    
            function inner_data_loaded( response )
            {
                if(on_complete)
                    on_complete(response)
            }
    
    
            function inner_json_loaded( response )
            {
                if(on_complete)
                {
                    var url = decodeURIComponent(response.env.iframe);
                    url = url.replace("https://webglstudio.org/latest/player.html?url=", "https://webglstudio.org/")
                    if(url.indexOf("https")==-1)
                        url = "https://webglstudio.org/"+ url;
                        on_complete(url,response.env.token)
                }   
    
                if( response.constructor !== Object )
                    throw("response must be object");
    
                var scripts = ONE.Scene.getScriptsList( response, true );
    
                //check JSON for special scripts
                if ( scripts.length )
                    that.loadScripts( scripts, function(){ inner_success(response); }, on_error );
                else
                    inner_success( response );
            }
    
            function inner_success( response )
            {
                if(on_loaded)
                    on_loaded(that, url);
    
                that.init();
                //Configure Behaviour Planner
                if(response.env.user)
                    that.user.configure(response.env.user);
                if(response.env.agents[0])
                 that.agent.configure(response.env.agents[0])
                that.loadGraph(response.env.graphs[0].behaviour)
    
                if(LS)
                    LS.Globals.sendMsg = that.onData.bind(that)
            }
    
    
            function inner_error(e)
            {
                var err_code = (e && e.target) ? e.target.status : 0;
                console.warn("Error loading scene: " + url + " -> " + err_code);
                if(on_error)
                    on_error(url, err_code, e);
            }
        }
    }
    global.BehaviourPlanner = BehaviourPlanner;

    function Loader(options)
    {
        options = options || {};
        this.options = options;
        this.bp = new BehaviourPlanner() ;
        this.bp.onActions = this.onActions;
        this.debug = false;
        this.autoplay = false;
        this.skip_play_button = false;

        this.last = this.now = performance.now();
        //this will repaint every frame and send events when the mouse clicks objects
        this.state = BehaviourPlanner.Loader.STOPPED;

        //set options
        this.configure( options );
        
    }

    /**
    * Loads a config file for the player, it could also load an scene if the config specifies one
    * @method loadConfig
    * @param {String} url url to the JSON file containing the config
    * @param {Function} on_complete callback trigged when the config is loaded
    * @param {Function} on_scene_loaded callback trigged when the scene and the resources are loaded (in case the config contains a scene to load)
    */
    Loader.prototype.loadConfig = function( url, on_complete, on_scene_loaded )
    {
        var that = this;
        ONE.Network.requestJSON( url, inner );
        function inner( data )
        {
            that.configure( data, on_scene_loaded );
            if(on_complete)
                on_complete(data);
        }
    }

    Loader.prototype.configure = function( options, on_scene_loaded )
    {
        var that = this;

        if(options.resources !== undefined)
            ONE.ResourcesManager.setPath( options.resources );

        if(options.proxy)
            ONE.ResourcesManager.setProxy( options.proxy );
        if(options.filesystems)
        {
            for(var i in options.filesystems)
                ONE.ResourcesManager.registerFileSystem( i, options.filesystems[i] );
        }

        if(options.allow_base_files)
            ONE.ResourcesManager.allow_base_files = options.allow_base_files;

        /*if(options.scene_url)
            this.loadScene( options.scene_url, on_scene_loaded );*/
    }
    Loader.STOPPED = 0;
    Loader.PLAYING = 1;
    Loader.PAUSED = 2;

    /**
    * Loads an scene and triggers start
    * @method loadPlanner
    * @param {String} url url to the JSON file containing all the behaviour planner info
    * @param {Function} on_complete callback trigged when the behaviour planner and the resources are loaded
    */
    Loader.prototype.loadPlanner = function(url, on_complete, on_progress)
    {
        var that = this;
        var bp = this.bp;
        if(this.options.proxy)
            url = ONE.ResourcesManager.proxy + url;
        bp.load( url, on_complete, null, inner_progress, inner_start );

        function inner_start()
        {
        }
        function inner_progress(){

        }
    }
    Loader.prototype.loadScene = function(url, room)
    {
        //LiteSCENE CODE *************************
        var settings = {
            alpha: false, //enables to have alpha in the canvas to blend with background
            stencil: true,
            redraw: true, //force to redraw
            autoplay: true,
            resources: "https://webglstudio.org/fileserver/files",
            autoresize: true, //resize the 3D window if the browser window is resized
            loadingbar: true, //shows loading bar progress
            proxy: "https://webglstudio.org/fileserver/files" //allows to proxy request to avoid cross domain problems, in this case the @ means same domain, so it will be http://hostname/proxy
        };
        /*SETTINGS_SETUP*/

        var player = new LS.Player(settings);

        var allow_remote_scenes = false; //allow scenes with full urls? this could be not safe...

        //support for external server
        var data = localStorage.getItem("wgl_user_preferences" );
        if(data)
        {
            var config = JSON.parse(data);
            if(config.modules.Drive && config.modules.Drive.fileserver_files_url)
            {
                allow_remote_scenes = true;
                LS.ResourcesManager.setPath( config.modules.Drive.fileserver_files_url );
            }
        }

        //allow to use Canvas2D call in the WebGLCanvas (this is not mandatory, just useful)
        if( window.enableWebGLCanvas )
            enableWebGLCanvas( gl.canvas );
        
        //this code defines which scene to load, in case you are loading an specific scene replce it by player.loadScene( scene_url )
        player.loadScene( url, inner_scene_loaded.bind(room, this) );
        function inner_scene_loaded(bpLoader, a){
            that.room = this.toString();
            if(LS)
                    LS.Globals.sendMsg = bpLoader.bp.onData.bind(bpLoader.bp)
            bpLoader.animate(that);
        }
    
        /*else if( allow_remote_scenes || url && url.indexOf("://") == -1) //for safety measures
            player.loadScene( url ); //the url must be something like: fileserver/files/guest/projects/Lee_FX.json
        else 
            player.loadConfig("config_BPplayer.json",player.loadScene);*/
    }
    Loader.prototype.animate = function(player){
        var that = this;
        player.ws = LS.Globals.ws = null;
    // if(player.ws.readyState == player.ws.OPEN && that.bp.state == BP_STATE.STOP)
        that.bp.play();

        that.last = that.now;
        that.now = performance.now();
        dt = (that.now - that.last) * 0.001;
        that.bp.update(dt);
        requestAnimationFrame(that.animate.bind(that, player));
    }
    Loader.prototype.update = function(dt)
    {
        //BP  
        this.bp.update(dt);
    }
    global.Loader = Loader;
})(this)
/*if(typeof module !== "undefined"){
	module.exports = function(HBTree,  behaviourNodes, entitiesManager){
		var global = { HBTree: HBTree, behaviourNodes: behaviourNodes, EntitiesManager: entitiesManager};
		_behaviourPlanner(global);
		return global;
	}
}else{
	_behaviourPlanner(this);
}*/