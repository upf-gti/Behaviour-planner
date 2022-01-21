 //-----------------------MODIFIED FROM HBTREE.JS------------------------------------//

//const { LiteGraph } = require("../src/libs/litegraph");
const HBTree = require("./HBTree");

/* * DEPENDENCES: 
 * LiteGraph (HBTree)
 * HBTGraph (HBTree)
 * Blackboard (HBTree)
 * Facade (HBTree)
 * */
 (function _HBTreeExtension(global){
   
    /*HBTree = global.HBTree;*/
   /* LiteGraph = global.HBTree.LiteGraph;*/
    Selector = HBTree.Selector;
    Sequencer = HBTree.Sequencer;
    Parallel = HBTree.Parallel;
    Conditional = HBTree.Conditional;
    BoolConditional = HBTree.BoolConditional;
    HBTproperty = HBTree.HBTproperty;
    
    LiteGraph = LiteGraph;
    HBTGraph = HBTree.HBTGraph;
    HBTContext = HBTree.HBTContext;
    Blackboard = HBTree.Blackboard;
    Facade = HBTree.Facade;
    Behaviour = HBTree.Behaviour;
    onConfig = HBTree.HBTree.onConfig;
    getLinkById = HBTree.HBTree.getLinkById
    nodePreviouslyEvaluated = HBTree.HBTree.nodePreviouslyEvaluated;
    highlightLink = HBTree.HBTree.highlightLink;
    B_TYPE = HBTree.B_TYPE;

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
    //global.HBTree.Selector = Selector;
    //global.expand(Selector)

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
    //global.HBTree.Sequencer = Sequencer;

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
   // global.HBTree.Parallel = Parallel;

    Conditional.prototype.tick = function(agent, dt, info )
    {
        if(this.properties.from_tags&& info&&info.tags)
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
   // global.HBTree.Conditional = Conditional;

    BoolConditional.prototype.tick = function(agent, dt, info )
    {
        if(this.properties.from_tags&& info&&info.tags)    {
        for(var i in info.tags)
        {
            this.properties.bool_state = Boolean(info.tags[i]);
        }
        }
        if(this.evaluateCondition && !this.evaluateCondition())
        {
        if(this.running_node_in_banch)
            agent.bt_info.running_node_index = null;

        this.behaviour.STATUS = STATUS.fail;
        return this.behaviour;
        }

        else if(this.evaluateCondition && this.evaluateCondition())
        {   
        this.description = this.properties.property_to_compare + ' property is true';
        var children = this.getOutputNodes(0);

        if(children.length == 0)
        {
            console.warn("BoolConditional Node has no children");
            return STATUS.success;
        }
        for(let n in children)
        {
            var child = children[n];
            var value = child.tick(agent, dt);

            if(value && value.STATUS == STATUS.success)
            {
            agent.evaluation_trace.push(this.id);

            if(agent.is_selected)
                highlightLink(this, child);

            return value;
            }
            else if(value && value.STATUS == STATUS.running)
            {
            agent.evaluation_trace.push(this.id);

            if(agent.is_selected)
                highlightLink(this, child);

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
    //global.HBTree.BoolConditional = BoolConditional;
    //global.expand(BoolConditional)

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
    //global.HBTree.HBTproperty = HBTproperty;
    //global.expoand(HBTproperty);

    //Expand B_TYPE list from HBTree.js
    B_TYPE = {
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
    //global.LiteGraph = LiteGraph;

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
    //global.expand(HBTGraph);

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
    //global.expand(Blackboard)
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
    /*global.expand(Facade);*/

    /*global.HBTree = HBTree;
    return global;*/
 })(this)
 /*if(typeof module !== "undefined"){
	module.exports = function(){
		var global = {HBTree: HBTree};
        _HBTreeExtension(global);
		return global;
	}
}else{
	_HBTreeExtension(this);
}*/

