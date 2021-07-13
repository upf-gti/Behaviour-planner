PLAYING = 1;
STOP = 0;

SESSION = {
IS_GUEST: 0
};

var baseURL = "https://webglstudio.org";
var last = now = performance.now();
var dt;

var LS = undefined;
Object.assign(window, glMatrix);
var tmp = {
	vec : 	vec3.create(),
	axis : 	vec3.create(),
	axis2 : vec3.create(),
	inv_mat : mat4.create(),
	agent_anim : null,
	behaviours : null,
    event_behaviours : null,
}

var corpus;
var entities = ["@people", "@people.FirstName", "@people.LastName","@people.Honorific", "@places", "@places.Country", "@places.City", "@places.Region", "@places.Adress", "@number", '@topic', '@organization', '@organization.SportsTeam', '@organization.Company', '@organization.School', '@phone_number', "@email"]

var iframeWindow = null;

class App{
	constructor(){
        this.bp = null;

	    this.state = STOP;
	    this.properties = {};

	    this.currentCanvas = null;
	    this.currentGraph = null;
	    this.graphManager = GraphManager;
	    this.interface = CORE.Interface;
	    this.env_tree = {
	        id: "Environment",
	        type:"env",
	        token: UTILS.rand(),
	        children: []
	    };

	    this.streamer = new Streamer("wss://webglstudio.org/port/9003/ws/");
	    this.streamer.onDataReceived = this.onDataReceived.bind(this);
			this.streamer.onConnect = this.onWSconnected.bind(this);

	    this.chat = new Chat();
			this.iframe =   CORE.Interface.iframe;
	}

    init(){
        let agent = new Agent(null, [0,0,0]);
        let user = new User(null, [0,0,100]);
        this.bp = new BehaviourPlanner({
            user: user,
            agent: agent,
        });
        this.bp.onBehaviours = this.onBehaviours.bind(this);
        this.bp.onActions = this.onActions.bind(this);
        let hbt_graph = GraphManager.newGraph(GraphManager.HBTGRAPH);
        this.bp.hbt_graph = hbt_graph;

        this.env_tree.children.push({id:agent.uid, type: "agent"});

        UserManager.users[user.uid] = user;
        UserManager.addPropertiesToLog(user.properties);

        AgentManager.agents[agent.uid] = agent;
        AgentManager.addPropertiesToLog(agent.properties);
        AgentManager.agent_selected = agent;

        this.env_tree.children.push({id:user.uid, type: "user"});

        this.interface.tree.insertItem({id:agent.properties.name, type: "agent"},"Environment");
        this.interface.tree.insertItem({id:user.properties.name, type: "user"},"Environment");

        last = now = performance.now();

        if(iframeWindow && iframeWindow.document){
            var iframe = iframeWindow.document.querySelector("#iframe-character");
            if(this.iframe)
                iframe = this.iframe;
            else
                this.iframe = iframe;
        }
        else{
            this.iframe = CORE.Interface.iframe;
        }

        document.body.addEventListener("keydown", function(e){
            
            if(e.keyCode == 79 && e.ctrlKey){

                e.preventDefault();
                e.stopPropagation();

                if(CORE["Interface"])
                {
                    CORE["Interface"].showLoadFromServerDialog();
                }
            }
        });

        requestAnimationFrame(this.animate.bind(this));
    }

    postInit() {
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
        if(CORE.App.bp.state == BP_STATE.STOP){
            CORE.App.state = PLAYING;
            CORE.App.bp.play();
        }else{
            CORE.App.state = STOP;
            CORE.App.bp.stop();
            this.chat.clearChat();
        }
    }

