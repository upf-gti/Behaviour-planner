
//Expand B_TYPE list from HBTree.js
var B_TYPE = {
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
}

LiteGraph.Subgraph.prototype.onSubgraphNewOutput = function(name, type) {
    var slot = this.findOutputSlot(name);
    if (slot == -1){
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
}

LiteGraph.Subgraph.prototype.onDeselected = function(){
    var output_node = this.subgraph.findNodeByTitle("HBTreeOutput");
    if(output_node) output_node.onDeselected();
}

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

//-----------------------MODIFIED FROM HBTREE.JS------------------------------------//
HBTGraph.prototype.runBehaviour = function(character, ctx, dt, starting_node){
	this.graph.character_evaluated = character;
	this.graph.evaluation_behaviours = []; //TODO are subgraphs evaluation_behaviours emptied?
	this.graph.context = ctx;
	ctx.agent_evaluated = character;
	//to know the previous execution trace of the character
	if(!character.evaluation_trace || character.evaluation_trace.length == 0 ){
		character.evaluation_trace = [];
		character.last_evaluation_trace = [];
	}
	//put the previous evaluation to the last, and empty for the coming one
	//the ... is to clone the array (just works with 1 dimension, if it was an array of objects, it won't work)
	character.last_evaluation_trace = [...character.evaluation_trace];
	character.evaluation_trace = [];

	/* In case a starting node is passed (we just want to execute a portion of the graph) */
	if(starting_node){
		this.graph.runStep(1, false);
		this.current_behaviour = starting_node.tick(this.graph.character_evaluated, dt);
		return this.getEvaluationBehaviours();
	}

	/* Execute the tree from the root node */
	else if(this.root_node){
		this.graph.runStep( 1, false );
		// console.log(character.evaluation_trace);
		// console.log(character.last_evaluation_trace);
		this.current_behaviour = this.root_node.tick(this.graph.character_evaluated, dt);
		return this.getEvaluationBehaviours();
	}
}

HBTGraph.prototype.processEvent = function(data){
    if(this.graph.context.last_event_node !== undefined){
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

//BP Blackboard: HBTGraph context blackboard will be created with these attributes instead
Blackboard.prototype._ctor = function(){
    this.user = null;
    this.agent = null;

    this.corpus = null;
    this.entities = null;
}

Blackboard.prototype.configure = function(o){
    if(o.user) this.user = o.user;
    if(o.agent) this.agent = o.agent;
    if(o.corpus) this.corpus = o.corpus;
    if(o.entities) this.entities = o.entities;
}

Blackboard.prototype.apply = function(data){
    //Hardcoded for user for now
    if(data.user){
        for(var key in data.user){
            this.user.properties[key] = data.user[key];
        }
    }
    
}
