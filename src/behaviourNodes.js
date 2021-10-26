/** BEHAVIOUR NODES:
 * It contains the definition/redefinition of nodes and its execution used in the Behaviour Planner
 */

//-----------------------FLOW NODES------------------------------------//
//Control flow of HBTGraph

/**
 * ParseCompare
 * This node compares the user text from the path with its phrases. If there is a match it continues execution to the child nodes.
 */
 function ParseCompare(){
    this.shape = 2;
    var w = 150;
    var h =45;

    this.color="#64a003";
    this.background = "#85d603";

    this.input_contexts = [];
    this.output_contexts = [];
    this.visible_phrases = [];
    this.phrases =  [];

    this.addInput("","path", { pos:[w*0.5, - LiteGraph.NODE_TITLE_HEIGHT], dir:LiteGraph.UP});
    this.addOutput("","path", { pos:[w*0.5, h] , dir:LiteGraph.DOWN});

    this.widgets_up = true;
    this.size = [w,h];
    this.behaviour = new Behaviour();

    this.tags_outputs = {};
}

//mapping must has the form [vocabulary array, mapped word]
ParseCompare.prototype.onConfigure = function(o){
    if(o.phrases)
        this.phrases = o.phrases;
    if(o.visible_phrases)
        this.visible_phrases = o.visible_phrases;
    if(o.input_contexts)
        this.input_contexts = o.input_contexts;
    if(o.output_contexts)
        this.output_contexts = o.output_contexts;
}

ParseCompare.prototype.onSerialize = function(o){
    if(this.phrases)
        o.phrases = this.phrases;
    if(this.visible_phrases)
        o.visible_phrases = this.visible_phrases;
    if(this.input_contexts)
        o.input_contexts = this.input_contexts;
    if(this.output_contexts)
        o.output_contexts = this.output_contexts;
}

ParseCompare.prototype.tick = function(agent, dt, info){
    var text = "";

    for(var i in this.inputs){
        if(this.inputs[i].name == "text")
        text = this.getInputData(i);
    }
    if((!text || text == "") && info && info.text)
        text = info.text
    var training_phrases = this.phrases;
    text = text.toString();

    var found = this.compare(text, training_phrases);
    if(!found){
		//some of its children of the branch is still on execution, we break that execution (se weh we enter again, it starts form the beginning)
        if(this.running_node_in_banch)
        agent.bt_info.running_node_index = null;

        this.behaviour.STATUS = STATUS.fail;
        return this.behaviour;
	}
	else{
        var values = this.extractEntities(text, found.tags);
        if(values){
            //Set tag outputs if any
            for(var o in this.outputs){
                var output = this.outputs[o];
                if(output.type == "string" && values[output.name]){
                this.setOutputData(o, values[output.name]);
                }
            }
            this.graph.context.blackboard.apply({entities:values})
            if(info){
                if(!info.tags)
                    info.tags = {};
                for(var i in values){
                    info.tags[i] = values[i];
                }
            }
            else
                info = {tags: values, text: info.text}
            
            //this.description = this.properties.property_to_compare + ' property passes the threshold';
            var children = this.getOutputNodes(0);
            //Just in case the conditional is used inside a sequencer to accomplish several conditions at the same time
            if(children.length == 0){
                this.behaviour.type = B_TYPE.parseCompare;
                this.behaviour.STATUS = STATUS.success;
                return this.behaviour;
            }

            for(let n in children){
                var child = children[n];
                var value = child.tick(agent, dt, info);
                if(value && value.STATUS == STATUS.success){
                    agent.evaluation_trace.push(this.id);
                    /* MEDUSA Editor stuff, not part of the core */
                    if(agent.is_selected)
                        highlightLink(this, child);

                    return value;
                }
                else if(value && value.STATUS == STATUS.running){
                    agent.evaluation_trace.push(this.id);
                    /* MEDUSA Editor stuff, not part of the core */
                    if(agent.is_selected)
                        highlightLink(this, child)

                    return value;
                }
            }
        }
        var idx = this.outputs.indexOf(["text","string"]);
        if(idx>-1)
            this.setOutputData(idx,text)
        if(this.running_node_in_banch)
            agent.bt_info.running_node_index = null;

        this.behaviour.STATUS = STATUS.fail;
        return this.behaviour;
	}
    //this.setOutputData(0, values);
}

ParseCompare.prototype.compare = function (inputString, vocabulary){
    
    var data = {tags:[]};
    for (var i in vocabulary){
        var found = false;
        var currentVocab = vocabulary[i]
        var currentText = currentVocab.text;
        found = new RegExp(currentVocab.toCompare.toLowerCase()).test(inputString.toLowerCase());

        if (found){
            if(currentVocab.tags.length)
                for(var t=0; t<currentVocab.tags.length; t++)
                    data.tags.push(currentVocab.tags[t]);
            else return currentVocab;
        }
            //return currentVocab;
    }
    return data.tags.length? data : false;
}
ParseCompare.prototype.extractEntities = function(string, tags){
    var info = {};
    for(var j = 0; j<tags.length; j++){
        var tag = tags[j];
        var value = EntitiesManager.getEntity(string, tag);
        if(!value)
            continue;
        info[tag] = value;
    }
    return info;
}



function wordInString(s, word){
    return new RegExp( '\\b' + word + '\\b', 'i').test(s);
}

ParseCompare.prototype.onGetInputs = function(){
    return [["text", "string", { pos: [0,this.size[1]*0.5], dir:LiteGraph.LEFT}]];
}

ParseCompare.prototype.onGetOutputs = function(){
    var outputs = [["text","string"]];
    for(var i in this.tags_outputs)
        outputs.push([i, this.tags_outputs[i]]);
    return outputs;
}

ParseCompare.prototype.onDeselected = function (){
	var parent = this.getInputNode(0);
	if(parent)
		parent.onDeselected();
}

ParseCompare.prototype.onShowNodePanel = function( event, pos, graphcanvas ){
    return true; //return true is the event was used by your node, to block other behaviours
}

LiteGraph.registerNodeType("btree/ParseCompare", ParseCompare );

//EventNode.TYPES Deprecated, only used for ParseEvent and probably it will not work due to changes on HBT event execution
EventNode.TYPES = ["userText", "imageRecieved","faceDetected", "infoRecieved"] //has to be sorted as EVENTS object idx
/*textRecieved: 0,
imageRecieved: 1,
faceDetected: 2,
codeRecieved: 3*/

/**
 * EventNode
 * Node that stops graph flow until a matching event is received
 * An event match if it contains class.property in its data (* means any)
 */
function EventNode(){
    this.shape = 1
    this.color = "#1E1E1E"
    this.boxcolor = "#999";
    this.addOutput("","path");
    this.properties = {};
    this.horizontal = true;
    this.widgets_up = true;
    this.addProperty("type", "user.text");

    this.widgetType = this.addWidget("string", "type", this.properties.type, function(v){this.properties.type = v;}.bind(this));

    this.addInput("", "path");
    this.behaviour = new Behaviour();
}

EventNode.prototype.onAdded = function(){
    this.title = "Event "+this.id;
    //this.widgetId = this.addWidget("info","id", this.properties.id, null, {editable:false});
}

/*EventNode.prototype.onDrawForeground = function(ctx)
{
  if(this.flags.collapsed)
    return;
  ctx.save();
  ctx.fillColor = "black";
  ctx.font = "12px Arial";
  ctx.fillText("Id: "+ this.id, 20, 50);
  ctx.restore();
}*/

//Does not get called
EventNode.prototype.onPropertyChanged = function(name, value){
    if(name == "type"){
        this.widgetType.value = this.properties.type = value;
    }
}

EventNode.prototype.tick = function(agent, dt, info){
    if(this.graph.context.last_event_node!=this.id){
        this.graph.context.last_event_node = this.id;
        return {STATUS : STATUS.success};
    }

	var children = this.getOutputNodes(0);
	for(var n in children) {

		var child = children[n];
		//if(child.constructor.name == "Subgraph")
		//child = child.subgraph.findNodeByTitle("HBTreeInput");
        
        if(this.data)
        {
            if(info){
            
                for(var i in this.data)
                {
                    info[i] = this.data[i];
                }
                
            }
            else if(this.data)
                info = Object.assign({},this.data);
        
            value = child.tick(agent, dt, info);
        }
        else
            var value = child.tick(agent, dt);

		if(value && (value.STATUS == STATUS.success || value.STATUS == STATUS.running)) {

			if(agent.is_selected)
				highlightLink(this, child)
			//push the node_id to the evaluation trace
			agent.evaluation_trace.push(this.id);

			//know if bt_info params must be reset
			//if the node was not in the previous
			// if(!nodePreviouslyEvaluated(agent, this.id))
			// 	resetHBTreeProperties(agent)

			return value;
		}
	}
    
    if(this.outputs)
    {
        for(var i = 0; i < this.outputs.length; i++)
        {
            if(this.outputs[i][0] == this.properties.type && this.data)
                this.setOutputData(i, this.data)
        }
    }

	// if(this.running_node_in_banch)
	// 	agent.bt_info.running_node_index = null;

	this.behaviour.STATUS = STATUS.fail;
	return this.behaviour;
}

EventNode.prototype.onConfigure = function(info){
  onConfig(info, this.graph);
  //["userText", "imageRecieved","faceDetected", "infoRecieved"]
  if(this.properties.type == "userText") this.properties.type = "user.text";
  this.widgetType.value = this.properties.type;
}

EventNode.title = "Event";
EventNode.desc = "Event node of the Hybrid Behaviour Tree";

//reorder the links
EventNode.prototype.onStart = EventNode.prototype.onDeselected = function(){
	var children = this.getOutputNodes(0);
	if(!children) return;
	children.sort(function(a,b){
		if(a.pos[0] > b.pos[0])
		  return 1;
		if(a.pos[0] < b.pos[0])
		  return -1;
	});

	this.outputs[0].links = [];
	for(var i in children)
		this.outputs[0].links.push(children[i].inputs[0].link);
}
EventNode.prototype.onGetOutputs = function()
{
    return [[this.properties.type,"*", {dir:LiteGraph.LEFT}]]
}
/*EventNode.prototype.onGetOutputs = function(){
    var outputs = [];
    for(var i in this.data)
    {
        outputs.push([i, typeof(this.data[i])]);
    }
    return outputs;
}*/

