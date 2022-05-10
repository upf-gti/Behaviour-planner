# Behaviour Planner
![status: development](https://img.shields.io/badge/status-development-blue.svg) 
[<img alt="alt_text" width="20px" style="filter:invert(1)" src="imgs/github.png" />](https://github.com/upf-gti/Behaviour-planner)

Web application to design and execute virtual agent behaviours.
--
This work is done in the context of the PRESENT project, built on top of previours work in SAUCE project.

---

The application uses modified decision trees to decide the behaviour of an agent. The trees are presented as a graph in the web editor to provide a visual way to design complex behavior using a node based programming approach. This web application allows to create new behaviour trees and test them using the build in chat (that simulates user input speech) and a provided scene created using a 3D web editor, WebGLStudio. The scene can be changed for another as long as it is created in the context of the mentioned editor.

Depending on the user inputs (i.e. speech, emotion, gestures) and the context, the tree decides which actions the agent may take and/or what the application should do. This set of actions has been grouped as what we call ‘intentions’, a series of co-related actions organized on time through temporal marks. These intention actions may include verbal and non-verbal speech, pose and emotion shifts among others. The context can contain the information received from the user, other services or previous behaviours of the agent.

When the Behaviour Planner executes a behaviour tree it uses a websocket connection. Meanwhile, the web application uses a websocket connection with a server that acts as a middleman to be able to receive and send data between other applications. The server supports differents sessions.

## Nodes provided
The library provides the necessary nodes to plan the behaviour of an agent, although new nodes types can easily be created. The default ones are the following:

<img alt="alt_text" width="100px"  src="./imgs/nodes/root.png" />

- **Root**: Starting node of the execution. 

<img alt="alt_text" width="100px"  src="./imgs/nodes/selector.png" />

- **Selector**: Execute child nodes from left to right until one succeeds (or at least not fails).
- **Sequencer**: Execute child nodes from left to right until one fails. As its name indicates, it is useful for a sequence of actions/conditions.
- **Parallel**: Execute all child nodes parallelly.

<img alt="alt_text" width="100px"  src="https://github.com/upf-gti/Behaviour-planner/blob/dev/web-app/imgs/nodes/conditional.png" />

- **Conditional / BoolConditional**: This node takes a value from the left inputs and compares it with the one set in the inner widgets. If the condition is passed, the execution continues by this branch. If not, the execution comes back to the parent. 
- **Timeline Intent**: This is the most complex node. It allows you to generate verbal and non-verbal behaviours at specific times and with specific duration. Users can generate different kinds of actions, such as facial expressions, gaze control, speech, gesture, etc. And place them at the time the user thinks it fits best, and with a custom duration. These actions follow the BML specifications.
- **ParseCompare**: Natural language processing node, where a set of phrases with tags or entities can be defined to be identified in the text passed through the branches. If the text passes the condition/ contains the text, tags or entities put in the node, it continues with its childs. If not, it goes back to the parent. It uses [compromise library](https://github.com/spencermountain/compromise/) to do the natural language processing.
- **SetProperty**: Puts a chosen property to a certain value.
- **Event**: This node is executed when an event of a given type occurs. Useful to capture when a message is recieved, for example, user text (user.text). The key of the message has to be specified as a property. Check the message protocol.
- **TriggerNode**: This node acts as a “bridge” between the current status, and another important part of the graph that might be in previous layers. Useful to create cycles in case several responses lead to dead ends and there is the need to go back to another stage. 
- **CustomRequest**: This is used in case the developer needs something from the scene (hosted in WebGLStudio). 
- **HttpRequest**: (only works on client side) This node allows making calls to external services/APIs. The inspector of the node allows you to build the http message, with headers and body of the message. There are some templates to create the body with required info (api-version, ids, texts…) 
- **HttpResponse**: (only works on client side) It parses the response of an HttpRequest node (this means that both are connected vertically) and detects if the code is the one set in the embedded widget (200, 201, 400)
