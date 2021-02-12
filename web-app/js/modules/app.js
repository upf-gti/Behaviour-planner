PLAYING = 1;
STOP = 0;

SESSION = {
IS_GUEST: 0
};

EVENTS = {
	textRecieved: 0,
	imageRecieved: 1,
	faceDetected: 2,
	codeRecieved: 3
};
var baseURL = "https://webglstudio.org";
var last = now = performance.now();
var dt;
var accumulate_time = 0;
var execution_t = 1;
var triggerEvent = false;
var corpus;
Object.assign(window, glMatrix);
var tmp = {
	vec : 	vec3.create(),
	axis : 	vec3.create(),
	axis2 : vec3.create(),
	inv_mat : mat4.create(),
	agent_anim : null,
	behaviours : null
}
var userText = false;
var currentContext = null;
var currentHBTGraph = null;
var entities = ["@people", "@people.FirstName", "@people.LastName","@people.Honorific", "@places", "@places.Country", "@places.City", "@places.Region", "@places.Adress", "@number", '@topic', '@organization', '@organization.SportsTeam', '@organization.Company', '@organization.School', '@phone_number', "@email"]

var iframeWindow = null;

class App{
    constructor(){
        this.state = STOP;
        this.properties = {};

        this.agent_selected = null;
        this.currentCanvas = null;
        this.currentContext = {};
        this.currentGraph = null;
        this.currentHBTGraph = null;
        this.graphManager = GraphManager;
        this.interface = CORE.Interface;
        this.env_tree = {
            id: "Environment",
            type:"env",
            token: UTILS.rand(),
            children: []
        };

        this.streamer = new Streamer("wss://webglstudio.org/port/9003/ws/");
        this.streamer.onDataReceived = this.onDataReceived;
		this.streamer.onConnect = this.onWSconnected.bind(this);

        this.chat = new Chat();
		this.iframe = null;
    }

    init(){


       /* var hbt_graph = GraphManager.newGraph(GraphManager.HBTGRAPH);
        currentContext = this.currentContext = hbt_graph.graph.context;

        currentHBTGraph = this.graphManager.currentHBTGraph = hbt_graph;

        var position = [0,0,0];
        var agent = new Agent(null, position);
        this.env_tree.children.push({id:agent.uid, type: "agent"});

        this.agent_selected = agent;
        AgentManager.agent_selected = this.agent_selected;
        this.agent_selected.is_selected=true;

        var user = new User(null, [0,0,100]);
        this.env_tree.children.push({id:user.uid, type: "user"});
        //var add_node = this.interface.addButton("", {className: "btn btn-icon right",innerHTML: '<span class="material-icons"> add_circle</span>', callback: this.interface.createNode});

        this.interface.tree.insertItem({id:agent.properties.name, type: "agent"},"Environment");
        this.interface.tree.insertItem({id:user.properties.name, type: "user"},"Environment");

        if(this.agent_selected){
            this.currentContext.agent_evaluated = this.agent_selected;
        }
        if(user!=null){
            this.currentContext.user = user;
        }
        */

       // this.interface.createNodeInspector("agent");

        var last = now = performance.now();
        
        //this.agent_selected = agent;
        AgentManager.agent_selected = this.agent_selected;
		
        if(iframeWindow){
			var iframe = iframeWindow.document.querySelector("#iframe-character");
			this.iframe = iframe;
		}
        //iframe.src = "https://webglstudio.org/latest/player.html?url=fileserver%2Ffiles%2Fevalls%2Fprojects%2Fscenes%2FBehaviourPlanner.scene.json"//"https://webglstudio.org/latest/player.html?url=fileserver%2Ffiles%2Fevalls%2Fprojects%2Fscenes%2FLaraFacialAnimations.scene.json";

        requestAnimationFrame(this.animate.bind(this));
    }

