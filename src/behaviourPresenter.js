
//-----------------------GRAPH EDITOR------------------------------------//
function GraphEditor(data){
    if(this.constructor !== GraphEditor)
        throw("You must use new to create a GraphEditor");
    this._ctor(data);
}

GraphEditor.prototype._ctor = function(id){
	this.name = "GraphEditor";
    this.node_pool = [];
    this.context2 = null;
    this.canvas2D = null;
    this.graph = null;
    this.graph_canvas = null;
    this.time = 0;
    this.last_time = 0;
    this.root_node = null;
    this.id = id? id: "graph-canvas"
}

GraphEditor.prototype.init = function( graph ){
    this.canvas2D = document.createElement("canvas");
    this.context2 = this.canvas2D.getContext("2d");
    var GraphEditor_cont = document.getElementById(this.id);
    this.canvas2D.width = GraphEditor_cont.clientWidth;
    this.canvas2D.height = GraphEditor_cont.clientHeight;
    this.canvas2D.id = "GraphEditor"+this.id
    GraphEditor_cont.appendChild(this.canvas2D);
    LiteGraph.NODE_TITLE_COLOR = "#DDD";
    LiteGraph.NODE_TEXT_COLOR = "#DDD"

    this.graph = graph.graph;

    this.graph.description_stack = [];

    var that = this;

    this.graph_canvas = new LGraphCanvas(this.canvas2D , graph.graph);
    this.graph_canvas.default_link_color = "#98bcbe";

    this.graph_canvas.onNodeSelected = function(node){
        console.log(node);
        that.current_graph_node = node;
    }

    this.graph_canvas.onNodeDeselected = function(node){
        that.current_graph_node = null;
        console.log(node);
    }

    this.graph_canvas.onDropItem = function( data ){
        var type = data.dataTransfer.getData("type");
		var name = data.dataTransfer.getData("name");
        var dataType = data.dataTransfer.getData("data_type");

        var info = data.dataTransfer.getData("info");
		if(name == "")
            name = data.dataTransfer.getData("obj");
        if(dataType == "")
            dataType = "agent";
        var obj = {name:name, dataType: dataType};
        if(info)
            obj.info = info;

        //var properties = data.dataTransfer.getData("obj");
        //properties = JSON.parse(properties);
        that.addNodeByType(type, obj , [data.canvasX,data.canvasY]);
    }
}

GraphEditor.prototype.addNodeByType = function(type, properties, pos){
    switch(type){
        /* ADDED BY EVA */
        case "GestureNode":
            var graphnode = LiteGraph.createNode( "btree/GestureNode" );
            var title = properties.name;
			graphnode.title = title;
			graphnode.pos = pos;
            graphnode.setProperty( "property_name", title );
            var gesture = GestureManager.gestures[title];
            for(var i in gesture){
                if(i == "properties"){
                    for(var j in gesture[i])
                        graphnode.properties[j] = gesture[i][j];
                }
                else
                    graphnode.properties[i] = gesture[i];
            }
            var widgets = graphnode.widgets;
            for(var i in widgets){
                var widgetName = widgets[i].name;
                if(graphnode.properties.hasOwnProperty(widgetName))
                    widgets[i].value = graphnode.properties[widgetName];
            }
            var dataType = null;
            graphnode.property_type = properties.dataType;
            var graphcanvas = LGraphCanvas.active_canvas;
            graphcanvas.graph.add(graphnode);
            break;

        case "GestureManager":
            var graphnode = LiteGraph.createNode( "btree/GestureMap" );
            var title = properties.name;
			graphnode.title = title;
			graphnode.pos = pos;
            graphnode.setProperty( "property_name", title );
            graphnode.gestures = GestureManager.gestures;
            var graphcanvas = LGraphCanvas.active_canvas;
            graphcanvas.graph.add(graphnode);
            break;

		case "HBTProperty":
            var graphnode = LiteGraph.createNode( "basic/property" );

			var title = properties.name;
			graphnode.title = title;
			graphnode.pos = pos;
            graphnode.setProperty( "property_name", title );
            var dataType = null;

            switch(properties.dataType){
                case "agent":
                    dataType = currentContext.agent_evaluated.properties[title];
                    break;
                case "user":
                    dataType =  currentContext.user.properties[title];
                    break;
                /**ADDED BY EVA**/
                case "gesture-property":
                    if(properties.info){
                        properties.dataType+="/"+properties.info;
                        var gesture = AgentManager.agent_selected.gesture_manager.gestures[properties.info];
                        title = title.toLocaleLowerCase();

                        if(gesture.hasOwnProperty(title))
                            dataType = gesture[title];
                        else if(gesture.properties.hasOwnProperty(title))
                            dataType = gesture.properties[title];
                    }
                    break;

            }
            graphnode.property_type =  graphnode.properties.property_type = properties.dataType;
            graphnode.setProperty("type", dataType.constructor.name.toLocaleLowerCase());
            graphnode.setProperty("value", dataType);
            var graphcanvas = LGraphCanvas.active_canvas;
            graphcanvas.graph.add(graphnode);

            if(graphcanvas.graph._is_subgraph){
                graphnode.graph.character_evaluated = this.graph.graph.character_evaluated;
                graphnode.graph.context = this.graph.graph.context;
                graphnode.graph.current_behaviour = this.graph.graph.current_behaviour;
                graphnode.graph.character_evaluated = this.graph.graph.character_evaluated;
                graphnode.graph.root_node = this.graph.graph.root_node;
                graphnode.graph.evaluation_behaviours = this.graph.graph.evaluation_behaviours;
            }
		    break;

        case "cycle":
			var props = JSON.parse(properties);
            var node_leaf = LiteGraph.createNode("btree/SimpleAnimate");
			node_leaf.setProperty("filename", props.filename);
			node_leaf.setProperty("speed", props.speed);
			node_leaf.setProperty("motion", props.motion);
            //node_leaf.properties = props;
            node_leaf.pos = pos;
            //node_leaf.data.g_node = node_leaf;
            this.graph.graph.add(node_leaf);
            if(this.current_graph_node && this.current_graph_node.outputs && this.current_graph_node.outputs[0].type == "path"){
                this.current_graph_node.connect(0, node_leaf, 0 );
            }
            break;

		case "action":
			var props = JSON.parse(properties);
            var node_leaf = LiteGraph.createNode("btree/ActionAnimate");
			node_leaf.setProperty("filename", props.filename);
			node_leaf.setProperty("speed", props.speed);
            //node_leaf.properties = props;
            node_leaf.pos = pos;
            //node_leaf.data.g_node = node_leaf;
            this.graph.graph.add(node_leaf);
            //if(hbt_editor.graph.)
            break;

        case "intarget":
            var node_cond = LiteGraph.createNode("btree/InTarget");
            node_cond.properties = properties;
            node_cond.pos = pos;
            // node_cond.data.g_node = node_cond;
            this.graph.graph.add(node_cond);
            break;
    }
}