LiteGraph.registerNodeType("btree/Event", EventNode);

/**
 * ParseEvent
 * (Old) Event and ParseCompare in the same node
 * Event part not updated to new class.property event definition
 */
//TODO ParseEvent not updated to new events!
/*
function ParseEvent(){
    this.shape = 2
    this.color = "#1E1E1E"
    this.boxcolor = "#999";  // this.boxcolor = "#999";
    this.addOutput("","path");
    this.properties = {};
    this.horizontal = true;
    this.widgets_up = true;
    this.addProperty("type", EventNode.TYPES[0]);

    this.event_type = EVENTS.textRecieved;
    var that = this;
    this.widgetType = this.addWidget("combo","type", that.properties.type, function(v){that.properties.type = v},  {values: EventNode.TYPES});
    
    this.input_contexts = [];
    this.output_contexts = [];
    this.visible_phrases = [];
    this.phrases =  [];
    
    this.addInput("", "path");
    this.behaviour = new Behaviour();
}

ParseEvent.prototype.onConfigure = function(o){
    if(o.phrases)
        this.phrases = o.phrases;
    if(o.visible_phrases)
        this.visible_phrases = o.visible_phrases;
    if(o.input_contexts)
        this.input_contexts = o.input_contexts;
    if(o.output_contexts)
        this.output_contexts = o.output_contexts;
}

ParseEvent.prototype.onSerialize = function(o){
    if(this.phrases)
        o.phrases = this.phrases;
    if(this.visible_phrases)
        o.visible_phrases = this.visible_phrases;
    if(this.input_contexts)
        o.input_contexts = this.input_contexts;
    if(this.output_contexts)
        o.output_contexts = this.output_contexts;
}

ParseEvent.prototype.onAdded = function(){
    this.title = "ParseEvent "+this.id;
    //this.widgetId = this.addWidget("info","id", this.properties.id, null, {editable:false});
}

ParseEvent.prototype.onPropertyChanged = function(name, value){
    if(name == "type"){
      this.event_type = EventNode.TYPES.indexOf(value);
    }
}

ParseEvent.prototype.onStart = EventNode.prototype.onDeselected = function(){
	var children = this.getOutputNodes(0);
	if(!children) return;
	children.sort(function(a,b){
		if(a.pos[0] > b.pos[0])
		  return 1;

		if(a.pos[0] < b.pos[0])
		  return -1;

	});

	this.outputs[0].links = [];
	for(var i in children)
		this.outputs[0].links.push(children[i].inputs[0].link);
}

ParseEvent.prototype.tick = function(agent, dt){
    if(this.graph.context.last_event_node!=this.id){
        this.graph.context.last_event_node = this.id;
        return {STATUS : STATUS.success};
    }
    var text = "";
    for(var i in this.inputs){
        if(this.inputs[i].name == "text")
        text = this.getInputData(i);
    }

    if((!text || text == "") && this.data && this.data.text)
        text = this.data.text;
	var training_phrases = this.phrases;

    var found = this.compare(text, training_phrases);

    if(!found){
		//some of its children of the branch is still on execution, we break that execution (se weh we enter again, it starts form the beginning)
        if(this.running_node_in_banch)
        agent.bt_info.running_node_index = null;

        this.behaviour.STATUS = STATUS.fail;
        return this.behaviour;
	}
    else{
        var values = this.extractEntities(text, found.tags);
        if(values){
            var info = {tags: values}

            //this.description = this.properties.property_to_compare + ' property passes the threshold';
            var children = this.getOutputNodes(0);
            //Just in case the conditional is used inside a sequencer to accomplish several conditions at the same time
            if(children.length == 0){
                this.behaviour.type = B_TYPE.parseCompare;
                this.behaviour.STATUS = STATUS.success;
                return this.behaviour;
            }

            for(let n in children){
                var child = children[n];
                var value = child.tick(agent, dt, info);
                if(value && value.STATUS == STATUS.success){
                    agent.evaluation_trace.push(this.id);
                    //MEDUSA Editor stuff, not part of the core
                    if(agent.is_selected)
                        highlightLink(this, child);

                    return value;
                }
                else if(value && value.STATUS == STATUS.running){
                    agent.evaluation_trace.push(this.id);
                    //MEDUSA Editor stuff, not part of the core
                    if(agent.is_selected)
                        highlightLink(this, child)

                    return value;
                }
            }
        }

        if(this.running_node_in_banch)
            agent.bt_info.running_node_index = null;

        this.behaviour.STATUS = STATUS.fail;
        return this.behaviour;
	}
}

ParseEvent.prototype.compare = function (inputString, vocabulary){
    var found = false;
    for (var i in vocabulary) {
        var currentVocab = vocabulary[i]
        var currentText = currentVocab.text;
        found = new RegExp(currentVocab.toCompare.toLowerCase()).test(inputString.toLowerCase());
        
        if (found)
            return currentVocab;
    }
    return found;
}

ParseEvent.prototype.extractEntities = function(string, tags){
    var info = {};
    for(var j = 0; j<tags.length; j++){
        var tag = tags[j];
        var value = EntitiesManager.getEntity(string, tag);
        if(!value)
            return false;
        info[tag] = value;
    }
    return info;
}

ParseEvent.prototype.onGetInputs = function(){
    return [["text", "string", { pos: [0,this.size[1]*0.5], dir:LiteGraph.LEFT}]];
}

ParseEvent.prototype.onDeselected = function (){
	var parent = this.getInputNode(0);
	if(parent)
		parent.onDeselected();
}

ParseEvent.prototype.onShowNodePanel = function( event, pos, graphcanvas ){
    return true; //return true is the event was used by your node, to block other behaviours
}

LiteGraph.registerNodeType("btree/ParseEvent", ParseEvent);
*/

/**
 * TriggerNode
 * Sets next node to be called to the specified node id
 */
function TriggerNode(){
  this.shape = 1;
  this.color = "#1E1E1E"
  this.boxcolor = "#999";

  this.properties = {node_id:null};
  this.horizontal = true;
  this.widgets_up = true;

  this.addProperty("node_id", "");
  var that = this;
  this.widget = this.addWidget("string","node_id", this.properties.node_id, function(v){v = v.replace("Event ", ""); that.properties.node_id = v;});
  this.addInput("", "path");
  this.serialize_widgets = true;
  this.behaviour = new Behaviour();
}

TriggerNode.prototype.tick = function(agent, dt, info){
    if(this.graph._is_subgraph)
        this.graph._subgraph_node.graph.context.last_event_node = this.properties.node_id;
    else
        this.graph.context.last_event_node = this.properties.node_id;
    return {STATUS : STATUS.success};
}

TriggerNode.prototype.onConfigure = function(info){
    onConfig(info, this.graph);
}

LiteGraph.registerNodeType("btree/Trigger", TriggerNode);

/**
 * HBTreeInput
 * Input of a behaviour subgraph that passes the path into the graph
 */
 function HBTreeInput(){
    this.name_in_graph = "";
    this.properties    = {
        name: "root",
        type: "path",
        value: 0
    };
    this._node    = null;
    this.shape    = 2;
    this.color    = "#1E1E1E"
    this.boxcolor = "#999";
    this.addOutput("","path");
    this.horizontal = true;
    this.widgets_up = true;
	this.behaviour  = new Behaviour();
    this.serialize_widgets = true;
}

HBTreeInput.title = "HBTreeInput";
HBTreeInput.desc = "Input of a behaviour subgraph that passes the path into the graph";

HBTreeInput.prototype.onAdded = function(){
    if(this.graph){
        if(!this.graph._subgraph_node.inputs || this.graph._subgraph_node.inputs.length == 0){
            this.graph.addInput( this.properties.name, this.properties.type );
            this.graph.description_stack = [];
        }
    }
}

HBTreeInput.prototype.tick = function(agent, dt, info){

	var children = this.getOutputNodes(0);
	for(var n in children){
		var child = children[n];
		var value = child.tick(agent, dt, info);
		if(value && value.STATUS == STATUS.success){
			if(agent.is_selected)
				highlightLink(this,child)

			return value;
		}
		else if(value && value.STATUS == STATUS.running){
			this.running_node_in_banch = true;
			if(agent.is_selected)
				highlightLink(this,child)

			return value;
		}
	}
	this.behaviour.STATUS = STATUS.fail;
	return this.behaviour;
}

HBTreeInput.prototype.getTitle = function(){
    if (this.flags.collapsed)
        return this.properties.name;

    return this.title;
}

HBTreeInput.prototype.onAction = function( action, param ){
    if (this.properties.type == LiteGraph.EVENT)
        this.triggerSlot(0, param);
}

HBTreeInput.prototype.onExecute = function(){
    //read from global input
    var name = this.properties.name;
    var data = this.graph.inputs[name];
    if (!data)
    {
        this.setOutputData(0, this.properties.value );
        return;
    }

    this.setOutputData(0, data.value !== undefined ? data.value : this.properties.value );
}

HBTreeInput.prototype.onRemoved = function(){
    if (this.name_in_graph)
        this.graph.removeInput(this.name_in_graph);
}

HBTreeInput.prototype.onStart = HBTreeInput.prototype.onDeselected = function(){
	var children = this.getOutputNodes(0);
	if(!children) return;
	children.sort(function(a,b){
		if(a.pos[0] > b.pos[0])
			return 1;
		if(a.pos[0] < b.pos[0])
			return -1;
	});

	this.outputs[0].links = [];
	for(var i in children)
		this.outputs[0].links.push(children[i].inputs[0].link);

	var parent = this.getInputNode(0);
	if(parent)
		parent.onDeselected();
}

