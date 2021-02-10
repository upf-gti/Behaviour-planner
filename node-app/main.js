/*
//TODO
//main.js should act as a websocket server instead of as a client so third applications can connect directly

var UTILS = require("../src/utils.js").UTILS;
var Streamer = require("../src/streamer.js").Streamer;
var streamer = new Streamer();
console.log(streamer);
*/

//Dependencies:
//npm install gl-matrix

//Base of node graph system. (There are some modifications to make it work properly with gl-matrix)
var LiteGraph = require("../src/libs/litegraph").LiteGraph;

//Expand graph system with behaviour trees and many nodes
var HBTree = require("../src/libs/HBTree")(LiteGraph);
var graphNodes = require("../src/graphNodes")(LiteGraph, HBTree);

//console.log(LiteGraph.Nodes);
