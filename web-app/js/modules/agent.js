var AgentManager = {
    name : "AgentManager",
    properties_log : {},
    agent_selected: null,
    agents: new Proxy({}, {
        set: (target, property, value, receiver) => {
            target[property] = value;

            if(property == "length")
                return true;

			//AgentManager.createGUIParams( value );

            return true;
        }
    }),

    init(){

    },
	addPropertiesToLog(data, type){
		if(Object.keys(this.properties_log).length == 0 )
				this.properties_log = data;
		else
		{
			if(type == 1)
				this.properties_log[Object.key(data)[0]] = Object.values(data)[0];
		}
	},
    getAgentById(id)
    {
        for(var i in this.agents)
        {
            var agent = this.agents[i];
            if(agent.uid.toLowerCase() == id.toLowerCase())
                return agent;
        }
    },
    save_agents()
    {
        var agents_to_save = [];
        for(var i in this.agents)
        {
            var agent = this.agents[i];
            var agent_ = {};
            agent_.uid = agent.uid;
            agent_.path = clearPath(agent.path);
            agent_.properties = agent.properties;
            agents_to_save.push(agent_);
        }
        // console.log(agents_to_save);
        return agents_to_save;
    },

	agentsFromJSON(agents)
	{
		for(var i = 0; i < agents.length; i++)
		{
			var agent_info = agents[i];
			var agent = new Agent(agent_info);
		}
	},



	deleteProperty(property_name)
	{
		for(var i in this.agents)
		{
			delete this.agents[i].properties[property_name];

		}
    },

    removeAllAgents()
    {
        for(var i in this.agents)
		{
			delete this.agents[i];

		}
    }
}

CORE.registerModule( AgentManager );


class Agent{
    /* A parameter is	 if we want to load an agent */
    constructor( o , pos){

        if(o)
        {
            this.configure(o, this)
            return;
        }

        this.uid =  "Agent-" + Date.now();
	      this.num_id = Object.keys(AgentManager.agents).length;

        this.btree = null;

	      this.hbtgraph = "default";

        this.path = null;
	      this.r_path = null;

        this.skeletal_animations = {};

        this.properties = {
            name: this.uid,
			// happiness:0,
			// energy:0,
            // relax:0,
            valence:0,
            arousal:0,
            age: 35,

            target: null, // this.path[0],
            look_at_pos: [0,0,10000],
            position: pos,
            orientation: [0,0,0,1],
            state: "waiting"
        };

        this.position = this.properties.position;
        //Store agents
        this.bt_info = {};
        this.bt_info.running_data = {};
        this._inspector =  null;
        AgentManager.agents[this.uid] = this;
        AgentManager.addPropertiesToLog(this.properties);
        AgentManager.agent_selected = this;
        this.createAgentInspector();
    }

    configure( o, agent )
    {
        // console.log(o);
        this.uid = o.uid;
        this.num_id = o.num_id;
        this.btree = null;

	      this.hbtgraph = o.graph || "default";

        this.path = null;//[{id:1,pos:[2800,0,-2500],visited:false},{id:2,pos: [1900,0,1000],visited:false} ,{id:3,pos: [1300,0,1800],visited:false}, {id:4,pos: [-1500,0,1800],visited:false}, {id:5,pos: [-1300,0,0],visited:false}, {id:6,pos: [0,0,-750],visited:false}, {id:7,pos: [1500,0,-1050],visited:false}, {id:8,pos: [2500,0,-2500],visited:false}];
//        this.current_waypoint = this.path[0];
        this.properties = o.properties;
        this.properties.target = null; //this.path[0];

       /* if(o.gestures)
        {
            this.gesture_manager = new GestureManager();
            for(var i in o.gestures)
            {
                var gesture = new Gesture(o.gestures[i])
                this.gesture_manager.gestures[o.gestures[i].name] = gesture;
            }

        }
     */

        //Store thiss
        this.bt_info = {};
        this.bt_info.running_data = {};
        AgentManager.agents[agent.uid] = agent;
        AgentManager.agent_selected = agent;
        AgentManager.addPropertiesToLog(agent.properties);
        this.createAgentInspector();
        agent._inspector.refresh();
    }
    serialize()
    {
        var o = {};
        o.uid = this.uid;
        o.num_id = this.num_id;
        o.btree = this.btree;
		o.hbtgraph = this.hbtgraph;
        o.properties = this.properties;
       /* if(this.gesture_manager)
        {
            var gestures = [];
            for(var i in this.gesture_manager.gestures)
            {
                gestures.push(this.gesture_manager.gestures[i]);
            }
            o.gestures = gestures;
        }

        return o;*/
    }
    applyBehaviour(behaviour)
    {
        if(behaviour.type == B_TYPE.setProperty)
        {
            var name = behaviour.data.name;
            var value = behaviour.data.value;
            this.properties[name] = value;
            if(this._inspector)
                this._inspector.refresh();
        }
    }
    deleteProperty(property_name)
	{
		 delete this.properties[property_name];

    }

