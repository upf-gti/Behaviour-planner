
//BehaviourPlanner manages the core logic of Behaviour Graphs

/**
 * Dependencies:
 *  LiteGraph
 *  HBTree
 *  graphManager
 *  utils
 */
function _behaviourPlanner(global){
    
    class Agent{

    }
    global.Agent = Agent;

    class User{

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
        constructor(){
            this.state = STATE.STOP;
            this.properties = {};

            this.agent = null;
            this.user = null;

            this.currentContext = {};
            //currentContext.user used?
            //currentContext.agent_evaluated used?
            //this.currentGraph = null; not used
            this.currentHBTGraph = null; //TODO from interface or graphManager update

            //GraphManager needed!
            //No interface
            
            this.env_tree = {
                id: "Environment",
                type: "env",
                token: UTILS.rand(),
                children: []
            };

            //No streamer - messages handled by callback
            //No chat (it's an interface)
            //No iframe
        }

        init(){
            var hbt_graph = GraphManager.newGraph(GraphManager.HBTGRAPH);
            this.currentHBTGraph = this.graphManager.currentHBTGraph = hbt_graph;
            this.currentContext = hbt_graph.graph.context;

            var position = [0,0,0];
            this.currentContext.agent_evaluated = this.agent = new Agent(null, position);
            this.env_tree.children.push({id:agent.uid, type: "agent"});

            this.currentContext.user = this.user = new User(null, [0,0,100]);
            this.env_tree.children.push({id:user.uid, type: "user"});

            //TODO in app interface logic
            //this.interface.tree.insertItem({id:agent.properties.name, type: "agent"},"Environment");
            //this.interface.tree.insertItem({id:user.properties.name, type: "user"},"Environment");

            last = now = performance.now();
        }

        changeState(){
            if(this.state == STATE.STOP) this.state = STATE.PLAYING;
            else this.state = STATE.STOP;
        }

        update(dt){
            if(this.state == STATE.PLAYING){
                accumulate_time += dt;
                if(accumulate_time >= execution_t){
                    //Evaluate the agent
                    var agent = this.agent;
                    var agent_graph = this.currentHBTGraph;
                    if(this.currentContext.last_event_node == null ||
                        this.currentContext.last_event_node == undefined){
                        //agent_graph -> HBTGraph, character puede ser var a = {prop1:2, prop2:43...}
                        tmp.behaviours = agent_graph.runBehaviour(agent, this.currentContext, accumulate_time);
                    }

                    if(tmp.behaviours && tmp.behaviours.length){
                        //Temp to manage messages to stream
                        var behaviours_message = {type: "behaviours", data: []};
                        var messages_to_send = [];

                        //Process all behaviours from HBT graph
                        for(var b in tmp.behaviours){
                            var behaviour = tmp.behaviours[b];

                            switch(behaviour.type){
                                case B_TYPE.setProperty:
                                    agent.applyBehaviour(behaviour);
                                    break;

                                case B_TYPE.intent:
                                    //TODO
                                    break;

                                case B_TYPE.action:
                                    //TODO
                                    break;

                                case B_TYPE.request:
                                    //TODO
                                    break;
                            }
                        }

                        if(behaviours_message.data.length) messages_to_send.push(behaviours_message);
                        //TODO send messages to callback
                    }

                    tmp.behaviours = [];

                    for(var i in GraphManager.graphs){
                        var graph = GraphManager.graphs[i];
                        if(graph.type == GraphManager.BASICGRAPH){
                            graph.graph.runStep();
                        }
                    }
    
                    accumulate_time=0;
                }
            }else{
                this.currentContext.last_event_node = null;
            }
        }

        onEvent(e){
            var agent = this.agent;
            var agent_graph = this.currentHBTGraph;
            var node = agent_graph.processEvent(e);
            if(node){
                tmp.behaviours = agent_graph.runBehaviour(agent, this.currentContext, accumulate_time);
            }
        }

        loadEnvironment(data){
            var that = this;
            var env = data.env;
            if(!env.token){
                env.token = this.env_tree.token;
            }
            //TODO in app update token in interface and connect to session

            this.env_tree = {
                id: "Environment",
                type:"env",
                token: env.token,
                children: []
            };

            this.agent = null;
            this.user = null;
            GraphManager.removeAllGraphs();

            for(var i in env.graphs){
                var graph = env.graphs[i];
                if(graph.behaviour){
                    var hbt_graph = GraphManager.newGraph(GraphManager.HBTGRAPH, i);
                    hbt_graph.graph.configure(graph.behaviour);
                    this.currentContext = hbt_graph.graph.context;
                    this.currentHBTGraph = this.graphManager.currentHBTGraph = hbt_graph;
                    //GraphManager.putGraphOnEditor( hbt_graph, i );
                }else{
                    var g = GraphManager.newGraph(GraphManager.BASICGRAPH, i);
                    graph.name =i;
                    g.graph.configure(graph);

                    //GraphManager.putGraphOnEditor(graph, i);
                    /*for(var j in graph.nodes){
                        var node = graph.nodes[j];
                        if(node.type == "network/sillyclient"){
                            var node = LGraphCanvas.active_canvas.graph_canvas.graph.getNodeById(node.id);

                            node.connectSocket();
                            //this.streamer = new Streamer();
                            this.streamer.ws = node._server;
                            node._server.onReady = this.streamer.onReady;
                            this.streamer.is_connected = node._server.is_connected;
                        }
                    }*/

                }
            }

            if(env.agent){
                this.agent = new Agent(env.agent);
            }else if(env.agents){ //Default to first agent
                this.agent = new Agent(env.agent[0]);
            }else{
                new Agent(null);
            }
            this.currentContext.agent_evaluated = this.agent;
            
            if(env.user){
                this.user = new User(env.user);
            }else{
                this.user = new User(null, [0,0,100]);
            }
            this.currentContext.user = this.user;
            
            //TODO Gestures
            /*
            if(env.gestures){
                that.interface.tree.insertItem({id:"Gesture Manager", type: "gesture"},"Environment");
                for(var i in env.gestures){
                    GestureManager.createGesture(env.gestures[i]);
                }

                GestureManager.createGestureInspector();
            }
            */
        }

        loadCorpusData(data){
            corpus = data;
            corpus.array = [];
            for(var i in data.data){
                corpus.array.push(i);
            }
        }

        onMessageReceived(data){
            var type = data.type;
            switch(type)
            {
                case "info":
                    //Server messages
                    console.log(data.data);
                    break;

                case "user-data":
                    this.currentContext.user.update(data.data);
                    var text = data.data.text;
                    if(text){
                        var event = {
                            type: EVENTS.textRecieved,
                            data: {text: text}
                        }
                        this.onEvent(event);
                        //TODO //if(this.chat) this.chat.showMessage(text);
                    }
                    break;
            }
        }

        toJSON(type, name){
            var data = null;
            switch(type)
            {
                case "download-env":
                    var obj = {env: {agents:[], graphs: []}}
                    var env = this.env_tree;
                    if(env.token) obj.env.token = env.token;
                    for(var i in env.children){
                        var item = env.children[i];
                        if(item.type == "agent"){
                            var agent = this.agent.serialize();
                            obj.env.agents.push(agent); //TODO remove this line
                            obj.env.agent = agent;
                        }else if(item.type == "user"){
                            var user = this.user.serialize();
                            obj.env.user = user;
                        }else if(item.type == "gesture"){
                            //TODO Gestures
                            /*
                            var gest = GestureManager.serialize();
                            obj.env.gestures = gest;
                            */
                        }
                    }
                    for(var i in GraphManager.graphs){
                        var graph = GraphManager.graphs[i];
    
                        if(graph.type == GraphManager.HBTGRAPH) data = GraphManager.exportBehaviour(graph.graph);
                        else if(graph.type == GraphManager.BASICGRAPH) data = GraphManager.exportBasicGraph(graph.graph);
                        obj.env.graphs[i] = data;
                    }
                    data = obj;
                    break;

                case "download-graph":
                    var graph = GraphManager.graphSelected;
                    if(!graph) return;
                    if(graph.type == GraphManager.HBTGRAPH) data = GraphManager.exportBehaviour(graph.graph);
                    else if(graph.type == GraphManager.BASICGRAPH) data = GraphManager.exportBasicGraph(graph.graph);
                    break;
            }
    
            return data;
        }

        downloadJSON(type, name){
            if(!name) return;
    
            var data = this.toJSON(type, name);
    
            if(!data){
                console.error("no data to export in json");
                return;
            }
    
            var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
            var downloadAnchorNode = document.createElement('a');
            var filename = name || "graph_data";
            //TODO check this for nodejs
            downloadAnchorNode.setAttribute("href",     dataStr);
            downloadAnchorNode.setAttribute("download", filename + ".json");
            document.body.appendChild(downloadAnchorNode); // required for firefox
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        }
    }
    global.BehaviourPlanner = BehaviourPlanner;
}

_graphManager(this);
