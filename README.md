# Behaviour Planner
![status: development](https://img.shields.io/badge/status-development-blue.svg)

Web application to design and execute virtual agent behaviours.
--
This work is done in the context of the PRESENT project, built on top of previours work in SAUCE project.

---

The application uses modified decision trees to decide the behaviour of an agent. The trees are presented as a graph in the web editor to provide a visual way to design complex behavior using a node based programming approach. This web application allows to create new behaviour trees and test them using the build in chat (that simulates user input speech) and a provided scene created using a 3D web editor, WebGLStudio. The scene can be changed for another as long as it is created in the context of the mentioned editor.

Depending on the user inputs (i.e. speech, emotion, gestures) and the context, the tree decides which actions the agent may take and/or what the application should do. This set of actions has been grouped as what we call ‘intentions’, a series of co-related actions organized on time through temporal marks. These intention actions may include verbal and non-verbal speech, pose and emotion shifts among others. The context can contain the information received from the user, other services or previous behaviours of the agent.

When the Behaviour Planner executes a behaviour tree it uses a websocket connection. Meanwhile, the web application uses a websocket connection with a server that acts as a middleman to be able to receive and send data between other applications. The server supports differents sessions.