LiteGraph.HBTreeInput = HBTreeInput;
LiteGraph.registerNodeType("graph/HBTreeinput", HBTreeInput);

/**
 * HBTreeOutput
 * Output of a behaviour subgraph that passes the path into the parent graph
 */
function HBTreeOutput(){
    this.name_in_graph = "";
    this.properties    = {
        name: "root",
        type: "path",
        value: 0
    };
    var that      = this;
    this._node    = null;
    this.shape    = 2;
    this.color    = "#1E1E1E"
    this.boxcolor = "#999";
    this.addInput("","path");
    this.horizontal = true;
    this.widgets_up = true;
	this.behaviour  = new Behaviour();
    this.serialize_widgets = true;
}

HBTreeOutput.title = "HBTreeOutput";
HBTreeOutput.desc  = "Output of a behaviour subgraph that passes the path into the parent graph";

HBTreeOutput.prototype.onAdded = function(){
    if(this.graph){
        if( this.graph._subgraph_node.outputs == undefined || this.graph._subgraph_node.outputs.length == 0 ){
            this.graph.addOutput( this.properties.name, this.properties.type );
            this.graph.description_stack = [];
        }
    }
}

HBTreeOutput.prototype.tick = function( agent, dt ){
    if(this.graph && this.graph._subgraph_node){
        var children = this.graph._subgraph_node.getOutputNodes(0)
        // In case the subgraph is not connected in the output
        if(!children || children.length == 0){
            this.behaviour.STATUS = STATUS.fail;
            return this.behaviour;
        }

        for(var n in children){
            var child = children[n];
            var value = child.tick(agent, dt);
            if(value && value.STATUS == STATUS.success){
                if(agent.is_selected)
                    highlightLink(this,child)

                return value;
            }
            else if(value && value.STATUS == STATUS.running){
                this.running_node_in_banch = true;
                if(agent.is_selected)
                    highlightLink(this,child)

                return value;
            }
        }
    }
    else{
        this.behaviour.STATUS = STATUS.fail;
        return this.behaviour;
    }
	this.behaviour.STATUS = STATUS.fail;
	return this.behaviour;
}

HBTreeOutput.prototype.getTitle = function(){
    if (this.flags.collapsed)
        return this.properties.name;

    return this.title;
}

HBTreeOutput.prototype.onAction = function( action, param ){
    if (this.properties.type == LiteGraph.EVENT)
        this.triggerSlot(0, param);

}

HBTreeOutput.prototype.onExecute = function(){
    //read from global input
    var name = this.properties.name;
    var data = this.graph.inputs[name];
    if (!data){
        this.setOutputData(0, this.properties.value );
        return;
    }
    this.setOutputData(0, data.value !== undefined ? data.value : this.properties.value );
}

HBTreeOutput.prototype.onRemoved = function(){
    if (this.name_in_graph){
        this.graph.removeInput(this.name_in_graph);
    }
}

HBTreeOutput.prototype.onStart = HBTreeOutput.prototype.onDeselected = function(){
    if(this.graph && this.graph._subgraph_node){
        var children = this.graph._subgraph_node.getOutputNodes(0)

        if(!children) return;
        children.sort(function(a,b){
            if(a.pos[0] > b.pos[0])
                return 1;
            if(a.pos[0] < b.pos[0])
                return -1;
        });

        this.graph._subgraph_node.outputs[0].links = [];
        for(var i in children)
            this.graph._subgraph_node.outputs[0].links.push(children[i].inputs[0].link);

        var parent = this.getInputNode(0);
        if(parent)
            parent.onDeselected();
    }
}

LiteGraph.HBTreeOutput = HBTreeOutput;
LiteGraph.registerNodeType("graph/HBTreeOutput", HBTreeOutput);

//-----------------------BEHAVIOUR NODES------------------------------------//
//Return a Behaviour to be handled by the application

/**
 * Intent
 * This node returns a B_TYPE.intent Behaviour with BML formatted information
 */
 function Intent(o){
    var w = 150;
    var h = 45;

    this.color="#64a003";
    this.background = "#85d603";
    this.addInput("","path", {pos:[w*0.5,-LiteGraph.NODE_TITLE_HEIGHT], dir:LiteGraph.UP});


    this.responses = [];
    this.visible_phrases = [];
    this.input_contexts = [];

    this.widgets_up = true;

    //this.addOutput("","path", { pos: [w*0.5, h-LiteGraph.NODE_TITLE_HEIGHT], dir:LiteGraph.DOWN});
    this.size = [w,h];
    this.behaviour = new Behaviour();
    /*if(o)
      this.configure(o);*/
}

Intent.prototype.onConfigure = function(o){
    if(o.responses)
        this.responses = o.responses;

    if(o.visible_phrases)
        this.visible_phrases = o.visible_phrases;
}

Intent.prototype.onSerialize = function(o){
    if(this.responses)
        o.responses = this.responses;

    if(this.visible_phrases)
        o.visible_phrases = this.visible_phrases;
}

Intent.prototype.tick = function(agent, dt, info){
	if(this.facade == null)
		this.facade = this.graph.context.facade;

    if(this.responses.length){
        return this.intent(agent,info);
	}
}

Intent.prototype.intent = function(agent, info){
    var id = Math.floor(Math.random()*this.responses.length);
    var response = this.responses[id];
    var output = response.text || "";
    if(response.tags.length>0 && info && info.tags){
        for(var i in response.tags){
            var tag = response.tags[i];
            if(info.tags[tag])
               output = response.text.replace(tag, info.tags[tag]);
            else
                output = response.text.replace(tag, "");
        }
    }

    var behaviour = {
		text: output,
		text_id: id,
		data: this.responses[id],
		author: "DaVinci"
    };

    this.behaviour.type = B_TYPE.intent || 16;
	this.behaviour.STATUS = STATUS.success;
	this.behaviour.setData(behaviour);
	//this.behaviour.priority = this.properties.priority;
	agent.evaluation_trace.push(this.id);
	this.graph.evaluation_behaviours.push(this.behaviour);
	return this.behaviour;
}

Intent.prototype.onDeselected = function (){
	var parent = this.getInputNode(0);
	if(parent)
		parent.onDeselected();
}

LiteGraph.registerNodeType("btree/Intent", Intent );

//TODO Merge TimelineIntent from timeline_node.js here
/**
 * TimelineIntent
 * This node returns a B_TYPE.timeline_intent Behaviour with BML formatted information
 */
function TimelineIntent(o){
    var w = 150;
    var h =45;
    
    this.addInput("","path", { pos:[w*0.5, - LiteGraph.NODE_TITLE_HEIGHT], dir:LiteGraph.UP});
 
    this.properties = { precision: 1 };
    this.size = [w,h];
    this.shape = 2;
    this.horizontal = true;
    this.serialize_widgets = true;
    this.widgets_up = true;
 
    this.color= "#97A003";
    this.background = "#85d603";
 
    this.name = "Intent timeline";
 
    this.behaviour = new Behaviour();

    //timing
    this.mode = ANIM.PAUSED;
    this.current_time = 0;
    this.duration = 160;
    this.framerate = 30;
    this.type = ANIM.CANVAS2D;
    this.allow_seeking = true;
  
    //tracks: similar to layers
    this.tracks = []; //all tracks
    this.markers = []; //time markers
 
    if(!this.tracks.length){
        for(var i in ANIM.track_types){
            this.add(new ANIM.Track(i));
        }
    }

    TimelineIntent.instance = this;
}
 
//name to show
TimelineIntent.title = "Timeline Intent";
TimelineIntent.prototype.onConfigure = function(o){
    if(o.tracks){
        this.tracks = [];
        for(var i in o.tracks){
            var trackData = o.tracks[i];
            var track = new ANIM.Track(trackData.name);
            track.fromJSON(trackData);
            this.add(track);
        }
    }

    if(o.markers) this.markers = o.markers;
    this.duration = o.duration;
    this.current_time = o.current_time;
}

TimelineIntent.prototype.onSerialize = function(o){ 
    o.tracks = [];
    for(var i = 0; i < this.tracks.length; ++i) o.tracks.push(this.tracks[i].toJSON());
    o.markers = this.markers;
    o.duration = this.duration;
    o.current_time = this.current_time;
}