    postInit() {
        
        // this.interface.importFromURL(baseURL+"/users/evalls/dialog-manager/dev/data/RAO-expressions.json");
        
        CORE["Interface"].showLoginDialog();
    }
    
	onWSconnected(){
		this.streamer.createRoom(this.env_tree.token);
	}

    getUserById(id){
        for(var i in this.users){
            var user = this.users[i];
            if(user.uid.toLowerCase() == id.toLowerCase()){
                return user;
            }
        }
        return false;
    }

    changeState(){
        if(CORE.App.state == STOP){
            CORE.App.state = PLAYING;
        }else{
            CORE.App.state = STOP;
        }
    }

    onPlayClicked(){

        var play_button = document.getElementById("play-btn");
        var stream_button = document.getElementById("stream-btn");
        var icons = CORE["Interface"].icons;

        this.changeState();
        if(this.state == PLAYING)
        {
            play_button.innerHTML= icons.stop;

            if(stream_button.lastElementChild.classList.contains("active"))
            {
                stream_button.lastElementChild.classList.remove("active");
                stream_button.lastElementChild.classList.add("play");
            }

        }
        else
        {
            play_button.innerHTML= icons.play;
            if(stream_button.lastElementChild.classList.contains("play"))
            {
                stream_button.lastElementChild.classList.remove("play");
                stream_button.lastElementChild.classList.add("active");
            }
        }


    }

    animate(){
        var that = this;
        requestAnimationFrame(that.animate.bind(that));
        last = now;
        now = performance.now();
        dt = (now - last) * 0.001;

        that.update(dt);
    }

    update(dt){
		var LS = null;
		if(iframeWindow){
			var iframe = iframeWindow.document.querySelector("#iframe-character");
			this.iframe = iframe;
			if(this.iframe && this.iframe.contentWindow){
                LS = this.iframe.contentWindow.LS;
            }
		}

        //AgentManager.agent_selected = this.currentContext.agent_selected
        if(this.state == PLAYING){
            accumulate_time+=dt;
            if(accumulate_time>=execution_t){
                //Evaluate each agent on the scene
                for(var c in AgentManager.agents){
                    var character_ = AgentManager.agents[c];

                    var agent_graph = currentHBTGraph = this.graphManager.graphs[character_.hbtgraph];
                    if(!agent_graph){
                        agent_graph = currentHBTGraph = this.graphManager.graphs[0];
                    }
					
                    /*
                    if(userText){
                    	var node = null;
                    	if(this.currentContext.last_event_node){
                    	    node = this.graphManager.currentHBTGraph.graph.getNodeById(this.currentContext.last_event_node);
                        }
                    }
                    */

                    if(this.currentContext.last_event_node==null ||this.currentContext.last_event_node==undefined){
                  		tmp.behaviours = agent_graph.runBehaviour(character_, this.currentContext, accumulate_time); //agent_graph -> HBTGraph, character puede ser var a = {prop1:2, prop2:43...}
                    }
                    
                    /*
                    userText = false;
					triggerEvent = true;
                    }*/

                    if(tmp.behaviours && tmp.behaviours.length){
                        //Temp to manage messages to stream
                        var behaviours_message = {type: "behaviours", data: []};
                        var messages_to_stream = [];

                        //Process all behaviours from HBT graph
                        for(var b in tmp.behaviours){
                            var behaviour = tmp.behaviours[b];
                            character_.applyBehaviour( behaviour);

                            switch(behaviour.type){
                                case B_TYPE.setProperty:
                                    character_.properties[behaviour.data.name] = behaviour.data.value;
                                    break;

                                case B_TYPE.intent:
                                    this.chat.showMessage(behaviour.data.text, "me");
                                    if(LS){
                                        //state = LS.Globals.SPEAKING;
                                        var obj = { speech: { text: behaviour.data.text }, control: LS.Globals.SPEAKING }; //speaking
                                        LS.Globals.processMsg(JSON.stringify(obj), true);
                                    }
                                    
                                    //TODO properly process intents and timetables to generate behaviours in protocol format
                                    var data = behaviour.data.data;
                                    if(data.text){
                                        data.type = "speech";
                                        
                                    }else{
                                        data.type = "anAnimation";
                                    }
                                    behaviours_message.data.push(data);

                                    break;

                                case B_TYPE.action:
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
                                    if(LS){
                                        LS.Globals.processMsg(JSON.stringify(obj), true);
                                    }
                                    
                                    //TODO properly process intents and timetables to generate behaviours in protocol format
                                    var data = behaviour.data;
                                    data.type = "facialLexeme";
                                    data.lexeme = data.animation_to_merge; //Wrong, just a placeholder
                                    behaviours_message.data.push(data);
                                    break;

                                case B_TYPE.request:
                                    console.log(behaviour.data);
                                    messages_to_stream.push({type: "custom_action", data: behaviour.data});
                                    break;
                            }

                            triggerEvent = false;
                        }

                        if(behaviours_message.data.length) messages_to_stream.push(behaviours_message);

                        //Send messages through streamer
                        if(this.streamer && this.streamer.ws &&  this.streamer.is_connected){
                            for(var m of messages_to_stream){
                                this.streamer.sendMessage(m.type, m.data);
                            }
                        }
                    }

                }
                tmp.behaviours = [];

                for(var i in GraphManager.graphs){
                    var graph = GraphManager.graphs[i];
                    if(graph.type == GraphManager.BASICGRAPH){
                        graph.graph.runStep();
                    }
                }

                accumulate_time=0;
                // var behaviours = hbt_graph.runBehaviour(info, hbt_context, dt);

                this.interface.showContent(tmp.behaviours );
            }
        }else{
        	this.currentContext.last_event_node = null;
			this.chat.clearChat();
        }
    }