//Unused
function removeChild(node){
    var parent = hbt_editor.graph.getNodeById(node.parent);
    for(var i = 0; i< parent.children.length; i++){
        var children = parent.children[i];
        if(children.id == node.id){
            var index = parent.children.indexOf(children);
            if (index !== -1){
                parent.children.splice(index, 1);
            }
        }
    }
    node.parent = null;
}

/*LGraphCanvas.prototype.onDropItem = function(data)
{
	var type = data.dataTransfer.getData("type");
		var name = data.dataTransfer.getData("name");
        var dataType = data.dataTransfer.getData("data_type");

        var info = data.dataTransfer.getData("info");
		if(name == "")
            name = data.dataTransfer.getData("obj");
        if(dataType == "")
            dataType = "agent";
        var obj = {name:name, dataType: dataType};
        if(info)
            obj.info = info;

//      var properties = data.dataTransfer.getData("obj");
//      properties = JSON.parse(properties);
        that.addNodeByType(type, obj , [data.canvasX,data.canvasY]);
}*/

/** 
 * LGraphCanvas overwrite onShowNodePanel to add onInspect
 */
LGraphCanvas.prototype.onShowNodePanel = function(n){
    if(n.onInspect){
        var insp = CORE.Interface.graphinspector;
        n.onInspect(insp);
    }
}