    onPlayClicked(){
        var play_buttons = document.getElementsByClassName("play-btn");
        var stream_button = document.getElementById("stream-btn");
        var icons = CORE["Interface"].icons;

        this.changeState();
        if(this.state == PLAYING){
            for(var i=0;i< play_buttons.length;i++)
                play_buttons[i].innerHTML= icons.stop;

            if(stream_button.lastElementChild.classList.contains("active")){
                stream_button.lastElementChild.classList.remove("active");
                stream_button.lastElementChild.classList.add("play");
            }
        }else{
            for(var i=0;i< play_buttons.length;i++)
                play_buttons[i].innerHTML= icons.play;
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
        if(iframeWindow){
            var iframe = null;
            if(iframeWindow.document){
                var iframe = iframeWindow.document.querySelector("#iframe-character");
                iframe = this.iframe;
            }
    
            if(this.iframe && this.iframe.contentWindow) LS = this.iframe.contentWindow.LS;
        }
        
        //BP  
        this.bp.update(dt);
}

    onBehaviours(behaviours){

        // behaviours.forEach(b => {
        //     switch(b.type)
        //     {
        //         case B_TYPE.http_request:

        //             var params = Object.assign({}, b.data);
        //             params.success = function(response, req){
        //                 console.log("request completed", response);
        //             }

        //             params.error = function(err){
        //                 console.log("request error", err);
        //             }
                    
        //             // Do http request here
        //             UTILS.request(params);
        //             break;
        //         default:
        //             break;
        //     }
        // });
    }

    onActions(actions){
        //console.log(actions);

        //Send messages through streamer
        if(this.streamer && this.streamer.ws &&  this.streamer.is_connected){
            for(var m of actions){
                this.streamer.sendMessage(m.type, m.data);
                if(LS){
                  //state = LS.Globals.SPEAKING;
                  m.control = LS.Globals.SPEAKING;
                  LS.Globals.processMsg(JSON.stringify(m.data), true);
                }
                if(m.type == "custom_action"){ //Placeholder stuff
                    this.placeholderProcessRequest(m);
                }
                
                if(m.type == "behaviours"){
                    for(var b of m.data){
                        if(b.type == "speech"){
                            this.chat.showMessage(b.text, "me");
                        }
                    }
                }
            }
        }
    }

    onDataReceived(msg){
	    var type = msg.type;
	    var data = msg.data;
	    switch(type)
	    {
	        case "info":
	            //Server messages
	            console.log(data);
	            break;

	        case "data":
                //Process data in App
	            if(data.user){
                    if(data.user.text && this.chat){
	                    this.chat.showMessage(data.user.text);
	                }
                }
                if(data.img) //TODO this should be stored as data.img.user if then is saved into user
                {
                    var img = new Image();
                    img.src = data.img;
                    if(!img.width)
                        img.width = 200;
                    if(!img.height)
                        img.height = 100;
                    var canvas = document.createElement("CANVAS");
                    var ctx = canvas.getContext('2d')

                    ctx.drawImage(img,0,0);
                    this.chat.log_container.appendChild(img)
                    data.user.imageTaken = true;
                    this.bp.blackboard.user.update(data.user); //TODO bp.onData should be enought to handle this
                    //this.placeholderData.faceMatching = true;
                }
                if(data.agent){
                    if(data.user.text)
                        this.bp.blackboard.agent.update(data.agent);
                }
                //Apply data and evaluate events in BP
                this.bp.onData(msg);

	            break;
	    }
	}

    loadBehaviour(data){
        if(data.behaviour){
            let hbt_graph = this.bp.loadGraph(data.behaviour);
            GraphManager.addGraph(hbt_graph);
        }
    }

    loadEnvironment(data){
        var env = data.env;
        if(!env.token){
            env.token = this.interface.tree.tree.token;
        }else{
            this.interface.tree.tree.token = env.token;
            this.streamer.createRoom(env.token);
        }

        this.env_tree = {
            id: "Environment",
            type:"env",
            token: env.token,
            children: []
        };
        this.interface.tree.clear(true);

        AgentManager.removeAllAgents();
        UserManager.removeAllUsers();
        GraphManager.removeAllGraphs();

        //Graphs
        for(var i in env.graphs){
            var graph = env.graphs[i];
            if(graph.behaviour){
                this.loadBehaviour(graph);
            }else{
                var g = GraphManager.newGraph(GraphManager.BASICGRAPH, graph.name);
                graph.name =i;
                g.graph.configure(graph);

                for(var j in graph.nodes){
                    var node = graph.nodes[j];
                    if(node.type == "network/sillyclient"){
                        var node = LGraphCanvas.active_canvas.graph_canvas.graph.getNodeById(node.id);

                        node.connectSocket();
                        this.streamer.ws = node._server;
                        node._server.onReady = this.streamer.onReady;
                        this.streamer.is_connected = node._server.is_connected;
                    }
                }

            }
        }

        //Agent
        let agent = null;
        for(var i in env.agents){
            var data = env.agents[i];
            agent = new Agent(data);
            this.env_tree.children.push({id:agent.uid, type: "agent"});
            this.interface.tree.insertItem({id:agent.uid, type: "agent"},"Environment");
        }

        if(agent){
            agent.is_selected = true;
            this.bp.agent = agent;

            AgentManager.agents[agent.uid] = agent;
            AgentManager.addPropertiesToLog(agent.properties);
            AgentManager.agent_selected = agent;
        }

        //User
        if(env.user){
            let user = new User(env.user);
            this.env_tree.children.push({id:user.uid, type: "user"});
            this.interface.tree.insertItem({id:user.uid, type: "user"},"Environment");
            
            this.bp.user = user;

            UserManager.users[user.uid] = user;
            UserManager.addPropertiesToLog(user.properties);

            this.interface.tree.setSelectedItem(this.env_tree.id, true, this.interface.createNodeInspector({
                detail: {
                    data: {
                        id: this.env_tree.id,
                        type: this.env_tree.type
                    }
                }
            }));
        }

        //Gestures
        if(env.gestures){
            this.interface.tree.insertItem({id:"Gesture Manager", type: "gesture"},"Environment");
            for(var i in env.gestures){
                GestureManager.createGesture(env.gestures[i]);
            }
            GestureManager.createGestureInspector();
        }
        //Entities
        if(env.entities){
            for(var tag in env.entities){
                EntitiesManager.addWordsToWorld(tag,env.entities[tag]);
            }
        }
    }

	loadCorpusData(data){
		corpus = this.bp.loadCorpus(data);
	}

    //TODO Take information from BP?
    toJSON(type, name){
        var data = null;
        switch(type){
            case "download-env":
                var obj = {env: {agents:[], graphs: []}};
                var env = this.env_tree;
                if(env.token) obj.env.token = env.token;

                for(var i in env.children){
                    var item = env.children[i];
                    if(item.type == "agent"){
                        var agent = AgentManager.getAgentById(item.id);
                        agent = agent.serialize();
                        obj.env.agents.push(agent);
                    }else if(item.type == "user"){
                        var user = UserManager.getUserById(item.id);
                        user = user.serialize();
                        obj.env.user = user;
                    }else if(item.type == "gesture"){
                        var gest = GestureManager.serialize();
                        obj.env.gestures = gest;
                    }
                }
                if(EntitiesManager.customEntities!={}){
                    obj.env.entities = EntitiesManager.customEntities;
                }
                for(var i in GraphManager.graphs){
                    var graph = GraphManager.graphs[i];
                    if(graph.constructor == HBTGraph) data = GraphManager.exportBehaviour(graph.graph);
                    else if(graph.constructor == LGraph) data = GraphManager.exportBasicGraph(graph);

                    obj.env.graphs.push(data);
                }
                data = obj;
                break;

            case "download-graph":
                var graph = GraphManager.graphSelected;
                if(!graph) return;
                if(graph.constructor == HBTGraph) data = GraphManager.exportBehaviour(graph.graph);
                else if(graph.constructor == LGraph) data = GraphManager.exportBasicGraph(graph);
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
        downloadAnchorNode.setAttribute("href",     dataStr);
        downloadAnchorNode.setAttribute("download", filename + ".json");
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    placeholderData = {
        phoneNumber: "5552020",
        code: "1234",
        documentID: "00000000A",
        faceMatching: false,
    };

    placeholderProcessRequest(msg){
        var msg_data = msg.data;
        var type = msg_data.type;
        var params = msg_data.parameters;
        var placeholderResponse = {
            type: "data",
            data: {
                user: {

                }
            }
        };
        switch(type){
            case "InfoCert_sendSMS":
                placeholderResponse.data.user.codeSended = (params.phoneNumber == this.placeholderData.phoneNumber);
                break;
            case "InfoCert_confirmSMSCode":
                placeholderResponse.data.user.codeConfirmed = (params.code.toString() == this.placeholderData.code);
                break;
            case "InfoCert_confirmDocumentID":
                placeholderResponse.data.user.documentIDconfirmed = (params.documentID.toString().includes(this.placeholderData.documentID));
                break;
            case "InfoCert_faceMatching":
                placeholderResponse.data.user.faceMatching = this.placeholderData.faceMatching;
                break;
        }

        this.onDataReceived(placeholderResponse);
    }
}

CORE.registerModule(App);
