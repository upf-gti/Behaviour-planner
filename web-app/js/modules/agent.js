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
		if(Object.keys(this.properties_log).length == 0)
				this.properties_log = data;
		else{
			if(type == 1)
				this.properties_log[Object.key(data)[0]] = Object.values(data)[0];
		}
	},

    getAgentById(id){
        for(var i in this.agents){
            var agent = this.agents[i];
            if(agent.uid.toLowerCase() == id.toLowerCase())
                return agent;
        }
    },

    save_agents(){
        var agents_to_save = [];
        for(var i in this.agents){
            var agent = this.agents[i];
            var agent_ = {};
            agent_.uid = agent.uid;
            agent_.path = clearPath(agent.path);
            agent_.properties = agent.properties;
            agents_to_save.push(agent_);
        }
        return agents_to_save;
    },

	agentsFromJSON(agents){
		for(var i = 0; i < agents.length; i++){
			var agent_info = agents[i];
			var agent = new Agent(agent_info);
		}
	},

	deleteProperty(property_name){
		for(var i in this.agents){
			delete this.agents[i].properties[property_name];
		}
    },

    removeAllAgents(){
        for(var i in this.agents){
			delete this.agents[i];

		}
    },

    createAgentInspector(inspector, agent){
        var inspector = inspector || new LiteGUI.Inspector();

        var that = agent;
        inspector.on_refresh = function(){
            var delete_html = '<img src="'+baseURL+'/latest/imgs/mini-icon-trash.png" alt="W3Schools.com">'
            inspector.clear();

            inspector.addSection("Agent properties");
            if(!that){
                inspector.addInfo("No agent selected", null, {name_width:"80%"});
            }else{
                inspector.root.id = that.uid.toLowerCase();
                var properties = that.properties;

                var uid = that.uid;
                inspector.widgets_per_row = 2;
                for(let p in properties){
                    let widget = null;
                    if(properties[p] == null) continue;
                    var pretitle = "<span title='Drag " + p + "' class='keyframe_icon'></span>";

                    switch(properties[p].constructor.name){
                        case "Number":
                            widget = inspector.addNumber( p, properties[p], { pretitle: pretitle, key: p, step:1, width:"calc(100% - 45px)", callback: function(v){ properties[this.options.key] = v } } );
                            inspector.addButton(null, delete_html, { width:40, name_width:"0%",callback: e => {
                                console.log(p);
                                that.deleteProperty(p, properties[p].constructor.name );
                                inspector.refresh();

                            }});
                            break;

                        case "String":
                            if(properties[p] == "true" || properties[p] == "false" ){
                                var value = true;
                                if(properties[p] == "false")
                                    value = false;
                                widget = inspector.addCheckbox( p, value, { pretitle: pretitle, key: p, width:"calc(100% - 45px)",callback: function(v){ properties[this.options.key] = v } } );
                                inspector.addButton(null, delete_html, {  width:40, name_width:"0%",callback: e => {
                                    console.log(p);
                                    that.deleteProperty(p, properties[p].constructor.name );
                                    inspector.refresh();
                                }});
                            }else{
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
                            break;

                        case "Boolean":
                            widget = inspector.addCheckbox( p, properties[p], { pretitle: pretitle, key: p, width:"calc(100% - 45px)",callback: function(v){ properties[this.options.key] = v } } );
                            inspector.addButton(null, delete_html, {  width:40, name_width:"0%",callback: e => {
                                console.log(p);
                                that.deleteProperty(p, properties[p].constructor.name );
                            }});
                            break;

                        case "Array":
                        case "Float32Array":
                            if(p == "position"){
                                widget = inspector.addVector3(p, properties[p], { pretitle: pretitle, key: p, width:"100%", callback: function(v){
                                    properties[this.options.key] = v;
                                    that.position = v;
                                }});
                            }
                            break;
                    }

                    if(!widget) continue;

                    var icon = widget.querySelector(".keyframe_icon");
                    if(icon){
                        icon.addEventListener("dragstart", function(a){
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

CORE.registerModule( AgentManager );

//	moveTo:0,
//	lookAt:1,
//	animateSimple:2,
//	wait:3,
//	nextTarget:4,
//	setMotion:5,
//	setProperties:6,
//	succeeder:7

//-------------------------------------------------------------------------------------------------------------------------------------