//-----------------------ONINSPECT METHOD FOR NODES------------------------------------//
ParseCompare.prototype.onInspect = function(  inspector ){
    component = this;
    inspector.clear();
    inspector.widgets_per_row = 1;
    var contexts = inspector.addSection("Contexts");
    //inspector.addTitle("Contexts");
    var inputContext = CORE.Interface.addInputTags("Input contexts", this.input_contexts, {placeholder: "Add input context...", callback: function(v){
        if(component.input_contexts.indexOf(v)>-1)
            return;
        component.input_contexts.push(v);
        if(corpus && corpus.data[v]){
            var utterances = corpus.data[v].utterances;

            for(var i in utterances){
                var aux=utterances[i];
                var tags = [];
                var idx = aux.indexOf("#");
                while(idx>=0){
                    var count = 0;
                    for(var j=idx; j<aux.length; j++){
                        count++;
                        if(aux[j]==" " || aux[j]=="." || aux[j]==","){
                            count--;
                            break;
                        }
                    }
                    var tag = aux.slice(idx,idx+count);
                    tags.push(tag);
                    aux = aux.replace(tag," ")
                    idx = aux.indexOf("#");
                }

                component.processPhrase(utterances[i], tags, inspector)
                //  component.onInspect(inspector)
                //component.phrases.push(utterances[i])
            }
            component.onInspect(inspector)
        }
    }, callback_delete: function(v){
        var i = component.input_contexts.indexOf(v);
        component.input_contexts = component.input_contexts.splice(i);
    }});
    if(corpus){
        inputContext.addEventListener("keypress", autocomplete(inputContext.lastElementChild.lastElementChild,corpus.array, null, {callback: function(){
            var e = new Event("keydown");
            e.keyCode=13;
            var input = document.getElementById("input-tag")
            input.dispatchEvent(e)
        }}))

    }

    inspector.append(inputContext);
    /*  var outputContext = CORE.Interface.addInputTags("Output contexts", this.output_contexts, {placeholder: "Add output context...", callback: function(v){
        component.output_contexts.push(v);
    }, callback_delete: function(v){
        var i = component.output_contexts.indexOf(v);
        component.output_contexts = component.output_contexts.splice(i);
    }});
    inspector.append(outputContext*/
    var phrases_insp = inspector.addSection("Training phrases");
    //inspector.addTitle("Training phrases");
    inspector.widgets_per_row = 2;
    var training_phrases = component.phrases;
    var container = document.createElement("DIV");
    container.setAttribute("class", "responsive-content")


    for(var i in training_phrases){
        /*HIGHLIGHT TAGS*/
        var div = document.createElement("DIV");
        div.className ="backdrop";
        div.style.width = "calc(100% - 48px)";
        var div_highlight = document.createElement("DIV");
        div_highlight.className ="highlights";
        div_highlight.innerHTML = component.visible_phrases[i];

        var input = document.createElement("TEXTAREA");//document.createElement("INPUT");
        input.setAttribute("class","inputfield textarea")
        input.style.width = "100%";
        input.value = training_phrases[i].text;
        input.setAttribute("readonly", true)
        new ResizeObserver(function(v){
            var that = this;
            that.style.width = input.clientWidth;
            that.style.height = input.innterHeight;
        }.bind(div_highlight)).observe(input)


        input.addEventListener("change", function(v){
            var id = this.toString();
            component.phrases[id].text = v;
        }.bind(i))
        div.appendChild(div_highlight);
        div.appendChild(input);
        container.appendChild(div);
        /*  var div = document.createElement("DIV");
            div.className ="highlighter";

            div.innerHTML = component.visible_phrases[i];
            var input = document.createElement("TEXTAREA");//document.createElement("INPUT");
            input.value = traingin_phrases[i].text;
            //input.id ="input"
            input.addEventListener("change", function(v){
                var id = this.toString();
                component.phrases[id].text = v;
            }.bind(i))

            inspector.append(div)
            inspector.append(input)*/
            /*var string = inspector.addString(null, component.visible_phrases[i], {width: "calc(100% -40px)", callback: function(v){
                var id = this.toString();
                component.phrases[id] = v;
            }.bind(i)});
    */

        var btn = new LiteGUI.Button('<img src="https://webglstudio.org/latest/imgs/mini-icon-trash.png">' ,{width:40,  callback: function(v){
            var id = this.toString();
            if(id > -1){
                component.phrases.splice(id, 1);
            }
            component.onInspect(inspector)
        }.bind(i)});

        btn.root.className+= " btn-custom";
            /*inspector.addButton(null, '<img src="https://webglstudio.org/latest/imgs/mini-icon-trash.png">' ,{width:40,callback: function(v){
                var id = this.toString();
                if(id > -1) {
                component.phrases.splice(id, 1);
                }
                component.onInspect(inspector)
            }.bind(i)})*/
        container.appendChild(btn.root)
    }

    inspector.append(container);
    inspector.widgets_per_row = 1;
    inspector.addSeparator();
    inspector.addTitle("New phrase");

    inspector.widgets_per_row = 2;
    var newPhrase = "";
    var tags = [];
  /*  var phrase = inspector.addTextarea(null, null, {title: "New training phrase...", width: "calc(100% - 40px)",
    callback: function(v){
        newPhrase = v;
    }, callback_enter: function(v){
        newPhrase = v;
    }});*/

    var phrase = document.createElement("TEXTAREA");//document.createElement("INPUT");
    phrase.setAttribute("className","inputfield textarea")
    phrase.setAttribute("placeholder", "New training phrase...")
    phrase.style.width = "calc(100% - 40px)";
    newPhrase = phrase.value
      //input.id ="input"

    //(phrase, EntitiesManager.getEntities())
    //phrase.addEventListener("keypress", autocomplete.bind(phrase, EntitiesManager.getEntities(), null))
    phrase.addEventListener("keypress", function(e){
        var that = this;
        /*if(e.key=="Alt"||e.key=="AltGraph" || e.key=="Control"|| e.key=="CapsLock" || e.key=="Backspace")
          return;*/
        newPhrase =   phrase.value;
        if(e.key == "#"){
            autocomplete(phrase, EntitiesManager.getEntities(), tags, {})
            //displayEntity(i, phrase, e, tags)
            newPhrase = e.target.value;
        }
    }.bind(this));
    inspector.append(phrase);

    inspector.addButton(null,"+", {width:40,callback: component.processPhrase.bind(this, phrase,tags, inspector)});
}

ParseCompare.prototype.processPhrase = function(phraseElement, tags, inspector){
    var newPhrase = (phraseElement.value!=undefined)? phraseElement.value:phraseElement;  // phraseElement.value!=undefined? phraseElement.value : phraseElement.getValue();
    var currentPhrase = newPhrase;
    var toCompare = newPhrase;
    //component.phrases.push(newPhrase);

    for(var i=0; i<tags.length; i++){
        var tag = tags[i];

        if(!this.tags_outputs[tag]){
          this.tags_outputs[tag] = "string";
        }

        var start = currentPhrase.indexOf(tag);
        var end = tag.length;
        //currentPhrase = currentPhrase.slice(0,start)+'<span>'+currentPhrase.slice(start,start+end)+'</span> '+currentPhrase.slice(start+end);
        currentPhrase = currentPhrase.slice(0,start)+'<mark>'+currentPhrase.slice(start,start+end)+'</mark>'+currentPhrase.slice(start+end);
        toCompare = toCompare.replace(tag, "(\\w+)");
    }

    this.visible_phrases.push(currentPhrase);
    this.phrases.push({text: newPhrase, tags: tags, toCompare: toCompare});
    if(inspector) this.onInspect(inspector);
}

