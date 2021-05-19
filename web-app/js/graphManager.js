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
    newGraph(type, name){
        var graph = null;
        switch(type)
        {
            case this.HBTGRAPH:
                var graph = new HBTGraph(name);
                graph.type = GraphManager.HBTGRAPH;
                var hbt_context = new HBTContext();

                graph.graph.context = hbt_context;
                graph.id = "graph-canvas-"+graph.name;
                this.graphs[graph.name] = graph;
                CORE.Interface.tabsRefresh();

                var hbt_canvas = new HBTEditor(graph.id);
                hbt_canvas.init(graph);
                GraphManager.graph_canvas[graph.id] = hbt_canvas;
                LGraphCanvas.active_canvas = this.currentCanvas = hbt_canvas;
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
                canvas.init(graph);
                this.currentCanvas = canvas;
                LGraphCanvas.active_canvas = this.currentCanvas;
                break;
        }

        return graph;
    },
    loadGraph(data)
    {
        var graph;
        var graph_name = (data.behaviour ? data.behaviour.name : data.name) || "default";
        
        if(data.constructor === HBTGraph){
            data = {behaviour: data};
        }

        if(data.behaviour){
            graph = GraphManager.newGraph(GraphManager.HBTGRAPH, graph_name);
            graph.graph.configure(data.behaviour);
        }else{
            graph = GraphManager.newGraph(GraphManager.BASICGRAPH, graph_name);
            graph.graph.configure(data);
        }
        
        return graph;
    },
    addGraph(graph){
        if(graph.constructor === HBTGraph){
            let graph_name = graph.name || "default";
            graph.name = graph_name;
            graph.id = "graph-canvas-"+graph.name;

            this.graphs[graph_name] = graph;
            CORE.Interface.tabsRefresh();

            let hbt_canvas = new HBTEditor(graph.id);
            hbt_canvas.init(graph);
            GraphManager.graph_canvas[graph.id] = hbt_canvas;
            LGraphCanvas.active_canvas = this.currentCanvas = hbt_canvas;
        }
    },
    onGraphSelected(id)
    {
        GraphManager.currentCanvas = GraphManager.graph_canvas[id];
        if(id.startsWith("graph-canvas"))
        {
            var name = id.substr(13);
            GraphManager.graphSelected = GraphManager.graphs[name];
        }


        LGraphCanvas.active_canvas = GraphManager.currentCanvas;
        console.log(id)
    },
    onGraphRenamed(id, newname)
    {
        var graph;
        if(id.startsWith("graph-canvas"))
        {
            var oldname = id.substr(13);
            graph = GraphManager.graphs[oldname];
        }
        
        var canvas = GraphManager.graph_canvas[id];

        if(!graph) return;

        var oldname = graph.name;
        graph.name = newname;
        graph.id =  "graph-canvas-" + newname;

        this.graphs[newname] = graph;
        delete this.graphs[oldname];

        this.graph_canvas[graph.id] = canvas;
        delete this.graph_canvas[id];

        CORE.Interface.tabsRefresh();
        canvas.init(graph);
        LGraphCanvas.active_canvas = GraphManager.currentCanvas;
    },
    clearCurrentGraph()
    {
        GraphManager.currentCanvas.graph.clear();
    }
    ,
    putGraphOnEditor( data )
	{
        var that = this;
        if(that.constructor.name != "Object")
            that = GraphManager;
        if(!data)
            return;

        var new_graph = this.loadGraph(data);
        var real_graph = new_graph.constructor === HBTGraph ? new_graph.graph : new_graph;

        if(!that.currentCanvas)
        {
          CORE.Interface.newTab(real_graph);
          that.newGraph(new_graph.type)
        }
        that.currentCanvas.graph_canvas.setGraph(real_graph);
        that.graphSelected = new_graph;
        
        return new_graph;
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