//function to call when the node is executed
TimelineIntent.prototype.tick = function(agent, dt, info){
    if(this.facade == null)
        this.facade = this.graph.context.facade;
    var behaviours = [];
    var bml = {};
    for(var i in this.tracks){
        var track = this.tracks[i];
        if(!bml[track.name]&&track.clips.length){
            bml[track.name] = [];
        }
        for(var j in track.clips){
            if(track.clips[j].constructor==ANIM.SpeechClip){
                if(track.clips[j].properties.inherited_text != undefined && track.clips[j].properties.inherited_text)
                {
                    track.clips[j].properties.text = info.text || "Check out the development";
                }
            }           
            var data = track.clips[j].toJSON();
            
            if(data.text)
            {               
                var tags = data.text.replace(/[.,\/!$%\^&\*;:{}=\-_`~()]/g,"").match(/#\S+/g);
                if(tags)
                {  
                    var values = {};
                    for(var x=0; x<tags.length; x++)
                    {
                        var tag = tags[i];
                        if(info && info.tags !=undefined&& info.tags[tag])
                        {   
                            values[tag] = info.tags[tag];
                        }
                        else
                        {
                            var value = this.graph.context.blackboard.getValue("entities",tag)
                            if(value)
                                values[tag] = value;
                        }
                        if(values[tag])
                            data.text = data.text.replace(tag, values[tag]);                             
                    }
                }
            }

            data.type = track.clips[j].constructor.type;
            bml[track.name].push(data);
        }
    }
    
    for(var i in bml){
        var data = {};
        if(i.includes("Shift")){
            data.type = i;
            data.data = bml[i]
        }else{
            data = bml[i];
        }
        var behaviour = new Behaviour();
        behaviour.type = B_TYPE.timeline_intent || B_TYPE.intent;
        behaviour.STATUS = STATUS.success;
        behaviour.setData(data);
        behaviours.push(behaviour);
        this.graph.evaluation_behaviours.push(behaviour);
    }
    agent.evaluation_trace.push(this.id);
 
    return {STATUS:STATUS.success, data:behaviours};
}

TimelineIntent.prototype.onDblClick = function(){
    ANIMED.project = this;
    ANIMED.project.name = name;
 
    ANIMED.clearUndo();
    ANIMED.setTime(this.current_time)
    ANIMED.showTimeline(true);
}

TimelineIntent.prototype.add = function(track){
    if(track.constructor !== ANIM.Track) throw("only tracks allowed to be added to project");
    this.tracks.push( track );
    track._project = this;
    return track;
}
 
TimelineIntent.prototype.getTrack = function(id){
    if(id.constructor === String){
        for(var i = 0; i < this.tracks.length; ++i )
            if( this.tracks[i].name == id ) return this.tracks[i];
        return null;
    }
    return this.tracks[ Number(id) ];
}
 
TimelineIntent.prototype.clear = function( skip_default_tracks ){
    this.current_time = 0;

    this.globals = {};
    this.tracks.length = 0;
    this.markers.length = 0;
}

TimelineIntent.prototype.showClipPanel = function(){
 
}

LiteGraph.registerNodeType("btree/TimelineIntent", TimelineIntent);

/**
 * FacialExpression
 * This node returns a B_TYPE.facialExpression Behaviour with BML formatted gesture information
 * Deprecated, use Intent/TimelineIntent instead
 */
FacialExpression.DURATION = ["Short-term", "Long-term"];
FacialExpression.PRIORITY = ["append","overwrite", "mix", "skip"];

function FacialExpression(){
    this.shape = 2;
	this.color = "#342331"
    this.bgcolor = "#523456";
	this.boxcolor = "#999";
	var w = 200;
    this.addInput("","path", {pos:[w*0.5,-LiteGraph.NODE_TITLE_HEIGHT], dir:LiteGraph.UP});
    this.size = [160,55];
    this.editable = { property:"value", type:"number" };
  	this.widgets_up = true;
	//this.horizontal = true;

	this.gesture_list = ["Smile","Frown","Pout", "Pursed Lips", "Jaw Dropped", "Tongue Out", "Raise Eyebrow"];
	this.gesture_interface = ["smile_face","frown_face","pout_face", "pursed_lips", "jaw_dropped", "tongue_out", "raise_eyebrow"];

	this.addProperty("intensity", 0.5, "number", {min:0, max:1} );
	this.addProperty("priority", "append", "enum", {values: FacialExpression.PRIORITY});
	this.addProperty("gesture", this.gesture_list[0], "enum",{values: this.gesture_list});
	this.addProperty("duration", FacialExpression.DURATION[0], "enum", {values: FacialExpression.DURATION});
	this.addProperty("interface", this.gesture_interface[0], "enum", {values: this.gesture_interface});
	this.addProperty("keywords", "", "string");

  	var that = this;
    this.widget = this.addWidget("combo","gesture", this.properties.gesture, this.onGestureChanged.bind(this),  {values: this.gesture_list});
    //this.number = this.addWidget("number","motion", this.properties.motion, function(v){ that.properties.motion = v; }, this.properties  );
    //this.toggle = this.addWidget("toggle","Translation:", this.properties.translation_enabled, function(v){ console.log(v);that.properties.translation_enabled = v; }, this.properties  );
	this.duration = this.addWidget("combo","duration", this.properties.duration, function(v){ that.properties.duration = v; },  {values: FacialExpression.DURATION} );
	this.addWidget("string","keywords", this.properties.keywords, function(v){ that.properties.keywords = v}, this.properties)

	this.facade = null;
	this.behaviour = new Behaviour();
	this.serialize_widgets = true;
}

FacialExpression.title = "FacialExpression";

FacialExpression.prototype.onGestureChanged = function(v){
	var that = this;
	that.properties.gesture = v;
	var idx = that.gesture_list.findIndex(v);
	that.properties.gesture_interface = that.gesture_interface[idx];
}

FacialExpression.prototype.onDeselected = function(){
	var parent = this.getInputNode(0);
	if(parent)
		parent.onDeselected();
}

FacialExpression.prototype.tick = function(agent, dt){
	if(this.facade == null)
		this.facade = this.graph.context.facade;

	if(this.action){
		this.description = 'Facial expresison: ' + this.properties.gesture;
		this.action(agent);
	}
	this.graph.evaluation_behaviours.push(this.behaviour);
	return this.behaviour;
}

FacialExpression.prototype.action = function(){
	var behaviour = this.properties;
	this.behaviour.type = B_TYPE.facialExpression;
	this.behaviour.setData(behaviour);
}

FacialExpression.prototype.onExecute = function(){
	if(this.inputs.length>1){
		for(var i in this.inputs){
			var input = this.inputs[i];
			var idx = this.findInputSlot(input.name);
			switch(input.name){
				case "intensity":
					var value = this.getInputData(idx);
					this.properties.intensity = value;
					break;
				case "duration":
					var value = this.getInputData(idx);
					value = value.toLowerCase();
					if(value == "short-term" || value == "long-term")
						this.properties.duration = value;
					break;
			}
		}
	}
}

FacialExpression.prototype.onGetInputs =  function(){
	//this.horizontal = false;
	return [["intensity", "number", {dir:LiteGraph.LEFT, pos: [0, this.size[1]]}], ["duration", "string", {dir:LiteGraph.LEFT,  pos: [0, this.size[1]]}]];
}

FacialExpression.prototype.onInputAdded = function(v){
	if(v.name == "intensity" || v.name == "duration"){
		//this.addInput(v.name, v.type, {dir:LiteGraph.LEFT});
		var y = this.size[1];

		v.pos[1] = y+(this.inputs.length-2)*20;
		this.size[1] = v.pos[1]+10;
	}

}

LiteGraph.FacialExpression = FacialExpression;
LiteGraph.registerNodeType("graph/FacialExpression", FacialExpression);

/**
 * GestureNode
 * This node returns a B_TYPE.gestureNode Behaviour with BML formatted gesture information
 * Deprecated, use Intent/TimelineIntent instead
 */
GestureNode.DURATION = ["Short-term", "Long-term"];
GestureNode.PRIORITY = ["append","overwrite", "mix", "skip"];

function GestureNode(){
    this.shape = 2;
	this.color = "#342331"
    this.bgcolor = "#523456";
	this.boxcolor = "#999";
	var w = 200;
    this.addInput("","path", {pos:[w*0.5,-LiteGraph.NODE_TITLE_HEIGHT], dir:LiteGraph.UP});
    this.size = [160,55];
    this.editable = { property:"value", type:"number" };
  	this.widgets_up = true;
	//this.horizontal = true;

	//this.gesture_list = ["Smile","Frown","Pout", "Pursed Lips", "Jaw Dropped", "Tongue Out", "Raise Eyebrow"];
	//this.gesture_interface = ["smile_face","frown_face","pout_face", "pursed_lips", "jaw_dropped", "tongue_out", "raise_eyebrow"];

	this.addProperty("intensity", 0.5, "number", {min:0, max:1} );
	this.addProperty("priority", "append", "enum", {values: GestureNode.PRIORITY});

	this.addProperty("duration", GestureNode.DURATION[0], "enum", {values: GestureNode.DURATION});
	this.addProperty("interface", "", "string");
	this.addProperty("keywords", "", "string");

	var that = this;
	this.addWidget("string", "interface", this.properties.interface, function(v){ that.properties.interface = v; })
    //this.widget = this.addWidget("combo","gesture", this.properties.gesture, this.onGestureChanged.bind(this),  {values: this.gesture_list});
    //this.number = this.addWidget("number","motion", this.properties.motion, function(v){ that.properties.motion = v; }, this.properties  );
    //this.toggle = this.addWidget("toggle","Translation:", this.properties.translation_enabled, function(v){ console.log(v);that.properties.translation_enabled = v; }, this.properties  );
	this.duration = this.addWidget("combo","duration", this.properties.duration, function(v){ that.properties.duration = v; },  {values: GestureNode.DURATION} );
	this.addWidget("string","keywords", this.properties.keywords, function(v){ that.properties.keywords = v}, this.properties)

	this.facade = null;
	this.behaviour = new Behaviour();
	this.serialize_widgets = true;
}

GestureNode.prototype.onGestureChanged = function(v){
	var that = this;
	that.properties.gesture = v;
	var idx = that.gesture_list.findIndex(v);
	that.properties.gesture_interface = that.gesture_interface[idx];
}

GestureNode.prototype.onDeselected = function(){
	var parent = this.getInputNode(0);
	if(parent)
		parent.onDeselected();
}

GestureNode.prototype.tick = function(agent, dt){
	if(this.facade == null)
		this.facade = this.graph.context.facade;

	if(this.action){
		this.description = 'Gesture Node: ' + this.title;
		this.action(agent);
	}
	this.graph.evaluation_behaviours.push(this.behaviour);
	return this.behaviour;
}

GestureNode.prototype.action = function(){
	var behaviour = this.properties;
	this.behaviour.type = B_TYPE.gestureNode;
	this.behaviour.setData(behaviour);
}

GestureNode.prototype.onExecute = function(){
	if(this.inputs.length>1){
		for(var i in this.inputs){
			var input = this.inputs[i];
			var idx = this.findInputSlot(input.name);
			switch(input.name){
				case "intensity":
					var value = this.getInputData(idx);
					this.properties.intensity = value;
					break;
				case "duration":
					var value = this.getInputData(idx);
					value = value.toLowerCase();
					if(value == "short-term" || value == "long-term")
						this.properties.duration = value;
                    break;
                case "gesture":
                    var value = this.getInputData(idx);
                    if(value){
                        value = value[0];
                        for(var j in this.properties){
                            if(value[j])
                                this.properties[j] = value[j];
                            if(value.properties && value.properties[j])
                                this.properties[j] = value.properties[j];
                        }
                        this.widgets[0].value = this.properties.interface;
                        this.widgets[1].value = this.properties.duration;
                        this.widgets[2].value = this.properties.keywords;
                    }
                    break;
                case "coords":
                    var value = this.getInputData(idx);
                    this.properties.controller = value;
                    break;
                case "speed":
                    var value = this.getInputData(idx);
                    this.properties.speed = value;
                    break;
			}
		}
	}
}

GestureNode.prototype.onGetInputs =  function(){
	//this.horizontal = false;
	return [["intensity", "number", {dir:LiteGraph.LEFT, pos: [0, this.size[1]]}], ["duration", "string", {dir:LiteGraph.LEFT,  pos: [0, this.size[1]]}], ["coords", "array", {dir:LiteGraph.LEFT, pos: [0, this.size[1]]}], ["array", "number", {dir:LiteGraph.LEFT, pos: [0, this.size[1]]}], ["gesture", "*", {dir:LiteGraph.LEFT, pos: [0, this.size[1]]}]];
}

GestureNode.prototype.onInputAdded = function(v){
	if(v.name == "intensity" || v.name == "duration" || v.name == "position" || v.name == "gesture"){
		//this.addInput(v.name, v.type, {dir:LiteGraph.LEFT});
		var y = this.size[1];
		v.pos[1] = y+(this.inputs.length-2)*20;
		this.size[1] = v.pos[1]+10;
	}

}

LiteGraph.GestureNode = GestureNode;
LiteGraph.registerNodeType("btree/GestureNode", GestureNode);

/**
 * GestureMap (Not fully implemented)
 * This node returns a B_TYPE.gestureNode Behaviour with BML formatted gesture information
 * Deprecated, use Intent/TimelineIntent instead
 */
function GestureMap(){
    this.shape = 2;
	this.color = "#342331"
    this.bgcolor = "#523456";
	this.boxcolor = "#999";
	var w = 200;
    //this.addInput("","path", {pos:[w*0.5,-LiteGraph.NODE_TITLE_HEIGHT], dir:LiteGraph.UP});
    this.size = [160,55];
    this.editable = { property:"value", type:"number" };
  	this.widgets_up = true;
	//this.horizontal = true;

	//this.gesture_list = ["Smile","Frown","Pout", "Pursed Lips", "Jaw Dropped", "Tongue Out", "Raise Eyebrow"];
	//this.gesture_interface = ["smile_face","frown_face","pout_face", "pursed_lips", "jaw_dropped", "tongue_out", "raise_eyebrow"];

	this.facade = null;

    this.serialize_widgets = true;
    this.addOutput("gestures", "array");
}

GestureMap.prototype.onExecute = function(){
	this.setOutputData(0, GestureManager.gestures);
}

LiteGraph.GestureMap = GestureMap;
LiteGraph.registerNodeType("btree/GestureMap", GestureMap);

/**
 * CustomRequest
 * Returns a B_TYPE.request with specified type and parameters
 */
function CustomRequest(){
    this.shape = 2;
    this.color = "#907300";
    this.bgcolor = '#796B31';
    this.boxcolor = "#999";
    var w = 210;
    var h = 55;

    this.addInput("","path",{pos: [w*0.5, -LiteGraph.NODE_TITLE_HEIGHT], dir: LiteGraph.UP});

    //Properties
    this.properties = {type: "", parameters: {}};

    var that = this;
    this._typeWidget = this.addWidget("text", "Type", this.properties.type, function(v){ that.properties.type = v; });

        this.size = [w, h];

    this._node = null;
        this._component = null;
        this.serialize_widgets = true;

    this.behaviour = new Behaviour();
}

//Update values from inputs, if any
CustomRequest.prototype.onExecute = function(){
    var parameters = this.properties.parameters;
    for(var i in this.inputs){
        var input = this.inputs[i];
        if(input.type != "path"){
            var value = this.getInputData(i);
            if(value !== undefined){
                if(value.constructor === Object) value = JSON.stringify(value);
                else if(value.constructor !== String) value = value.toString();
                parameters[input.name] = value;
            }
        }
    }
}

CustomRequest.prototype.tick = function(agent, dt, info){
    this.behaviour.type = B_TYPE.request;

    var parameters = Object.assign({}, this.properties.parameters); //Clone so changes on values if there is any tag doesn't change original one
    if(info){
        for(var p in parameters){
            var value = parameters[p];
            if(info.tags && value.constructor === String && value[0] == "#"){ //Try to match a tag from info
                if(info.tags[value]){
                    parameters[p] = info.tags[value];
                }
            }else if(info[p]!=undefined){
                parameters[p] = info[p];
            }
        }
    }
    

    this.behaviour.setData({type: this.properties.type, parameters: parameters});
    this.behaviour.STATUS = STATUS.success;
    this.graph.evaluation_behaviours.push(this.behaviour);
    return this.behaviour;
}

CustomRequest.prototype.onGetInputs = function(){
    var inputs = [];
    var parameters = this.properties.parameters;
    for(var p in parameters){
        var added = false;
        for(var i of this.inputs){
            if(i.name == p) added = true;
        }
        if(!added) inputs.push([p, "", {dir:LiteGraph.LEFT}]);
    }
    return inputs;
}

CustomRequest.prototype.addParameter = function(name, value){
    var parameters = this.properties.parameters;
    if(!name || name.constructor !== String) return false;
    if(parameters[name]) return false; //Name already used

    parameters[name] = value || "";
    return true;
}

LiteGraph.registerNodeType("events/CustomRequest", CustomRequest);

/**
 * HttpRequest
 * Returns a B_TYPE.http_request with specified type and parameters
 */
function HttpRequest() 
{
    this.shape = 2;
    this.color = "#2c3394";
    this.bgcolor = "#6969aa";
    this.boxcolor = "#999";
    var w = 210;
    var h = 80;

    //Properties
    this.properties = {
        "method": "GET", 
        "url": "",
        "dataType": "text",
        "mimeType": "",
        "async": true
    };

    this.headers = {
        "Cache-Control": "no-cache",
        "apikey": ""
    };

    this.data = {};

    var that = this;
    this.methods = [
        "GET",
        "HEAD",
        "POST",
        "PUT",
        "DELETE",
        "CONNECT",
        "OPTIONS",
        "TRACE",
        "PATCH",
    ];

    this.dataTypes = [
        "",
        "text",
        "json",
        "arraybuffer",
        "document",
        "blob",
        "ms-stream"
    ];

    this.size = [w,h];

    this.addInput("","path",{pos: [w*0.5, -LiteGraph.NODE_TITLE_HEIGHT], dir: LiteGraph.UP});
    this.addOutput("","path", { pos:[w*0.5, h] , dir:LiteGraph.DOWN});

    this._methodWidget = this.addWidget("combo", "Method", this.properties.method, function(v){ that.properties.method = v; }, { values: this.methods });
    this._dataTypeWidget = this.addWidget("combo", "Data type", this.properties.dataType, function(v){ that.properties.dataType = v; },  {values: this.dataTypes});
    
    this._node = null;
    this._component = null;
    this.serialize_widgets = true;
    this.widgets_up = true;

    this.behaviour = new Behaviour();
    this.behaviour.type = B_TYPE.http_request;
    this.behaviour.STATUS.fail;

    this.response = null;
}

HttpRequest.prototype.onConfigure = function(o)
{
    if(o.imported_templates)
        HttpRequest.Imported_Templates = o.imported_templates;

    this.headers = Object.assign({}, o.headers);
    this.properties = Object.assign({}, o.properties);
}

HttpRequest.prototype.onSerialize = function(o)
{
    if(this.headers)
        o.headers = this.headers;
    if(this.data)
        o.data = this.data;

    if(Object.keys(HttpRequest.Imported_Templates).length)
        o.imported_templates = HttpRequest.Imported_Templates;
}

//Update values from inputs, if any
HttpRequest.prototype.onExecute = function()
{
    for(var i in this.inputs){
        var input = this.inputs[i];
        // if(input.type == "path")
        // continue;
        
        var value = this.getInputData(i);

        if(!value)
        continue;

        if(value.constructor === Object) 
            value = JSON.stringify(value);
        else if(value.constructor !== String) 
            value = value.toString();
        this.properties[input.name] = value;
    }
}

HttpRequest.prototype.isTag = function(value)
{
    return value.constructor === String && value.length && value[0] == "#";
}

HttpRequest.prototype.tick = function(agent, dt, info)
{
    // info:
    // tags: {#PhoneNumber: "6456516516"}
    // text: "cosas y/o 645651655"
    
    // Clone so changes on values if there is any tag doesn't change original one
  /*  var body = Object.assign({}, this.data); 
    var bb = this.graph.context.blackboard;
    this.findPlaceholders(body, info, bb)
    /*for(var p in body) {
        var value = body[p];
        if(!this.isTag(body[p]) )
            continue;
        var found = false;
        if(info && info.tags) {
            // Try to match a tag from info
            if(info.tags[value]){ 
                body[p] = info.tags[value];
                found = true;
            }
            else if(info[p] != undefined){
                body[p] = info[p];
            }
        }
        var found = false;
        var bb = this.graph.context.blackboard;
        var keys = Object.keys(bb);
        for(var i in keys)
        {
            var key = keys[i];
            if(!bb[key])
                continue;
            var properties =  {};
            if(bb[key].properties)
                properties = Object.assign({},bb[key].properties);
            else
                properties = Object.assign({},bb[key]);
            this.findProperty(body, p, properties )
            
        }
        
    }*/

   

    if(!this.graph.context.isRunningNode(this))
    {
        var body = JSON.parse(JSON.stringify(this.data)); 
        var bb = this.graph.context.blackboard;
        this.findPlaceholders(body, info, bb)
        var requestParams = {
            "parameters": this.properties,
            "headers": this.headers,
            "data": body
        };
        this.send( Object.assign({}, requestParams), agent, dt);
    }
        
    if(this.response) {
        var b = this.response.behaviour;
        if(!b)
        {
            delete this.response;
            return;
        }
            
        // More than one behaviour
        if(b.data && b.data.constructor == Array){
            for(var _b of b.data){
                this.graph.evaluation_behaviours.push(_b);
            }
        }else{
            this.graph.evaluation_behaviours.push(b);
        }

        this.graph.context.removeRunningNode(this);
        delete this.response;
        return b;
    }else{
        return this.graph.context.addRunningNode(this);
    }
}
HttpRequest.prototype.findPlaceholders = function(body, info, blackboard) 
{
    for(var p in body) {
        var value = body[p];
        if(value.constructor == Object)
            this.findPlaceholders(body[p], info, blackboard);
        if(info && info.tags) {
            // Try to match a tag from info
            if(this.isTag(body[p])&& info.tags[value]){ 
                body[p] = info.tags[value];
                continue;
            }
            else if(info[p] != undefined){
                body[p] = info[p];
                continue;
            }
        }
       
        var keys = Object.keys(blackboard);
        for(var i in keys)
        {
            var key = keys[i];
            if(!blackboard[key])
                continue;
            var properties =  {};
            if(blackboard[key].properties)
                properties = Object.assign({},blackboard[key].properties);
            else
                properties = Object.assign({},blackboard[key]);
            this.findProperty(body, p, properties )
            
        }
        
    }

}
HttpRequest.prototype.findProperty = function(body, p, obj) 
{
    var value = body[p]
    for(var prop in obj)
    {    
        if(!obj[prop]) continue;
        if(obj[prop].constructor == Object)
        {
            var found = this.findProperty(body, p, obj[prop] )
           if(found) return true;
        }
        else if(this.isTag(value) && value == prop)
        {
            body[p] = obj[value];
            return true;
        }
       
    } 
    return false;  
}


HttpRequest.prototype.send = function(params, agent, dt) {

    var that = this;

    params.onload = function(request, parameters) {

        var response = {
            response: request.response, 
            behaviour: null
        };;

        var info = {tags: null, data: {
            req: request,
            params: parameters
        }};
        var children = that.getOutputNodes(0);

        //Just in case the conditional is used inside a sequencer to accomplish several conditions at the same time
        if(!children || children.length == 0){
            that.behaviour.type = B_TYPE.http_request;
            that.behaviour.STATUS = STATUS.success;
            that.response = Object.assign({}, response);
            return;
        }

        for(let n in children){
            var child = children[n];
            var value = child.tick(agent, dt, info);
            if(value && value.STATUS == STATUS.success){
                agent.evaluation_trace.push(that.id);
                /* MEDUSA Editor stuff, not part of the core */
                if(agent.is_selected)
                    highlightLink(that, child);

                that.response = Object.assign({}, response);
                that.response.behaviour = value;
                return;
            }
        }
               
        if(that.running_node_in_banch)
            agent.bt_info.running_node_index = null;

        that.behaviour.STATUS = STATUS.fail;
        that.response = Object.assign({}, response);
    }
    
    // Do http request here
    UTILS.request(params);
}

HttpRequest.prototype.onStart = HttpRequest.prototype.onDeselected = function()
{
	var children = this.getOutputNodes(0);
	if(!children) return;
	children.sort(function(a,b){
		if(a.pos[0] > b.pos[0])
		  return 1;
		if(a.pos[0] < b.pos[0])
		  return -1;
	});

	this.outputs[0].links = [];
	for(var i in children)
		this.outputs[0].links.push(children[i].inputs[0].link);
}

HttpRequest.prototype.onGetInputs = function()
{
    var inputs = [];

    for(var p in this.properties){
        var added = false;
        for(var i of this.inputs){
            if(i.name == p) added = true;
        }
        if(!added) inputs.push([p, "", {dir:LiteGraph.LEFT}]);
    }
    for(var p in this.data){
        for(var i of this.inputs){
            if(i.name == p) added = true;
        }
        if(!added) inputs.push([p, "", {dir:LiteGraph.LEFT}]);
    }
    return inputs;
}

HttpRequest.prototype.onGetOutputs = function()
{
    var node_outputs = ["response"];
    var outputs = [];

    for(var i = 0; i < node_outputs.length; ++i){
        var added = false;
        for(var output of this.outputs){
            if(output.name == node_outputs[i]) added = true;
        }
        if(!added) outputs.push([node_outputs[i], "", {dir:LiteGraph.LEFT}]);
    }

    return outputs;
}

HttpRequest.prototype.addProperty = function(name, value, is_header)
{
    if(!name || name.constructor !== String) return false;

    var container = is_header ? this.headers : this.properties;
    
    if(container[name]) return false; //Name already used

    container[name] = value || "";

    // process special cases
    this.propagate(name, container[name]);

    return true;
}

HttpRequest.prototype.propagate = function(name, value)
{
    var special_cases = ["#apikey"]//, "url"];

    if(special_cases.indexOf(name) < 0)
    return;

    var nodes = this.graph.findNodesByClass(HttpRequest);

    for(var i = 0; i < nodes.length; ++i) {
        nodes[i].properties[name] = value;
    }

    return true;
}

HttpRequest.getTemplate = function(name, template_list)
{
    template_list = template_list || HttpRequest.RAO_Templates;
    return JSON.parse(JSON.stringify(template_list[name]));
}

HttpRequest.Imported_Templates = {

};

HttpRequest.RAO_Templates = {

    "/aidocreader": {
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
        "options": "string"
    },
    "/facematching": {
        "api-version": "v1.0",
        "request-id": "AX0001",
        "images": [
            {
            "image-id": "0001",
            "description": "cid-42488231-front.jpg",
            "identity-id": "user01",
            "content": "iVBORw0KGgo...AANSUhEUgAA=="
            }
        ],
        "options": {
            "<option-name>": "True"
        }
    },
    "/sendotp": {
        "api-version": "v1.0",
        "request-id": "AX0001",
        "sms-text": "This is the One Time Password generated: #OTP",
        "mobile-number": "3933300112233"
    },
    "/sendsms": {
        "api-version": "v1.0",
        "request-id": "AX0001",
        "sms-text": "This is the message to the user mobile phone",
        "mobile-number": "#PhoneNumber"
    }
}

LiteGraph.registerNodeType("btree/HttpRequest", HttpRequest);

/**
 * HttpResponse
 * Compare the HTTPresponse code. If there is a match it continues execution to the child nodes.
 */
 HttpResponse.CODES = [200, 201, 400];

 function HttpResponse(){
    this.shape = 2;
    this.color = "#2c3394";
    this.bgcolor = "#6969aa";
    this.boxcolor = "#999";
    var w = 210;
    var h = 40;

    //Properties
    this.properties = {
        "code": 200
    };

    this.data = {};
    this.size = [w,h];

    this.addInput("","path", { pos:[w*0.5, - LiteGraph.NODE_TITLE_HEIGHT], dir:LiteGraph.UP});
    this.addOutput("","path", { pos:[w*0.5, h] , dir:LiteGraph.DOWN});

    this.widgets_up = true;
    
    var that = this;
    this._codeWidget = this.addWidget("combo", "Code", this.properties.code, function(v){ that.properties.code = v; },  {values: HttpResponse.CODES});
    
    this._node = null;
    this._component = null;
    this.serialize_widgets = true;
    this.widgets_up = true;

    this.behaviour = new Behaviour();
    this.behaviour.type = B_TYPE.http_response;
}

HttpResponse.prototype.onConfigure = function(o)
{
    if(o.imported_templates)
        HttpResponse.Imported_Templates = o.imported_templates;

    this.properties = Object.assign({}, o.properties);
}

HttpResponse.prototype.onSerialize = function(o)
{
    if(this.data)
        o.data = this.data;

    if(Object.keys(HttpResponse.Imported_Templates).length)
        o.imported_templates = HttpResponse.Imported_Templates;
}

HttpResponse.prototype.tick = function(agent, dt, info) {
   
    if(!info || !info.data) {
        this.behaviour.STATUS = STATUS.fail;
        return this.behaviour;
    }

    var response = this.parseResponse(info.data);
    response = this.extractData(response);
    
    console.log(response);    
    // ...
    if(response.status == this.properties.code){
        var info = {data: response.data}
        //this.description = this.properties.property_to_compare + ' property passes the threshold';
        if(this.outputs)
            {
                for(var o in this.outputs){
                    var output = this.outputs[o];
                    if(output.name == "")
                        continue;
                    if(output.dataPath){
                        var path = output.dataPath.join(".");
                        var dd = Object.byString(response.data, path)
                        if(dd!=undefined && dd[output.name]!=undefined){    
                            this.setOutputData(o, dd[output.name]);
                            continue;
                    }
                
                }
                    this.setOutputsFromObject(response.data, output,o)
                    
                }
            }
        var children = this.getOutputNodes(0);
        //Just in case the conditional is used inside a sequencer to accomplish several conditions at the same time
        if(children.length == 0){
            this.behaviour.type = B_TYPE.http_response;
            this.behaviour.STATUS = STATUS.success;
            return this.behaviour;
        }
        
        
        for(let n in children){
            var child = children[n];
            var value = child.tick(agent, dt, info);
            if(value && value.STATUS == STATUS.success){
                agent.evaluation_trace.push(this.id);
                /* MEDUSA Editor stuff, not part of the core */
                if(agent.is_selected)
                    highlightLink(this, child);

                
                return value;
            }
            else if(value && value.STATUS == STATUS.running){
                agent.evaluation_trace.push(this.id);
                /* MEDUSA Editor stuff, not part of the core */
                if(agent.is_selected)
                    highlightLink(this, child)

                return value;
            }
        }
    }
    if(this.running_node_in_banch)
            agent.bt_info.running_node_index = null;

    this.behaviour.STATUS = STATUS.fail;
    return this.behaviour;
    /*this.behaviour.STATUS = response ? STATUS.success : STATUS.fail;
    return this.behaviour;*/
}

HttpResponse.prototype.parseResponse = function (data) {
    
    if(!data.req || !data.params)
        return null;

    var xhr = data.req;
    var params = data.params;

    // Check control code
    if(xhr.status != this.properties["code"])
        return null;

    var response = xhr.response;

    function __validate() {

        if(params.dataType == "json") {
            try  {
                response = JSON.parse(response);
            }
            catch (err) {
                // throw err;
            }
        }
        else if(params.dataType == "xml") {
            try {
                var xmlparser = new DOMParser();
                response = xmlparser.parseFromString(response,"text/xml");
            }
            catch (err) {
                // throw err;
            }
        }
    }

    switch(xhr.status) {
        case 200:
            __validate();
            break;
        default:
            console.warn("HttpRequest Error", xhr);
            break;
    }

    return { status : xhr.status, data : response};
}

HttpResponse.prototype.extractData = function (response) {

    var res = response.data;

    function __evaluate(r, d){

        for(var k in r){
            if(!d[k])
                delete r[k];
            else{
                if(r[k].constructor == Object)
                    return __evaluate(r[k], d[k]);
                else
                    return r[k];
            }           
        }
    }
    if(this.data || this.data != {}){
        for(var k in res){
            if(!this.data[k])
                delete res[k];
            else{
                if(res[k].constructor == Object)
                    res[k] = __evaluate(res[k], this.data[k]);
            }
        }
    }

    response.data = res;
    return response;
}

HttpResponse.prototype.onDeselected = function () {
	var parent = this.getInputNode(0);
	if(parent)
		parent.onDeselected();
}

HttpResponse.prototype.onShowNodePanel = function( event, pos, graphcanvas ){
    return true; //return true is the event was used by your node, to block other behaviours
}

HttpResponse.getTemplate = HttpRequest.getTemplate;

HttpResponse.Imported_Templates = {

};

HttpResponse.RAO_Templates = {

    
}
HttpResponse.prototype.onGetOutputs = function(){
    var outputs = [];
    this.addOutputsFromObject(this.data, outputs, []) 
    return outputs;
}
HttpResponse.prototype.addOutputsFromObject = function(data, outputs, path) 
{
   
    for(var i in data)
    {
        if(data[i].constructor == Array || data[i].constructor == Object)
        {
            var p = [...path];
            p.push(i)
            this.addOutputsFromObject(data[i], outputs, p)      
        }
        else
        {
            outputs.push([i, typeof(data[i]), {"dataPath":path}]);
           
        }
        
    }
}
HttpResponse.prototype.setOutputsFromObject = function(data, output, o) 
{
    for(var i in data)
    {
        if(data[output.name]!=undefined)
        {
            this.setOutputData(o, data[output.name]);
            continue;
        }
        else if(data[i]!=undefined && (data[i].constructor == Array || data[i].constructor == Object))
            this.setOutputsFromObject(data[i], output, o)        
    }
}
LiteGraph.registerNodeType("btree/HttpResponse", HttpResponse );

//-----------------------MODIFIED FROM HBTREE.JS------------------------------------//
Selector.prototype.tick = function(agent, dt, info){
	//there is a task node in running state
	if(agent.bt_info.running_node_index != null && agent.bt_info.running_node_id == this.id){
		var children = this.getOutputNodes(0);
        var child = children[agent.bt_info.running_node_index];
        if(info)
            var value = child.tick(agent, dt, info);
        else
            var value = child.tick(agent, dt);

		if(value.STATUS == STATUS.running){
			agent.evaluation_trace.push(this.id);

			//Editor stuff [highlight trace]
			if(agent.is_selected)
				highlightLink(this, child);

			return value;
		}

		if(value.STATUS == STATUS.success){
			agent.evaluation_trace.push(this.id);

			//reinitialize running
			agent.bt_info.running_node_index = null;
			agent.bt_info.running_node_id = null;
			//Editor stuff [highlight trace]
			if(agent.is_selected)
				highlightLink(this, child);

			value.STATUS = STATUS.success;
			return value;
		}

		if(value.STATUS == STATUS.fail){
			agent.bt_info.running_node_index = null;
			return value;
		}
	}
	//No running state in child nodes
	else{
		//The output 0 is always the behaviour tree output
		var children = this.getOutputNodes(0);
		for(let n in children){
            var child = children[n];
            if(info)
                var value = child.tick(agent, dt, info);
            else
                var value = child.tick(agent, dt);

			if(value.STATUS == STATUS.running){
				agent.evaluation_trace.push(this.id);

				//first time receiving running state
				if((agent.bt_info.running_node_index == undefined || agent.bt_info.running_node_index == null ) || agent.bt_info.running_node_id == null){
					agent.bt_info.running_node_index = parseInt(n);
					agent.bt_info.running_node_id = this.id;
				}

				//running node directly in the next child level, need to know which index to run
				if(agent.bt_info.running_node_index != undefined && agent.bt_info.running_node_index != null && agent.bt_info.running_node_id == this.id){
					agent.bt_info.running_node_index = parseInt(n);
					agent.bt_info.running_node_id = this.id;
				}
				//Editor stuff [highlight trace]
				if(agent.is_selected)
					highlightLink(this, child);

				return value;
			}
			if(value.STATUS == STATUS.success){
				agent.evaluation_trace.push(this.id);

				//Editor stuff [highlight trace]
				if(agent.is_selected)
					highlightLink(this, child);

				return value;
			}
		}
		return value;
	}

}

Sequencer.prototype.tick = function(agent, dt, info){
	//check if this node was executed the previous evaluation
	if(!nodePreviouslyEvaluated(agent, this.id)){
		//clear this node, so it executes from the beginning
		agent.bt_info.running_data[this.id] = null;
	}

	/* means that there is some node on running state */
	if(agent.bt_info.running_data[this.id]){
		var children = this.getOutputNodes(0);
		for(var i = 0; i < children.length; i++){
			if(i != agent.bt_info.running_data[this.id]) continue;
			var child = children[agent.bt_info.running_data[this.id]];
            if(info)
                var value = child.tick(agent, dt, info);
            else
                var value = child.tick(agent, dt);
			if(value && value.STATUS == STATUS.running){
				agent.evaluation_trace.push(this.id);

				if(agent.is_selected)
					highlightLink(this, child);

				return value;
			}
			if(agent.bt_info.running_data[this.id] == children.length-1 && value && value.STATUS == STATUS.success){
				agent.bt_info.running_data[this.id] = null;
				// value.STATUS = STATUS.success;
				return value;
			}
            if( value && value.STATUS == STATUS.success ){
				agent.evaluation_trace.push(this.id);

				agent.bt_info.running_data[this.id] ++;
				if(agent.is_selected)
					highlightLink(this, child);

				value.STATUS = STATUS.success;
				continue;
			}
			//Value deber�a ser success, fail, o running
			if(value && value.STATUS == STATUS.fail){
				agent.bt_info.running_data[this.id] = null;
				return value;
			}
		}
	}
	else{
		var children = this.getOutputNodes(0);
		for(let n in children){
		    var child = children[n];
            if(info)
            var value = child.tick(agent, dt, info);
            else
            var value = child.tick(agent, dt);
			if(value && value.STATUS == STATUS.running){
				agent.evaluation_trace.push(this.id);
				agent.bt_info.running_data[this.id] = parseInt(n);

				if(agent.is_selected)
					highlightLink(this, child);

				return value;
			}
			if(value && value.STATUS == STATUS.success){
				agent.evaluation_trace.push(this.id);

				if(agent.is_selected)
					highlightLink(this, child);
			}
			if(n == children.length-1 && value && value.STATUS == STATUS.success && agent.bt_info.running_data[this.id] == null)
				return value;
			//Value deber�a ser success, fail, o running
			if(value && value.STATUS == STATUS.fail){
				if(this.running_node_in_banch)
					agent.bt_info.running_data[this.id] = null;

				return value;
			}
		}
	}
}

Parallel.prototype.tick = function(agent, dt, info){
	this.behaviour.STATUS = STATUS.fail;
	var children = this.getOutputNodes(0);
	for(let n in children){
		var child = children[n];
		var value = child.tick(agent, dt, info);

		if(value && (value.STATUS == STATUS.running || value.STATUS == STATUS.success)){
			agent.evaluation_trace.push(this.id);
			this.behaviour.STATUS = STATUS.success;
			//Editor stuff [highlight trace]
			if(agent.is_selected)
				highlightLink(this, child);

			if(n == children.length-1)
				return value;

			continue;
		}
		if(n == children.length-1 && this.behaviour.STATUS == STATUS.fail)
			return value;
	}
}
Conditional.prototype.tick = function(agent, dt, info )
{
    if(info&&info.tags)
    {
        for(var i in info.tags)
        {
            this.properties.limit_value = info.tags[i];
        }
    }
	//condition not passed
	if(this.evaluateCondition && !this.evaluateCondition())
	{
		//some of its children of the branch is still on execution, we break that execution (se weh we enter again, it starts form the beginning)
		// if(this.running_node_in_banch)
		// 	agent.bt_info.running_node_index = null;

		this.behaviour.STATUS = STATUS.fail;
		return this.behaviour;
	}
	else if(this.evaluateCondition && this.evaluateCondition())
	{               
		//this.description = this.properties.property_to_compare + ' property passes the threshold';
		var children = this.getOutputNodes(0);
		//Just in case the conditional is used inside a sequencer to accomplish several conditions at the same time
		if(children.length == 0){
			this.behaviour.type = B_TYPE.conditional;
			this.behaviour.STATUS = STATUS.success; 
			return this.behaviour;
		}
    
		for(let n in children)
		{
			var child = children[n];
			var value = child.tick(agent, dt);
			if(value && value.STATUS == STATUS.success)
			{
				agent.evaluation_trace.push(this.id);
				/* MEDUSA Editor stuff, not part of the core */
				if(agent.is_selected)
					highlightLink(this, child);

				return value;
			}
			else if(value && value.STATUS == STATUS.running)
			{
				agent.evaluation_trace.push(this.id);
				/* MEDUSA Editor stuff, not part of the core */
				if(agent.is_selected)
					highlightLink(this, child)

				return value;
			}
		}

		//if this is reached, means that has failed
		
		if(this.running_node_in_banch)
			agent.bt_info.running_node_index = null;

		this.behaviour.STATUS = STATUS.fail;
		return this.behaviour;
	}
}
//lack of type choice --> on progress
function SetProperty()
{
    this.shape = 2;
    this.color = "#2e542e"
    this.bgcolor = "#496b49";
    this.boxcolor = "#999";
    this.size = [200,80];
    this.addInput("","path", {pos:[200*0.5,-LiteGraph.NODE_TITLE_HEIGHT], dir:LiteGraph.UP});
    this.addInput("name","", {pos:[0,35], dir:LiteGraph.LEFT});
    this.addInput("root","", {pos:[0,55], dir:LiteGraph.LEFT});
    this.addProperty("priority", "append", "enum", {
        values: [
            "append",
            "overwrite",
            "mix",
            "skip"
        ]
    });
	this.addProperty("value", 1.0, "number");
	this.addProperty("property_to_compare", "", "string");
    this.addProperty("on", "execute", "enum", {values: ["tick", "execute"]})
    this.editable = { property:"value", type:"number" };
    this.widgets_up = true;
    this.horizontal = true;     
    var that = this;
    this.dynamic = null;
    this.widget_type = "number";
    this.target_type = "agent";
    this.dynamic = this.addWidget("string","name", "", function(v){ that.properties.property_to_compare = v; }, this.properties );
    this.dynamic = this.addWidget("string","value", 5, function(v){ that.properties.value = v; }, this.properties );
    this.tmp_data = {};
    this.facade = null;
    this.behaviour = new Behaviour();
    this.serialize_widgets = true;

}
SetProperty.prototype.onExecute = function()
{
	var data = this.getInputData(1);
	var root = this.getInputData(2);
    if(data)
        this.properties.property_to_compare = data;
	
	if(!this.graph.character_evaluated) return;
	/*if(this.graph.character_evaluated.properties[data])
	{	
		this.target_type = "agent";
	}
	else if(blackboard[data])
	{
		this.target_type = "global";
	}*/
	if(this.inputs.length==4)
	{
		var value = this.getInputData(3);
		this.properties.value = value;
		
	}
	this.target_type = root;
}
SetProperty.prototype.onGetInputs = function()
{
	this.size[1] +=30;
	return [["value", "",{dir:LiteGraph.LEFT, pos: [0, this.size[1]-30]}]];
}

SetProperty.prototype.tick = function(agent, dt)
{
    if(this.properties.on == "tick")
    {
        this.onExecute();
    }
	if(this.facade == null)
		this.facade = this.graph.context.facade;

	agent.evaluation_trace.push(this.id);
	// the property has to increment or decrement
	if(this.properties.value.constructor == Array && (this.properties.value[0] == "-" || this.properties.value[0] == "+"))
	{
		if(this.target_type == "agent")
		{
			var f_value = this.facade.getEntityPropertyValue(this.properties.property_to_compare, agent);
			f_value += parseFloat(this.properties.value);
			this.tmp_data = {type:"setProperty", name: this.properties.property_to_compare, value:f_value}
		}
		else
			this.tmp_data = {type:"setProperty", name: this.properties.property_to_compare, value:this.properties.value}
	}
	//just set the property to the value
	else{
		var final_value = this.properties.value;
		if(this.properties.value == "true" || this.properties.value == "false")
		{
			final_value = this.properties.value == "true" ? true : false;
		}
		else if(!isNaN(parseFloat(this.properties.value)))
			final_value = parseFloat(this.properties.value);


		if(this.target_type == "agent")
		{
			this.tmp_data = {type:"setProperty", name: this.properties.property_to_compare, value:final_value, type: this.target_type}
		}
		else
			this.tmp_data = {type:"setProperty", name: this.properties.property_to_compare, value:final_value, type: this.target_type}
	}

	this.behaviour.type = B_TYPE.setProperty;
	this.behaviour.setData(this.tmp_data);
	this.behaviour.STATUS = STATUS.success; 
	this.behaviour.priority = this.properties.priority; 
	this.graph.evaluation_behaviours.push(this.behaviour);
	return this.behaviour;
}

LiteGraph.registerNodeType("btree/SetProperty", SetProperty);
//-----------------------BASIC NODES------------------------------------//
/**
 * Property
 * Returns the value of the specified property
 */
//TODO standardize so it takes values from the same place, not hardcoded
function Property(){
    this.shape = 2;
    this.color = "#907300";
  	this.bgcolor = '#796B31';
    this.boxcolor = "#999";
  	var w = 210;
    var h = 55;
    this.addInput("value","");

    this.flags = {};
  	this.properties = {value:null, node_name: this.title, type:"float", property_type: this.property_type};
    this.data = {};
	this.size = [w, h];
	var that = this;

	this.property_type = "agent" ;

  	this._node = null;
	this._component = null;
	this.serialize_widgets = true;
}

Property.prototype.onExecute = function(){
	//Check if its Scene or Agent
	var value = this.getInputData(0);
	var entity;
	var property_type = this.property_type.split("/");
	switch(property_type[0]){
		case "agent":
			entity = currentHBTGraph.graph.character_evaluated;
		    break;
		case "user":
			entity = currentHBTGraph.graph.context.user;
		    break;
		case "gesture-property":
			entity = GestureManager.gestures[property_type[1]];
		    break;
	}

    currentHBTGraph.graph.context.facade.setEntityProperty(entity,this.title,value);
}

/* ADDED BY EVA */
Property.prototype.onSerialize = function(o){
	if(this.property_type){
		o.property_type = this.property_type;
	}
}

LiteGraph.registerNodeType("basic/property", Property);

function ToObjectData(){
	this.addInput("name", "string");
	this.addInput("value", "");
	this.addOutput("obj", "object");
}

ToObjectData.prototype.onExecute = function (){
	var name = this.getInputData(0);
	var value = this.getInputData(1);
	var obj = {};
	obj[name] = value;
	this.setOutputData(0, obj)
}

LiteGraph.registerNodeType("basic/to_object", ToObjectData);

function JSONstringify(){
	this.addInput("obj", "object");
	this.addOutput("string", "string");
}

JSONstringify.prototype.onExecute = function(){
	var obj = this.getInputData(0) || {};
	this.setOutputData(0, JSON.stringify(obj))
}

LiteGraph.registerNodeType("basic/to_json", JSONstringify);

function JSONparse(){
	this.addInput("string", "string");
	this.addOutput("obj", "object");
}

JSONparse.prototype.onExecute = function(){
    var str = this.getInputData(0) || "{}";
    var obj = JSON.parse(str);
    this.setOutputData(0, obj );
}

LiteGraph.registerNodeType("basic/json_parse", JSONparse);

HBTproperty.prototype.onNodeAdded = function(){
	this.properties.property_type = this.property_type;
	/*if(!this.graph.character_evaluated.hasOwnProperty(this.title))
	{
		if(this.graph.context.user.properties.hasOwnProperty(this.title))
			this.property_type ="user"
		else
			this.property_type = "global"
	}*/
}

//Change node to use blackboard instead of only using agent data and facade
HBTproperty.prototype.onExecute = function(){
    let type = this.properties.property_type;
    let name = this.properties.property_name;

    let value = this.graph.context.blackboard.getValue(type, name);
	
	this.setOutputData(0,value);
	this.setOutputData(1,name);
	this.setOutputData(2,type);
}


function NodeScript() {
    this.size = [60, 30];
    this.addProperty("onExecute", "return A;");
    this.addProperty("temp_code", "");
    this.addProperty("prefab_code_key", "custom");
    this.addProperty("prefab_code_value", "");
    this.addInput("A", "");
    this.addInput("B", "");
    this.addOutput("out", "");
    this.properties.sample_codes = {
        custom:"",
        string_to_date: `var today = new Date();
        var birthDate = new Date(A);
        var age = today.getFullYear() - birthDate.getFullYear();
        var m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;`, 
        count_vowels: `var m = A.match(/[aeiou]/gi);
        return m === null ? 0 : m.length;`

    }
    this._func = null;
    this.data = {};
}

NodeScript.prototype.onConfigure = function(o) {
    // debugger;
    if (o.properties.onExecute && LiteGraph.allow_scripts)
        this.compileCode(o.properties.onExecute);
    else
        console.warn("Script not compiled, LiteGraph.allow_scripts is false");
};

NodeScript.title = "ScriptNode";
NodeScript.desc = "executes a code (max 512 characters)";

NodeScript.widgets_info = {
    onExecute: { type: "code" }
};

NodeScript.prototype.onPropertyChanged = function(name, value) {
    if (name == "onExecute" && LiteGraph.allow_scripts)
        this.compileCode(value);
    else
        console.warn("Script not compiled, LiteGraph.allow_scripts is false");
};

NodeScript.prototype.compileCode = function(code) {
    this._func = null;
    if (code.length > 1024) {
        console.warn("Script too long, max 256 chars");
    } else {
        var code_low = code.toLowerCase();
        var forbidden_words = [
            "script",
            "body",
            "document",
            "eval",
            "nodescript",
            "function"
        ]; //bad security solution
        for (var i = 0; i < forbidden_words.length; ++i) {
            if (code_low.indexOf(forbidden_words[i]) != -1) {
                console.warn("invalid script");
                return;
            }
        }
        try {
            this._func = new Function("A", "B", "C", "DATA", "node", code);
            console.log("FUNCION ADDED");
        } catch (err) {
            console.error("Error parsing script");
            console.error(err);
        }
    }
};

NodeScript.prototype.onExecute = function() {
    if (!this._func) {
        return;
    }

    try {
        var A = this.getInputData(0);
        var B = this.getInputData(1);
        var C = this.getInputData(2);
        this.setOutputData(0, this._func(A, B, C, this.data, this));
    } catch (err) {
        console.error("Error in script");
        console.error(err);
    }
};

NodeScript.prototype.onGetOutputs = function() {
    return [["C", ""]];
};


LiteGraph.registerNodeType("basic/script", NodeScript);