Intent.prototype.onInspect = function(  inspector ){
    component = this;
    inspector.clear();
    inspector.widgets_per_row = 1;

    var contexts = inspector.addSection("Contexts");
    //inspector.addTitle("Contexts");
    var inputContext = CORE.Interface.addInputTags("Input contexts", this.input_contexts, {placeholder: "Add input context...", callback: function(v){
        if(component.input_contexts.indexOf(v)>-1)
            return;
        component.input_contexts.push(v);
        if(corpus && corpus.data[v]){
            var answers = corpus.data[v].answers;

            for(var i in answers){
                var aux = answers[i];
                var tags = [];
                var idx = aux.indexOf("#");
                while(idx>=0){
                    var count = 0;
                    for(var j=idx; j<aux.length; j++){
                        count++;
                        if(aux[j]==" " || aux[j]=="." || aux[j]==",")
                        {
                            count--;
                            break;
                        }
                    }
                    var tag = aux.slice(idx,idx+count);
                    tags.push(tag);
                    aux = aux.replace(tag," ")
                    idx = aux.indexOf("#");
                }

                component.processPhrase(answers[i], tags, inspector);
                //  component.onInspect(inspector)
                //component.phrases.push(utterances[i])
            }
            component.onInspect(inspector);
        }
    }, callback_delete: function(v){
        var i = component.input_contexts.indexOf(v);
        component.input_contexts = component.input_contexts.splice(i);
    }});

    if(corpus){
        inputContext.addEventListener("keypress", autocomplete(inputContext.lastElementChild.lastElementChild,corpus.array, null, {callback: function(){
            var e = new Event("keydown");
            e.keyCode=13;
            var input = document.getElementById("input-tag")
            input.dispatchEvent(e);
        }}));
    }

    inspector.append(inputContext);
    var phrases_insp = inspector.addSection("Responses");
    //inspector.addTitle("Training phrases");
    inspector.widgets_per_row = 2;
    var responses = component.responses;
    var container = document.createElement("DIV");
    container.setAttribute("class", "responsive-content");

    for(var i in responses){
        /*HIGHLIGHT TAGS*/
        var div = document.createElement("DIV");
        div.className ="backdrop";
        div.style.width = "calc(100% - 48px)";
        var div_highlight = document.createElement("DIV");
        div_highlight.className ="highlights";
        div_highlight.innerHTML = component.visible_phrases[i];

        var input = document.createElement("TEXTAREA");//document.createElement("INPUT");
        input.setAttribute("class","inputfield textarea")
        input.style.width = "100%";
        input.value = responses[i].text;
        input.setAttribute("readonly", true)
        new ResizeObserver(function(v){
            var that = this;
            that.style.width = input.clientWidth;
            that.style.height = input.innterHeight;
        }.bind(div_highlight)).observe(input);

        input.addEventListener("change", function(v){
            var id = this.toString();
            component.phrases[id].text = v;
        }.bind(i));
        div.appendChild(div_highlight);
        div.appendChild(input);
        container.appendChild(div);
        /*  var div = document.createElement("DIV");
            div.className ="highlighter";

            div.innerHTML = component.visible_phrases[i];
            var input = document.createElement("TEXTAREA");//document.createElement("INPUT");
            input.value = traingin_phrases[i].text;
            //input.id ="input"
            input.addEventListener("change", function(v){
                var id = this.toString();
                component.phrases[id].text = v;
            }.bind(i))

            inspector.append(div)
            inspector.append(input)*/
            /*var string = inspector.addString(null, component.visible_phrases[i], {width: "calc(100% -40px)", callback: function(v){
                var id = this.toString();
                component.phrases[id] = v;
            }.bind(i)});
    */      
        var btn = new LiteGUI.Button('<img src="https://webglstudio.org/latest/imgs/mini-icon-trash.png">' ,{width:40,  callback: function(v){
            var id = this.toString();
            if(id > -1) {
                component.responses.splice(id, 1);
            }
            component.onInspect(inspector);
        }.bind(i)});
        btn.root.className+= " btn-custom";
            /*inspector.addButton(null, '<img src="https://webglstudio.org/latest/imgs/mini-icon-trash.png">' ,{width:40,callback: function(v){
                var id = this.toString();
                if(id > -1) {
                component.phrases.splice(id, 1);
                }
                component.onInspect(inspector)
            }.bind(i)})*/
        container.appendChild(btn.root);
    }
    inspector.append(container);
    inspector.widgets_per_row = 1;
    inspector.addSeparator();
    inspector.addTitle("New response");

    inspector.widgets_per_row = 2;
    var newPhrase = "";
    var tags = [];
    
    /*var phrase = inspector.addTextarea(null, null, {title: "New training phrase...", width: "calc(100% - 40px)",
    callback: function(v){
        newPhrase = v;
    }, callback_enter: function(v){
        newPhrase = v;
    }});*/

    var phrase = document.createElement("TEXTAREA");//document.createElement("INPUT");
    phrase.setAttribute("className","inputfield textarea");
    phrase.setAttribute("placeholder", "New agent response...");
    phrase.style.width = "calc(100% - 40px)";
    newPhrase = phrase.value;
    //input.id ="input"

    //(phrase, EntitiesManager.getEntities())
    //phrase.addEventListener("keypress", autocomplete.bind(phrase, EntitiesManager.getEntities(), null))
    phrase.addEventListener("keypress", function(e){
        var that = this;
        /*if(e.key=="Alt"||e.key=="AltGraph" || e.key=="Control"|| e.key=="CapsLock" || e.key=="Backspace")
          return;*/
        newPhrase =   phrase.value;
        if(e.key == "#"){
            autocomplete(phrase, EntitiesManager.getEntities(), tags, {})
            //displayEntity(i, phrase, e, tags)
            newPhrase = e.target.value;
        }
    }.bind(this));
    inspector.append(phrase);

    inspector.addButton(null,"+", {width:40,callback: component.processPhrase.bind(this, phrase,tags, inspector)});

  /*  var dialog = new LiteGUI.Dialog('Intent', { title:'Intent', close: true, minimize: false, width: 700, height: 200, scroll: false, resizable: false, draggable: true });
    var canvas = document.createElement("CANVAS");
    canvas.style.position = "absoulte"
    var ctx = canvas.getContext('2d');

    this.timeline.draw(ctx, {duration:7}, 0)
    var keyframes = {data: [[0,0], [1,1], [2,2], [3,3], [4,3], [5,2], [6,1], [7,0]]}
    this.timeline.drawTrackWithKeyframes(ctx, 5, 20, "Speech", "", keyframes, 0, null)
    this.timeline.drawTrackWithKeyframes(ctx, 6, 20, "Speech", "", keyframes, 0, null)
    dialog.add(canvas)
    dialog.show()*/
}

