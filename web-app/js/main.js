Object.assign(window, glMatrix)
var tmp = {
	vec : 	vec3.create(),
	axis : 	vec3.create(),
	axis2 : vec3.create(),
	inv_mat : mat4.create(), 
	agent_anim : null, 
	behaviour : null
}
PLAYING=1;
STOP = 0;
var baseURL = "https://webglstudio.org";
var currentHBTGraph;
var hbt_graphs 	= {};

var hbt_context;
var currentCanvas;
var currentContext;
var info = {is_selected:true, bt_info: {}};
var last = now = performance.now();
var state = STOP;
var dt;         
var agent_selected = null;    
var accumulate_time = 0;  
var execution_t = 1;
var user = null; 
var streamer = null;
function appInit()
{
   
  
    var hbt_graph = GraphManager.newGraph(GraphManager.HBTGRAPH)
    currentContext = hbt_graph.graph.context;
  //  CORE.Interface.preInit();
    currentHBTGraph = hbt_graph;
    //hbt_canvas.init(currentGraph)
    var position = [0,0,0];
    var agent = new Agent(null, position);
    agent_selected = agent;
    agent_selected.is_selected=true;
    //CORE.Interface.createAgentInspector();
    user = new User(null, [0,0,100]);
    
    //CORE.Interface.createUserInspector();
    
    if(agent_selected)
        currentContext.agent_evaluated = agent_selected;
    if(user!=null)
        currentContext.user = user;
    
    var last = now =performance.now();
    CORE.Interface.importFromURL();
    requestAnimationFrame(animate);
        
}
function animate() {
    requestAnimationFrame(animate);
    last = now;
    now =performance.now();
    dt = (now - last) * 0.001;     
   
    update(dt);
      
}
function update(dt)
{
    
    if(state == PLAYING)
    {
        accumulate_time+=dt;
        if(accumulate_time>=execution_t)
        {
            
            //Evaluate each agent on the scene
            for(var c in AgentManager.agents)
            {
                var character_ = AgentManager.agents[c]; 


                var agent_graph = hbt_graphs[character_.hbtgraph];
                if(user!=null)
                    currentContext.user = user;
                tmp.behaviour = agent_graph.runBehaviour(character_, currentContext, accumulate_time); //agent_graph -> HBTGraph, character puede ser var a = {prop1:2, prop2:43...}
                
                for(var b in tmp.behaviour)
                {
                    character_.applyBehaviour( tmp.behaviour[b]);
                    if(tmp.behaviour[b].type == 6)
                        character_.properties[tmp.behaviour[b].data.name] = tmp.behaviour[b].data.value; 	
                }
                
                
            }
            for(var i in GraphManager.graphs)
            {
                var graph = GraphManager.graphs[i];
                if(graph.type == GraphManager.BASICGRAPH)
                    graph.graph.runStep();
            }
            accumulate_time=0;
        // var behaviours = hbt_graph.runBehaviour(info, hbt_context, dt);
        
            CORE.Interface.showContent(tmp.behaviour );
            if(streamer && streamer.ws.is_connected && streamer.streaming)
                streamer.sendData(tmp.behaviour);
        }
    }
}
var inital = {
    name : "inital",
    postInit(){
        window.appInit();
    }
}

CORE.registerModule( inital );