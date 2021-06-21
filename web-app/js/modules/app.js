PLAYING = 1;
STOP = 0;

SESSION = {
IS_GUEST: 0
};

EVENTS = {
	textRecieved: 0,
	imageRecieved: 1,
	faceDetected: 2,
	infoRecieved: 3
};
var baseURL = "https://webglstudio.org";
var last = now = performance.now();
var dt;
var accumulate_time = 0;
var execution_t = 1;
var corpus;
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
	    this.streamer.onDataReceived = this.onDataReceived.bind(this);
			this.streamer.onConnect = this.onWSconnected.bind(this);

	    this.chat = new Chat();
			this.iframe =   CORE.Interface.iframe;
	}

  init(){

    var hbt_graph = GraphManager.newGraph(GraphManager.HBTGRAPH);
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

    var last = now = performance.now();

    AgentManager.agent_selected = this.agent_selected;

    if(iframeWindow && iframeWindow.document){
			var iframe = iframeWindow.document.querySelector("#iframe-character");
            if(this.iframe)
			    iframe = this.iframe;
            else
                this.iframe = iframe
    }
    else{
        this.iframe = CORE.Interface.iframe;
    }
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
	  if(CORE.App.state == STOP){
	      CORE.App.state = PLAYING;
	  }else{
	      CORE.App.state = STOP;
	  }
  }

  onPlayClicked(){

    var play_buttons = document.getElementsByClassName("play-btn");
    var stream_button = document.getElementById("stream-btn");
    var icons = CORE["Interface"].icons;

    this.changeState();
    if(this.state == PLAYING)
    {
        for(var i=0;i< play_buttons.length;i++)
            play_buttons[i].innerHTML= icons.stop;

      if(stream_button.lastElementChild.classList.contains("active"))
      {
          stream_button.lastElementChild.classList.remove("active");
          stream_button.lastElementChild.classList.add("play");
      }
    }
    else
    {
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

  update(dt)
  {
      var LS = null;
      if(iframeWindow){
        var iframe = null;
        if(iframeWindow.document)
        {
            var iframe = iframeWindow.document.querySelector("#iframe-character");
            iframe = this.iframe;
        }

    if(this.iframe && this.iframe.contentWindow)
        LS = this.iframe.contentWindow.LS;
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

                if(tmp.event_behaviours){
                    tmp.behaviours = tmp.event_behaviours;
                    tmp.event_behaviours = null;
                }else if(this.currentContext.last_event_node == null || this.currentContext.last_event_node === undefined){
                    tmp.behaviours = agent_graph.runBehaviour(character_, this.currentContext, accumulate_time); //agent_graph -> HBTGraph, character puede ser var a = {prop1:2, prop2:43...}
                }

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
                                var data = behaviour.data;
                                if(!data.type || data.type == "agent"){
                                    this.currentContext.agent_evaluated.properties[data.name] = data.value;
                                }else if(data.type == "user"){
                                    this.currentContext.user.properties[data.name] = data.value;
                                }
                                break;

                            case B_TYPE.intent:

                              var obj = {};
                              //TODO properly process intents and timetables to generate behaviours in protocol format
                              var data = behaviour.data;

                              if(data.text){
                                  data.type = "speech";
                                  this.chat.showMessage(data.text, "me");
                                     var obj = { "speech": { text: data.text } }; //speaking

                              }else{
                                  var type = data.type = "anAnimation";
                                                                      var obj = { type: data };
                              }

                              behaviours_message.data.push(data);

                              break;
                          case B_TYPE.timeline_intent:
                              var obj = {};
                              //TODO properly process intents and timetables to generate behaviours in protocol format
                              var bh = behaviour.data;
                              if(bh.data)
                              {
                                  for(var i in bh.data)
                                  {
                                      var data = bh.data[i];

                                      var obj = { type: data };

                                      behaviours_message.data.push(data);

                                  }
                              }
                              else{
                                  for(var i in bh)
                                  {
                                      var data = bh[i];
                                      if(data.type == "speech"){

                                          this.chat.showMessage(data.text, "me");
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
                                if(behaviour.data.type.length != 0){
                                    messages_to_stream.push({type: "custom_action", data: behaviour.data});
                                }
                                break;
                        }
                    }

                    if(behaviours_message.data.length) messages_to_stream.push(behaviours_message);

                    //Send messages through streamer
                    if(this.streamer && this.streamer.ws &&  this.streamer.is_connected){
                        for(var m of messages_to_stream){
                            this.streamer.sendMessage(m.type, m.data);
                            if(LS){
                              //state = LS.Globals.SPEAKING;
                              m.control = LS.Globals.SPEAKING;
                              LS.Globals.processMsg(JSON.stringify(m.data), true);
                            }
                            if(m.type == "custom_action"){ //Placeholder stuff
                                this.placeholderProcessRequest(m);
                            }
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
			tmp.event_behaviours = agent_graph.runBehaviour(character_, this.currentContext, accumulate_time, node);
		}
	}

    loadBehaviour(data){
        var hbt_graph = this.currentHBTGraph = currentHBTGraph = GraphManager.loadGraph(data);
        //this.currentContext = hbt_graph.graph.context;
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
                var hbt_graph = GraphManager.newGraph(GraphManager.HBTGRAPH, graph.name);
                hbt_graph.graph.configure(graph.behaviour);
                this.currentContext = hbt_graph.graph.context;
                this.currentHBTGraph = currentHBTGraph = that.graphManager.currentHBTGraph = hbt_graph;
                //GraphManager.putGraphOnEditor( hbt_graph, i );
            }else{
                var g = GraphManager.newGraph(GraphManager.BASICGRAPH, graph.name);
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
            that.interface.tree.insertItem({id:agent.uid, type: "agent"},"Environment");
        }

        if(env.user){
            var user = new User(env.user);
            that.env_tree.children.push({id:user.uid, type: "user"});
            that.interface.tree.insertItem({id:user.uid, type: "user"},"Environment");
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

	onDataReceived(msg){
	    var type = msg.type;
	    var data = msg.data;
	    switch(type)
	    {
	        case "info":
	            //Server messages
	            console.log(data);
	            break;

	        case "user-data":   //Old, to remove
	            this.currentContext.user.update(data);
	            var text = data.text;
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

	        case "data":
	            //Process data in App
	            if(data.user){
	                this.currentContext.user.update(data.user);
                    if(data.user.text && this.chat){
	                    this.chat.showMessage(data.user.text);
	                }

                }
                if(data.img)
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
                    this.currentContext.user.update(data.user);
                    //this.placeholderData.faceMatching = true;
                }
                //TODO think about adding data of agent or for blackboard

                //Create event and process it in Graph
                this.onEvent(data);

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

              if(graph.type == GraphManager.HBTGRAPH) data = GraphManager.exportBehaviour(graph.graph);
              else if(graph.type == GraphManager.BASICGRAPH) data = GraphManager.exportBasicGraph(graph.graph);

              obj.env.graphs.push(data);
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

    placeholderData = {
        phoneNumber: "5552020",
        code: "1234",
        documentID: "00000000A",
        faceMatching: false,

    }

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

testRequest = function(m, key = "my-key", method, callback = null){
    url = "https://productsevo.infocert.it/RaoBotAPI/v1.0"//"http://ec2-79-125-68-20.eu-west-1.compute.amazonaws.com/RaoBotAPI/v1.0";
    request = m || "/status";
    /*fetch(url + method, {
        method: "GET",
        //mode: "no-cors", <- not compatible with custom headers
        headers: {
            apikey: key
        },
        body: null
    })
    .then(response => response.json())
    .then(data => {console.log(data);})
    .catch((error) => {console.error(error);});*/
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() { 
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
        if(callback)
            callback(xmlHttp.responseText);
        else
            console.log(xmlHttp.responseText)
    }
    xmlHttp.open(method, url+request, true); // true for asynchronous 
    xmlHttp.setRequestHeader("apikey", key)
    var data = null;
    if(method=="POST"){
        switch(request)
        {
            case "/aidocreader":
                data = {
                    "api-version": "v1.0",
                    "request-id": "AX0001",
                    "front": {
                      "image-id": "0001",
                      "description": "cid-42488231-front.jpg",
                      "doc-types": [
                        "ITA",
                        "DRIVER LICENSE"
                      ],
                      "content": "iVBORw0KGgo...AANSUhEUgAA==",
                      "comparison-text": {
                        "<label-name>": "ROSSI"
                      }
                    },
                    "back": {
                      "image-id": "0002",
                      "description": "cid-42488231-front.jpg",
                      "doc-types": [
                        "ITA",
                        "DRIVER LICENSE"
                      ],
                      "content": "iVBORw0KGgo...AANSUhEUgAA==",
                      "comparison-text": {
                        "<label-name>": "ROSSI"
                      }
                    },
                    "options": "string"
                  }
                break;
            case "/facematching":
                data = {
                    "api-version": "v1.0",
                    "request-id": "AX0001",
                    "front": {
                      "image-id": "0001",
                      "description": "cid-42488231-front.jpg",
                      "doc-types": [
                        "ITA",
                        "DRIVER LICENSE"
                      ],
                      "content": "iVBORw0KGgo...AANSUhEUgAA==",
                      "comparison-text": {
                        "<label-name>": "ROSSI"
                      }
                    },
                    "back": {
                      "image-id": "0002",
                      "description": "cid-42488231-front.jpg",
                      "doc-types": [
                        "ITA",
                        "DRIVER LICENSE"
                      ],
                      "content": "iVBORw0KGgo...AANSUhEUgAA==",
                      "comparison-text": {
                        "<label-name>": "ROSSI"
                      }
                    },
                    "options": "string"
                }
                break;
            case "/sendotp":
                data = {
                    "api-version": "v1.0",
                    "request-id": "AX0001",
                    "sms-text": "This is the One Time Password generated: #OTP",
                    "mobile-number": "+34676325485"
                    };
                break;
            case "/sendsms":
                data = {
                    "api-version": "v1.0",
                    "request-id": "AX0001",
                    "sms-text": "This is the message to the user mobile phone",
                    "mobile-number": "+34676325485"
                }
                break;
        }
       
        data = JSON.stringify(data)//convertJsonToFormData(data);
        xmlHttp.setRequestHeader("accept", "application/json");
        xmlHttp.setRequestHeader("Content-Type", "application/json");
        xmlHttp.send(data);
    }
    else if(method=="GET")
    {
        
        xmlHttp.send(null);
    }
}
//Will return an error because server does not currently implement OPTIONS call that is needed for CORS (cross-origin resource sharing)
//testRequest("/status", <key>);
function convertJsonToFormData(data) {
    const formData = new FormData()
    const entries = Object.entries(data) // returns array of object property as [key, value]
    // https://medium.com/front-end-weekly/3-things-you-didnt-know-about-the-foreach-loop-in-js-ff02cec465b1

    for (let i = 0; i < entries.length; i++) {
      // don't try to be smart by replacing it with entries.each, it has drawbacks
      const arKey = entries[i][0]
      let arVal = entries[i][1]
      if (typeof arVal === 'boolean') {
        arVal = arVal === true ? 1 : 0
      }
      if (Array.isArray(arVal)) {
        console.log('displaying arKey')
        console.log(arKey)
        console.log('displaying arval')
        console.log(arVal)

        if (this.isFile(arVal[0])) {
          for (let z = 0; z < arVal.length; z++) {
            formData.append(`${arKey}[]`, arVal[z])
          }

          continue // we don't need to append current element now, as its elements already appended
        } else if (arVal[0] instanceof Object) {
          for (let j = 0; j < arVal.length; j++) {
            if (arVal[j] instanceof Object) {
              // if first element is not file, we know its not files array
              for (const prop in arVal[j]) {
                if (Object.prototype.hasOwnProperty.call(arVal[j], prop)) {
                  // do stuff
                  if (!isNaN(Date.parse(arVal[j][prop]))) {
                    // console.log('Valid Date \n')
                    // (new Date(fromDate)).toUTCString()
                    formData.append(
                      `${arKey}[${j}][${prop}]`,
                      new Date(arVal[j][prop])
                    )
                  } else {
                    formData.append(`${arKey}[${j}][${prop}]`, arVal[j][prop])
                  }
                }
              }
            }
          }
          continue // we don't need to append current element now, as its elements already appended
        } else {
          arVal = JSON.stringify(arVal)
        }
      }
      else if (arVal instanceof Object) {
        for (var j in arVal) {
          if (arVal[j] instanceof Object) {
            // if first element is not file, we know its not files array
            for (const prop in arVal[j]) {
              if (Object.prototype.hasOwnProperty.call(arVal[j], prop)) {
                // do stuff
                if (!isNaN(Date.parse(arVal[j][prop]))) {
                  // console.log('Valid Date \n')
                  // (new Date(fromDate)).toUTCString()
                  formData.append(
                    `${arKey}[${j}][${prop}]`,
                    new Date(arVal[j][prop])
                  )
                } else {
                  formData.append(`${arKey}[${j}][${prop}]`, arVal[j][prop])
                }
              }
            }
          }
        }
    }
      if (arVal === null) {
        continue
      }
      formData.append(arKey, arVal)
    }
    return formData
  }
CORE.registerModule( App );
