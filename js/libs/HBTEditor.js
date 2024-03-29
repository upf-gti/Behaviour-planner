function HBTEditor(data )
{
  if(this.constructor !== HBTEditor)
	 throw("You must use new to create a HBTEditor");
	this._ctor(data);
}

HBTEditor.prototype._ctor = function(id)
{
	this.name = "HybridBehaviorTree";
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
HBTEditor.prototype.init = function( hbt_graph )
{
    this.canvas2D = document.createElement("canvas");
    this.context2 = this.canvas2D.getContext("2d");
    var HBTEditor_cont = document.getElementById(this.id);
    this.canvas2D.width = HBTEditor_cont.clientWidth;
    this.canvas2D.height = HBTEditor_cont.clientHeight;
    this.canvas2D.id = "HBTEditor"+this.id
    HBTEditor_cont.appendChild(this.canvas2D);
    LiteGraph.NODE_TITLE_COLOR = "#DDD";
    LiteGraph.NODE_TEXT_COLOR = "#DDD"

    this.graph = hbt_graph.graph;
	this.graph.current_behaviour = new Behaviour();
	this.createInitGraph();
    this.graph.description_stack = [];

    var that = this;

    this.graph_canvas = new LGraphCanvas(this.canvas2D , hbt_graph.graph);
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

    /*************** Draww summary of what is happening on the tree *****************/
    /*this.graph_canvas.onDrawOverlay = function( ctx )
    {
        if( this.graph.description_stack.length > 0 )
        {
            var array_of_messages = hbt_editor.graph.description_stack;

            ctx.beginPath();
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillRect(70, 2, 275, ((array_of_messages.length)*25)); 

            ctx.font = "12px Arial";
            ctx.fillStyle  = "#888888";
            if(array_of_messages)
                for (var i = array_of_messages.length-1; i >= 0; i-- )
                {
                    var h = Math.abs(i-(array_of_messages.length-1));
                    ctx.fillText(array_of_messages[i].capitalize(), 80, (15 + h*25)); 
                }
            ctx.closePath();
        }
    }*/
}

HBTEditor.prototype.createInitGraph = function()
{
	//var initial = JSON.parse(CORE.Scene.initial_behaviour["InitialDemo"])
	//this.graph.configure(initial.behaviour);
}

HBTEditor.prototype.addNodeByType = function(type, properties, pos)
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
            graphnode.gestures = JSON.parse(properties.info);
            var graphcanvas = LGraphCanvas.active_canvas;
            graphcanvas.graph.add(graphnode);
        }break;
        /**-------------------------------------------------------------**/
		case "HBTProperty":{
            var graphnode = LiteGraph.createNode( "btree/HBTproperty" );
           
			var title = properties.name;
			graphnode.title = title;
			graphnode.pos = pos;
            graphnode.setProperty( "property_name", title );
            var dataType = null;
            
            switch(properties.dataType)
            {
                case "agent":
                    dataType = this.graph.context.agent_evaluated.properties[title];
                    break;
                case "user":
                    dataType =  this.graph.context.user.properties[title];
                    break;
                /**ADDED BY EVA**/
                case "gesture-property":
                    
                    if(properties.info)
                    {
                        properties.dataType+="/"+properties.info;
                        var gesture = GestureManager.gestures[properties.info];
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

function onConfig(info, graph)
{
    if(!info.outputs)
        return

    for(let i in info.outputs)
    {
        var output = info.outputs[i];
        for(let j in output.links)
        {   
            var link_id = output.links[j];
            var link = getLinkById(link_id, graph);

            var node = graph.getNodeById(link.origin_id);
            var origin_slot = link.origin_slot;
            var target_node = graph.getNodeById(link.target_id);
            var target_slot = link.target_slot;
            var type = link.type;
//            graph.onNodeConnectionChange( 1 , target_node, origin_slot, node, target_slot );
        }
    }
}  

function getLinkById(id,graph)
{
    for(var i in graph.links)
    {
        var link = graph.links[i];
        if(link.id == id)
            return link;
    }
}


//var B_TYPE = {
//	moveTo:0, 
//	lookAt:1, 
//	animateSimple:2, 
//	wait:3, 
//	nextTarget:4
//	
//}
//
///*To encapsulate the result somewhere*/
//function Behaviour()
//{
//	if(this.constructor !== Behaviour)
//		throw("You must use new to create a Behaviour");
//	this._ctor(  );
//}
//
//Behaviour.prototype._ctor = function()
//{
//	// type can be moveTo, LookAt, setProperty, AnimateSimple...
//	this.type = null;
//	this.STATUS = STATUS.success;
//	this.data = {};
//	
//}
//
//Behaviour.prototype.setData = function( data )
//{
//	this.data = data;
//}