PLAYING = 1;
STOP = 0;
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
Object.assign(window, glMatrix)
var tmp = {
	vec : 	vec3.create(),
	axis : 	vec3.create(),
	axis2 : vec3.create(),
	inv_mat : mat4.create(),
	agent_anim : null,
	behaviour : null
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
        this.env_tree = { id: "Environment", type:"env",
            children: [
               ]};

        this.streamer = new Streamer("wss://webglstudio.org/port/9003/ws/");
        this.chat = new Chat();
				this.iframe = null;

    }

    init(){


       /* var hbt_graph = GraphManager.newGraph(GraphManager.HBTGRAPH)
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
        //var add_node = this.interface.addButton("", {className: "btn btn-icon right",innerHTML: '<span class="material-icons"> add_circle</span>', callback: this.interface.createNode})

        this.interface.tree.insertItem({id:agent.properties.name, type: "agent"},"Environment");
        this.interface.tree.insertItem({id:user.properties.name, type: "user"},"Environment");

        if(this.agent_selected)
            this.currentContext.agent_evaluated = this.agent_selected;
        if(user!=null)
            this.currentContext.user = user;
        */

       // this.interface.createNodeInspector("agent");


        var last = now =performance.now();
        //this.interface.importFromURL();
        this.interface.importFromURL(baseURL+"/users/evalls/dialog-manager/dev/data/RAO-expressions.json")
			//	this.interface.loadCorpusData(baseURL+"/users/evalls/dialog-manager/data/corpus.json")
        //this.agent_selected = agent;
        AgentManager.agent_selected = this.agent_selected;
				if(iframeWindow)
				{
					var iframe = iframeWindow.document.querySelector("#iframe-character");
					this.iframe = iframe;
				}

				//iframe.src = "https://webglstudio.org/latest/player.html?url=fileserver%2Ffiles%2Fevalls%2Fprojects%2Fscenes%2FBehaviourPlanner.scene.json"//"https://webglstudio.org/latest/player.html?url=fileserver%2Ffiles%2Fevalls%2Fprojects%2Fscenes%2FLaraFacialAnimations.scene.json";


        requestAnimationFrame(this.animate.bind(this))
    }
    getUserById(id)
    {
        for(var i in this.users)
        {
            var user = this.users[i];
            if(user.uid.toLowerCase() == id.toLowerCase())
                return user;
        }
        return false;
    }
    changeState(){
        if(CORE.App.state == STOP)
            CORE.App.state = PLAYING;
        else
            CORE.App.state = STOP;
    }
    animate() {
        var that = this;
        requestAnimationFrame(that.animate.bind(that));
        last = now;
        now =performance.now();
        dt = (now - last) * 0.001;

        that.update(dt);

    }
    update(dt)
    {
			var LS = null;
			if(iframeWindow)
			{
				var iframe = iframeWindow.document.querySelector("#iframe-character");
				this.iframe = iframe;
				if(this.iframe && this.iframe.contentWindow)
					LS = this.iframe.contentWindow.LS;
			}

        //AgentManager.agent_selected = this.currentContext.agent_selected
        if(this.state == PLAYING)
        {
            accumulate_time+=dt;
            if(accumulate_time>=execution_t)
            {

                //Evaluate each agent on the scene
                for(var c in AgentManager.agents)
                {
                    var character_ = AgentManager.agents[c];


                    var agent_graph = currentHBTGraph = this.graphManager.graphs[character_.hbtgraph];
                    if(!agent_graph)
                        var agent_graph = currentHBTGraph = this.graphManager.graphs[0];
										/*if(userText)
                    {
                    	var node = null;
                    	if(this.currentContext.last_event_node)
                    	    node = this.graphManager.currentHBTGraph.graph.getNodeById(this.currentContext.last_event_node)
*/									if(this.currentContext.last_event_node==null ||this.currentContext.last_event_node==undefined)
                  		tmp.behaviour = agent_graph.runBehaviour(character_, this.currentContext, accumulate_time); //agent_graph -> HBTGraph, character puede ser var a = {prop1:2, prop2:43...}
                    /*    userText = false;
												triggerEvent = true;
                    }*/

                    for(var b in tmp.behaviour)
                    {
                        character_.applyBehaviour( tmp.behaviour[b]);
                        if(tmp.behaviour[b].type == 6)
                            character_.properties[tmp.behaviour[b].data.name] = tmp.behaviour[b].data.value;
											  if(tmp.behaviour[b].type == B_TYPE.intent)
												{
													this.chat.showMessage(tmp.behaviour[b].data.text, "me")


													if(LS)
													{
														//state = LS.Globals.SPEAKING;
														var obj = { speech: { text: tmp.behaviour[b].data.text }, control: LS.Globals.SPEAKING }; //speaking
														LS.Globals.processMsg(JSON.stringify(obj), true);
													}
													tmp.behaviour.splice(b,1);
												}
												else if(tmp.behaviour[b].type == B_TYPE.action)
												{
													var expressions = {
														angry:[-0.76,-0.64],
														happy:[0.95,-0.25],
														sad:[-0.81,0.57],
														surprised:[0.22,-0.98],
														sacred:[-0.23,-0.97],
														disgusted:[-0.97,-0.23],
														contempt:[-0.98,0.21],
														neutral:[0,0]
													}
													var va = [0,0];
													if(tmp.behaviour[b].data.animation_to_merge)
													{
														var g = tmp.behaviour[b].data.animation_to_merge.toLowerCase();

														va = expressions[g];
													}
													var obj = {facialExpression: {va: va}}
													if(tmp.behaviour[b].data.speed)
														obj.facialExpression.duration = tmp.behaviour[b].data.speed;
													if(LS)
														LS.Globals.processMsg(JSON.stringify(obj), true);

													tmp.behaviour.splice(b,1);
												}
                    }
										triggerEvent = false;
                }
                for(var i in GraphManager.graphs)
                {
                    var graph = GraphManager.graphs[i];
                    if(graph.type == GraphManager.BASICGRAPH)
                        graph.graph.runStep();
                }
                accumulate_time=0;
            // var behaviours = hbt_graph.runBehaviour(info, hbt_context, dt);

                this.interface.showContent(tmp.behaviour );
                if(this.streamer && this.streamer.ws &&  this.streamer.is_connected)
                    this.streamer.sendData(tmp.behaviour);
            }
        }
				else
				{
        	this.currentContext.last_event_node = null;
					this.chat.clearChat()
        }
    }
		onEvent(e)
		{
			var character_ = AgentManager.agent_selected;
			var agent_graph = currentHBTGraph = this.graphManager.graphs[character_.hbtgraph];
			if(!agent_graph)
					var agent_graph = currentHBTGraph = this.graphManager.graphs[0];
			var node = agent_graph.processEvent(e);
			if(node)
			{
				tmp.behaviour = agent_graph.runBehaviour(character_, this.currentContext, accumulate_time, node);
				triggerEvent=true;
			}
		}
    loadEnvironment(data)
    {
        var that = this;
        that.env_tree = { id: "Environment", type:"env",
            children: [
               ]};
        that.interface.tree.clear(true);
        AgentManager.removeAllAgents();
        UserManager.removeAllUsers();
        GraphManager.removeAllGraphs();

        var env = data.env;
        for(var i in env.graphs)
        {
            var graph = env.graphs[i];
            if(graph.behaviour)
            {
                var hbt_graph = GraphManager.newGraph(GraphManager.HBTGRAPH, i);
                hbt_graph.graph.configure(graph.behaviour)
                that.currentContext = hbt_graph.graph.context;
                currentHBTGraph = that.graphManager.currentHBTGraph = hbt_graph;
                //GraphManager.putGraphOnEditor( hbt_graph, i );
            }
            else
            {
                var g = GraphManager.newGraph(GraphManager.BASICGRAPH, i);
                graph.name =i;
                g.graph.configure(graph)

                //GraphManager.putGraphOnEditor(graph, i);
                for(var j in graph.nodes)
                {
                    var node = graph.nodes[j];
                    if(node.type == "network/sillyclient")
                    {
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
        for(var i in env.agents)
        {
            var data = env.agents[i];
            var agent = new Agent(data);
            that.agent_selected = agent;
            that.agent_selected.is_selected = true;
            that.env_tree.children.push({id:agent.uid, type: "agent"});
            that.interface.tree.insertItem({id:agent.properties.name, type: "agent"},"Environment");


        }

        if(env.user)
        {
            var user = new User(env.user);
            that.env_tree.children.push({id:user.uid, type: "user"});
            that.interface.tree.insertItem({id:user.properties.name, type: "user"},"Environment");
        }
        if(env.gestures)
        {
            that.interface.tree.insertItem({id:"Gesture Manager", type: "gesture"},"Environment");
            for(var i in env.gestures)
            {
                GestureManager.createGesture(env.gestures[i]);
            }

            GestureManager.createGestureInspector();
        }
        if(that.agent_selected)
            that.currentContext.agent_evaluated = that.agent_selected;
        if(user!=null)

        that.interface.tree.setSelectedItem(that.env_tree.id, true, that.interface.createNodeInspector({detail:{data:{id: that.env_tree.id, type: that.env_tree.type}}}))
        that.currentContext.user = user;
    }
		loadCorpusData(data)
		{
				corpus = data;
				corpus.array = [];
				for(var i in data.data)
				{
					corpus.array.push(i);
				}
		}
		onDataReceived(data)
		{
			var type = data.type;
			switch(type)
			{
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
}
CORE.registerModule( App );
