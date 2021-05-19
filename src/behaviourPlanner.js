/** BehaviourPlanner:
 * Manages and updates behaviour graphs
 */

//TODO move definition here
/*
class User{

}

class Agent{

}
*/

class Environment{
    
}

var STATE = {
    STOP: 0,
    PLAYING: 1,
};

//AKA model of application
class BehaviourPlanner{

    constructor(o){
        this._user = null;
        this._agent = null;
        this.corpus = null;
        this.entities = null;

        this._hbt_graph = null;

        this.state = STATE.STOP;
        this.last = 0;
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

    get user(){
        return this._user;
    }

    set agent(o){
        if(o.constructor !== Agent){
            console.log("Error while assigning Agent");
            return;
        }

        this._agent = o;

        if(this.hbt_graph){
            this.blackboard.agent = o;
        }
    }

    get agent(){
        return this._agent;
    }

    set hbt_graph(o){
        if(o.constructor !== HBTGraph){
            console.log("Graph must be HBTGraph");
            return;
        }

        this._hbt_graph = o;

        //LAST: Set attributes of graph blackboard
        this.blackboard.configure({
            user: this.user,
            agent: this.agent,
            corpus: this.corpus,
            entities: this.entities,
        });
    }

    get hbt_graph(){
        return this._hbt_graph;
    }

    get context(){
        return this._hbt_graph ? this._hbt_graph.graph.context : null;
    }

    get blackboard(){
        return this._hbt_graph ? this._hbt_graph.graph.context.blackboard : null;
    }

    init(){
        this.user = new User();
        this.agent = new Agent();
        this.state = STATE.STOP;
        this.last = 0;
        this.accumulate_time = 0;
        this.execution_t = 1;
    }

    configure(o){
        if(o.user) this.user = o.user;
        if(o.agent) this.agent = o.agent;

        if(o.hbt_graph) this.hbt_graph = o.hbt_graph;
    }

    play(){
        this.state = STATE.PLAYING;
    }

    stop(){
        this.state = STATE.STOP;
        this.context.last_event_node = null;
    }

    update(dt){
        if(this.state == STATE.PLAYING){
            this.accumulate_time += dt;
            if(this.accumulate_time >= this.execution_t){
                //Evaluate agent on the graph
                if(this.agent && this.hbt_graph){
                    let context = this.context;

                    //Behaviours from event can be processed after event, no?

                    if(context.last_event_node == null || context.last_event_node == undefined){
                        var behaviours = this.hbt_graph.runBehaviour(this.agent, context, this.accumulate_time);

                        if(this.onBehaviours) this.onBehaviours(behaviours);
                        this.processBehaviours(behaviours);
                    }
                }
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
                case B_TYPE.setProperty: //TODO make it work with blackboard
                    var data = behaviour.data;
                    if(!data.type || data.type == "agent"){ //TODO callback to refresh interface like in Agent.applyBehaviour (agent.js)
                        this.agent.properties[data.name] = data.value;
                    }else if(data.type == "user"){
                        this.user.properties[data.name] = data.value;
                    }
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
        //Currently hardcoded to user
        //TODO apply to any data
        this.context.blackboard.apply(data);

        //Create event and process it in Graph
        this.onEvent(data);
    }

    onEvent(e){
        if(this.state == STATE.PLAYING){
            var node = this.hbt_graph.processEvent(e);
            if(node){
                var behaviours = this.hbt_graph.runBehaviour(this.agent, this.context, this.accumulate_time, node);
                if(this.onBehaviours) this.onBehaviours(behaviours);
                this.processBehaviours(behaviours);
            }
        }
    }

    loadGraph(data){

    }

    loadEnvironment(data){

    }

    loadCorpusData(data){

    }

    toJSON(type, name){

    }

    downloadJSON(type, name){

    }

    


}
