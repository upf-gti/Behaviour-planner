
//BehaviourPlanner manages the core logic of Behaviour Graphs

/**
 * Dependencies:
 *  LiteGraph
 *  HBTree
 *  graphManager
 *  utils
 */
function _behaviourPlanner(global)
{
    
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

    var STATE = {
        PLAYING: 1,
        STOP: 0,
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
        vec: vec3.create(),
        axis: vec3.create(),
        axis2: vec3.create(),
        inv_mat: mat4.create(),
        agent_anim: null,
        behaviours: null
    };

    //var userText = false;
    //var currentContext = null;
    //var currentHBTGraph = null;
    var entities = global.entities = ["@people", "@people.FirstName", "@people.LastName","@people.Honorific", "@places", "@places.Country", "@places.City", "@places.Region", "@places.Adress", "@number", '@topic', '@organization', '@organization.SportsTeam', '@organization.Company', '@organization.School', '@phone_number', "@email"];

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
            this.entitiesManager = entitiesManager;
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
                        GraphManager.addGraph(hbt_graph);
                    }
                }else{
                    var g = GraphManager.newGraph(GraphManager.BASICGRAPH, graph.name);
                    graph.name =i;
                    g.graph.configure(graph);
    
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
    
                AgentManager.agents[agent.uid] = agent;
                AgentManager.addPropertiesToLog(agent.properties);
                AgentManager.agent_selected = agent;
            }
    
            //User
            if(env.user){
                let user = new User(env.user);
                this.user = user;
    
                UserManager.users[user.uid] = user;
                UserManager.addPropertiesToLog(user.properties);
            }
    
            //Gestures
            if(env.gestures){
               /* this.interface.tree.insertItem({id:"Gesture Manager", type: "gesture"},"Environment");
               */ for(var i in env.gestures){
                    GestureManager.createGesture(env.gestures[i]);
                }
                GestureManager.createGestureInspector();
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
}

_behaviourPlanner(this);