    createAgentInspector(inspector)
    {
        var inspector = this._inspector= this.agent_inspector = inspector || new LiteGUI.Inspector();

        var that = this;
        inspector.on_refresh = function()
        {

            var delete_html = '<img src="'+baseURL+'/latest/imgs/mini-icon-trash.png" alt="W3Schools.com">'
            inspector.clear();

            inspector.addSection("Agent properties");
            if(!that)
            {
                inspector.addInfo("No agent selected", null, {name_width:"80%"});
            }
            else
            {
                inspector.root.id = that.uid.toLowerCase();
                var properties = that.properties;

                var uid = that.uid;
                inspector.widgets_per_row = 2;
                for(let p in properties)
                {
                    let widget = null;
                    if(properties[p] == null) continue;
                    var pretitle = "<span title='Drag " + p + "' class='keyframe_icon'></span>";
                    switch(properties[p].constructor.name)
                    {
                        case "Number" : {
                            widget = inspector.addNumber( p, properties[p], { pretitle: pretitle, key: p, step:1, width:"calc(100% - 45px)", callback: function(v){ properties[this.options.key] = v } } );
                            inspector.addButton(null, delete_html, { width:40, name_width:"0%",callback: e => {
                                console.log(p);
                                that.deleteProperty(p, properties[p].constructor.name );
                                inspector.refresh();

                            }});
                            } break;
                        case "String" :
                        {
                            if(properties[p] == "true" || properties[p] == "false" )
                            {
                                var value = true;
                                if(properties[p] == "false")
                                    value = false;
                                widget = inspector.addCheckbox( p, value, { pretitle: pretitle, key: p, width:"calc(100% - 45px)",callback: function(v){ properties[this.options.key] = v } } );
                                inspector.addButton(null, delete_html, {  width:40, name_width:"0%",callback: e => {
                                    console.log(p);
                                    that.deleteProperty(p, properties[p].constructor.name );
                                    inspector.refresh();
                                }});
                            }
                            else{
                                widget = inspector.addString( p, properties[p], { pretitle: pretitle, key: p, width:"calc(100% - 45px)",callback: function(v){

                                    //Updates name reference in menu
                                    if(this.options.key == "name"){
                                        AgentManager.agents[that.uid].properties.name;
                                    }
                                    properties[this.options.key] = v;

                                }});
                                inspector.addButton(null, delete_html, {  width:40, name_width:"0%",callback: e => {
                                    if(p == "name")
                                        return;
                                    console.log(p);
                                    that.deleteProperty(p, properties[p].constructor.name );
                                    inspector.refresh();
                                }});
                            }


                        }break;
                        case "Boolean":
                        {
                            widget = inspector.addCheckbox( p, properties[p], { pretitle: pretitle, key: p, width:"calc(100% - 45px)",callback: function(v){ properties[this.options.key] = v } } );
                            inspector.addButton(null, delete_html, {  width:40, name_width:"0%",callback: e => {
                                console.log(p);
                                that.deleteProperty(p, properties[p].constructor.name );
                            }});
                        } break;

                        case "Array":
                        case "Float32Array":
                            if(p == "position")
                                widget = inspector.addVector3(p, properties[p], { pretitle: pretitle, key: p, width:"100%", callback: function(v){
                                    properties[this.options.key] = v;
                                    that.position = v;
                                } });
                            break;
                        default:
                        // debugger;
                            // console.warn( "parameter type from parameter "+p+" in agent "+ uid + " was not recognised");
                    }


                    if(!widget) continue;
    //					widget.classList.add("draggable-item");

                    var icon = widget.querySelector(".keyframe_icon");
                    if(icon){
                        icon.addEventListener("dragstart", function(a)
                        {
                            a.dataTransfer.setData("type", "HBTProperty" );
                            a.dataTransfer.setData("name", a.srcElement.parentElement.title );
                            a.dataTransfer.setData("data_type", "agent" );
                        });
                        icon.setAttribute("draggable", true);
                    }

                }

                inspector.addSeparator();
                inspector.widgets_per_row = 3;

                var _k,_v;
                inspector.addString(null, "",  { width:"50%", placeHolder:"param name",  callback: v => _k = v });
                inspector.addString(null, "",  { width:"calc(50% - 45px)", placeHolder:"value",       callback: v => _v = v });
                inspector.addButton(null, "+", { width:40, callback: e => {
                    if(!_k || !_v)
                        return;
                    try{
                        _v = JSON.parse('{ "v":'+_v+'}').v;
                    }catch(e){
                        //if fails it was a string, so leave it as the string it was.
                    }
                    properties[_k] = _v;

                    inspector.refresh();
                }});


            }

        }
        /*var container = document.getElementById("agent-content")
        container.appendChild(inspector.root);*/
        inspector.refresh();
        return inspector;

    }

}


//	moveTo:0,
//	lookAt:1,
//	animateSimple:2,
//	wait:3,
//	nextTarget:4,
//	setMotion:5,
//	setProperties:6,
//	succeeder:7

//-------------------------------------------------------------------------------------------------------------------------------------