	onEvent(e){
		var character_ = AgentManager.agent_selected;
		var agent_graph = currentHBTGraph = this.graphManager.graphs[character_.hbtgraph];
		if(!agent_graph){
			var agent_graph = currentHBTGraph = this.graphManager.graphs[0];
        }
		var node = agent_graph.processEvent(e);
		if(node){
			tmp.behaviours = agent_graph.runBehaviour(character_, this.currentContext, accumulate_time, node);
			triggerEvent=true;
		}
	}

    loadEnvironment(data){
        var that = this;
        var env = data.env;
        if(!env.token){
            env.token = that.interface.tree.tree.token;
        }else{
            that.interface.tree.tree.token = env.token;
            that.streamer.createRoom(env.token);
        }

        that.env_tree = {
            id: "Environment",
            type:"env",
            token: env.token,
            children: []
        };
        that.interface.tree.clear(true);

        AgentManager.removeAllAgents();
        UserManager.removeAllUsers();
        GraphManager.removeAllGraphs();

        for(var i in env.graphs){
            var graph = env.graphs[i];
            if(graph.behaviour){
                var hbt_graph = GraphManager.newGraph(GraphManager.HBTGRAPH, i);
                hbt_graph.graph.configure(graph.behaviour);
                that.currentContext = hbt_graph.graph.context;
                currentHBTGraph = that.graphManager.currentHBTGraph = hbt_graph;
                //GraphManager.putGraphOnEditor( hbt_graph, i );
            }else{
                var g = GraphManager.newGraph(GraphManager.BASICGRAPH, i);
                graph.name =i;
                g.graph.configure(graph);

                //GraphManager.putGraphOnEditor(graph, i);
                for(var j in graph.nodes){
                    var node = graph.nodes[j];
                    if(node.type == "network/sillyclient"){
                        var node = LGraphCanvas.active_canvas.graph_canvas.graph.getNodeById(node.id);

                        node.connectSocket();
                        //this.streamer = new Streamer();
                        this.streamer.ws = node._server;
                        node._server.onReady = this.streamer.onReady;
                        this.streamer.is_connected = node._server.is_connected;
                        var btn = document.getElementById("stream-btn");
                        btn.style.display="block";
                    }
                }

            }
        }
        for(var i in env.agents){
            var data = env.agents[i];
            var agent = new Agent(data);
            that.agent_selected = agent;
            that.agent_selected.is_selected = true;
            that.env_tree.children.push({id:agent.uid, type: "agent"});
            that.interface.tree.insertItem({id:agent.properties.name, type: "agent"},"Environment");
        }

        if(env.user){
            var user = new User(env.user);
            that.env_tree.children.push({id:user.uid, type: "user"});
            that.interface.tree.insertItem({id:user.properties.name, type: "user"},"Environment");
        }
        
        if(env.gestures){
            that.interface.tree.insertItem({id:"Gesture Manager", type: "gesture"},"Environment");
            for(var i in env.gestures){
                GestureManager.createGesture(env.gestures[i]);
            }

            GestureManager.createGestureInspector();
        }

        if(that.agent_selected){
            that.currentContext.agent_evaluated = that.agent_selected;
        }

        if(user!=null){
            that.interface.tree.setSelectedItem(that.env_tree.id, true, that.interface.createNodeInspector({
                detail: {
                    data: {
                        id: that.env_tree.id,
                        type: that.env_tree.type
                    }
                }
            }));
            that.currentContext.user = user;
        }
    }

