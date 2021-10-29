class Scene{
    constructor(){
        this.properties = {}
		this.last_target_id = null;
    }

    preInit(){
        
//        CORE.GUI.menu.add("Scene/· Scene Properties",{ 
//            callback:( ()=>{ 
////				console.log("GV");
//                this.toggleSceneProperties()
//            }).bind(this) 
//        });       
    }

    init(){
        this.zones = {};
        window.blackboard = this.addZone("zone1" ,new Blackboard());
        this.properties.interest_points = {}; 
        this.behaviors = {};

		for(var k in gen_behaviors)
			this.behaviors[k] = JSON.parse(gen_behaviors[k]);

//        this.behaviors = gen_behaviors;

		this.ip_setups = ip_setups;
		this.initial_behaviour = init_behaviour;
		this.bprops = this.zones["zone1"].bbvariables;

		this.createSceneInspector();
		this.createAgentInspector();
		
    }
createSceneInspector()
{
    var inspector = this.inspector = new LiteGUI.Inspector();
    var zones = this.zones;

    /**
     * SUPER TODO
     */
    inspector.widgets_per_row = 2;
    inspector.on_refresh = function()
    {
        var delete_html = '<img src="https://webglstudio.org/latest/imgs/mini-icon-trash.png" alt="W3Schools.com">'

        inspector.clear();
        inspector.addSection("Scene properties");
        for(let z in zones)
        {
            // inspector.addTitle(z);
//				inspector.addSeparator();
            inspector.widgets_per_row = 2;
            for(let p in zones[z].bbvariables)
            {
                var key = zones[z].bbvariables[p];
                var widget = null;
                var pretitle = "<span title='Drag " + key + "' class='keyframe_icon'></span>";
                switch(zones[z][key].constructor.name)
                {
                    case "Number": {
                        widget = inspector.addSlider(key, zones[z][key], { pretitle:pretitle, min:0, max:100, width:"calc(100% - 45px)", key: key, callback: function(v){ zones[z][this.options.key] = v } });
                        inspector.addButton(null, delete_html, { width:40, callback: e => {
                            console.log(p);
                            CORE.Scene.deletePropertyFromBlackboard(key, z );
                        }});
                    } break;
                    case "String": {
                        widget = inspector.addString(key, zones[z][key], { pretitle:pretitle, width:"calc(100% - 45px)",key: key, callback: function(v){ zones[z][this.options.key] = v } }); 
                        inspector.addButton(null, delete_html, { width:40, callback: e => {
                            console.log(p);
                            CORE.Scene.deletePropertyFromBlackboard(key, z );
                        }});
                    } break;
                }

                if(!widget) continue;
//					widget.classList.add("draggable-item");
                var icon = widget.querySelector(".keyframe_icon");
                if(icon){
                    icon.addEventListener("dragstart", function(a)
                    {  
                        a.dataTransfer.setData("type", "HBTProperty" );
                        a.dataTransfer.setData("name", a.srcElement.parentElement.title );
                    });
                    icon.setAttribute("draggable", true);
                }
            }
            inspector.addSeparator();
            inspector.widgets_per_row = 3;

            var _k,_v,_z;
            _z = JSON.parse(JSON.stringify(z));
            inspector.addString(null, "",  { width:"50%", placeHolder:"param name",  callback: v => _k = v });
            inspector.addString(null, "",  { width:"calc(50% - 45px)", placeHolder:"value",       callback: v => _v = v });
            inspector.addButton(null, "+", { zone: z, width:40, callback: function(e)
            {
            if(!_k || !_v)return;
                try{  _v = JSON.parse('{ "v":'+_v+'}').v; }catch(e){ }
                zones[this.options.zone].bbvariables.push(_k.toLowerCase()); 
                zones[this.options.zone][_k.toLowerCase()] = _v;
                inspector.refresh(); 
            }});

            inspector.widgets_per_row = 1;
            
        }
        inspector.endCurrentSection();
    }

    GraphManager.inspector_area.add(inspector);
    inspector.refresh();
    }
    createAgentInspector()
	{
		var inspector = agent_selected.inspector= this.agent_inspector = new LiteGUI.Inspector();
                
		inspector.on_refresh = function()
		{
			var delete_html = '<img src="https://webglstudio.org/latest/imgs/mini-icon-trash.png" alt="W3Schools.com">'
			inspector.clear();
			inspector.addSection("Agent properties");
			if(!agent_selected)
			{
				inspector.addInfo("No agent selected", null, {name_width:"80%"});
			}
			else
			{
				var properties = agent_selected.properties;
				properties.position = agent_selected.position;
				var uid = agent_selected.uid;
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
								AgentManager.deleteProperty(p, properties[p].constructor.name );

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
									AgentManager.deleteProperty(p, properties[p].constructor.name );
								}});
							}
							else{
								widget = inspector.addString( p, properties[p], { pretitle: pretitle, key: p, width:"calc(100% - 45px)",callback: function(v){ 

									//Updates name reference in menu
									if(this.options.key == "name"){
										dialog.root.querySelector(".panel-header").innerText = "Agent: "+v;
										CORE.GUI.menu.findMenu( "Agent/"+properties[this.options.key]).name = v;
									}
									properties[this.options.key] = v;
	
								}});   
								inspector.addButton(null, delete_html, {  width:40, name_width:"0%",callback: e => {
									if(p == "name")
										return;
									console.log(p);
									AgentManager.deleteProperty(p, properties[p].constructor.name );
								}});
							}

							
						}break;
						case "Boolean": 
						{	
							widget = inspector.addCheckbox( p, properties[p], { pretitle: pretitle, key: p, width:"calc(100% - 45px)",callback: function(v){ properties[this.options.key] = v } } );    
							inspector.addButton(null, delete_html, {  width:40, name_width:"0%",callback: e => {
								console.log(p);
								agent_selected.deleteProperty(p, properties[p].constructor.name );
							}});
						} break;
						
						case "Array":
						case "Float32Array": 
							if(p == "position")
								widget = inspector.addVector3(p, properties[p], { disabled:true, pretitle: pretitle, key: p, width:"100%", callback: function(v){ 
									properties[this.options.key] = v;
									agent_selected.position = v;
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
        var container = document.getElementById("agent-content")
		container.appendChild(inspector.root);
		inspector.refresh();
    }
    createUserInspector()
	{
		var inspector = user.inspector = new LiteGUI.Inspector();
                
		inspector.on_refresh = function()
		{
			var delete_html = '<img src="https://webglstudio.org/latest/imgs/mini-icon-trash.png" alt="W3Schools.com">'
			inspector.clear();
			inspector.addSection("User properties");
			if(!user)
			{
				inspector.addInfo("No user", null, {name_width:"80%"});
			}
			else
			{
				var properties = user.properties;
				properties.position = user.position;
				
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
								user.deleteProperty(p, properties[p].constructor.name );

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
									user.deleteProperty(p, properties[p].constructor.name );
								}});
							}
							else{
								widget = inspector.addString( p, properties[p], { pretitle: pretitle, key: p, width:"calc(100% - 45px)",callback: function(v){ 

									//Updates name reference in menu
									if(this.options.key == "name"){
										dialog.root.querySelector(".panel-header").innerText = "Agent: "+v;
										CORE.GUI.menu.findMenu( "User/"+properties[this.options.key]).name = v;
									}
									properties[this.options.key] = v;
	
								}});   
								inspector.addButton(null, delete_html, {  width:40, name_width:"0%",callback: e => {
									if(p == "name")
										return;
									console.log(p);
									user.deleteProperty(p, properties[p].constructor.name );
								}});
							}

							
						}break;
						case "Boolean": 
						{	
							widget = inspector.addCheckbox( p, properties[p], { pretitle: pretitle, key: p, width:"calc(100% - 45px)",callback: function(v){ properties[this.options.key] = v } } );    
							inspector.addButton(null, delete_html, {  width:40, name_width:"0%",callback: e => {
								console.log(p);
								user.deleteProperty(p, properties[p].constructor.name );
							}});
						} break;
						
						case "Array":
						case "Float32Array": 
							if(p == "position")
								widget = inspector.addVector3(p, properties[p], { disabled:true, pretitle: pretitle, key: p, width:"100%", callback: function(v){ 
									properties[this.options.key] = v;
									user.position = v;
								} }); 
							break;
						default:    

					}


					if(!widget) continue;

					var icon = widget.querySelector(".keyframe_icon");
					if(icon){
						icon.addEventListener("dragstart", function(a)
						{  
							a.dataTransfer.setData("type", "HBTProperty" );
							a.dataTransfer.setData("name", a.srcElement.parentElement.title );
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
        var container = document.getElementById("agent-content")
		container.appendChild(inspector.root);
		inspector.refresh();
	}
}