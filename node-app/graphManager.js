
function _graphManager(global){
    var GraphManager = global.GraphManager = {
        graphs: {},
        currentHBTGraph: null,
        currentBasicGraph: null,
        hbt_context : null,
        graphSelected: null,
        HBTGRAPH : 0,
        BASICGRAPH : 1,
        newGraph(type, name){
            var graph = null;
            switch(type){
                case this.HBTGRAPH:
                    var graph = new HBTGraph(name);
                    graph.type = GraphManager.HBTGRAPH;
                    var hbt_context = new HBTContext();
                     
                    graph.graph.context = hbt_context;
                    this.graphs[graph.name] = graph;
                    CORE.Interface.tabsRefresh() 

                    break;

                case this.BASICGRAPH:
                    var graph = {}
                    graph.graph = new LGraph(name);
                    graph.type = GraphManager.BASICGRAPH;
                     
                    this.graphs[graph.id] = graph
                    CORE.Interface.newTab(graph) 
                     
                    break;
            }
            return graph;
        },
        exportBehaviour(graph_){
            var behaviour_obj = {};
            var graph = graph_.serialize();
            var nodes = graph.nodes;
            for(var i in nodes){
                if(nodes[i].data) delete nodes[i].data["g_node"];
            }
            behaviour_obj = {"behaviour":graph};
            console.log(behaviour_obj);
            return behaviour_obj;
        },
        exportBasicGraph(graph_){
            var graph = graph_.serialize();
            var nodes = graph.nodes;
            for(var i in nodes){   
                if(nodes[i].data) delete nodes[i].data["g_node"];
            }
            //behaviour_obj = {"behaviour":graph};
            console.log(graph);
            return graph;
        },
        removeGraph(name){
            if(!name){
                var graph = this.graphSelected;
                if(graph.name) delete this.graphs[graph.name];
                else delete this.graphs[graph.id];
            }else{
                if(this.graphs[name]) delete this.graphs[name];          
            } 
        },
        removeAllGraphs(){
            for(var i in this.graphs){
                delete this.graphs[i];
            }
        }
    }
}

_graphManager(this);