	loadCorpusData(data){
		corpus = data;
		corpus.array = [];
		for(var i in data.data){
			corpus.array.push(i);
		}
	}

    onDataReceived(data)
    {
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
                if(text)
                {
                    var event = {
                    type: EVENTS.textRecieved,
                    data:{text: text}
                }
                this.onEvent(event);
                    if(this.chat)
                        this.chat.showMessage(text);
                }
                break;
        }
    }

    toJSON( type, name) {

        var data = null;
        switch(type)
        {
            case "download-env":
              var obj = {env: {agents:[], graphs: []}}
                var env = this.env_tree;
                if(env.token)
                  obj.env.token = env.token;
                for(var i in env.children)
                {
                    var item = env.children[i];
                    if(item.type == "agent")
                    {
                        var agent = AgentManager.getAgentById(item.id);
                        agent = agent.serialize();
                        obj.env.agents.push(agent);
                    }
                    else if(item.type == "user")
                    {
                        var user = UserManager.getUserById(item.id);
                        user = user.serialize();
                        obj.env.user = user;
                    }
                    else if(item.type == "gesture")
                    {
                        var gest = GestureManager.serialize();
                        obj.env.gestures = gest;
                    }
                }
                for(var i in GraphManager.graphs)
                {
                    var graph = GraphManager.graphs[i];

                    if(graph.type == GraphManager.HBTGRAPH)
                        data = GraphManager.exportBehaviour(graph.graph);
                    else if(graph.type == GraphManager.BASICGRAPH)
                        data = GraphManager.exportBasicGraph(graph.graph);
                    obj.env.graphs[i] = data;
                }
                data = obj;
                break;
            case "download-graph":
                var graph = GraphManager.graphSelected;
                if(!graph)
                    return;
                if(graph.type == GraphManager.HBTGRAPH)
                    data = GraphManager.exportBehaviour(graph.graph);
                else if(graph.type == GraphManager.BASICGRAPH)
                    data = GraphManager.exportBasicGraph(graph.graph);
                break;
        }

        return data;
    }

    downloadJSON( type, name) {

        if(!name)
            return;

        var data = this.toJSON(type, name);

        if(!data) {
            console.error("no data to export in json");
            return;
        }

        var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
        var downloadAnchorNode = document.createElement('a');
        var filename = name || "graph_data";
        downloadAnchorNode.setAttribute("href",     dataStr);
        downloadAnchorNode.setAttribute("download", filename + ".json");
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }
}

CORE.registerModule( App );
