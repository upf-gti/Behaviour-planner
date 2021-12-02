
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
    timeline_intent:18,
    http_request:19,
    http_response:20
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
	//this.graph.evaluation_behaviours = []; //TODO are subgraphs evaluation_behaviours emptied?
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
//Data is always inside properties in each attribute
//Attribute may have an onUpdate(object) callback
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

Blackboard.prototype.addAttribute = function(attr, o){
    if(this[attr]){
        console.log("Blackboard attribute already exists.");
        return;
    }

    //Create object with empty properties
    this[attr] = o || {properties: {}};
}

Blackboard.prototype.applyOn = function(data, attr){
    if(!this[attr]) this.addAttribute(attr);

    for(let key in data){
        this[attr].properties[key] = data[key];
    }

    if(this[attr].onUpdate){
        this[attr].onUpdate(this[attr]);
    }
}

Blackboard.prototype.apply = function(data){
    for(let key in data){
        this.applyOn(data[key], key);
    }
}

Blackboard.prototype.getValue = function(attr, name){
    return this[attr] ? this[attr].properties[name] : null;
}

//Implementation of Facade methods of HBTree

/* 
* Receives as a parmaeter a game/system entity, a scene node which is being evaluated
* Returns a vec3 with the position
*/
Facade.prototype.getEntityPosition = function( entity )
{
	entity.transform.position;
}

//For the HBTProperty Node
/*
* Search in all the properties (scene and entity) one with the name passed as a parameter
* Returns the value of the property (int, float or vec3) 
*/
Facade.prototype.getEntityPropertyValue = function( property_name, entity )
{	
	var my_comp = null;
	var components = entity._components;
	for(var i in components)
	{
		if(components[i].constructor.name == "HBTreeController")
			my_comp = components[i];
	}
    if(!my_comp)
    {
        my_comp = {};
        my_comp.local_properties = entity.properties;
    }
	return my_comp.local_properties[property_name];
	//Search for the value of the property "property_name" in the system
}

//For the SimpleAnimate Node
/*
* Return the existing types of interest points
*/
Facade.prototype.getAnimation = function( path )
{
	if(typeof LS == "undefined")
		return path;
	var anim = LS.ResourcesManager.getResource( path );
	if(anim)
		return anim.filename;
	else
		return path;
	//debugger;
	//console.warn("entityInTarget() Must be implemented to use HBTree system");
}

//For the ActionAnimate Node
/*
* Return the time of an animation
*/
Facade.prototype.getAnimationDuration = function( path )
{
	var anim = LS.ResourcesManager.getResource( path );
	if(anim)
		return anim.takes.default.duration;
	else
		return false;
}

//For the EQSNearestInterestPoint Node
/*
* Return all the existing interest points
*/
Facade.prototype.getInterestPoints = function(  )
{
	console.warn("entityInTarget() Must be implemented to use HBTree system");
}
/*
* @entity: the virtual entity evaluated. The type you are using as an entity 
* @look_at_pos: vec3 with the target position to check if it's seen or not 
* @limit_angle: a number in degrees (field of view)
*/
Facade.prototype.canSeeElement = function( entity, look_at_pos, limit_angle)
{
	console.warn("entityInTarget() Must be implemented to use HBTree system");
}

Facade.prototype.setEntityProperty = function( entity, property, value )
{
	var my_comp = null;
	var components = entity._components;
	for(var i in components)
	{
		if(components[i].constructor.name == "HBTreeController")
			my_comp = components[i];
	}
    if(!my_comp)
    {
        my_comp = {};
        my_comp.local_properties = entity.properties;
    }
	my_comp.local_properties[property] = value;
	if(entity.inspector)
		entity.inspector.refresh()
	console.warn("entityInTarget() Must be implemented to use HBTree system");
}


//Not implemented:
//Facade.prototype.getListOfAgents
//Facade.prototype.entityInTarget
//Facade.prototype.checkNextTarget
//Facade.prototype.entityHasProperty
