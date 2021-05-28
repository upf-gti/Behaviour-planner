/** BehaviourPlanner:
 * Manages and updates behaviour graphs
 */

class User{
    constructor(o, pos){
        this.uid =  "User-"+ Date.now();
        this.initProperties();
        if(o){
            this.configure(o);
        }

        //Legacy in constructor pos
        this.position = pos;

        this.onUpdate = null;
    }

    initProperties(){
        this.properties = {
            name: this.uid,
            is_in_front: false,
      		is_speaking: false,
            valence: 0,
            arousal: 0,
            look_at_pos: [0,0,0],
            position: [0,0,0],
            orientation: [0,0,0,1],
            text: ""
        }
    }

    configure(o){
        if(o.uid){
            this.uid = o.uid;
            this.properties.name = o.uid;
        }

        if(o.properties){
            for(let k in o.properties){
                this.properties[k] = o.properties[k];
            }
        }
    }

    //For HBT where is expected to be outside properties:
    get position(){return this.properties.position;}
    set position(p){this.properties.position = p;}

    serialize(){
        var o = {};
        o.uid = this.uid;
        o.properties = this.properties;
        return o;
    }
}

class Agent{
    constructor(o ,pos){
        this.uid =  "Agent-" + Date.now();

        this.initProperties();
        if(o){
            this.configure(o);
        }

        //Legacy in constructor pos
        this.position = pos;

        this.onUpdate = null;

        //this.hbtgraph is not used in HBTree
    }

    initProperties(){
        this.properties = {
            name: this.uid,
            valence:0,
            arousal:0,
            age: 35,

            target: null,
            look_at_pos: [0,0,10000],
            position: [0,0,0],
            orientation: [0,0,0,1],
            state: "waiting",

            //Internal for hbt
            bt_info: {running_data: {}},
        };
    }

    configure(o){
        if(o.uid){
            this.uid = o.uid;
            this.properties.name = o.uid;
        }

        if(o.properties){
            for(let k in o.properties){
                this.properties[k] = o.properties[k];
            }
        }
    }

    //For HBT where is expected to be outside properties
    get position(){return this.properties.position;}
    set position(p){this.properties.position = p;}
    get bt_info(){return this.properties.bt_info;}

    serialize(){
        var o = {};
        o.uid = this.uid;
        o.properties = this.properties;

        return o;
    }
}

class Gesture{
    constructor(o){
        this.uid =  "Gesture-" + Date.now();

        this.initProperties();
        if(o){
            this.configure(o);
        }

        this.name = "";
        this.duration = GestureManager.DURATION[0];
	    this.priority = GestureManager.PRIORITY[0];
	    this.interface = "";
        this.keywords = "";
        this.properties = {};

        this.onUpdate = null;
    }

    initProperties(){
        this.properties = {
            name: "",
            duration: Gesture.DURATION[0],
            priority: Gesture.PRIORITY[0],
            keywords: ""
        };
    }

    configure(o){
        if(o.uid){
            this.uid = o.uid;
            this.properties.name = o.uid;
        }

        if(o.properties){
            for(let k in o.properties){
                this.properties[k] = o.properties[k];
            }
        }

        this.name = o.name;
        this.duration = o.duration;
        this.priority = o.priority;
        this.interface = o.interface;
        this.keywords = o.keywords;
        if(o.properties)
            this.properties = o.properties
    }

    //Legacy, all references should be done directly in properties
    get name(){return this.properties.name;}
    set name(v){this.properties.name = v;}
    get duration(){return this.properties.duration;}
    set duration(v){this.properties.duration = v;}
    get keywords(){return this.properties.keywords;}
    set keywords(v){this.properties.keywords = v;}
}
Gesture.DURATION = ["Short-term", "Long-term"];
Gesture.PRIORITY = ["append","overwrite", "mix", "skip"];

var BP_STATE = {
    STOP: 0,
    PLAYING: 1,
};

//AKA model of application
class BehaviourPlanner{

    constructor(o){
        this._user = null;
        this._agent = null;
        this._corpus = null;
        this._entities = null;

        this._hbt_graph = null;

        this.state = BP_STATE.STOP;
        this.accumulate_time = 0;
        this.execution_t = 1;


        //Callbacks
        this.onStateChange = null; //Not used
        this.onBehaviours = null; //Raw behaviour objects
        this.onActions = null; //Action objects (protocol) from processing behaviours

        //Init and configure
        this.init();
        if(o) this.configure(o);
    }

    set user(o){
        if(o.constructor !== User){
            console.log("Error while assigning User");
            return;
        }

        this._user = o;

        if(this.hbt_graph){
            this.blackboard.user = o;
        }
    }

    get user(){return this._user;}

    set agent(o){
        if(o.constructor !== Agent){
            console.log("Error while assigning Agent");
            return;
        }

        this._agent = o;

        if(this.hbt_graph){
            this.context.agent_evaluated = o;
            this.blackboard.agent = o;
        }
    }

    get agent(){return this._agent;}
    set corpus(o){this._corpus = o;}
    get corpus(){return this._corpus || null;}

    set hbt_graph(o){
        if(o.constructor !== HBTGraph){
            console.log("Graph must be HBTGraph");
            return;
        }

        this._hbt_graph = o;

        //Be sure that graph has context (it should be already set)
        if(!this._hbt_graph.graph.context){
            this._hbt_graph.graph.context = new HBTContext();
        }

        this.context.agent_evaluated = this.agent;
    
        //LAST: Set attributes of graph blackboard
        this.blackboard.configure({
            user: this.user,
            agent: this.agent,
            corpus: this.corpus,
            entities: this.entities,
        });
    }