Intent.prototype.processPhrase = function(phraseElement, tags, inspector){
    newPhrase = (phraseElement.value!=undefined)? phraseElement.value:phraseElement  // phraseElement.value!=undefined? phraseElement.value : phraseElement.getValue();
    var currentPhrase = newPhrase;

    //component.phrases.push(newPhrase);

    for(var i=0; i<tags.length; i++){
        var start = currentPhrase.indexOf(tags[i]);
        var end = tags[i].length;
        //currentPhrase = currentPhrase.slice(0,start)+'<span>'+currentPhrase.slice(start,start+end)+'</span> '+currentPhrase.slice(start+end);
        currentPhrase = currentPhrase.slice(0,start)+'<mark>'+currentPhrase.slice(start,start+end)+'</mark>'+currentPhrase.slice(start+end);
    }
    component.visible_phrases.push(currentPhrase);
    component.responses.push({text: newPhrase, tags: tags});
    component.onInspect(inspector)
}

function displayEntity(id, inspector, e, tags){
    var text = e.target//document.getElementById("input-text");
    //var t = text.value.substr(text.selectionStart, text.selectionEnd - text.selectionStart);

    /*if(t != "")
    {*/
    autocomplete(inspector, EntitiesManager.getEntities());
    /*var contextmenu = new LiteGUI.ContextMenu( EntitiesManager.getEntities(), {title: "Entities", callback: function(v){

        /*var resp = component.responses[id].text;
        var highlightText = resp.slice(0,text.selectionStart)+'<span class="">'+resp.slice(text.selectionStart,text.selectionEnd)+'</span>'+resp.slice(text.selectionEnd)
        component.responses[id].highlightText = highlightText;
        component.responses[id].tags[v]= t;
        component.onInspect(inspector)*/
  /*      inspector.setValue(text.value+v)
        /*e.target.value = text.value+v;
        newPhrase = e.target.value;*/
    /*    tags.push("#"+v);

    }});
*/
/*}*/
}

CustomRequest.prototype.onInspect = function(inspector){
    var that = this;
  
    inspector.clear();
  
    inspector.addTitle("Custom Request");
  
    inspector.widgets_per_row = 1;
    inspector.addString("Type", this.properties.type, {width: "100%", content_width: "70%", callback: function(value){
        that.properties.type = value;
        that._typeWidget.value = value;
    }});
  
    inspector.widgets_per_row = 3;
  
    inspector.addSection("CustomRequest Parameters");
    var parameters = this.properties.parameters;
  
    //Header
    inspector.addInfo("Name", "", {width: "40%", disabled: true});
    inspector.addInfo("Value (Optional)", "", {width: "40%", disabled: true});
    inspector.addNull();
  
    //Existing parameters
    for(var p in parameters){
        inspector.addString("", p, {width: "40%", content_width: "100%", disabled: true});
        inspector.addString("", parameters[p], {width: "40%", content_width: "100%", callback: function(value){
            parameters[p] = value;
        }});
        inspector.addButton(null, "Remove", {width: "20%", callback: function(){
            delete parameters[p];
            that.onInspect(inspector);
        }});
    }
  
    //New one
    var newName, newValue;
    inspector.addString("", "", {width: "40%", content_width: "100%", callback: function(value){
        newName = value;
    }});
    inspector.addString("", "", {width: "40%", content_width: "100%", callback: function(value){
        newValue = value;
    }});
    inspector.addButton(null, "Add", {width: "20%", callback: function(){
        if(that.addParameter(newName, newValue)){
            that.onInspect(inspector);
        }
    }});
}

