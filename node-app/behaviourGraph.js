/**
 * Dependences;
 * 
 * LiteGraph (HBTree)
 * HBTGraph (HBTree)
 * Blackboard (HBTree)
 * Facade (HBTree)
 */

//Expand B_TYPE list from HBTree.js
function _HBTreeNodes(global)
{
    LiteGraph = global.LiteGraph;
    HBTGraph = global.HBTGraph;
    Blackboard = global.Blackboard;
    Facade = global.Facade;

    


    //Not implemented:
    //Facade.prototype.getListOfAgents
    //Facade.prototype.entityInTarget
    //Facade.prototype.checkNextTarget
    //Facade.prototype.entityHasProperty
}
if(typeof module !== "undefined"){
	module.exports = function(LiteGraph, HBTree, entitiesManager){
		var global = {LiteGraph: LiteGraph, HBTree: HBTree, EntitiesManager: entitiesManager};
		_HBTreeNodes(global);
		return global;
	}
}else{
	_HBTreeNodes(this);
}
