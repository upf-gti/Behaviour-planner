var GraphManager = {
   graphs: {},
   graph_canvas: {},
   currentCanvas: {},
   currentHBTGraph: null,
   currentBasicGraph: null,
   hbt_context : null,
   graphSelected: null,
    HBTGRAPH : 0,
    BASICGRAPH : 1,
    newGraph(type, name, callback){
        var graph = null;
        switch(type)
        {
            case this.HBTGRAPH:
                var graph = new HBTGraph(name);
                graph.type = GraphManager.HBTGRAPH;
                var hbt_context = new HBTContext();

                graph.graph.context = hbt_context;
                //graph.name = "graph-canvas-"+Object.entries(GraphManager.graphs).length;
                graph.id = "graph-canvas-"+graph.name;
                this.graphs[graph.name] = graph;
                CORE.Interface.tabsRefresh()

                var hbt_canvas = new HBTEditor(graph.id);
                hbt_canvas.init(graph);
                GraphManager.graph_canvas[graph.id] = hbt_canvas;
                this.currentCanvas = hbt_canvas;
                LGraphCanvas.active_canvas = this.currentCanvas;

                break;
            case this.BASICGRAPH:
                var graph = {}
                graph.graph = new LGraph(name);
                graph.type = GraphManager.BASICGRAPH;

               /* var canvasDOM = document.createElement("CANVAS");
                canvasDOM.id = "new-canvas-"+GraphManager.graphs.length;*/

                graph.id = "graph-canvas-"+graph.name;
                this.graphs[graph.id] = graph
                CORE.Interface.newTab(graph)

               // var tab = CORE.Interface.tabs.addTab(canvasDOM.id, {id: canvasDOM.id,size:"full", title: "Basic Graph", width:"100%", height:"100%" });
                var canvas =  new GraphEditor(graph.id);//new LGraphCanvas("#g"+graph.id, graph);
                GraphManager.graph_canvas[graph.id] = canvas;
                canvas.init(graph)
                this.currentCanvas = canvas;
                LGraphCanvas.active_canvas = this.currentCanvas;
                break;
        }
       /* if(callback)
            callback(GraphManager.graphs[GraphManager.graphs.length-1])*/
        return graph;
    },
    onGraphSelected(data, g)
    {
        GraphManager.currentCanvas = GraphManager.graph_canvas[data];
        if(data.startsWith("graph-canvas"))
        {
            var arr = data.split("-");
            var name = arr[2];
            if(arr.length>3)
            {
                arr = arr.slice(2);
                name = arr.join("-");
            }
            GraphManager.graphSelected = GraphManager.graphs[name];
        }


        LGraphCanvas.active_canvas = GraphManager.currentCanvas;
        console.log(data)
    },
    clearCurrentGraph()
    {
        GraphManager.currentCanvas.graph.clear();
    }
    ,
    putGraphOnEditor( data, name )
	{
        var that = this;
        if(that.constructor.name != "Object")
            that = GraphManager;
        if(!data)
            return;

        var new_graph = {};
        if(data.behaviour)
        {
            new_graph = new HBTGraph(name);
            new_graph.type = this.HBTGRAPH;
            new_graph.graph.configure(data.behaviour);
            new_graph.graph.context = this.hbt_context;
            that.graphs[new_graph.name] = new_graph;

        }
        else if(data.constructor.name == "HBTGraph")
        {
            new_graph = data;
        }
        else
        {
            new_graph.graph = new LGraph();
            new_graph.type = this.BASICGRAPH;
            new_graph.graph.configure(data)
            that.graphs[new_graph.graph.name] = new_graph;

        }

        if(!that.currentCanvas)
        {
          CORE.Interface.newTab(new_graph.grap);
          that.newGraph(new_graph.type)
        }
        that.currentCanvas.graph_canvas.setGraph(new_graph.graph);
        that.graphSelected = new_graph;
        

    },
    init(){
        window.addEventListener("resize", this.resize.bind(this));
    },
    resize() {
        var that = this;
        if(GraphManager.currentCanvas.graph_canvas)
            GraphManager.currentCanvas.graph_canvas.resize();

    },
    exportBehaviour(graph_)
    {
        var behaviour_obj = {};
        var graph = graph_.serialize();
        var nodes = graph.nodes;
        for(var i in nodes)
        {
            if(nodes[i].data)
                delete nodes[i].data["g_node"];
        }
        behaviour_obj = {"behaviour":graph};
        console.log(behaviour_obj);
        return behaviour_obj;
    },
    exportBasicGraph(graph_)
    {

        var graph = graph_.serialize();
        var nodes = graph.nodes;
        for(var i in nodes)
        {
            if(nodes[i].data)
                delete nodes[i].data["g_node"];
        }
        //behaviour_obj = {"behaviour":graph};
        console.log(graph);
        return graph;
    },
    removeGraph(name)
    {
        if(!name)
        {
            var graph = this.graphSelected;
            if(graph.name)
                delete this.graphs[graph.name];
            else
                delete this.graphs[graph.id]
        }
        else
        {
            if(this.graphs[name])
                delete this.graphs[name];
        }

    },
    removeAllGraphs()
    {
        for(var i in this.graphs)
        {
            delete this.graphs[i];
        }
    }
}