HttpRequest.prototype.onInspect = function(inspector)
{
    var that = this;
  
    inspector.clear();
  
    inspector.addSection("Http Request");

    inspector.widgets_per_row = 2;
    inspector.addTitle("Add request property");

    //New one
    var newName, newValue;
    inspector.addString(null, "", {placeHolder: "Name", callback: function(value){
        newName = value;
    }});
    inspector.addString(null, "", {placeHolder: "Value", callback: function(value){
        newValue = value;
    }});
    inspector.addButton(null, "As header", {callback: function(){
        if(that.addProperty(newName, newValue, true)){
            that.onInspect(inspector);
        }
    }});
    inspector.addButton(null, "As param", {callback: function(){
        if(that.addProperty(newName, newValue)){
            that.onInspect(inspector);
        }
    }});

    inspector.addSeparator();
    inspector.addSection("Headers");

    // Existing headers
    for(let p in this.headers){

        inspector.addInfo("", p, {width: "30%", content_width: "100%"});

        inspector.addString(null, this.headers[p], {width: "60%", content_width: "100%", callback: function(v){
            that.propagate(p, v);
            that.headers[p] = v;
        }});

        inspector.addButton(null, "<img src='https://webglstudio.org/latest/imgs/mini-icon-trash.png'>", {width: "10%", micro: true, callback: function(){
            that.propagate(p, null);
            delete that.headers[p];
            that.onInspect(inspector);
        }});
    }

    inspector.addSection("Parameters");
      
    // Existing parameters 
    for(let p in this.properties){

        if(p == "method" || p == "dataType")
        continue;

        var func = null;
        var value = this.properties[p];

        var isBool = (value.constructor == Boolean);
        inspector.addInfo("", p, {width: isBool ? "40%" : "30%", content_width: "100%"});

        switch(value.constructor)
        {
            case Number:
                var precision = variable.type == "float" ? 2 : 0;
                func = inspector.addNumber(null, value, {precision: precision, width: "60%", content_width: "100%", callback: function(v){
                    that.propagate(p, v);
                    that.properties[p] = v;
                }});
                break;
            case String:
                func = inspector.addString(null, value, {width: "60%", content_width: "100%", callback: function(v){
                    that.propagate(p, v);
                    that.properties[p] = v;
                }});
                break;
            case Boolean:
                func = inspector.addCheckbox(null, value, {width: "50%", content_width: "100%", callback: function(v){
                    that.propagate(p, v);
                    that.properties[p] = v;
                }});
                break;
        }

        inspector.addButton(null, "<img src='https://webglstudio.org/latest/imgs/mini-icon-trash.png'>", {width: "10%", micro: true, callback: function(){
            delete that.properties[p];
            that.onInspect(inspector);
        }});
    }

    inspector.addSection("Request Data");

    // Load template 
    {
        inspector.widgets_per_row = 1;
        var templateBtn = inspector.addButton(null, "From template", {callback: function(value, e){
    
            e.preventDefault();

            var options = [
                {title: "Templates", disabled: true}, null, {
                    title: "New",
                    callback: function(){
                        CORE.Interface.openTemplateLoader(function(name, data){
                            HttpRequest.Imported_Templates["/" + name] = data;
                        });
                    }
                },
                {
                    title: "Saved",
                    submenu: {
                        options: []
                    }
                },
                {
                    title: "Default RAO",
                    submenu: {
                        options: []
                    }
                }
            ];

            for(let t in HttpRequest.Imported_Templates) {
                options[3].submenu.options.push({
                    title: t,
                    callback: function(){
                        that.data = Object.assign({}, HttpRequest.getTemplate(t, HttpRequest.Imported_Templates));
                        that.onInspect(inspector);
                    }
                });
            }

            if(options[3].submenu.options.length){
                options[3].submenu.options.push(null, {
                    title: "Clear all",
                    callback: function(){
                        HttpRequest.Imported_Templates = {};
                        that.onInspect(inspector);
                    }
                });
            }

            for(let t in HttpRequest.RAO_Templates) {
                options[4].submenu.options.push({
                    title: t,
                    callback: function(){
                        that.data = Object.assign({}, HttpRequest.getTemplate(t));
                        that.onInspect(inspector);
                    }
                });
            }

            new LiteGraph.ContextMenu(options, {event: e});

        }});
        inspector.addSeparator();
    }

    // Show data
    {
        this.onInspectObject(inspector, this.data);
    }
    
}

HttpRequest.prototype.onInspectObject = function(inspector, o)
{
    var that = this;

    for(let key in o) {

        var value = o[key];
        var func = this.onInspectProperty(o, inspector, key, value);

        if(func){
            if(value.constructor == Array){
                inspector.widgets_per_row = 2;
                var domEl = func(null, value, {callback: function(v){
                    o[key] = v;
                    that.onInspect(inspector);
                }});
                inspector.addSeparator();
                inspector.widgets_per_row = 1;
            }
            else
            {
                inspector.widgets_per_row = 3;
                inspector.addString(null, key, {width: "35%", callback: function(v){
                    var prev_value = o[key];
                    delete o[key];
                    o[v] = prev_value;
                    that.onInspect(inspector);
                }});
                var domEl = func(null, value, {width: "55%", callback: function(v){
                    o[key] = v;
                    that.onInspect(inspector);
                }});
                inspector.addButton(null, "<img src='https://webglstudio.org/latest/imgs/mini-icon-trash.png'>", {width: "10%", micro: true, callback: function(){
                    delete o[key];
                    that.onInspect(inspector);
                }});
                inspector.widgets_per_row = 1;
            }
    
        }
    }
}

