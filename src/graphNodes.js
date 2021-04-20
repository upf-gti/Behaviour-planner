

//Input for a subgraph
function HBTreeInput()
{
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
    this.addOutput("","path");
    this.horizontal = true;
    this.widgets_up = true;
	this.behaviour  = new Behaviour();
    this.serialize_widgets = true;
}

HBTreeInput.title = "HBTreeInput";
HBTreeInput.desc = "Input of the graph";

HBTreeInput.prototype.onAdded = function()
{
    if(this.graph)
    {
        if(!this.graph._subgraph_node.inputs || this.graph._subgraph_node.inputs.length == 0)
        {
            this.graph.addInput( this.properties.name, this.properties.type );
            this.graph.description_stack = [];
        }
    }
}

HBTreeInput.prototype.tick = function(agent, dt)
{
	var children = this.getOutputNodes(0);
	for(var n in children)
	{
		var child = children[n];
		var value = child.tick(agent, dt);
		if(value && value.STATUS == STATUS.success)
		{
			if(agent.is_selected)
				highlightLink(this,child)

			return value;
		}
		else if(value && value.STATUS == STATUS.running)
		{
			this.running_node_in_banch = true;
			if(agent.is_selected)
				highlightLink(this,child)

			return value;
		}
	}
	this.behaviour.STATUS = STATUS.fail;
	return this.behaviour;
}

HBTreeInput.prototype.getTitle = function()
{
    if (this.flags.collapsed)
        return this.properties.name;

    return this.title;
};

HBTreeInput.prototype.onAction = function( action, param )
{
    if (this.properties.type == LiteGraph.EVENT)
        this.triggerSlot(0, param);

};

HBTreeInput.prototype.onExecute = function() {
    //read from global input
    var name = this.properties.name;
    var data = this.graph.inputs[name];
    if (!data)
    {
        this.setOutputData(0, this.properties.value );
        return;
    }

    this.setOutputData(0, data.value !== undefined ? data.value : this.properties.value );
};

