Javascript library for making decisions about the verbal and non-verbal behaviour of an embodied conversational agent using hybrid behaviour trees. It is based on the SAIBA multi-modal Behaviour Generation Framework and acts as a Behaviour Planner.

At runtime, the library outputs BML blocks containing a number of behaviour elements with synchronisation. The planner also waits for messages from the Behaviour Realizer to inform it of the progress of the realisation as well as what is happening in the environment (e.g. user response). Used to inform the planner (and possibly other processes) of the progress of the realisation process.


It can be easily integrated into any existing web application and the graphics can be executed without the need for the editor. 

## Features
Renders on Canvas2D (zoom in/out and panning, easy to render complex interfaces, can be used inside a WebGLTexture)
Easy to use editor (searchbox, keyboard shortcuts, multiple selection, context menu, ...)
Optimized to support hundreds of nodes per graph (on editor but also on execution)
Customizable theme (colors, shapes, background)
Callbacks to personalize every action/drawing/event of nodes
Subgraphs (nodes that contain graphs themselves)
Live mode system (hides the graph but calls nodes to render whatever they want, useful to create UIs)
Graphs can be executed in NodeJS
Highly customizable nodes (color, shape, slots vertical or horizontal, widgets, custom rendering)
Easy to integrate in any JS application (one single file, no dependencies)
Typescript support

## Nodes provided
The library provides the necessary nodes to plan the behaviour of an agent, although new nodes types can easily be created. The default ones are the following:

- Root: Starting node of the execution. 
- Selector: Execute child nodes from left to right until one succeeds (or at least not fails).
- Sequencer: Execute child nodes from left to right until one fails. As its name indicates, it is useful for a sequence of actions/conditions.
- Parallel: Execute all child nodes parallelly.
- Conditional / BoolConditional: This node takes a value from the left inputs and compares it with the one set in the inner widgets. If the condition is passed, the execution continues by this branch. If not, the execution comes back to the parent. 
- Timeline Intent: This is the most complex node. It allows you to generate verbal and non-verbal behaviours at specific times and with specific duration. Users can generate different kinds of actions, such as facial expressions, gaze control, speech, gesture, etc. And place them at the time the user thinks it fits best, and with a custom duration. These actions follow the BML specifications.
- ParseCompare: Natural language processing node, where a set of phrases with tags or entities can be defined to be identified in the text passed through the branches. If the text passes the condition/ contains the text, tags or entities put in the node, it continues with its childs. If not, it goes back to the parent. It uses [compromise library] (https://github.com/spencermountain/compromise/) to do the natural language processing.
- SetProperty: Puts a chosen property to a certain value.
- Event: This node is executed when an event of a given type occurs. Useful to capture when a message is recieved, for example, user text (user.text). The key of the message has to be specified as a property. Check the message protocol.
- TriggerNode: This node acts as a “bridge” between the current status, and another important part of the graph that might be in previous layers. Useful to create cycles in case several responses lead to dead ends and there is the need to go back to another stage. 
- CustomRequest: This is used in case the developer needs something from the scene (hosted in WebGLStudio). 
- HttpRequest: (only works on client side) This node allows making calls to external services/APIs. The inspector of the node allows you to build the http message, with headers and body of the message. There are some templates to create the body with required info (api-version, ids, texts…) 
- HttpResponse: (only works on client side) It parses the response of an HttpRequest node (this means that both are connected vertically) and detects if the code is the one set in the embedded widget (200, 201, 400)

## Installation

You can install it using npm 
```
npm install gl-matrix
npm install litegraph.js
npm install compromise
npm install compromise-numbers
npm install compromise-dates
npm install hbtree
npm install hbtree-extension
npm install behaviour-planner.js
```
Or downloading the ```build/behaviourPlanner.min.js``` version from this repository.

## Server side
It also works server-side using NodeJS although some nodes do not work in server (HttpRequest, HttpResponse).

```js
const {performance} = require('perf_hooks');
global.getTime = performance.now.bind(performance) ;
require("gl-matrix").glMatrix

LiteGraph = require("litegraph.js").LiteGraph;

require("hbtree-extension"); //(contains modified HBTree and LiteGraph)


var BehaviourPlanner = require("behaviour-planner.js").BehaviourPlanner;
var bplanner = new BehaviourPlanner();
var behaviourData = "{behaviour:{...}}" //JSON exported from BehaviourPlanner application (contains graph and environment properties)
bplanner.loadEnvironment(JSON.parse(behaviorData));

let now = performance.now(); 
let last = 0;
init()

function init(){
  
  bplanner.play();
  requestAnimationFrame(animate);
 
} 
function animate(dt){  
    last = now;
    now = performance.now();
    dt = (now - last) * 0.001;
    bplanner.update(dt);
    requestAnimationFrame(animate);
}
function requestAnimationFrame(f){
    setImmediate(()=>f(performance.now()))
}
```