HttpRequest.prototype.onInspectProperty = function(object, inspector, key, value, is_array_member)
{
    if(!value)
    return;

    var that = this;
    switch(value.constructor)
    {
        case String:
            func = inspector.addString.bind(inspector);
            break;
        case Number:
            func = inspector.addNumber.bind(inspector);
            break;
        case Boolean:
            func = inspector.addCheckbox.bind(inspector);
            break;
        case Object:
            if(!is_array_member){
                var objectTitle = inspector.addTitle(key);
                objectTitle.addEventListener("contextmenu", function(e){

                    e.preventDefault();
        
                    new LiteGraph.ContextMenu( [
                        {title: key, disabled: true}, null,
                        {title: "Add key", callback: function(){
                            value["new_key"] = "";
                            that.onInspect(inspector);
                        }}, null,
                        {title: "Remove", callback: function(){
                            delete object[key];
                            that.onInspect(inspector);
                        }}
                    ], { event: e});
                });
            }
            this.onInspectObject(inspector, value);
            return null;
            break;
        case Array:
            var arrayTitle = inspector.addTitle(key);

            arrayTitle.addEventListener("contextmenu", function(e){

                e.preventDefault();
    
                new LiteGraph.ContextMenu( [
                    {title: key, disabled: true}, null,
                    {title: "Add item", callback: function(){
                        value.push(value[0]);
                        that.onInspect(inspector);
                    }},
                    {title: "Add key", callback: function(){
                        for(var i = 0; i < value.length; ++i){
                           value[i]["new_key"] = "";
                        }
                        that.onInspect(inspector);
                    }}, null,
                    {title: "Remove", callback: function(){
                        delete object[key];
                        that.onInspect(inspector);
                    }}
                ], { event: e});
            });
            var arr = [];
            /*for(var i = 0; i < value.length; ++i){
                //if(i != 0)
                  
                if(value[i].constructor == Array)
                    continue;
                //func = this.onInspectProperty(object, inspector, key, value[i], true);
               // this.onInspectObject(inspector, {[i] :value[i]});
                inspector.addSeparator();
               
            }*/
            func = inspector.addArray.bind(inspector);
            
            //return null;
            //return f;
         
            break;
    }

    return func;
}

HttpResponse.prototype.onInspect = function(inspector)
{
    var that = this;
  
    inspector.clear();
  
    inspector.addSection("Http Response");
    inspector.addTitle("Extract data");

    // Show data
    {
        this.onInspectObject(inspector, this.data);
    }

    // Load template 
    inspector.addSeparator();
    inspector.widgets_per_row = 1;
    var templateBtn = inspector.addButton(null, "From template", {callback: function(value, e){

        e.preventDefault();

        var options = [
            {title: "Templates", disabled: true}, null, {
                title: "New",
                callback: function(){
                    CORE.Interface.openTemplateLoader(function(name, data){
                        HttpResponse.Imported_Templates["/" + name] = data;
                    });
                }
            },
            {
                title: "Saved",
                submenu: {
                    options: []
                }
            },
            {
                title: "Default RAO",
                submenu: {
                    options: []
                }
            }
        ];

        for(let t in HttpResponse.Imported_Templates) {
            options[3].submenu.options.push({
                title: t,
                callback: function(){
                    that.data = Object.assign({}, HttpResponse.getTemplate(t, HttpResponse.Imported_Templates));
                    that.onInspect(inspector);
                }
            });
        }

        if(options[3].submenu.options.length){
            options[3].submenu.options.push(null, {
                title: "Clear all",
                callback: function(){
                    HttpResponse.Imported_Templates = {};
                    that.onInspect(inspector);
                }
            });
        }

        for(let t in HttpResponse.RAO_Templates) {
            options[4].submenu.options.push({
                title: t,
                callback: function(){
                    that.data = Object.assign({}, HttpResponse.getTemplate(t));
                    that.onInspect(inspector);
                }
            });
        }

        new LiteGraph.ContextMenu(options, {event: e});

    }});
}

HttpResponse.prototype.onInspectObject = HttpRequest.prototype.onInspectObject;
HttpResponse.prototype.onInspectProperty = HttpRequest.prototype.onInspectProperty;

