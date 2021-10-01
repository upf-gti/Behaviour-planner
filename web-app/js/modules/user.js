var UserManager = {
    name : "UserManager",
	properties_log : {},
    users: new Proxy({}, {
        set: (target, property, value, receiver) => {
            target[property] = value;

            if(property == "length")
                return true;

            return true;
        }
    }),

    init(){

    },

	addPropertiesToLog(data, type){
		if(Object.keys(this.properties_log).length == 0 )
				this.properties_log = data;
		else{
			if(type == 1)
				this.properties_log[Object.key(data)[0]] = Object.values(data)[0];
		}
	},
    getUserById(id){
        for(var i in this.users){
            var user = this.users[i];
            if(user.uid.toLowerCase() == id.toLowerCase())
                return user;
        }
    },

    deleteProperty(property_name){
        for(var i in this.users){
            delete this.users[i].properties[property_name];
        }
    },

    removeAllUsers(){
        for(var i in this.users)
        {
            delete this.users[i];
        }
    },

    createUserInspector(inspector, user){
        var inspector = this._inspector = inspector || new LiteGUI.Inspector();
        var that = user;
        inspector.on_refresh = function(){
            var delete_html = '<img src="'+baseURL+'/latest/imgs/mini-icon-trash.png" alt="W3Schools.com">'
            inspector.clear();
            inspector.addSection("User properties");
            if(!that){
                inspector.addInfo("No user", null, {name_width:"80%"});
            }else{
                var properties = that.properties;
                // properties.position = this.position;
    
                inspector.widgets_per_row = 2;
                for(let p in properties){
                    let widget = null;
                    if(properties[p] == null) continue;
                    var pretitle = "<span title='Drag " + p + "' class='keyframe_icon'></span>";
                    switch(properties[p].constructor.name){
                        case "Number":
                            widget = inspector.addNumber( p, properties[p], { pretitle: pretitle, key: p, step:1, width:"calc(100% - 45px)", callback: function(v){ properties[this.options.key] = v } } );
                            inspector.addButton(null, delete_html, { width:40, name_width:"0%",callback: e => {
                                UserManager.deleteProperty(p, properties[p].constructor.name );
                                inspector.refresh();
                            }});
                            break;
                        case "String":
                            if(properties[p] == "true" || properties[p] == "false"){
                                var value = true;
                                if(properties[p] == "false") value = false;
                                widget = inspector.addCheckbox( p, value, { pretitle: pretitle, key: p, width:"calc(100% - 45px)",callback: function(v){ properties[this.options.key] = v } } );
                                inspector.addButton(null, delete_html, {  width:40, name_width:"0%",callback: e => {
                                    console.log(p);
                                    UserManager.deleteProperty(p, properties[p].constructor.name );
                                    inspector.refresh();
                                }});
                            }else{
                                widget = inspector.addString( p, properties[p], { pretitle: pretitle, key: p, width:"calc(100% - 45px)",callback: function(v){
                                    //Updates name reference in menu
                                    if(this.options.key == "name"){
                                        //that.properties[this.options.key] = v;
                                        UserManager.users[that.uid].properties.name = v;
                                    }
                                    properties[this.options.key] = v;
                                }});
                                inspector.addButton(null, delete_html, {  width:40, name_width:"0%",callback: e => {
                                    if(p == "name") return;
                                    console.log(p);
                                    UserManager.deleteProperty(p, properties[p].constructor.name );
                                    inspector.refresh();
                                }});
                            }
                            break;
                        case "Boolean":
                            widget = inspector.addCheckbox( p, properties[p], { pretitle: pretitle, key: p, width:"calc(100% - 45px)",callback: function(v){ properties[this.options.key] = v } } );
                            inspector.addButton(null, delete_html, {  width:40, name_width:"0%",callback: e => {
                                console.log(p);
                                UserManager.deleteProperty(p, properties[p].constructor.name );
                                inspector.refresh();
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
                            a.dataTransfer.setData("data_type", "user" );
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
                    if(!_k || !_v) return;
    
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
    
        //var container = document.getElementById("agent-content")
        //container.appendChild(inspector.root);
        inspector.refresh();
        return inspector;
    }
}

CORE.registerModule( UserManager );
