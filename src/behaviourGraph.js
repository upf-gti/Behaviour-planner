
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