    get hbt_graph(){return this._hbt_graph;}
    get context(){return this._hbt_graph ? this._hbt_graph.graph.context : null;}
    get blackboard(){return this._hbt_graph ? this._hbt_graph.graph.context.blackboard : null;}

    init(){
        this.user = new User();
        this.agent = new Agent();
        this.state = BP_STATE.STOP;
        this.accumulate_time = 0;
        this.execution_t = 1;
    }

    configure(o){
        if(o.user) this.user = o.user;
        if(o.agent) this.agent = o.agent;

        if(o.hbt_graph) this.hbt_graph = o.hbt_graph;
    }

    play(){
        this.state = BP_STATE.PLAYING;
    }

    stop(){
        this.state = BP_STATE.STOP;
        this.context.last_event_node = null;
    }

    update(dt){
        if(this.state == BP_STATE.PLAYING){
            this.accumulate_time += dt;
            if(this.accumulate_time >= this.execution_t){
                //Evaluate agent on the graph
                if(this.agent && this.hbt_graph){
                    let context = this.context;

                    if(context.last_event_node == null || context.last_event_node == undefined){
                        var behaviours = this.hbt_graph.runBehaviour(this.agent, context, this.accumulate_time);
                        this.accumulate_time = 0; //runBehaviour expects time between calls

                        if(this.onBehaviours) this.onBehaviours(behaviours);
                        this.processBehaviours(behaviours);
                    }
                }
            }
        }
    }

    onEvent(e){
        if(this.state == BP_STATE.PLAYING){
            var node = this.hbt_graph.processEvent(e);
            if(node){
                var behaviours = this.hbt_graph.runBehaviour(this.agent, this.context, this.accumulate_time, node);
                this.accumulate_time = 0; //runBehaviour expects time between calls

                if(this.onBehaviours) this.onBehaviours(behaviours);
                this.processBehaviours(behaviours);
            }
        }
    }

    processBehaviours(behaviours){
        if(!behaviours || behaviours.length == 0) return;
        if(!this.onActions) return; //If no callback for actions do nothing

        //Temp to manage action messages
        let behaviours_message = {type: "behaviours", data: []};
        let actions = [];

        //Process all behaviours from HBT graph
        for(var b in behaviours){
            var behaviour = behaviours[b];

            switch(behaviour.type){
                case B_TYPE.setProperty:
                    var data = behaviour.data;
                    let o = {};
                    o[data.name] = data.value;
                    this.blackboard.applyOn(o, data.type || "agent"); //TODO callback to refresh interface like in Agent.applyBehaviour (agent.js)
                    break;

                case B_TYPE.intent:
                    var obj = {};
                    //TODO properly process intents and timetables to generate behaviours in protocol format
                    var data = behaviour.data;

                    if(data.text){
                        data.type = "speech";
                        var obj = { "speech": { text: data.text } }; //speaking
                    }else{
                        data.type = "anAnimation";
                        var obj = { type: data };
                    }
                    behaviours_message.data.push(data);
                    break;

              case B_TYPE.timeline_intent:
                    var obj = {};
                    //TODO properly process intents and timetables to generate behaviours in protocol format
                    var bh = behaviour.data;
                    if(bh.data){
                        for(var i in bh.data){
                            var data = bh.data[i];

                            var obj = { type: data };

                            behaviours_message.data.push(data);
                        }
                    }else{
                        for(var i in bh){
                            var data = bh[i];
                            if(data.type == "speech"){
                                var obj = { "speech": { text: data.text } }; //speaking
                            }else{
                                var obj = { type: data };
                            }
                            behaviours_message.data.push(data);
                        }
                    }
                    break;

                case B_TYPE.action:
                    //HARCODED
                    var expressions = {
                        angry:[-0.76,-0.64],
                        happy:[0.95,-0.25],
                        sad:[-0.81,0.57],
                        surprised:[0.22,-0.98],
                        sacred:[-0.23,-0.97],
                        disgusted:[-0.97,-0.23],
                        contempt:[-0.98,0.21],
                        neutral:[0,0]
                    };
                    var va = [0,0];
                    if(behaviour.data.animation_to_merge){
                        var g = behaviour.data.animation_to_merge.toLowerCase();
                        va = expressions[g];
                    }
                    var obj = {facialExpression: {va: va}}
                    if(behaviour.data.speed){
                        obj.facialExpression.duration = behaviour.data.speed;
                    }

                    //TODO properly process intents and timetables to generate behaviours in protocol format
                    var data = behaviour.data;
                    data.type = "facialLexeme";
                    data.lexeme = data.animation_to_merge; //Wrong, just a placeholder
                    behaviours_message.data.push(data);
                    break;

                case B_TYPE.request:
                    if(behaviour.data.type.length != 0){
                        actions.push({type: "custom_action", data: behaviour.data});
                    }
                    break;
            }
        }

        if(behaviours_message.data.length) actions.push(behaviours_message);

        if(actions.length) this.onActions(actions);
    }

    //Process data message following protocol
    onData(msg){
        var type = msg.type;
        var data = msg.data;

        if(type != "data") return null;

        //Always updates data inside blackboard
        this.blackboard.apply(data); //Defined in behaviourGraph.js

        //Create event and process it in Graph
        this.onEvent(data);
    }

    //o must be graph data (data.behaviour)
    loadGraph(o){
        let graph = new HBTGraph();
        let context = new HBTContext();
        graph.graph.context = context;
        graph.graph.configure(o);

        this.hbt_graph = graph;

        return graph;
    }

    //An environment can have multiple graphs and agents, but then only 1 is executed and used...
    loadEnvironment(env){

    }

    loadCorpus(o){
		o.array = [];
		for(var i in o.data){
			o.array.push(i);
		}
        this.corpus = o;

        return o;
    }

    toJSON(type, name){

    }

}