//TODO ParseEvent not updated to new events!
/*
ParseEvent.prototype.onInspect = function(  inspector ){
    component = this;
    inspector.clear();
    inspector.widgets_per_row = 1;
    var contexts = inspector.addSection("Contexts");
    //inspector.addTitle("Contexts");
    var inputContext = CORE.Interface.addInputTags("Input contexts", this.input_contexts, {placeholder: "Add input context...", callback: function(v){
        if(component.input_contexts.indexOf(v)>-1)
            return;
        component.input_contexts.push(v);
        if(corpus && corpus.data[v]){
            var utterances = corpus.data[v].utterances;

            for(var i in utterances){
            var aux=utterances[i];
            var tags = [];
            var idx = aux.indexOf("#");
            while(idx>=0){
                var count = 0;
                for(var j=idx; j<aux.length; j++){
                    count++;
                    if(aux[j]==" " || aux[j]=="." || aux[j]==","){
                        count--;
                        break;
                    }
                }
                var tag = aux.slice(idx,idx+count);
                tags.push(tag);
                aux = aux.replace(tag," ")
                idx = aux.indexOf("#");
            }

            component.processPhrase(utterances[i], tags, inspector)
            //  component.onInspect(inspector)
            //component.phrases.push(utterances[i])
            }
            component.onInspect(inspector);
        }
    }, callback_delete: function(v){
        var i = component.input_contexts.indexOf(v);
        component.input_contexts = component.input_contexts.splice(i);
    }});
    if(corpus){
        inputContext.addEventListener("keypress", autocomplete(inputContext.lastElementChild.lastElementChild,corpus.array, null, {callback: function(){
            var e = new Event("keydown");
            e.keyCode=13;
            var input = document.getElementById("input-tag")
            input.dispatchEvent(e)
        }}));
    }

    inspector.append(inputContext);
//      var outputContext = CORE.Interface.addInputTags("Output contexts", this.output_contexts, {placeholder: "Add output context...", callback: function(v){
//        component.output_contexts.push(v);
//    }, callback_delete: function(v){
//        var i = component.output_contexts.indexOf(v);
//        component.output_contexts = component.output_contexts.splice(i);
//    }});
//    inspector.append(outputContext
    var phrases_insp = inspector.addSection("Training phrases");
    //inspector.addTitle("Training phrases");
    inspector.widgets_per_row = 2;
    var training_phrases = component.phrases;
    var container = document.createElement("DIV");
    container.setAttribute("class", "responsive-content")

    for(var i in training_phrases){
        //HIGHLIGHT TAGS
        var div = document.createElement("DIV");
        div.className ="backdrop";
        div.style.width = "calc(100% - 48px)";
        var div_highlight = document.createElement("DIV");
        div_highlight.className ="highlights";
        div_highlight.innerHTML = component.visible_phrases[i];

        var input = document.createElement("TEXTAREA");//document.createElement("INPUT");
        input.setAttribute("class","inputfield textarea")
        input.style.width = "100%";
        input.value = training_phrases[i].text;
        input.setAttribute("readonly", true)
        new ResizeObserver(function(v){
            var that = this;
            that.style.width = input.clientWidth;
            that.style.height = input.innterHeight;
        }.bind(div_highlight)).observe(input);


        input.addEventListener("change", function(v){
            var id = this.toString();
            component.phrases[id].text = v;
        }.bind(i));
        div.appendChild(div_highlight);
        div.appendChild(input);
        container.appendChild(div);
        
        var btn = new LiteGUI.Button('<img src="https://webglstudio.org/latest/imgs/mini-icon-trash.png">' ,{width:40,  callback: function(v){
                var id = this.toString();
                if(id > -1) {
                    component.phrases.splice(id, 1);
                }
                component.onInspect(inspector);
            }.bind(i)})
        btn.root.className+= " btn-custom";
        container.appendChild(btn.root)
    }
    inspector.append(container);
    inspector.widgets_per_row = 1;
    inspector.addSeparator();
    inspector.addTitle("New phrase");

    inspector.widgets_per_row = 2;
    var newPhrase = "";
    var tags = [];

    var phrase = document.createElement("TEXTAREA");//document.createElement("INPUT");
    phrase.setAttribute("className","inputfield textarea")
    phrase.setAttribute("placeholder", "New training phrase...")
    phrase.style.width = "calc(100% - 40px)";
    newPhrase = phrase.value;
    //input.id ="input"

    //(phrase, EntitiesManager.getEntities())
    //phrase.addEventListener("keypress", autocomplete.bind(phrase, EntitiesManager.getEntities(), null))
    phrase.addEventListener("keypress", function(e){
//        if(e.key=="Alt"||e.key=="AltGraph" || e.key=="Control"|| e.key=="CapsLock" || e.key=="Backspace")
//          return;
        newPhrase =   phrase.value;
        if(e.key == "#"){
            autocomplete(phrase, EntitiesManager.getEntities(), tags, {})
            //displayEntity(i, phrase, e, tags)
            newPhrase = e.target.value;
        }
    }.bind(this));
    inspector.append(phrase);

    inspector.addButton(null,"+", {width:40,callback: component.processPhrase.bind(this, phrase,tags, inspector)});
}

ParseEvent.prototype.processPhrase = function(phraseElement, tags, inspector){
    newPhrase = (phraseElement.value!=undefined)? phraseElement.value:phraseElement  // phraseElement.value!=undefined? phraseElement.value : phraseElement.getValue();
    var currentPhrase = newPhrase;
    var toCompare = newPhrase;
    //component.phrases.push(newPhrase);

    for(var i=0; i<tags.length; i++){
        var start = currentPhrase.indexOf(tags[i]);
        var end = tags[i].length;
        //currentPhrase = currentPhrase.slice(0,start)+'<span>'+currentPhrase.slice(start,start+end)+'</span> '+currentPhrase.slice(start+end);
        currentPhrase = currentPhrase.slice(0,start)+'<mark>'+currentPhrase.slice(start,start+end)+'</mark>'+currentPhrase.slice(start+end);
        toCompare = toCompare.replace(tags[i], "(\\w+)");
    }
    component.visible_phrases.push(currentPhrase);
    component.phrases.push({text: newPhrase, tags: tags, toCompare: toCompare});
    component.onInspect(inspector);
}
*/