HBTreeInput.prototype.onRemoved = function()
{
    if (this.name_in_graph)
        this.graph.removeInput(this.name_in_graph);

};
HBTreeInput.prototype.onStart = HBTreeInput.prototype.onDeselected = function()
{
	var children = this.getOutputNodes(0);
	if(!children) return;
	children.sort(function(a,b)
	{
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

//Output for a subgraph
function HBTreeOutput()
{
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
HBTreeOutput.desc  = "Output of the graph";

HBTreeOutput.prototype.onAdded = function()
{
    if(this.graph)
    {
        if( this.graph._subgraph_node.outputs == undefined || this.graph._subgraph_node.outputs.length == 0 )
        {
            this.graph.addOutput( this.properties.name, this.properties.type );
            this.graph.description_stack = [];
        }
    }
}

HBTreeOutput.prototype.tick = function( agent, dt )
{
    if(this.graph && this.graph._subgraph_node)
    {
        var children = this.graph._subgraph_node.getOutputNodes(0)
        // In case the subgraph is not connected in the output
        if(!children || children.length == 0)
        {
            this.behaviour.STATUS = STATUS.fail;
            return this.behaviour;
        }

        for(var n in children)
        {
            var child = children[n];
            var value = child.tick(agent, dt);
            if(value && value.STATUS == STATUS.success)
            {
                if(agent.is_selected)
                    highlightLink(this,child)

                return value;
            }
            else if(value && value.STATUS == STATUS.running)
            {
                this.running_node_in_banch = true;
                if(agent.is_selected)
                    highlightLink(this,child)

                return value;
            }
        }
    }
    else
    {
        this.behaviour.STATUS = STATUS.fail;
        return this.behaviour;
    }
	this.behaviour.STATUS = STATUS.fail;
	return this.behaviour;
}

HBTreeOutput.prototype.getTitle = function() {
    if (this.flags.collapsed)
        return this.properties.name;

    return this.title;
};

HBTreeOutput.prototype.onAction = function( action, param )
{
    if (this.properties.type == LiteGraph.EVENT)
        this.triggerSlot(0, param);

};

HBTreeOutput.prototype.onExecute = function()
{
    //read from global input
    var name = this.properties.name;
    var data = this.graph.inputs[name];
    if (!data)
    {
        this.setOutputData(0, this.properties.value );
        return;
    }
    this.setOutputData(0, data.value !== undefined ? data.value : this.properties.value );
};

HBTreeOutput.prototype.onRemoved = function() {
    if (this.name_in_graph) {
        this.graph.removeInput(this.name_in_graph);
    }
};
HBTreeOutput.prototype.onStart = HBTreeOutput.prototype.onDeselected = function()
{
    if(this.graph && this.graph._subgraph_node)
    {
        var children = this.graph._subgraph_node.getOutputNodes(0)

        if(!children) return;
        children.sort(function(a,b)
        {
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

//-----------------------LITEGRAPH SUBGRAPH INPUT FOR HBT------------------------------------//
LiteGraph.Subgraph.prototype.onSubgraphNewInput = function(name, type) {
    var slot = this.findInputSlot(name);
    if (slot == -1) {
        /* ADDED FOR BEHAVIOUR TREES */
        //add input to the node
        var w = this.size[0];
        if(type=="path")
        	this.addInput("","path", {pos:[w*0.5,-LiteGraph.NODE_TITLE_HEIGHT], dir:LiteGraph.UP});
        /*---------------------------*/
        //add input to the node
        else
            this.addInput(name, type);
    }
};

LiteGraph.Subgraph.prototype.onSubgraphNewOutput = function(name, type) {
    var slot = this.findOutputSlot(name);
    if (slot == -1) {
        /* ADDED FOR BEHAVIOUR TREES */
        //add input to the node
        var w = this.size[0];
        var h = this.size[1];
        if(type=="path")
        	this.addOutput("","path", {pos:[w*0.5,h], dir:LiteGraph.DOWN});
        /*---------------------------*/
        //add input to the node
        else
            this.addOutput(name, type);
    }
};

LiteGraph.Subgraph.prototype.onDeselected = function()
{
    var output_node = this.subgraph.findNodeByTitle("HBTreeOutput");
    if(output_node) output_node.onDeselected();
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
/*-------------------------FACIAL EXPRESSION-------------------------------------------------------*/

FacialExpression.DURATION = ["Short-term", "Long-term"];
FacialExpression.PRIORITY = ["append","overwrite", "mix", "skip"];

function FacialExpression()
{
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
//  	this.number = this.addWidget("number","motion", this.properties.motion, function(v){ that.properties.motion = v; }, this.properties  );
//	this.toggle = this.addWidget("toggle","Translation:", this.properties.translation_enabled, function(v){ console.log(v);that.properties.translation_enabled = v; }, this.properties  );
	this.duration = this.addWidget("combo","duration", this.properties.duration, function(v){ that.properties.duration = v; },  {values: FacialExpression.DURATION} );
	this.addWidget("string","keywords", this.properties.keywords, function(v){ that.properties.keywords = v}, this.properties)

	this.facade = null;
	this.behaviour = new Behaviour();
	this.serialize_widgets = true;
}

FacialExpression.title = "FacialExpression";

FacialExpression.prototype.onGestureChanged = function(v)
{
	var that = this;
	that.properties.gesture = v;
	var idx = that.gesture_list.findIndex(v);
	that.properties.gesture_interface = that.gesture_interface[idx];
}

FacialExpression.prototype.onDeselected = function()
{
	var parent = this.getInputNode(0);
	if(parent)
		parent.onDeselected();
}
FacialExpression.prototype.tick = function(agent, dt)
{
	if(this.facade == null)
		this.facade = this.graph.context.facade;


	if(this.action)
	{
		this.description = 'Facial expresison: ' + this.properties.gesture;
		this.action(agent);
	}
	this.graph.evaluation_behaviours.push(this.behaviour);
	return this.behaviour;

}
FacialExpression.prototype.action = function()
{

	var behaviour = this.properties;
	this.behaviour.type = B_TYPE.facialExpression;
	this.behaviour.setData(behaviour);

}
FacialExpression.prototype.onExecute = function()
{
	if(this.inputs.length>1)
	{
		for(var i in this.inputs){
			var input = this.inputs[i];
			var idx = this.findInputSlot(input.name);
			switch(input.name)
			{
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
FacialExpression.prototype.onInputAdded = function(v)
{
	if(v.name == "intensity" || v.name == "duration")
	{
		//this.addInput(v.name, v.type, {dir:LiteGraph.LEFT});
		var y = this.size[1];

		v.pos[1] = y+(this.inputs.length-2)*20;
		this.size[1] = v.pos[1]+10;
	}

}

LiteGraph.FacialExpression = FacialExpression;
LiteGraph.registerNodeType("graph/FacialExpression", FacialExpression);
var B_TYPE =
{
	moveToLocation:0,
	lookAt:1,
	animateSimple:2,
	wait:3,
	nextTarget:4,
	setMotion:5,
	setProperty:6,
	succeeder:7,
	action:8,
	conditional:9,
	gestureNode:10,
	facialExpression:11,
  ParseCompare:15,
  intent: 16,
  request: 17,
  timeline_intent:18
}
GestureNode.DURATION = ["Short-term", "Long-term"];
GestureNode.PRIORITY = ["append","overwrite", "mix", "skip"];

function GestureNode()
{
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
   // this.widget = this.addWidget("combo","gesture", this.properties.gesture, this.onGestureChanged.bind(this),  {values: this.gesture_list});
//  	this.number = this.addWidget("number","motion", this.properties.motion, function(v){ that.properties.motion = v; }, this.properties  );
//	this.toggle = this.addWidget("toggle","Translation:", this.properties.translation_enabled, function(v){ console.log(v);that.properties.translation_enabled = v; }, this.properties  );
	this.duration = this.addWidget("combo","duration", this.properties.duration, function(v){ that.properties.duration = v; },  {values: GestureNode.DURATION} );
	this.addWidget("string","keywords", this.properties.keywords, function(v){ that.properties.keywords = v}, this.properties)

	this.facade = null;
	this.behaviour = new Behaviour();
	this.serialize_widgets = true;
}


GestureNode.prototype.onGestureChanged = function(v)
{
	var that = this;
	that.properties.gesture = v;
	var idx = that.gesture_list.findIndex(v);
	that.properties.gesture_interface = that.gesture_interface[idx];
}

GestureNode.prototype.onDeselected = function()
{
	var parent = this.getInputNode(0);
	if(parent)
		parent.onDeselected();
}
GestureNode.prototype.tick = function(agent, dt)
{
	if(this.facade == null)
		this.facade = this.graph.context.facade;


	if(this.action)
	{
		this.description = 'Gesture Node: ' + this.title;
		this.action(agent);
	}
	this.graph.evaluation_behaviours.push(this.behaviour);
	return this.behaviour;

}
GestureNode.prototype.action = function()
{

	var behaviour = this.properties;
	this.behaviour.type = B_TYPE.gestureNode;
	this.behaviour.setData(behaviour);

}
GestureNode.prototype.onExecute = function()
{
	if(this.inputs.length>1)
	{
		for(var i in this.inputs){
			var input = this.inputs[i];
			var idx = this.findInputSlot(input.name);
			switch(input.name)
			{
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
                    if(value)
                    {
                        value = value[0];
                        for(var j in this.properties)
                        {
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
GestureNode.prototype.onInputAdded = function(v)
{
	if(v.name == "intensity" || v.name == "duration" || v.name == "position" || v.name == "gesture")
	{
		//this.addInput(v.name, v.type, {dir:LiteGraph.LEFT});
		var y = this.size[1];

		v.pos[1] = y+(this.inputs.length-2)*20;
		this.size[1] = v.pos[1]+10;
	}

}
LiteGraph.GestureNode = GestureNode;
LiteGraph.registerNodeType("btree/GestureNode", GestureNode);

function GestureMap()
{
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

	var that = this;

	this.facade = null;

    this.serialize_widgets = true;
    this.addOutput("gestures", "array");
}
GestureMap.prototype.onExecute = function()
{
	this.setOutputData(0, GestureManager.gestures);
}
LiteGraph.GestureMap = GestureMap;
LiteGraph.registerNodeType("btree/GestureMap", GestureMap);

/*LGraphCanvas overwrite onShowNodePanel*/
LGraphCanvas.prototype.onShowNodePanel = function(n)
{
    if(n.onInspect)
    {
        var insp = CORE.Interface.graphinspector;
        n.onInspect(insp);
    }

}
function ParseCompare()
{
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
ParseCompare.prototype.onConfigure = function(o)
{
  if(o.phrases)
    this.phrases = o.phrases;
  if(o.visible_phrases)
    this.visible_phrases = o.visible_phrases;
  if(o.input_contexts)
    this.input_contexts = o.input_contexts;
  if(o.output_contexts)
    this.output_contexts = o.output_contexts;
}
ParseCompare.prototype.onSerialize = function(o)
{
  if(this.phrases)
    o.phrases = this.phrases;
  if(this.visible_phrases)
    o.visible_phrases = this.visible_phrases;
  if(this.input_contexts)
    o.input_contexts = this.input_contexts;
  if(this.output_contexts)
    o.output_contexts = this.output_contexts;
}
ParseCompare.prototype.tick = function(agent, dt, info)
{
  var text = "";

  for(var i in this.inputs)
  {
    if(this.inputs[i].name == "text")
      text = this.getInputData(i);
  }
  if((!text || text == "") && info && info.text)
    text = info.text
	var training_phrases = this.phrases;

  var found = this.compare(text, training_phrases);
  if(!found)
	{
		//some of its children of the branch is still on execution, we break that execution (se weh we enter again, it starts form the beginning)

    if(this.running_node_in_banch)
      agent.bt_info.running_node_index = null;

    this.behaviour.STATUS = STATUS.fail;
    return this.behaviour;


	}
	else
	{
    var values = this.extractEntities(text, found.tags);
    if(values)
    {
      //Set tag outputs if any
      for(var o in this.outputs){
        var output = this.outputs[o];
        if(output.type == "string" && values[output.name]){
          this.setOutputData(o, values[output.name]);
        }
      }


      var info = {tags: values}

  		//this.description = this.properties.property_to_compare + ' property passes the threshold';
  		var children = this.getOutputNodes(0);
  		//Just in case the conditional is used inside a sequencer to accomplish several conditions at the same time
  		if(children.length == 0){
  			this.behaviour.type = B_TYPE.parseCompare;
  			this.behaviour.STATUS = STATUS.success;
  			return this.behaviour;
  		}

  		for(let n in children)
  		{
  			var child = children[n];
  			var value = child.tick(agent, dt, info);
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
    }

    if(this.running_node_in_banch)
      agent.bt_info.running_node_index = null;

		this.behaviour.STATUS = STATUS.fail;
		return this.behaviour;
	}

  //this.setOutputData(0, values);
}
ParseCompare.prototype.compare = function (inputString, vocabulary) {
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
ParseCompare.prototype.extractEntities = function(string, tags)
{
    var info = {};
    for(var j = 0; j<tags.length; j++)
    {
        var tag = tags[j];
        var value = EntitiesManager.getEntity(string, tag);
        if(!value)
          return false;
        info[tag] = value;
    }
    return info;
}

function wordInString(s, word){
  return new RegExp( '\\b' + word + '\\b', 'i').test(s);
}
ParseCompare.prototype.onGetInputs = function()
{
  return [["text", "string", { pos: [0,this.size[1]*0.5], dir:LiteGraph.LEFT}]];
}
ParseCompare.prototype.onGetOutputs = function()
{
  var outputs = [];
  for(var i in this.tags_outputs)
    outputs.push([i, this.tags_outputs[i]]);
  return outputs;
}
ParseCompare.prototype.onInspect = function(  inspector )
{
    component = this;
    inspector.clear();
    inspector.widgets_per_row = 1;
    var contexts = inspector.addSection("Contexts");
    //inspector.addTitle("Contexts");
    var inputContext = CORE.Interface.addInputTags("Input contexts", this.input_contexts, {placeholder: "Add input context...", callback: function(v){
      if(component.input_contexts.indexOf(v)>-1)
        return;
      component.input_contexts.push(v);
      if(corpus && corpus.data[v])
      {
        var utterances = corpus.data[v].utterances;

        for(var i in utterances)
        {
          var aux=utterances[i];
          var tags = [];
          var idx = aux.indexOf("#");
          while(idx>=0)
          {
            var count = 0;
            for(var j=idx; j<aux.length; j++)
            {
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
    if(corpus)
    {
      inputContext.addEventListener("keypress", autocomplete(inputContext.lastElementChild.lastElementChild,corpus.array, null, {callback: function(){
        var e = new Event("keydown");
        e.keyCode=13;
        var input = document.getElementById("input-tag")
        input.dispatchEvent(e)
      }}))

    }

    inspector.append(inputContext)
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


    for(var i in training_phrases)
    {
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
      container.appendChild(div)
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
*/      var btn = new LiteGUI.Button('<img src="https://webglstudio.org/latest/imgs/mini-icon-trash.png">' ,{width:40,  callback: function(v){
            var id = this.toString();
            if(id > -1) {
              component.phrases.splice(id, 1);
            }
            component.onInspect(inspector)
        }.bind(i)})
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
        if(e.key == "#")
        {
          autocomplete(phrase, EntitiesManager.getEntities(), tags, {})
            //displayEntity(i, phrase, e, tags)
          newPhrase = e.target.value;

        }
    }.bind(this))
    inspector.append(phrase)

    inspector.addButton(null,"+", {width:40,callback: component.processPhrase.bind(this, phrase,tags, inspector)});


}
ParseCompare.prototype.processPhrase = function(phraseElement, tags, inspector)
{
    newPhrase = (phraseElement.value!=undefined)? phraseElement.value:phraseElement  // phraseElement.value!=undefined? phraseElement.value : phraseElement.getValue();
    var currentPhrase = newPhrase;
    var toCompare = newPhrase;
    //component.phrases.push(newPhrase);

    for(var i=0; i<tags.length; i++)
    {
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
ParseCompare.prototype.onDeselected = function ()
{
	var parent = this.getInputNode(0);
	if(parent)
		parent.onDeselected();
}
ParseCompare.prototype.onShowNodePanel = function( event, pos, graphcanvas )
{
    return true; //return true is the event was used by your node, to block other behaviours
}
LiteGraph.registerNodeType("btree/ParseCompare", ParseCompare );

function Intent(o)
{
    //this.timeline = new Timeline()

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
Intent.prototype.onConfigure = function(o)
{
  if(o.responses)
    this.responses = o.responses;
  if(o.visible_phrases)
    this.visible_phrases = o.visible_phrases;
}
Intent.prototype.onSerialize = function(o)
{
  if(this.responses)
    o.responses = this.responses;
  if(this.visible_phrases)
    o.visible_phrases = this.visible_phrases;
}
Intent.prototype.tick = function(agent, dt, info)
{
	if(this.facade == null)
		this.facade = this.graph.context.facade;

    if(this.responses.length)
    {

      return this.intent(agent,info);
	}
//   }
}
Intent.prototype.intent = function(agent, info)
{
    var id = Math.floor(Math.random()*this.responses.length);
    var response = this.responses[id];
    var output = response.text || "";
    if(response.tags.length>0 && info && info.tags)
    {
        for(var i in response.tags)
        {
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
	console.log(this.behaviour)
	agent.evaluation_trace.push(this.id);
	this.graph.evaluation_behaviours.push(this.behaviour);
	return this.behaviour;
}
Intent.prototype.onDeselected = function ()
{
	var parent = this.getInputNode(0);
	if(parent)
		parent.onDeselected();
}

Intent.prototype.onInspect = function(  inspector )
{
    component = this;
    inspector.clear();
    inspector.widgets_per_row = 1;

    var contexts = inspector.addSection("Contexts");
    //inspector.addTitle("Contexts");
    var inputContext = CORE.Interface.addInputTags("Input contexts", this.input_contexts, {placeholder: "Add input context...", callback: function(v){
      if(component.input_contexts.indexOf(v)>-1)
        return;
      component.input_contexts.push(v);
      if(corpus && corpus.data[v])
      {
        var answers = corpus.data[v].answers;

        for(var i in answers)
        {
          var aux = answers[i];
          var tags = [];
          var idx = aux.indexOf("#");
          while(idx>=0)
          {
            var count = 0;
            for(var j=idx; j<aux.length; j++)
            {
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

          component.processPhrase(answers[i], tags, inspector)
        //  component.onInspect(inspector)
          //component.phrases.push(utterances[i])
        }
        component.onInspect(inspector)
      }
    }, callback_delete: function(v){
        var i = component.input_contexts.indexOf(v);
        component.input_contexts = component.input_contexts.splice(i);
    }});
    if(corpus)
    {
      inputContext.addEventListener("keypress", autocomplete(inputContext.lastElementChild.lastElementChild,corpus.array, null, {callback: function(){
        var e = new Event("keydown");
        e.keyCode=13;
        var input = document.getElementById("input-tag")
        input.dispatchEvent(e)
      }}))

    }

    inspector.append(inputContext)
    var phrases_insp = inspector.addSection("Responses");
    //inspector.addTitle("Training phrases");
    inspector.widgets_per_row = 2;
    var responses = component.responses;
    var container = document.createElement("DIV");
    container.setAttribute("class", "responsive-content")


    for(var i in responses)
    {
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
      }.bind(div_highlight)).observe(input)


      input.addEventListener("change", function(v){
          var id = this.toString();
          component.phrases[id].text = v;
      }.bind(i))
      div.appendChild(div_highlight);
      div.appendChild(input);
      container.appendChild(div)
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
*/      var btn = new LiteGUI.Button('<img src="https://webglstudio.org/latest/imgs/mini-icon-trash.png">' ,{width:40,  callback: function(v){
            var id = this.toString();
            if(id > -1) {
              component.responses.splice(id, 1);
            }
            component.onInspect(inspector)
        }.bind(i)})
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
    inspector.addTitle("New response");

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
    phrase.setAttribute("placeholder", "New agent response...")
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
        if(e.key == "#")
        {
          autocomplete(phrase, EntitiesManager.getEntities(), tags, {})
            //displayEntity(i, phrase, e, tags)
          newPhrase = e.target.value;

        }
    }.bind(this))
    inspector.append(phrase)

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
Intent.prototype.processPhrase = function(phraseElement, tags, inspector)
{
    newPhrase = (phraseElement.value!=undefined)? phraseElement.value:phraseElement  // phraseElement.value!=undefined? phraseElement.value : phraseElement.getValue();
    var currentPhrase = newPhrase;

    //component.phrases.push(newPhrase);

    for(var i=0; i<tags.length; i++)
    {
        var start = currentPhrase.indexOf(tags[i]);
        var end = tags[i].length;
        //currentPhrase = currentPhrase.slice(0,start)+'<span>'+currentPhrase.slice(start,start+end)+'</span> '+currentPhrase.slice(start+end);
        currentPhrase = currentPhrase.slice(0,start)+'<mark>'+currentPhrase.slice(start,start+end)+'</mark>'+currentPhrase.slice(start+end);


    }
    component.visible_phrases.push(currentPhrase);
    component.responses.push({text: newPhrase, tags: tags});
    component.onInspect(inspector)
}
function displayEntity(id, inspector, e, tags) {
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
LiteGraph.registerNodeType("btree/Intent", Intent );

/*------------------------------- Timeline node ------------------------------- */
/*function TimelineNode()
{
  this.timeline = new Timeline()
}

TimelineNode.prototype.onInspect = function()
{
    var dialog = new LiteGUI.Dialog('Intent', { title:'Intent', close: true, minimize: false, width: 700, height: 200, scroll: false, resizable: false, draggable: true });
    var canvas = document.createElement("CANVAS");
    canvas.style.position = "absoulte"
    var ctx = canvas.getContext('2d');

    this.timeline.draw(ctx, {duration:7}, 0)
    var keyframes = {data: [[0,0], [1,1], [2,2], [3,3], [4,3], [5,2], [6,1], [7,0], [4,3], [5,2], [6,1], [7,0]]}
      var markers = [{time:0}, {time:1}, {time:2}, {time:3}, {time:4}];
    this.timeline.drawTrackWithKeyframes(ctx, 20, 50, "Speech", "dddd", keyframes, 0, null)
    this.timeline.drawMarkers(ctx,markers)
  //  this.timeline.drawTrackWithKeyframes(ctx, 6, 20, "Speech", "", keyframes, 0, null)
    dialog.add(canvas)
    dialog.show()
}*/

/* ------------------------------ GRAPH EDITOR ---------------------------------------- */
function GraphEditor(data )
{
  if(this.constructor !== GraphEditor)
	 throw("You must use new to create a GraphEditor");
	this._ctor(data);
}

GraphEditor.prototype._ctor = function(id)
{
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
GraphEditor.prototype.init = function( graph )
{
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

    this.graph_canvas.onNodeSelected = function(node)
    {
        console.log(node);
        that.current_graph_node = node;
    }

    this.graph_canvas.onNodeDeselected = function(node)
    {
        that.current_graph_node = null;
        console.log(node);
    }

    this.graph_canvas.onDropItem = function( data )
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
    }
}
GraphEditor.prototype.addNodeByType = function(type, properties, pos)
{
    switch(type){
        /* ADDED BY EVA */
        case "GestureNode":{
            var graphnode = LiteGraph.createNode( "btree/GestureNode" );
            var title = properties.name;
			graphnode.title = title;
			graphnode.pos = pos;
            graphnode.setProperty( "property_name", title );
            var gesture = GestureManager.gestures[title];
            for(var i in gesture)
            {
                if(i == "properties")
                {
                    for(var j in gesture[i])
                        graphnode.properties[j] = gesture[i][j];
                }
                else
                    graphnode.properties[i] = gesture[i];
            }
            var widgets = graphnode.widgets;
            for(var i in widgets)
            {
                var widgetName = widgets[i].name;
                if(graphnode.properties.hasOwnProperty(widgetName))
                    widgets[i].value = graphnode.properties[widgetName];
            }
            var dataType = null;
            graphnode.property_type = properties.dataType;
            var graphcanvas = LGraphCanvas.active_canvas;
            graphcanvas.graph.add(graphnode);
        }break;
        case "GestureManager":{
            var graphnode = LiteGraph.createNode( "btree/GestureMap" );
            var title = properties.name;
			graphnode.title = title;
			graphnode.pos = pos;
            graphnode.setProperty( "property_name", title );
            graphnode.gestures = GestureManager.gestures;
            var graphcanvas = LGraphCanvas.active_canvas;
            graphcanvas.graph.add(graphnode);
        }break;
        /**-------------------------------------------------------------**/
		case "HBTProperty":{
            var graphnode = LiteGraph.createNode( "basic/property" );

			var title = properties.name;
			graphnode.title = title;
			graphnode.pos = pos;
            graphnode.setProperty( "property_name", title );
            var dataType = null;

            switch(properties.dataType)
            {
                case "agent":
                    dataType = currentContext.agent_evaluated.properties[title];
                    break;
                case "user":
                    dataType =  currentContext.user.properties[title];
                    break;
                /**ADDED BY EVA**/
                case "gesture-property":

                    if(properties.info)
                    {
                        properties.dataType+="/"+properties.info;
                        var gesture = AgentManager.agent_selected.gesture_manager.gestures[properties.info];
                        title = title.toLocaleLowerCase();

                        if(gesture.hasOwnProperty(title))
                            dataType = gesture[title];
                        else if(gesture.properties.hasOwnProperty(title))
                            dataType = gesture.properties[title];
                    }
                    break;
                /*************************************************************/
            }
            graphnode.property_type =  graphnode.properties.property_type = properties.dataType;
            graphnode.setProperty("type", dataType.constructor.name.toLocaleLowerCase());
            graphnode.setProperty("value", dataType);
            var graphcanvas = LGraphCanvas.active_canvas;
            graphcanvas.graph.add(graphnode);

            if(graphcanvas.graph._is_subgraph)
            {
                graphnode.graph.character_evaluated = this.graph.graph.character_evaluated;
                graphnode.graph.context = this.graph.graph.context;
                graphnode.graph.current_behaviour = this.graph.graph.current_behaviour;
                graphnode.graph.character_evaluated = this.graph.graph.character_evaluated;
                graphnode.graph.root_node = this.graph.graph.root_node;
                graphnode.graph.evaluation_behaviours = this.graph.graph.evaluation_behaviours;
            }

		} break;
        case "cycle":{
			var props = JSON.parse(properties);
            var node_leaf = LiteGraph.createNode("btree/SimpleAnimate");
			node_leaf.setProperty("filename", props.filename);
			node_leaf.setProperty("speed", props.speed);
			node_leaf.setProperty("motion", props.motion);
//            node_leaf.properties = props;
            node_leaf.pos = pos;
            // node_leaf.data.g_node = node_leaf;
            this.graph.graph.add(node_leaf);
            if(this.current_graph_node && this.current_graph_node.outputs && this.current_graph_node.outputs[0].type == "path")
            {

                this.current_graph_node.connect(0, node_leaf, 0 );
            }
        } break;

		case "action":{
			var props = JSON.parse(properties);
            var node_leaf = LiteGraph.createNode("btree/ActionAnimate");
			node_leaf.setProperty("filename", props.filename);
			node_leaf.setProperty("speed", props.speed);
//            node_leaf.properties = props;
            node_leaf.pos = pos;
            // node_leaf.data.g_node = node_leaf;
            this.graph.graph.add(node_leaf);
            // if(hbt_editor.graph.)
        } break;

        case "intarget":{
            var node_cond = LiteGraph.createNode("btree/InTarget");
            node_cond.properties = properties;
            node_cond.pos = pos;
            // node_cond.data.g_node = node_cond;
            this.graph.graph.add(node_cond);
        } break;
    }
}

function removeChild(node)
{
    var parent = hbt_editor.graph.getNodeById(node.parent);
    for(var i = 0; i< parent.children.length; i++)
    {
        var children = parent.children[i];
        if(children.id == node.id)
        {
            var index = parent.children.indexOf(children);
            if (index !== -1) {
                parent.children.splice(index, 1);
            }
        }
    }
    node.parent = null;
}

function ToObjectData()
{
	this.addInput("name", "string");
	this.addInput("value", "");
	this.addOutput("obj", "object");
}
ToObjectData.prototype.onExecute = function ()
{
	var name = this.getInputData(0);
	var value = this.getInputData(1);
	var obj = {};
	obj[name] = value;
	this.setOutputData(0, obj)
}
LiteGraph.registerNodeType("basic/to_object", ToObjectData)


function JSONstringify()
{
	this.addInput("obj", "object");
	this.addOutput("string", "string");
}
JSONstringify.prototype.onExecute = function()
{
	var obj = this.getInputData(0) || {};
	this.setOutputData(0, JSON.stringify(obj))
}
LiteGraph.registerNodeType("basic/to_json", JSONstringify)

function JSONparse()
{

	this.addInput("string", "string");
	this.addOutput("obj", "object");
}
JSONparse.prototype.onExecute = function()
{
    var str = this.getInputData(0) || "{}";
    var obj = JSON.parse(str);
    this.setOutputData(0, obj );

}
LiteGraph.registerNodeType("basic/json_parse", JSONparse)
/*EVENT NODE*/
/*Trigger HBT when an event is recieved.*/
EventNode.TYPES = ["userText", "imageRecieved","faceDetected", "infoRecieved"] //has to be sorted as EVENTS object idx
/*textRecieved: 0,
imageRecieved: 1,
faceDetected: 2,
codeRecieved: 3*/
function EventNode()
{
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

EventNode.prototype.onAdded = function()
{
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
EventNode.prototype.onPropertyChanged = function(name, value)
{
    if(name == "type")
    {
      this.widgetType.value = this.properties.type = value;
    }
}
EventNode.prototype.tick = function(agent, dt, info)
{
  if(this.graph.context.last_event_node!=this.id)
  {
    this.graph.context.last_event_node = this.id;
    return {STATUS : STATUS.success};
  }

	var children = this.getOutputNodes(0);
	for(var n in children)
	{
		var child = children[n];
		// if(child.constructor.name == "Subgraph")
		// 	child = child.subgraph.findNodeByTitle("HBTreeInput");
    if(this.data)
      var value = child.tick(agent, dt, this.data);
    else
		  var value = child.tick(agent, dt);

		if(value && (value.STATUS == STATUS.success || value.STATUS == STATUS.running))
		{
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

	// if(this.running_node_in_banch)
	// 	agent.bt_info.running_node_index = null;

	this.behaviour.STATUS = STATUS.fail;
	return this.behaviour;
}

EventNode.prototype.onConfigure = function(info)
{
  onConfig(info, this.graph);
  //["userText", "imageRecieved","faceDetected", "infoRecieved"]
  if(this.properties.type == "userText") this.properties.type = "user.text";
  this.widgetType.value = this.properties.type;
}

EventNode.title = "Event";
EventNode.desc = "Event node of the Hybrid Behaviour Tree";

//reorder the links
EventNode.prototype.onStart = EventNode.prototype.onDeselected = function()
{
	var children = this.getOutputNodes(0);
	if(!children) return;
	children.sort(function(a,b)
	{
		if(a.pos[0] > b.pos[0])
		  return 1;

		if(a.pos[0] < b.pos[0])
		  return -1;

	});

	this.outputs[0].links = [];
	for(var i in children)
		this.outputs[0].links.push(children[i].inputs[0].link);
}

LiteGraph.registerNodeType("btree/Event", EventNode);

function TriggerNode()
{
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
TriggerNode.prototype.tick = function(agent, dt, info)
{
  this.graph.context.last_event_node = this.properties.node_id
    return {STATUS : STATUS.success};

}
TriggerNode.prototype.onConfigure = function(info)
{
    onConfig(info, this.graph);

}
LiteGraph.registerNodeType("btree/Trigger", TriggerNode);

function Property()
{
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

Property.prototype.onExecute = function()
{
	//	Check if its Scene or Agent
	//console.log(this.graph);
	var value = this.getInputData(0);
	var entity;
	var property_type = this.property_type.split("/");
	switch(property_type[0])
	{
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
Property.prototype.onSerialize = function(o)
{

	if(this.property_type)
	{
		o.property_type = this.property_type;
	}

}
/* ------------------------------------------ */
LiteGraph.registerNodeType("basic/property", Property);

//TODO add widget to change type string and add/create widget to allow the addition of name:string pairs on parameters
//TODO dinamically create inputs to set a value for each parameter (if desired)
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
  if(info && info.tags){
    for(var p in parameters){
      var value = parameters[p];
      if(value.constructor === String && value[0] == "#"){ //Try to match a tag from info
        if(info.tags[value]){
          parameters[p] = info.tags[value];
        }
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
      if(i.name == p.name) added = true;
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

CustomRequest.prototype.onInspect = function(inspector){
  var that = this;

  inspector.clear();

  inspector.addTitle("CustomRequest");

  inspector.widgets_per_row = 1;
  inspector.addString("Type", this.properties.type, {width: "100%", content_width: "70%", callback: function(value){
    that.properties.type = value;
    that._typeWidget.value = value;
  }})

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

LiteGraph.registerNodeType("events/CustomRequest", CustomRequest);



/*HBTree library changed*/
Selector.prototype.tick = function(agent, dt, info)
{
	//there is a task node in running state
	if(agent.bt_info.running_node_index != null && agent.bt_info.running_node_id == this.id)
	{
		var children = this.getOutputNodes(0);
        var child = children[agent.bt_info.running_node_index];
        if(info)
            var value = child.tick(agent, dt, info);
        else
            var value = child.tick(agent, dt);

		if(value.STATUS == STATUS.running)
		{
			agent.evaluation_trace.push(this.id);

			//Editor stuff [highlight trace]
			if(agent.is_selected)
				highlightLink(this, child);

			return value;
		}

		if(value.STATUS == STATUS.success )
		{
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
	else
	{
		//The output 0 is always the behaviour tree output
		var children = this.getOutputNodes(0);
		for(let n in children)
		{
            var child = children[n];
            if(info)
                var value = child.tick(agent, dt, info);
            else
                var value = child.tick(agent, dt);

			if(value.STATUS == STATUS.running)
			{
				agent.evaluation_trace.push(this.id);

				//first time receiving running state
				if((agent.bt_info.running_node_index == undefined || agent.bt_info.running_node_index == null ) || agent.bt_info.running_node_id == null)
				{
					agent.bt_info.running_node_index = parseInt(n);
					agent.bt_info.running_node_id = this.id;
				}

				//running node directly in the next child level, need to know which index to run
				if(agent.bt_info.running_node_index != undefined && agent.bt_info.running_node_index != null && agent.bt_info.running_node_id == this.id)
				{
					agent.bt_info.running_node_index = parseInt(n);
					agent.bt_info.running_node_id = this.id;
				}
				//Editor stuff [highlight trace]
				if(agent.is_selected)
					highlightLink(this, child);

				return value;
			}
			if(value.STATUS == STATUS.success)
			{
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

Sequencer.prototype.tick = function(agent, dt, info)
{

	//check if this node was executed the previous evaluation
	if(!nodePreviouslyEvaluated(agent, this.id))
	{
		//clear this node, so it executes from the beginning
		agent.bt_info.running_data[this.id] = null;
	}

	/* means that there is some node on running state */
	if(agent.bt_info.running_data[this.id])
	{
		var children = this.getOutputNodes(0);
		for(var i = 0; i < children.length; i++)
		{
			if(i != agent.bt_info.running_data[this.id]) continue;
			var child = children[agent.bt_info.running_data[this.id]];
      if(info)
        var value = child.tick(agent, dt, info);
      else
        var value = child.tick(agent, dt);
			if(value && value.STATUS == STATUS.running)
			{
				agent.evaluation_trace.push(this.id);

				if(agent.is_selected)
					highlightLink(this, child);

				return value;
			}
			if(agent.bt_info.running_data[this.id] == children.length-1 && value && value.STATUS == STATUS.success)
			{
				agent.bt_info.running_data[this.id] = null;
				// value.STATUS = STATUS.success;
				return value;
			}
			if( value && value.STATUS == STATUS.success )
			{
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
	else
	{
		var children = this.getOutputNodes(0);
		for(let n in children)
		{
		    var child = children[n];
        if(info)
          var value = child.tick(agent, dt, info);
        else
          var value = child.tick(agent, dt);
			// debugger;
			if(value && value.STATUS == STATUS.running)
			{
				agent.evaluation_trace.push(this.id);
				agent.bt_info.running_data[this.id] = parseInt(n);

				if(agent.is_selected)
					highlightLink(this, child);

				return value;
			}
			if(value && value.STATUS == STATUS.success)
			{
				agent.evaluation_trace.push(this.id);

				if(agent.is_selected)
					highlightLink(this, child);
			}
			if(n == children.length-1 && value && value.STATUS == STATUS.success && agent.bt_info.running_data[this.id] == null)
				return value;
			//Value deber�a ser success, fail, o running
			if(value && value.STATUS == STATUS.fail)
			{
				if(this.running_node_in_banch)
					agent.bt_info.running_data[this.id] = null;

				return value;
			}
		}
	}
}
Parallel.prototype.tick = function(agent, dt, info)
{
	this.behaviour.STATUS = STATUS.fail;
	var children = this.getOutputNodes(0);
	for(let n in children)
	{
		var child = children[n];
		var value = child.tick(agent, dt, info);

		if(value && (value.STATUS == STATUS.running || value.STATUS == STATUS.success))
		{
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

HBTGraph.prototype.runBehaviour = function(character, ctx, dt, starting_node)
{
	this.graph.character_evaluated = character;
	this.graph.evaluation_behaviours = []; //TODO are subgraphs evaluation_behaviours emptied?
	this.graph.context = ctx;
	ctx.agent_evaluated = character;
	//to know the previous execution trace of the character
	if(!character.evaluation_trace || character.evaluation_trace.length == 0 )
	{
		character.evaluation_trace = [];
		character.last_evaluation_trace = [];
	}
	//put the previous evaluation to the last, and empty for the coming one
	//the ... is to clone the array (just works with 1 dimension, if it was an array of objects, it won't work)
	character.last_evaluation_trace = [...character.evaluation_trace];
	character.evaluation_trace = [];

	/* In case a starting node is passed (we just want to execute a portion of the graph) */
	if(starting_node)
	{
		this.graph.runStep(1, false);
		this.current_behaviour = starting_node.tick(this.graph.character_evaluated, dt);
		return this.getEvaluationBehaviours();
	}
	/* Execute the tree from the root node */
	else if(this.root_node)
	{
		this.graph.runStep( 1, false );
		// console.log(character.evaluation_trace);
		// console.log(character.last_evaluation_trace);
		this.current_behaviour = this.root_node.tick(this.graph.character_evaluated, dt);
		return this.getEvaluationBehaviours();
	}
}

HBTGraph.prototype.processEvent = function(data)
{
  if(this.graph.context.last_event_node !== undefined)
  {
    var node = this.graph.getNodeById(this.graph.context.last_event_node)
    if(node){
      var event_type = node.properties.type.split("."); //class.property
      var c = event_type.length > 0 ? event_type[0] : "*"; //class
      var p = event_type.length > 1 ? event_type[1] : "*"; //property
      if(c == "*"){
        node.data = data;
        return node;
      }
      else if(data.hasOwnProperty(c)){ //class
        if(p == "*" || data[c].hasOwnProperty(p)){ //* or property
          node.data = data[c]; //TODO think other options to have all data
          return node;
        }
      } 
    }
  }
  return false;
}


// ******************* COLLAPSE EVENT AND PARSE COMPARE *******************
function ParseEvent()
{
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

ParseEvent.prototype.onConfigure = function(o)
{
  if(o.phrases)
    this.phrases = o.phrases;
  if(o.visible_phrases)
    this.visible_phrases = o.visible_phrases;
  if(o.input_contexts)
    this.input_contexts = o.input_contexts;
  if(o.output_contexts)
    this.output_contexts = o.output_contexts;
}

ParseEvent.prototype.onSerialize = function(o)
{
  if(this.phrases)
    o.phrases = this.phrases;
  if(this.visible_phrases)
    o.visible_phrases = this.visible_phrases;
  if(this.input_contexts)
    o.input_contexts = this.input_contexts;
  if(this.output_contexts)
    o.output_contexts = this.output_contexts;
}

ParseEvent.prototype.onAdded = function()
{
  this.title = "ParseEvent "+this.id;
  //this.widgetId = this.addWidget("info","id", this.properties.id, null, {editable:false});

}

ParseEvent.prototype.onPropertyChanged = function(name, value)
{
    if(name == "type")
    {
      this.event_type = EventNode.TYPES.indexOf(value);
    }
}

ParseEvent.prototype.onStart = EventNode.prototype.onDeselected = function()
{
	var children = this.getOutputNodes(0);
	if(!children) return;
	children.sort(function(a,b)
	{
		if(a.pos[0] > b.pos[0])
		  return 1;

		if(a.pos[0] < b.pos[0])
		  return -1;

	});

	this.outputs[0].links = [];
	for(var i in children)
		this.outputs[0].links.push(children[i].inputs[0].link);
}

ParseEvent.prototype.tick = function(agent, dt)
{
  if(this.graph.context.last_event_node!=this.id)
  {
    this.graph.context.last_event_node = this.id;
    return {STATUS : STATUS.success};
  }
  var text = "";
  for(var i in this.inputs)
  {
    if(this.inputs[i].name == "text")
      text = this.getInputData(i);
  }

  if((!text || text == "") && this.data && this.data.text)
    text = this.data.text;
	var training_phrases = this.phrases;

  var found = this.compare(text, training_phrases);

  if(!found)
	{
		//some of its children of the branch is still on execution, we break that execution (se weh we enter again, it starts form the beginning)
    if(this.running_node_in_banch)
      agent.bt_info.running_node_index = null;

    this.behaviour.STATUS = STATUS.fail;
    return this.behaviour;
	}
  else
	{
    var values = this.extractEntities(text, found.tags);
    if(values)
    {
      var info = {tags: values}

  		//this.description = this.properties.property_to_compare + ' property passes the threshold';
  		var children = this.getOutputNodes(0);
  		//Just in case the conditional is used inside a sequencer to accomplish several conditions at the same time
  		if(children.length == 0)
      {
  			this.behaviour.type = B_TYPE.parseCompare;
  			this.behaviour.STATUS = STATUS.success;
  			return this.behaviour;
  		}

  		for(let n in children)
  		{
  			var child = children[n];
  			var value = child.tick(agent, dt, info);
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
    }

    if(this.running_node_in_banch)
      agent.bt_info.running_node_index = null;

		this.behaviour.STATUS = STATUS.fail;
		return this.behaviour;
	}
}

ParseEvent.prototype.compare = function (inputString, vocabulary) 
{
  var found = false;
  for (var i in vocabulary) 
  {
    var currentVocab = vocabulary[i]
    var currentText = currentVocab.text;
    found = new RegExp(currentVocab.toCompare.toLowerCase()).test(inputString.toLowerCase());
    
    if (found)
      return currentVocab;
  }
  return found;
}

ParseEvent.prototype.extractEntities = function(string, tags)
{
    var info = {};
    for(var j = 0; j<tags.length; j++)
    {
        var tag = tags[j];
        var value = EntitiesManager.getEntity(string, tag);
        if(!value)
          return false;
        info[tag] = value;
    }
    return info;
}

ParseEvent.prototype.onGetInputs = function()
{
  return [["text", "string", { pos: [0,this.size[1]*0.5], dir:LiteGraph.LEFT}]];
}

ParseEvent.prototype.onInspect = function(  inspector )
{
    component = this;
    inspector.clear();
    inspector.widgets_per_row = 1;
    var contexts = inspector.addSection("Contexts");
    //inspector.addTitle("Contexts");
    var inputContext = CORE.Interface.addInputTags("Input contexts", this.input_contexts, {placeholder: "Add input context...", callback: function(v){
      if(component.input_contexts.indexOf(v)>-1)
        return;
      component.input_contexts.push(v);
      if(corpus && corpus.data[v])
      {
        var utterances = corpus.data[v].utterances;

        for(var i in utterances)
        {
          var aux=utterances[i];
          var tags = [];
          var idx = aux.indexOf("#");
          while(idx>=0)
          {
            var count = 0;
            for(var j=idx; j<aux.length; j++)
            {
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
    if(corpus)
    {
      inputContext.addEventListener("keypress", autocomplete(inputContext.lastElementChild.lastElementChild,corpus.array, null, {callback: function(){
        var e = new Event("keydown");
        e.keyCode=13;
        var input = document.getElementById("input-tag")
        input.dispatchEvent(e)
      }}))

    }

    inspector.append(inputContext)
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


    for(var i in training_phrases)
    {
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
      container.appendChild(div)
     
      var btn = new LiteGUI.Button('<img src="https://webglstudio.org/latest/imgs/mini-icon-trash.png">' ,{width:40,  callback: function(v){
            var id = this.toString();
            if(id > -1) {
              component.phrases.splice(id, 1);
            }
            component.onInspect(inspector)
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
    newPhrase = phrase.value
      //input.id ="input"

    //(phrase, EntitiesManager.getEntities())
    //phrase.addEventListener("keypress", autocomplete.bind(phrase, EntitiesManager.getEntities(), null))
    phrase.addEventListener("keypress", function(e){
        var that = this;
        /*if(e.key=="Alt"||e.key=="AltGraph" || e.key=="Control"|| e.key=="CapsLock" || e.key=="Backspace")
          return;*/
        newPhrase =   phrase.value;
        if(e.key == "#")
        {
          autocomplete(phrase, EntitiesManager.getEntities(), tags, {})
            //displayEntity(i, phrase, e, tags)
          newPhrase = e.target.value;

        }
    }.bind(this))
    inspector.append(phrase)

    inspector.addButton(null,"+", {width:40,callback: component.processPhrase.bind(this, phrase,tags, inspector)});

}

ParseEvent.prototype.processPhrase = function(phraseElement, tags, inspector)
{
    newPhrase = (phraseElement.value!=undefined)? phraseElement.value:phraseElement  // phraseElement.value!=undefined? phraseElement.value : phraseElement.getValue();
    var currentPhrase = newPhrase;
    var toCompare = newPhrase;
    //component.phrases.push(newPhrase);

    for(var i=0; i<tags.length; i++)
    {
        var start = currentPhrase.indexOf(tags[i]);
        var end = tags[i].length;
        //currentPhrase = currentPhrase.slice(0,start)+'<span>'+currentPhrase.slice(start,start+end)+'</span> '+currentPhrase.slice(start+end);
        currentPhrase = currentPhrase.slice(0,start)+'<mark>'+currentPhrase.slice(start,start+end)+'</mark>'+currentPhrase.slice(start+end);
        toCompare = toCompare.replace(tags[i], "(\\w+)");

    }
    component.visible_phrases.push(currentPhrase);
    component.phrases.push({text: newPhrase, tags: tags, toCompare: toCompare});
    component.onInspect(inspector)
}
ParseEvent.prototype.onDeselected = function ()
{
	var parent = this.getInputNode(0);
	if(parent)
		parent.onDeselected();
}
ParseEvent.prototype.onShowNodePanel = function( event, pos, graphcanvas )
{
    return true; //return true is the event was used by your node, to block other behaviours
}
LiteGraph.registerNodeType("btree/ParseEvent", ParseEvent );

LiteGraph.LGraph.prototype.getNodeById = function(id){
  if(id == null){
    return null;
  }

  var node = this._nodes_by_id[id];
  if(node) return node;

  //Check subgraphs
  //TODO store somewhere a list of subgraphs to avoid iterating over all nodes
  for(var n of this._nodes){
    if(n.constructor === LiteGraph.Subgraph){
      node = n.subgraph.getNodeById(id);
      if(node) return node;
    }
  }

  return null;
}

//Subgraphs are LGraph, so this has to be in LGraph
LiteGraph.LGraph.prototype.getEvaluationBehaviours = function(){
  var behaviours = this.evaluation_behaviours || [];

  //Check subgraphs
  //TODO store somewhere a list of subgraphs to avoid iterating over all nodes
  for(var n of this._nodes){
    if(n.constructor === LiteGraph.Subgraph){
      var subgraph_behaviours = n.subgraph.getEvaluationBehaviours();
      if(subgraph_behaviours){
        for(var b of subgraph_behaviours){
          behaviours.push(b);
        }
      }
    }
  }
  
  return behaviours;
}

HBTGraph.prototype.getEvaluationBehaviours = function(){
  return this.graph.getEvaluationBehaviours();
}
