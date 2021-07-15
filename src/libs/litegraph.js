//packer version

(function(global) {
    // *************************************************************
    //   LiteGraph CLASS                                     *******
    // *************************************************************

    /**
     * The Global Scope. It contains all the registered node classes.
     *
     * @class LiteGraph
     * @constructor
     */

    var LiteGraph = (global.LiteGraph = {
        VERSION: 0.4,

        CANVAS_GRID_SIZE: 10,

        NODE_TITLE_HEIGHT: 30,
        NODE_TITLE_TEXT_Y: 20,
        NODE_SLOT_HEIGHT: 20,
        NODE_WIDGET_HEIGHT: 20,
        NODE_WIDTH: 140,
        NODE_MIN_WIDTH: 50,
        NODE_COLLAPSED_RADIUS: 10,
        NODE_COLLAPSED_WIDTH: 80,
        NODE_TITLE_COLOR: "#999",
        NODE_TEXT_SIZE: 14,
        NODE_TEXT_COLOR: "#AAA",
        NODE_SUBTEXT_SIZE: 12,
        NODE_DEFAULT_COLOR: "#333",
        NODE_DEFAULT_BGCOLOR: "#353535",
        NODE_DEFAULT_BOXCOLOR: "#666",
        NODE_DEFAULT_SHAPE: "box",
        DEFAULT_SHADOW_COLOR: "rgba(0,0,0,0.5)",
        DEFAULT_GROUP_FONT: 24,

		WIDGET_BGCOLOR: "#222",
		WIDGET_OUTLINE_COLOR: "#666",
		WIDGET_TEXT_COLOR: "#DDD",
		WIDGET_SECONDARY_TEXT_COLOR: "#999",

        LINK_COLOR: "#9A9",
        EVENT_LINK_COLOR: "#A86",
        CONNECTING_LINK_COLOR: "#AFA",

        MAX_NUMBER_OF_NODES: 1000, //avoid infinite loops
        DEFAULT_POSITION: [100, 100], //default node position
        VALID_SHAPES: ["default", "box", "round", "card"], //,"circle"

        //shapes are used for nodes but also for slots
        BOX_SHAPE: 1,
        ROUND_SHAPE: 2,
        CIRCLE_SHAPE: 3,
        CARD_SHAPE: 4,
        ARROW_SHAPE: 5,

        //enums
        INPUT: 1,
        OUTPUT: 2,

        EVENT: -1, //for outputs
        ACTION: -1, //for inputs

        ALWAYS: 0,
        ON_EVENT: 1,
        NEVER: 2,
        ON_TRIGGER: 3,

        UP: 1,
        DOWN: 2,
        LEFT: 3,
        RIGHT: 4,
        CENTER: 5,

        STRAIGHT_LINK: 0,
        LINEAR_LINK: 1,
        SPLINE_LINK: 2,

        NORMAL_TITLE: 0,
        NO_TITLE: 1,
        TRANSPARENT_TITLE: 2,
        AUTOHIDE_TITLE: 3,

        proxy: null, //used to redirect calls
        node_images_path: "",

        debug: false,
        catch_exceptions: true,
        throw_errors: true,
        allow_scripts: false, //if set to true some nodes like Formula would be allowed to evaluate code that comes from unsafe sources (like node configuration), which could lead to exploits
        registered_node_types: {}, //nodetypes by string
        node_types_by_file_extension: {}, //used for dropping files in the canvas
        Nodes: {}, //node types by classname

        searchbox_extras: {}, //used to add extra features to the search box

        /**
         * Register a node class so it can be listed when the user wants to create a new one
         * @method registerNodeType
         * @param {String} type name of the node and path
         * @param {Class} base_class class containing the structure of a node
         */

        registerNodeType: function(type, base_class) {
            if (!base_class.prototype) {
                throw "Cannot register a simple object, it must be a class with a prototype";
            }
            base_class.type = type;

            if (LiteGraph.debug) {
                console.log("Node registered: " + type);
            }

            var categories = type.split("/");
            var classname = base_class.name;

            var pos = type.lastIndexOf("/");
            base_class.category = type.substr(0, pos);

            if (!base_class.title) {
                base_class.title = classname;
            }
            //info.name = name.substr(pos+1,name.length - pos);

            //extend class
            if (base_class.prototype) {
                //is a class
                for (var i in LGraphNode.prototype) {
                    if (!base_class.prototype[i]) {
                        base_class.prototype[i] = LGraphNode.prototype[i];
                    }
                }
            }

            var prev = this.registered_node_types[type];
			if(prev)
				console.log("replacing node type: " + type);
			else
			{
				if( !Object.hasOwnProperty( base_class.prototype, "shape") )
				Object.defineProperty(base_class.prototype, "shape", {
					set: function(v) {
						switch (v) {
							case "default":
								delete this._shape;
								break;
							case "box":
								this._shape = LiteGraph.BOX_SHAPE;
								break;
							case "round":
								this._shape = LiteGraph.ROUND_SHAPE;
								break;
							case "circle":
								this._shape = LiteGraph.CIRCLE_SHAPE;
								break;
							case "card":
								this._shape = LiteGraph.CARD_SHAPE;
								break;
							default:
								this._shape = v;
						}
					},
					get: function(v) {
						return this._shape;
					},
					enumerable: true,
					configurable: true
				});

				//warnings
				if (base_class.prototype.onPropertyChange) {
					console.warn(
						"LiteGraph node class " +
							type +
							" has onPropertyChange method, it must be called onPropertyChanged with d at the end"
					);
				}

				//used to know which nodes create when dragging files to the canvas
				if (base_class.supported_extensions) {
					for (var i in base_class.supported_extensions) {
						var ext = base_class.supported_extensions[i];
						if(ext && ext.constructor === String)
							this.node_types_by_file_extension[ ext.toLowerCase() ] = base_class;
					}
				}
			}

            this.registered_node_types[type] = base_class;
            if (base_class.constructor.name) {
                this.Nodes[classname] = base_class;
            }
            if (LiteGraph.onNodeTypeRegistered) {
                LiteGraph.onNodeTypeRegistered(type, base_class);
            }
            if (prev && LiteGraph.onNodeTypeReplaced) {
                LiteGraph.onNodeTypeReplaced(type, base_class, prev);
            }
        },

        /**
         * removes a node type from the system
         * @method unregisterNodeType
         * @param {String|Object} type name of the node or the node constructor itself
         */
        unregisterNodeType: function(type) {
			var base_class = type.constructor === String ? this.registered_node_types[type] : type;
			if(!base_class)
				throw("node type not found: " + type );
			delete this.registered_node_types[base_class.type];
			if(base_class.constructor.name)
				delete this.Nodes[base_class.constructor.name];
		},

        /**
         * Create a new nodetype by passing a function, it wraps it with a proper class and generates inputs according to the parameters of the function.
         * Useful to wrap simple methods that do not require properties, and that only process some input to generate an output.
         * @method wrapFunctionAsNode
         * @param {String} name node name with namespace (p.e.: 'math/sum')
         * @param {Function} func
         * @param {Array} param_types [optional] an array containing the type of every parameter, otherwise parameters will accept any type
         * @param {String} return_type [optional] string with the return type, otherwise it will be generic
         * @param {Object} properties [optional] properties to be configurable
         */
        wrapFunctionAsNode: function(
            name,
            func,
            param_types,
            return_type,
            properties
        ) {
            var params = Array(func.length);
            var code = "";
            var names = LiteGraph.getParameterNames(func);
            for (var i = 0; i < names.length; ++i) {
                code +=
                    "this.addInput('" +
                    names[i] +
                    "'," +
                    (param_types && param_types[i]
                        ? "'" + param_types[i] + "'"
                        : "0") +
                    ");\n";
            }
            code +=
                "this.addOutput('out'," +
                (return_type ? "'" + return_type + "'" : 0) +
                ");\n";
            if (properties) {
                code +=
                    "this.properties = " + JSON.stringify(properties) + ";\n";
            }
            var classobj = Function(code);
            classobj.title = name.split("/").pop();
            classobj.desc = "Generated from " + func.name;
            classobj.prototype.onExecute = function onExecute() {
                for (var i = 0; i < params.length; ++i) {
                    params[i] = this.getInputData(i);
                }
                var r = func.apply(this, params);
                this.setOutputData(0, r);
            };
            this.registerNodeType(name, classobj);
        },

        /**
         * Adds this method to all nodetypes, existing and to be created
         * (You can add it to LGraphNode.prototype but then existing node types wont have it)
         * @method addNodeMethod
         * @param {Function} func
         */
        addNodeMethod: function(name, func) {
            LGraphNode.prototype[name] = func;
            for (var i in this.registered_node_types) {
                var type = this.registered_node_types[i];
                if (type.prototype[name]) {
                    type.prototype["_" + name] = type.prototype[name];
                } //keep old in case of replacing
                type.prototype[name] = func;
            }
        },

        /**
         * Create a node of a given type with a name. The node is not attached to any graph yet.
         * @method createNode
         * @param {String} type full name of the node class. p.e. "math/sin"
         * @param {String} name a name to distinguish from other nodes
         * @param {Object} options to set options
         */

        createNode: function(type, title, options) {
            var base_class = this.registered_node_types[type];
            if (!base_class) {
                if (LiteGraph.debug) {
                    console.log(
                        'GraphNode type "' + type + '" not registered.'
                    );
                }
                return null;
            }

            var prototype = base_class.prototype || base_class;

            title = title || base_class.title || type;

            var node = null;

            if (LiteGraph.catch_exceptions) {
                try {
                    node = new base_class(title);
                } catch (err) {
                    console.error(err);
                    return null;
                }
            } else {
                node = new base_class(title);
            }

            node.type = type;

            if (!node.title && title) {
                node.title = title;
            }
            if (!node.properties) {
                node.properties = {};
            }
            if (!node.properties_info) {
                node.properties_info = [];
            }
            if (!node.flags) {
                node.flags = {};
            }
            if (!node.size) {
                node.size = node.computeSize();
                node.setDirtyCanvas(true, true);
            }
            if (!node.pos) {
                node.pos = LiteGraph.DEFAULT_POSITION.concat();
            }
            if (!node.mode) {
                node.mode = LiteGraph.ALWAYS;
            }

            //extra options
            if (options) {
                for (var i in options) {
                    node[i] = options[i];
                }
            }

            return node;
        },

        /**
         * Returns a registered node type with a given name
         * @method getNodeType
         * @param {String} type full name of the node class. p.e. "math/sin"
         * @return {Class} the node class
         */
        getNodeType: function(type) {
            return this.registered_node_types[type];
        },

        /**
         * Returns a list of node types matching one category
         * @method getNodeType
         * @param {String} category category name
         * @return {Array} array with all the node classes
         */

        getNodeTypesInCategory: function(category, filter) {
            var r = [];
            for (var i in this.registered_node_types) {
                var type = this.registered_node_types[i];
                if (type.filter != filter) {
                    continue;
                }

                if (category == "") {
                    if (type.category == null) {
                        r.push(type);
                    }
                } else if (type.category == category) {
                    r.push(type);
                }
            }

            return r;
        },

        /**
         * Returns a list with all the node type categories
         * @method getNodeTypesCategories
         * @param {String} filter only nodes with ctor.filter equal can be shown
         * @return {Array} array with all the names of the categories
         */
        getNodeTypesCategories: function( filter ) {
            var categories = { "": 1 };
            for (var i in this.registered_node_types) {
				var type = this.registered_node_types[i];
                if ( type.category && !type.skip_list )
                {
					if(type.filter != filter)
						continue;
                    categories[type.category] = 1;
                }
            }
            var result = [];
            for (var i in categories) {
                result.push(i);
            }
            return result;
        },

        //debug purposes: reloads all the js scripts that matches a wildcard
        reloadNodes: function(folder_wildcard) {
            var tmp = document.getElementsByTagName("script");
            //weird, this array changes by its own, so we use a copy
            var script_files = [];
            for (var i in tmp) {
                script_files.push(tmp[i]);
            }

            var docHeadObj = document.getElementsByTagName("head")[0];
            folder_wildcard = document.location.href + folder_wildcard;

            for (var i in script_files) {
                var src = script_files[i].src;
                if (
                    !src ||
                    src.substr(0, folder_wildcard.length) != folder_wildcard
                ) {
                    continue;
                }

                try {
                    if (LiteGraph.debug) {
                        console.log("Reloading: " + src);
                    }
                    var dynamicScript = document.createElement("script");
                    dynamicScript.type = "text/javascript";
                    dynamicScript.src = src;
                    docHeadObj.appendChild(dynamicScript);
                    docHeadObj.removeChild(script_files[i]);
                } catch (err) {
                    if (LiteGraph.throw_errors) {
                        throw err;
                    }
                    if (LiteGraph.debug) {
                        console.log("Error while reloading " + src);
                    }
                }
            }

            if (LiteGraph.debug) {
                console.log("Nodes reloaded");
            }
        },

        //separated just to improve if it doesn't work
        cloneObject: function(obj, target) {
            if (obj == null) {
                return null;
            }
            var r = JSON.parse(JSON.stringify(obj));
            if (!target) {
                return r;
            }

            for (var i in r) {
                target[i] = r[i];
            }
            return target;
        },

        /**
         * Returns if the types of two slots are compatible (taking into account wildcards, etc)
         * @method isValidConnection
         * @param {String} type_a
         * @param {String} type_b
         * @return {Boolean} true if they can be connected
         */
        isValidConnection: function(type_a, type_b) {
            if (
                !type_a || //generic output
                !type_b || //generic input
                type_a == type_b || //same type (is valid for triggers)
                (type_a == LiteGraph.EVENT && type_b == LiteGraph.ACTION)
            ) {
                return true;
            }

            // Enforce string type to handle toLowerCase call (-1 number not ok)
            type_a = String(type_a);
            type_b = String(type_b);
            type_a = type_a.toLowerCase();
            type_b = type_b.toLowerCase();

            // For nodes supporting multiple connection types
            if (type_a.indexOf(",") == -1 && type_b.indexOf(",") == -1) {
                return type_a == type_b;
            }

            // Check all permutations to see if one is valid
            var supported_types_a = type_a.split(",");
            var supported_types_b = type_b.split(",");
            for (var i = 0; i < supported_types_a.length; ++i) {
                for (var j = 0; j < supported_types_b.length; ++j) {
                    if (supported_types_a[i] == supported_types_b[j]) {
                        return true;
                    }
                }
            }

            return false;
        },

        /**
         * Register a string in the search box so when the user types it it will recommend this node
         * @method registerSearchboxExtra
         * @param {String} node_type the node recommended
         * @param {String} description text to show next to it
         * @param {Object} data it could contain info of how the node should be configured
         * @return {Boolean} true if they can be connected
         */
        registerSearchboxExtra: function(node_type, description, data) {
            this.searchbox_extras[description.toLowerCase()] = {
                type: node_type,
                desc: description,
                data: data
            };
        },

        /**
         * Wrapper to load files (from url using fetch or from file using FileReader)
         * @method fetchFile
         * @param {String|File|Blob} url the url of the file (or the file itself)
         * @param {String} type an string to know how to fetch it: "text","arraybuffer","json","blob"
         * @param {Function} on_complete callback(data)
         * @param {Function} on_error in case of an error
         * @return {FileReader|Promise} returns the object used to 
         */
		fetchFile: function( url, type, on_complete, on_error ) {
			var that = this;
			if(!url)
				return null;

			type = type || "text";
			if( url.constructor === String )
			{
				if (url.substr(0, 4) == "http" && LiteGraph.proxy) {
					url = LiteGraph.proxy + url.substr(url.indexOf(":") + 3);
				}
				return fetch(url)
				.then(function(response) {
					if(!response.ok)
						 throw new Error("File not found"); //it will be catch below
					if(type == "arraybuffer")
						return response.arrayBuffer();
					else if(type == "text" || type == "string")
						return response.text();
					else if(type == "json")
						return response.json();
					else if(type == "blob")
						return response.blob();
				})
				.then(function(data) {
					if(on_complete)
						on_complete(data);
				})
				.catch(function(error) {
					console.error("error fetching file:",url);
					if(on_error)
						on_error(error);
				});
			}
			else if( url.constructor === File || url.constructor === Blob)
			{
				var reader = new FileReader();
				reader.onload = function(e)
				{
					var v = e.target.result;
					if( type == "json" )
						v = JSON.parse(v);
					if(on_complete)
						on_complete(v);
				}
				if(type == "arraybuffer")
					return reader.readAsArrayBuffer(url);
				else if(type == "text" || type == "json")
					return reader.readAsText(url);
				else if(type == "blob")
					return reader.readAsBinaryString(url);
			}
			return null;
		}
    });

    //timer that works everywhere
    if (typeof performance != "undefined") {
        LiteGraph.getTime = performance.now.bind(performance);
    } else if (typeof Date != "undefined" && Date.now) {
        LiteGraph.getTime = Date.now.bind(Date);
    } else if (typeof process != "undefined") {
        LiteGraph.getTime = function() {
            var t = process.hrtime();
            return t[0] * 0.001 + t[1] * 1e-6;
        };
    } else {
        LiteGraph.getTime = function getTime() {
            return new Date().getTime();
        };
    }

    //*********************************************************************************
    // LGraph CLASS
    //*********************************************************************************

    /**
     * LGraph is the class that contain a full graph. We instantiate one and add nodes to it, and then we can run the execution loop.
	 * supported callbacks:
		+ onNodeAdded: when a new node is added to the graph
		+ onNodeRemoved: when a node inside this graph is removed
		+ onNodeConnectionChange: some connection has changed in the graph (connected or disconnected)
     *
     * @class LGraph
     * @constructor
     * @param {Object} o data from previous serialization [optional]
     */

    function LGraph(o) {
        if (LiteGraph.debug) {
            console.log("Graph created");
        }
        this.list_of_graphcanvas = null;
        this.clear();

        if (o) {
            this.configure(o);
        }
    }

    global.LGraph = LiteGraph.LGraph = LGraph;

    //default supported types
    LGraph.supported_types = ["number", "string", "boolean"];

    //used to know which types of connections support this graph (some graphs do not allow certain types)
    LGraph.prototype.getSupportedTypes = function() {
        return this.supported_types || LGraph.supported_types;
    };

    LGraph.STATUS_STOPPED = 1;
    LGraph.STATUS_RUNNING = 2;

    /**
     * Removes all nodes from this graph
     * @method clear
     */

    LGraph.prototype.clear = function() {
        this.stop();
        this.status = LGraph.STATUS_STOPPED;

        this.last_node_id = 0;
        this.last_link_id = 0;

        this._version = -1; //used to detect changes

        //safe clear
        if (this._nodes) {
            for (var i = 0; i < this._nodes.length; ++i) {
                var node = this._nodes[i];
                if (node.onRemoved) {
                    node.onRemoved();
                }
            }
        }

        //nodes
        this._nodes = [];
        this._nodes_by_id = {};
        this._nodes_in_order = []; //nodes sorted in execution order
        this._nodes_executable = null; //nodes that contain onExecute sorted in execution order

        //other scene stuff
        this._groups = [];

        //links
        this.links = {}; //container with all the links

        //iterations
        this.iteration = 0;

        //custom data
        this.config = {};
		this.vars = {};
		this.extra = {}; //to store custom data

        //timing
        this.globaltime = 0;
        this.runningtime = 0;
        this.fixedtime = 0;
        this.fixedtime_lapse = 0.01;
        this.elapsed_time = 0.01;
        this.last_update_time = 0;
        this.starttime = 0;

        this.catch_errors = true;

        //subgraph_data
        this.inputs = {};
        this.outputs = {};

        //notify canvas to redraw
        this.change();

        this.sendActionToCanvas("clear");
    };

    /**
     * Attach Canvas to this graph
     * @method attachCanvas
     * @param {GraphCanvas} graph_canvas
     */

    LGraph.prototype.attachCanvas = function(graphcanvas) {
        if (graphcanvas.constructor != LGraphCanvas) {
            throw "attachCanvas expects a LGraphCanvas instance";
        }
        if (graphcanvas.graph && graphcanvas.graph != this) {
            graphcanvas.graph.detachCanvas(graphcanvas);
        }

        graphcanvas.graph = this;

        if (!this.list_of_graphcanvas) {
            this.list_of_graphcanvas = [];
        }
        this.list_of_graphcanvas.push(graphcanvas);
    };

    /**
     * Detach Canvas from this graph
     * @method detachCanvas
     * @param {GraphCanvas} graph_canvas
     */
    LGraph.prototype.detachCanvas = function(graphcanvas) {
        if (!this.list_of_graphcanvas) {
            return;
        }

        var pos = this.list_of_graphcanvas.indexOf(graphcanvas);
        if (pos == -1) {
            return;
        }
        graphcanvas.graph = null;
        this.list_of_graphcanvas.splice(pos, 1);
    };

    /**
     * Starts running this graph every interval milliseconds.
     * @method start
     * @param {number} interval amount of milliseconds between executions, if 0 then it renders to the monitor refresh rate
     */

    LGraph.prototype.start = function(interval) {
        if (this.status == LGraph.STATUS_RUNNING) {
            return;
        }
        this.status = LGraph.STATUS_RUNNING;

        if (this.onPlayEvent) {
            this.onPlayEvent();
        }

        this.sendEventToAllNodes("onStart");

        //launch
        this.starttime = LiteGraph.getTime();
        this.last_update_time = this.starttime;
        interval = interval || 0;
        var that = this;

		//execute once per frame
        if ( interval == 0 && typeof window != "undefined" && window.requestAnimationFrame ) {
            function on_frame() {
                if (that.execution_timer_id != -1) {
                    return;
                }
                window.requestAnimationFrame(on_frame);
				if(that.onBeforeStep)
					that.onBeforeStep();
                that.runStep(1, !that.catch_errors);
				if(that.onAfterStep)
					that.onAfterStep();
            }
            this.execution_timer_id = -1;
            on_frame();
        } else { //execute every 'interval' ms
            this.execution_timer_id = setInterval(function() {
                //execute
				if(that.onBeforeStep)
					that.onBeforeStep();
                that.runStep(1, !that.catch_errors);
				if(that.onAfterStep)
					that.onAfterStep();
            }, interval);
        }
    };

    /**
     * Stops the execution loop of the graph
     * @method stop execution
     */

    LGraph.prototype.stop = function() {
        if (this.status == LGraph.STATUS_STOPPED) {
            return;
        }

        this.status = LGraph.STATUS_STOPPED;

        if (this.onStopEvent) {
            this.onStopEvent();
        }

        if (this.execution_timer_id != null) {
            if (this.execution_timer_id != -1) {
                clearInterval(this.execution_timer_id);
            }
            this.execution_timer_id = null;
        }

        this.sendEventToAllNodes("onStop");
    };

    /**
     * Run N steps (cycles) of the graph
     * @method runStep
     * @param {number} num number of steps to run, default is 1
     * @param {Boolean} do_not_catch_errors [optional] if you want to try/catch errors 
     * @param {number} limit max number of nodes to execute (used to execute from start to a node)
     */

    LGraph.prototype.runStep = function(num, do_not_catch_errors, limit ) {
        num = num || 1;

        var start = LiteGraph.getTime();
        this.globaltime = 0.001 * (start - this.starttime);

        var nodes = this._nodes_executable
            ? this._nodes_executable
            : this._nodes;
        if (!nodes) {
            return;
        }

		limit = limit || nodes.length;

        if (do_not_catch_errors) {
            //iterations
            for (var i = 0; i < num; i++) {
                for (var j = 0; j < limit; ++j) {
                    var node = nodes[j];
                    if (node.mode == LiteGraph.ALWAYS && node.onExecute) {
                        node.onExecute(); //hard to send elapsed time
                    }
                }

                this.fixedtime += this.fixedtime_lapse;
                if (this.onExecuteStep) {
                    this.onExecuteStep();
                }
            }

            if (this.onAfterExecute) {
                this.onAfterExecute();
            }
        } else {
            try {
                //iterations
                for (var i = 0; i < num; i++) {
                    for (var j = 0; j < limit; ++j) {
                        var node = nodes[j];
                        if (node.mode == LiteGraph.ALWAYS && node.onExecute) {
                            node.onExecute();
                        }
                    }

                    this.fixedtime += this.fixedtime_lapse;
                    if (this.onExecuteStep) {
                        this.onExecuteStep();
                    }
                }

                if (this.onAfterExecute) {
                    this.onAfterExecute();
                }
                this.errors_in_execution = false;
            } catch (err) {
                this.errors_in_execution = true;
                if (LiteGraph.throw_errors) {
                    throw err;
                }
                if (LiteGraph.debug) {
                    console.log("Error during execution: " + err);
                }
                this.stop();
            }
        }

        var now = LiteGraph.getTime();
        var elapsed = now - start;
        if (elapsed == 0) {
            elapsed = 1;
        }
        this.execution_time = 0.001 * elapsed;
        this.globaltime += 0.001 * elapsed;
        this.iteration += 1;
        this.elapsed_time = (now - this.last_update_time) * 0.001;
        this.last_update_time = now;
    };

    /**
     * Updates the graph execution order according to relevance of the nodes (nodes with only outputs have more relevance than
     * nodes with only inputs.
     * @method updateExecutionOrder
     */
    LGraph.prototype.updateExecutionOrder = function() {
        this._nodes_in_order = this.computeExecutionOrder(false);
        this._nodes_executable = [];
        for (var i = 0; i < this._nodes_in_order.length; ++i) {
            if (this._nodes_in_order[i].onExecute) {
                this._nodes_executable.push(this._nodes_in_order[i]);
            }
        }
    };

    //This is more internal, it computes the executable nodes in order and returns it
    LGraph.prototype.computeExecutionOrder = function(
        only_onExecute,
        set_level
    ) {
        var L = [];
        var S = [];
        var M = {};
        var visited_links = {}; //to avoid repeating links
        var remaining_links = {}; //to a

        //search for the nodes without inputs (starting nodes)
        for (var i = 0, l = this._nodes.length; i < l; ++i) {
            var node = this._nodes[i];
            if (only_onExecute && !node.onExecute) {
                continue;
            }

            M[node.id] = node; //add to pending nodes

            var num = 0; //num of input connections
            if (node.inputs) {
                for (var j = 0, l2 = node.inputs.length; j < l2; j++) {
                    if (node.inputs[j] && node.inputs[j].link != null) {
                        num += 1;
                    }
                }
            }

            if (num == 0) {
                //is a starting node
                S.push(node);
                if (set_level) {
                    node._level = 1;
                }
            } //num of input links
            else {
                if (set_level) {
                    node._level = 0;
                }
                remaining_links[node.id] = num;
            }
        }

        while (true) {
            if (S.length == 0) {
                break;
            }

            //get an starting node
            var node = S.shift();
            L.push(node); //add to ordered list
            delete M[node.id]; //remove from the pending nodes

            if (!node.outputs) {
                continue;
            }

            //for every output
            for (var i = 0; i < node.outputs.length; i++) {
                var output = node.outputs[i];
                //not connected
                if (
                    output == null ||
                    output.links == null ||
                    output.links.length == 0
                ) {
                    continue;
                }

                //for every connection
                for (var j = 0; j < output.links.length; j++) {
                    var link_id = output.links[j];
                    var link = this.links[link_id];
                    if (!link) {
                        continue;
                    }

                    //already visited link (ignore it)
                    if (visited_links[link.id]) {
                        continue;
                    }

                    var target_node = this.getNodeById(link.target_id);
                    if (target_node == null) {
                        visited_links[link.id] = true;
                        continue;
                    }

                    if (
                        set_level &&
                        (!target_node._level ||
                            target_node._level <= node._level)
                    ) {
                        target_node._level = node._level + 1;
                    }

                    visited_links[link.id] = true; //mark as visited
                    remaining_links[target_node.id] -= 1; //reduce the number of links remaining
                    if (remaining_links[target_node.id] == 0) {
                        S.push(target_node);
                    } //if no more links, then add to starters array
                }
            }
        }

        //the remaining ones (loops)
        for (var i in M) {
            L.push(M[i]);
        }

        if (L.length != this._nodes.length && LiteGraph.debug) {
            console.warn("something went wrong, nodes missing");
        }

        var l = L.length;

        //save order number in the node
        for (var i = 0; i < l; ++i) {
            L[i].order = i;
        }

        //sort now by priority
        L = L.sort(function(A, B) {
            var Ap = A.constructor.priority || A.priority || 0;
            var Bp = B.constructor.priority || B.priority || 0;
            if (Ap == Bp) {
                //if same priority, sort by order
                return A.order - B.order;
            }
            return Ap - Bp; //sort by priority
        });

        //save order number in the node, again...
        for (var i = 0; i < l; ++i) {
            L[i].order = i;
        }

        return L;
    };

    /**
     * Returns all the nodes that could affect this one (ancestors) by crawling all the inputs recursively.
     * It doesn't include the node itself
     * @method getAncestors
     * @return {Array} an array with all the LGraphNodes that affect this node, in order of execution
     */
    LGraph.prototype.getAncestors = function(node) {
        var ancestors = [];
        var pending = [node];
        var visited = {};

        while (pending.length) {
            var current = pending.shift();
            if (!current.inputs) {
                continue;
            }
            if (!visited[current.id] && current != node) {
                visited[current.id] = true;
                ancestors.push(current);
            }

            for (var i = 0; i < current.inputs.length; ++i) {
                var input = current.getInputNode(i);
                if (input && ancestors.indexOf(input) == -1) {
                    pending.push(input);
                }
            }
        }

        ancestors.sort(function(a, b) {
            return a.order - b.order;
        });
        return ancestors;
    };

    /**
     * Positions every node in a more readable manner
     * @method arrange
     */
    LGraph.prototype.arrange = function(margin) {
        margin = margin || 100;

        var nodes = this.computeExecutionOrder(false, true);
        var columns = [];
        for (var i = 0; i < nodes.length; ++i) {
            var node = nodes[i];
            var col = node._level || 1;
            if (!columns[col]) {
                columns[col] = [];
            }
            columns[col].push(node);
        }

        var x = margin;

        for (var i = 0; i < columns.length; ++i) {
            var column = columns[i];
            if (!column) {
                continue;
            }
            var max_size = 100;
            var y = margin + LiteGraph.NODE_TITLE_HEIGHT;
            for (var j = 0; j < column.length; ++j) {
                var node = column[j];
                node.pos[0] = x;
                node.pos[1] = y;
                if (node.size[0] > max_size) {
                    max_size = node.size[0];
                }
                y += node.size[1] + margin + LiteGraph.NODE_TITLE_HEIGHT;
            }
            x += max_size + margin;
        }

        this.setDirtyCanvas(true, true);
    };

    /**
     * Returns the amount of time the graph has been running in milliseconds
     * @method getTime
     * @return {number} number of milliseconds the graph has been running
     */
    LGraph.prototype.getTime = function() {
        return this.globaltime;
    };

    /**
     * Returns the amount of time accumulated using the fixedtime_lapse var. This is used in context where the time increments should be constant
     * @method getFixedTime
     * @return {number} number of milliseconds the graph has been running
     */

    LGraph.prototype.getFixedTime = function() {
        return this.fixedtime;
    };

    /**
     * Returns the amount of time it took to compute the latest iteration. Take into account that this number could be not correct
     * if the nodes are using graphical actions
     * @method getElapsedTime
     * @return {number} number of milliseconds it took the last cycle
     */

    LGraph.prototype.getElapsedTime = function() {
        return this.elapsed_time;
    };

    /**
     * Sends an event to all the nodes, useful to trigger stuff
     * @method sendEventToAllNodes
     * @param {String} eventname the name of the event (function to be called)
     * @param {Array} params parameters in array format
     */
    LGraph.prototype.sendEventToAllNodes = function(eventname, params, mode) {
        mode = mode || LiteGraph.ALWAYS;

        var nodes = this._nodes_in_order ? this._nodes_in_order : this._nodes;
        if (!nodes) {
            return;
        }

        for (var j = 0, l = nodes.length; j < l; ++j) {
            var node = nodes[j];

            if (
                node.constructor === LiteGraph.Subgraph &&
                eventname != "onExecute"
            ) {
                if (node.mode == mode) {
                    node.sendEventToAllNodes(eventname, params, mode);
                }
                continue;
            }

            if (!node[eventname] || node.mode != mode) {
                continue;
            }
            if (params === undefined) {
                node[eventname]();
            } else if (params && params.constructor === Array) {
                node[eventname].apply(node, params);
            } else {
                node[eventname](params);
            }
        }
    };

    LGraph.prototype.sendActionToCanvas = function(action, params) {
        if (!this.list_of_graphcanvas) {
            return;
        }

        for (var i = 0; i < this.list_of_graphcanvas.length; ++i) {
            var c = this.list_of_graphcanvas[i];
            if (c[action]) {
                c[action].apply(c, params);
            }
        }
    };

    /**
     * Adds a new node instance to this graph
     * @method add
     * @param {LGraphNode} node the instance of the node
     */

    LGraph.prototype.add = function(node, skip_compute_order) {
        if (!node) {
            return;
        }

        //groups
        if (node.constructor === LGraphGroup) {
            this._groups.push(node);
            this.setDirtyCanvas(true);
            this.change();
            node.graph = this;
            this._version++;
            return;
        }

        //nodes
        if (node.id != -1 && this._nodes_by_id[node.id] != null) {
            console.warn(
                "LiteGraph: there is already a node with this ID, changing it"
            );
            node.id = ++this.last_node_id;
        }

        if (this._nodes.length >= LiteGraph.MAX_NUMBER_OF_NODES) {
            throw "LiteGraph: max number of nodes in a graph reached";
        }

        //give him an id
        if (node.id == null || node.id == -1) {
            node.id = ++this.last_node_id;
        } else if (this.last_node_id < node.id) {
            this.last_node_id = node.id;
        }

        node.graph = this;
        this._version++;

        this._nodes.push(node);
        this._nodes_by_id[node.id] = node;

        if (node.onAdded) {
            node.onAdded(this);
        }

        if (this.config.align_to_grid) {
            node.alignToGrid();
        }

        if (!skip_compute_order) {
            this.updateExecutionOrder();
        }

        if (this.onNodeAdded) {
            this.onNodeAdded(node);
        }

        this.setDirtyCanvas(true);
        this.change();

        return node; //to chain actions
    };

    /**
     * Removes a node from the graph
     * @method remove
     * @param {LGraphNode} node the instance of the node
     */

    LGraph.prototype.remove = function(node) {
        if (node.constructor === LiteGraph.LGraphGroup) {
            var index = this._groups.indexOf(node);
            if (index != -1) {
                this._groups.splice(index, 1);
            }
            node.graph = null;
            this._version++;
            this.setDirtyCanvas(true, true);
            this.change();
            return;
        }

        if (this._nodes_by_id[node.id] == null) {
            return;
        } //not found

        if (node.ignore_remove) {
            return;
        } //cannot be removed

        //disconnect inputs
        if (node.inputs) {
            for (var i = 0; i < node.inputs.length; i++) {
                var slot = node.inputs[i];
                if (slot.link != null) {
                    node.disconnectInput(i);
                }
            }
        }

        //disconnect outputs
        if (node.outputs) {
            for (var i = 0; i < node.outputs.length; i++) {
                var slot = node.outputs[i];
                if (slot.links != null && slot.links.length) {
                    node.disconnectOutput(i);
                }
            }
        }

        //node.id = -1; //why?

        //callback
        if (node.onRemoved) {
            node.onRemoved();
        }

        node.graph = null;
        this._version++;

        //remove from canvas render
        if (this.list_of_graphcanvas) {
            for (var i = 0; i < this.list_of_graphcanvas.length; ++i) {
                var canvas = this.list_of_graphcanvas[i];
                if (canvas.selected_nodes[node.id]) {
                    delete canvas.selected_nodes[node.id];
                }
                if (canvas.node_dragged == node) {
                    canvas.node_dragged = null;
                }
            }
        }

        //remove from containers
        var pos = this._nodes.indexOf(node);
        if (pos != -1) {
            this._nodes.splice(pos, 1);
        }
        delete this._nodes_by_id[node.id];

        if (this.onNodeRemoved) {
            this.onNodeRemoved(node);
        }

		//close panels
		this.sendActionToCanvas("checkPanels");

        this.setDirtyCanvas(true, true);
        this.change();

        this.updateExecutionOrder();
    };

    /**
     * Returns a node by its id.
     * @method getNodeById
     * @param {Number} id
     */

    LGraph.prototype.getNodeById = function(id) {
        if (id == null) {
            return null;
        }
        return this._nodes_by_id[id];
    };

    /**
     * Returns a list of nodes that matches a class
     * @method findNodesByClass
     * @param {Class} classObject the class itself (not an string)
     * @return {Array} a list with all the nodes of this type
     */
    LGraph.prototype.findNodesByClass = function(classObject, result) {
        result = result || [];
        result.length = 0;
        for (var i = 0, l = this._nodes.length; i < l; ++i) {
            if (this._nodes[i].constructor === classObject) {
                result.push(this._nodes[i]);
            }
        }
        return result;
    };

    /**
     * Returns a list of nodes that matches a type
     * @method findNodesByType
     * @param {String} type the name of the node type
     * @return {Array} a list with all the nodes of this type
     */
    LGraph.prototype.findNodesByType = function(type, result) {
        var type = type.toLowerCase();
        result = result || [];
        result.length = 0;
        for (var i = 0, l = this._nodes.length; i < l; ++i) {
            if (this._nodes[i].type.toLowerCase() == type) {
                result.push(this._nodes[i]);
            }
        }
        return result;
    };

    /**
     * Returns the first node that matches a name in its title
     * @method findNodeByTitle
     * @param {String} name the name of the node to search
     * @return {Node} the node or null
     */
    LGraph.prototype.findNodeByTitle = function(title) {
        for (var i = 0, l = this._nodes.length; i < l; ++i) {
            if (this._nodes[i].title == title) {
                return this._nodes[i];
            }
        }
        return null;
    };

    /**
     * Returns a list of nodes that matches a name
     * @method findNodesByTitle
     * @param {String} name the name of the node to search
     * @return {Array} a list with all the nodes with this name
     */
    LGraph.prototype.findNodesByTitle = function(title) {
        var result = [];
        for (var i = 0, l = this._nodes.length; i < l; ++i) {
            if (this._nodes[i].title == title) {
                result.push(this._nodes[i]);
            }
        }
        return result;
    };

    /**
     * Returns the top-most node in this position of the canvas
     * @method getNodeOnPos
     * @param {number} x the x coordinate in canvas space
     * @param {number} y the y coordinate in canvas space
     * @param {Array} nodes_list a list with all the nodes to search from, by default is all the nodes in the graph
     * @return {LGraphNode} the node at this position or null
     */
    LGraph.prototype.getNodeOnPos = function(x, y, nodes_list, margin) {
        nodes_list = nodes_list || this._nodes;
        for (var i = nodes_list.length - 1; i >= 0; i--) {
            var n = nodes_list[i];
            if (n.isPointInside(x, y, margin)) {
                return n;
            }
        }
        return null;
    };

    /**
     * Returns the top-most group in that position
     * @method getGroupOnPos
     * @param {number} x the x coordinate in canvas space
     * @param {number} y the y coordinate in canvas space
     * @return {LGraphGroup} the group or null
     */
    LGraph.prototype.getGroupOnPos = function(x, y) {
        for (var i = this._groups.length - 1; i >= 0; i--) {
            var g = this._groups[i];
            if (g.isPointInside(x, y, 2, true)) {
                return g;
            }
        }
        return null;
    };

    /**
     * Checks that the node type matches the node type registered, used when replacing a nodetype by a newer version during execution
     * this replaces the ones using the old version with the new version
     * @method checkNodeTypes
     */
    LGraph.prototype.checkNodeTypes = function() {
        var changes = false;
        for (var i = 0; i < this._nodes.length; i++) {
            var node = this._nodes[i];
            var ctor = LiteGraph.registered_node_types[node.type];
            if (node.constructor == ctor) {
                continue;
            }
            console.log("node being replaced by newer version: " + node.type);
            var newnode = LiteGraph.createNode(node.type);
            changes = true;
            this._nodes[i] = newnode;
            newnode.configure(node.serialize());
            newnode.graph = this;
            this._nodes_by_id[newnode.id] = newnode;
            if (node.inputs) {
                newnode.inputs = node.inputs.concat();
            }
            if (node.outputs) {
                newnode.outputs = node.outputs.concat();
            }
        }
        this.updateExecutionOrder();
    };

    // ********** GLOBALS *****************

    LGraph.prototype.onAction = function(action, param) {
        this._input_nodes = this.findNodesByClass(
            LiteGraph.GraphInput,
            this._input_nodes
        );
        for (var i = 0; i < this._input_nodes.length; ++i) {
            var node = this._input_nodes[i];
            if (node.properties.name != action) {
                continue;
            }
            node.onAction(action, param);
            break;
        }
    };

    LGraph.prototype.trigger = function(action, param) {
        if (this.onTrigger) {
            this.onTrigger(action, param);
        }
    };

    /**
     * Tell this graph it has a global graph input of this type
     * @method addGlobalInput
     * @param {String} name
     * @param {String} type
     * @param {*} value [optional]
     */
    LGraph.prototype.addInput = function(name, type, value) {
        var input = this.inputs[name];
        if (input) {
            //already exist
            return;
        }

        this.inputs[name] = { name: name, type: type, value: value };
        this._version++;

        if (this.onInputAdded) {
            this.onInputAdded(name, type);
        }

        if (this.onInputsOutputsChange) {
            this.onInputsOutputsChange();
        }
    };

    /**
     * Assign a data to the global graph input
     * @method setGlobalInputData
     * @param {String} name
     * @param {*} data
     */
    LGraph.prototype.setInputData = function(name, data) {
        var input = this.inputs[name];
        if (!input) {
            return;
        }
        input.value = data;
    };

    /**
     * Returns the current value of a global graph input
     * @method getInputData
     * @param {String} name
     * @return {*} the data
     */
    LGraph.prototype.getInputData = function(name) {
        var input = this.inputs[name];
        if (!input) {
            return null;
        }
        return input.value;
    };

    /**
     * Changes the name of a global graph input
     * @method renameInput
     * @param {String} old_name
     * @param {String} new_name
     */
    LGraph.prototype.renameInput = function(old_name, name) {
        if (name == old_name) {
            return;
        }

        if (!this.inputs[old_name]) {
            return false;
        }

        if (this.inputs[name]) {
            console.error("there is already one input with that name");
            return false;
        }

        this.inputs[name] = this.inputs[old_name];
        delete this.inputs[old_name];
        this._version++;

        if (this.onInputRenamed) {
            this.onInputRenamed(old_name, name);
        }

        if (this.onInputsOutputsChange) {
            this.onInputsOutputsChange();
        }
    };

    /**
     * Changes the type of a global graph input
     * @method changeInputType
     * @param {String} name
     * @param {String} type
     */
    LGraph.prototype.changeInputType = function(name, type) {
        if (!this.inputs[name]) {
            return false;
        }

        if (
            this.inputs[name].type &&
            String(this.inputs[name].type).toLowerCase() ==
                String(type).toLowerCase()
        ) {
            return;
        }

        this.inputs[name].type = type;
        this._version++;
        if (this.onInputTypeChanged) {
            this.onInputTypeChanged(name, type);
        }
    };

    /**
     * Removes a global graph input
     * @method removeInput
     * @param {String} name
     * @param {String} type
     */
    LGraph.prototype.removeInput = function(name) {
        if (!this.inputs[name]) {
            return false;
        }

        delete this.inputs[name];
        this._version++;

        if (this.onInputRemoved) {
            this.onInputRemoved(name);
        }

        if (this.onInputsOutputsChange) {
            this.onInputsOutputsChange();
        }
        return true;
    };

    /**
     * Creates a global graph output
     * @method addOutput
     * @param {String} name
     * @param {String} type
     * @param {*} value
     */
    LGraph.prototype.addOutput = function(name, type, value) {
        this.outputs[name] = { name: name, type: type, value: value };
        this._version++;

        if (this.onOutputAdded) {
            this.onOutputAdded(name, type);
        }

        if (this.onInputsOutputsChange) {
            this.onInputsOutputsChange();
        }
    };

    /**
     * Assign a data to the global output
     * @method setOutputData
     * @param {String} name
     * @param {String} value
     */
    LGraph.prototype.setOutputData = function(name, value) {
        var output = this.outputs[name];
        if (!output) {
            return;
        }
        output.value = value;
    };

    /**
     * Returns the current value of a global graph output
     * @method getOutputData
     * @param {String} name
     * @return {*} the data
     */
    LGraph.prototype.getOutputData = function(name) {
        var output = this.outputs[name];
        if (!output) {
            return null;
        }
        return output.value;
    };

    /**
     * Renames a global graph output
     * @method renameOutput
     * @param {String} old_name
     * @param {String} new_name
     */
    LGraph.prototype.renameOutput = function(old_name, name) {
        if (!this.outputs[old_name]) {
            return false;
        }

        if (this.outputs[name]) {
            console.error("there is already one output with that name");
            return false;
        }

        this.outputs[name] = this.outputs[old_name];
        delete this.outputs[old_name];
        this._version++;

        if (this.onOutputRenamed) {
            this.onOutputRenamed(old_name, name);
        }

        if (this.onInputsOutputsChange) {
            this.onInputsOutputsChange();
        }
    };

    /**
     * Changes the type of a global graph output
     * @method changeOutputType
     * @param {String} name
     * @param {String} type
     */
    LGraph.prototype.changeOutputType = function(name, type) {
        if (!this.outputs[name]) {
            return false;
        }

        if (
            this.outputs[name].type &&
            String(this.outputs[name].type).toLowerCase() ==
                String(type).toLowerCase()
        ) {
            return;
        }

        this.outputs[name].type = type;
        this._version++;
        if (this.onOutputTypeChanged) {
            this.onOutputTypeChanged(name, type);
        }
    };

    /**
     * Removes a global graph output
     * @method removeOutput
     * @param {String} name
     */
    LGraph.prototype.removeOutput = function(name) {
        if (!this.outputs[name]) {
            return false;
        }
        delete this.outputs[name];
        this._version++;

        if (this.onOutputRemoved) {
            this.onOutputRemoved(name);
        }

        if (this.onInputsOutputsChange) {
            this.onInputsOutputsChange();
        }
        return true;
    };

    LGraph.prototype.triggerInput = function(name, value) {
        var nodes = this.findNodesByTitle(name);
        for (var i = 0; i < nodes.length; ++i) {
            nodes[i].onTrigger(value);
        }
    };

    LGraph.prototype.setCallback = function(name, func) {
        var nodes = this.findNodesByTitle(name);
        for (var i = 0; i < nodes.length; ++i) {
            nodes[i].setTrigger(func);
        }
    };

    LGraph.prototype.connectionChange = function(node, link_info) {
        this.updateExecutionOrder();
        if (this.onConnectionChange) {
            this.onConnectionChange(node);
        }
        this._version++;
        this.sendActionToCanvas("onConnectionChange");
    };

    /**
     * returns if the graph is in live mode
     * @method isLive
     */

    LGraph.prototype.isLive = function() {
        if (!this.list_of_graphcanvas) {
            return false;
        }

        for (var i = 0; i < this.list_of_graphcanvas.length; ++i) {
            var c = this.list_of_graphcanvas[i];
            if (c.live_mode) {
                return true;
            }
        }
        return false;
    };

    /**
     * clears the triggered slot animation in all links (stop visual animation)
     * @method clearTriggeredSlots
     */
    LGraph.prototype.clearTriggeredSlots = function() {
        for (var i in this.links) {
            var link_info = this.links[i];
            if (!link_info) {
                continue;
            }
            if (link_info._last_time) {
                link_info._last_time = 0;
            }
        }
    };

    /* Called when something visually changed (not the graph!) */
    LGraph.prototype.change = function() {
        if (LiteGraph.debug) {
            console.log("Graph changed");
        }
        this.sendActionToCanvas("setDirty", [true, true]);
        if (this.on_change) {
            this.on_change(this);
        }
    };

    LGraph.prototype.setDirtyCanvas = function(fg, bg) {
        this.sendActionToCanvas("setDirty", [fg, bg]);
    };

    /**
     * Destroys a link
     * @method removeLink
     * @param {Number} link_id
     */
    LGraph.prototype.removeLink = function(link_id) {
        var link = this.links[link_id];
        if (!link) {
            return;
        }
        var node = this.getNodeById(link.target_id);
        if (node) {
            node.disconnectInput(link.target_slot);
        }
    };

    //save and recover app state ***************************************
    /**
     * Creates a Object containing all the info about this graph, it can be serialized
     * @method serialize
     * @return {Object} value of the node
     */
    LGraph.prototype.serialize = function() {
        var nodes_info = [];
        for (var i = 0, l = this._nodes.length; i < l; ++i) {
            nodes_info.push(this._nodes[i].serialize());
        }

        //pack link info into a non-verbose format
        var links = [];
        for (var i in this.links) {
            //links is an OBJECT
            var link = this.links[i];
            if (!link.serialize) {
                //weird bug I havent solved yet
                console.warn(
                    "weird LLink bug, link info is not a LLink but a regular object"
                );
                var link2 = new LLink();
                for (var i in link) {
                    link2[i] = link[i];
                }
                this.links[i] = link2;
                link = link2;
            }

            links.push(link.serialize());
        }

        var groups_info = [];
        for (var i = 0; i < this._groups.length; ++i) {
            groups_info.push(this._groups[i].serialize());
        }

        var data = {
            last_node_id: this.last_node_id,
            last_link_id: this.last_link_id,
            nodes: nodes_info,
            links: links,
            groups: groups_info,
            config: this.config,
			extra: this.extra,
            version: LiteGraph.VERSION
        };

		if(this.onSerialize)
			this.onSerialize(data);

        return data;
    };

    /**
     * Configure a graph from a JSON string
     * @method configure
     * @param {String} str configure a graph from a JSON string
     * @param {Boolean} returns if there was any error parsing
     */
    LGraph.prototype.configure = function(data, keep_old) {
        if (!data) {
            return;
        }

        if (!keep_old) {
            this.clear();
        }

        var nodes = data.nodes;

        //decode links info (they are very verbose)
        if (data.links && data.links.constructor === Array) {
            var links = [];
            for (var i = 0; i < data.links.length; ++i) {
                var link_data = data.links[i];
				if(!link_data) //weird bug
				{
					console.warn("serialized graph link data contains errors, skipping.");
					continue;
				}
                var link = new LLink();
                link.configure(link_data);
                links[link.id] = link;
            }
            data.links = links;
        }

        //copy all stored fields
        for (var i in data) {
			if(i == "nodes" || i == "groups" ) //links must be accepted
				continue;
            this[i] = data[i];
        }

        var error = false;

        //create nodes
        this._nodes = [];
        if (nodes) {
            for (var i = 0, l = nodes.length; i < l; ++i) {
                var n_info = nodes[i]; //stored info
                var node = LiteGraph.createNode(n_info.type, n_info.title);
                if (!node) {
                    if (LiteGraph.debug) {
                        console.log(
                            "Node not found or has errors: " + n_info.type
                        );
                    }

                    //in case of error we create a replacement node to avoid losing info
                    node = new LGraphNode();
                    node.last_serialization = n_info;
                    node.has_errors = true;
                    error = true;
                    //continue;
                }

                node.id = n_info.id; //id it or it will create a new id
                this.add(node, true); //add before configure, otherwise configure cannot create links
            }

            //configure nodes afterwards so they can reach each other
            for (var i = 0, l = nodes.length; i < l; ++i) {
                var n_info = nodes[i];
                var node = this.getNodeById(n_info.id);
                if (node) {
                    node.configure(n_info);
                }
            }
        }

        //groups
        this._groups.length = 0;
        if (data.groups) {
            for (var i = 0; i < data.groups.length; ++i) {
                var group = new LiteGraph.LGraphGroup();
                group.configure(data.groups[i]);
                this.add(group);
            }
        }

        this.updateExecutionOrder();

		this.extra = data.extra || {};

		if(this.onConfigure)
			this.onConfigure(data);

        this._version++;
        this.setDirtyCanvas(true, true);
        return error;
    };

    LGraph.prototype.load = function(url) {
        var that = this;
        var req = new XMLHttpRequest();
        req.open("GET", url, true);
        req.send(null);
        req.onload = function(oEvent) {
            if (req.status !== 200) {
                console.error("Error loading graph:", req.status, req.response);
                return;
            }
            var data = JSON.parse(req.response);
            that.configure(data);
        };
        req.onerror = function(err) {
            console.error("Error loading graph:", err);
        };
    };

    LGraph.prototype.onNodeTrace = function(node, msg, color) {
        //TODO
    };

    //this is the class in charge of storing link information
    function LLink(id, type, origin_id, origin_slot, target_id, target_slot) {
        this.id = id;
        this.type = type;
        this.origin_id = origin_id;
        this.origin_slot = origin_slot;
        this.target_id = target_id;
        this.target_slot = target_slot;

        this._data = null;
        this._pos = new Float32Array(2); //center
    }

    LLink.prototype.configure = function(o) {
        if (o.constructor === Array) {
            this.id = o[0];
            this.origin_id = o[1];
            this.origin_slot = o[2];
            this.target_id = o[3];
            this.target_slot = o[4];
            this.type = o[5];
        } else {
            this.id = o.id;
            this.type = o.type;
            this.origin_id = o.origin_id;
            this.origin_slot = o.origin_slot;
            this.target_id = o.target_id;
            this.target_slot = o.target_slot;
        }
    };

    LLink.prototype.serialize = function() {
        return [
            this.id,
            this.origin_id,
            this.origin_slot,
            this.target_id,
            this.target_slot,
            this.type
        ];
    };

    LiteGraph.LLink = LLink;

    // *************************************************************
    //   Node CLASS                                          *******
    // *************************************************************

    /*
	title: string
	pos: [x,y]
	size: [x,y]

	input|output: every connection
		+  { name:string, type:string, pos: [x,y]=Optional, direction: "input"|"output", links: Array });

	general properties:
		+ clip_area: if you render outside the node, it will be clipped
		+ unsafe_execution: not allowed for safe execution
		+ skip_repeated_outputs: when adding new outputs, it wont show if there is one already connected
		+ resizable: if set to false it wont be resizable with the mouse
		+ horizontal: slots are distributed horizontally
		+ widgets_start_y: widgets start at y distance from the top of the node
	
	flags object:
		+ collapsed: if it is collapsed

	supported callbacks:
		+ onAdded: when added to graph (warning: this is called BEFORE the node is configured when loading)
		+ onRemoved: when removed from graph
		+ onStart:	when the graph starts playing
		+ onStop:	when the graph stops playing
		+ onDrawForeground: render the inside widgets inside the node
		+ onDrawBackground: render the background area inside the node (only in edit mode)
		+ onMouseDown
		+ onMouseMove
		+ onMouseUp
		+ onMouseEnter
		+ onMouseLeave
		+ onExecute: execute the node
		+ onPropertyChanged: when a property is changed in the panel (return true to skip default behaviour)
		+ onGetInputs: returns an array of possible inputs
		+ onGetOutputs: returns an array of possible outputs
		+ onBounding: in case this node has a bigger bounding than the node itself (the callback receives the bounding as [x,y,w,h])
		+ onDblClick: double clicked in the node
		+ onInputDblClick: input slot double clicked (can be used to automatically create a node connected)
		+ onOutputDblClick: output slot double clicked (can be used to automatically create a node connected)
		+ onConfigure: called after the node has been configured
		+ onSerialize: to add extra info when serializing (the callback receives the object that should be filled with the data)
		+ onSelected
		+ onDeselected
		+ onDropItem : DOM item dropped over the node
		+ onDropFile : file dropped over the node
		+ onConnectInput : if returns false the incoming connection will be canceled
		+ onConnectionsChange : a connection changed (new one or removed) (LiteGraph.INPUT or LiteGraph.OUTPUT, slot, true if connected, link_info, input_info )
		+ onAction: action slot triggered
		+ getExtraMenuOptions: to add option to context menu
*/

    /**
     * Base Class for all the node type classes
     * @class LGraphNode
     * @param {String} name a name for the node
     */

    function LGraphNode(title) {
        this._ctor(title);
    }

    global.LGraphNode = LiteGraph.LGraphNode = LGraphNode;

    LGraphNode.prototype._ctor = function(title) {
        this.title = title || "Unnamed";
        this.size = [LiteGraph.NODE_WIDTH, 60];
        this.graph = null;

        this._pos = new Float32Array(10, 10);

        Object.defineProperty(this, "pos", {
            set: function(v) {
                if (!v || v.length < 2) {
                    return;
                }
                this._pos[0] = v[0];
                this._pos[1] = v[1];
            },
            get: function() {
                return this._pos;
            },
            enumerable: true
        });

        this.id = -1; //not know till not added
        this.type = null;

        //inputs available: array of inputs
        this.inputs = [];
        this.outputs = [];
        this.connections = [];

        //local data
        this.properties = {}; //for the values
        this.properties_info = []; //for the info

        this.flags = {};
    };

    /**
     * configure a node from an object containing the serialized info
     * @method configure
     */
    LGraphNode.prototype.configure = function(info) {
        if (this.graph) {
            this.graph._version++;
        }
        for (var j in info) {
            if (j == "properties") {
                //i don't want to clone properties, I want to reuse the old container
                for (var k in info.properties) {
                    this.properties[k] = info.properties[k];
                    if (this.onPropertyChanged) {
                        this.onPropertyChanged( k, info.properties[k] );
                    }
                }
                continue;
            }

            if (info[j] == null) {
                continue;
            } else if (typeof info[j] == "object") {
                //object
                if (this[j] && this[j].configure) {
                    this[j].configure(info[j]);
                } else {
                    this[j] = LiteGraph.cloneObject(info[j], this[j]);
                }
            } //value
            else {
                this[j] = info[j];
            }
        }

        if (!info.title) {
            this.title = this.constructor.title;
        }

        if (this.onConnectionsChange) {
            if (this.inputs) {
                for (var i = 0; i < this.inputs.length; ++i) {
                    var input = this.inputs[i];
                    var link_info = this.graph
                        ? this.graph.links[input.link]
                        : null;
                    this.onConnectionsChange(
                        LiteGraph.INPUT,
                        i,
                        true,
                        link_info,
                        input
                    ); //link_info has been created now, so its updated
                }
            }

            if (this.outputs) {
                for (var i = 0; i < this.outputs.length; ++i) {
                    var output = this.outputs[i];
                    if (!output.links) {
                        continue;
                    }
                    for (var j = 0; j < output.links.length; ++j) {
                        var link_info = this.graph
                            ? this.graph.links[output.links[j]]
                            : null;
                        this.onConnectionsChange(
                            LiteGraph.OUTPUT,
                            i,
                            true,
                            link_info,
                            output
                        ); //link_info has been created now, so its updated
                    }
                }
            }
        }

		if( this.widgets )
		{
			for (var i = 0; i < this.widgets.length; ++i)
			{
				var w = this.widgets[i];
				if(!w)
					continue;
				if(w.options && w.options.property && this.properties[ w.options.property ])
					w.value = JSON.parse( JSON.stringify( this.properties[ w.options.property ] ) );
			}
			if (info.widgets_values) {
				for (var i = 0; i < info.widgets_values.length; ++i) {
					if (this.widgets[i]) {
						this.widgets[i].value = info.widgets_values[i];
					}
				}
			}
		}

        if (this.onConfigure) {
            this.onConfigure(info);
        }
    };

    /**
     * serialize the content
     * @method serialize
     */

    LGraphNode.prototype.serialize = function() {
        //create serialization object
        var o = {
            id: this.id,
            type: this.type,
            pos: this.pos,
            size: this.size,
            flags: LiteGraph.cloneObject(this.flags),
			order: this.order,
            mode: this.mode
        };

        //special case for when there were errors
        if (this.constructor === LGraphNode && this.last_serialization) {
            return this.last_serialization;
        }

        if (this.inputs) {
            o.inputs = this.inputs;
        }

        if (this.outputs) {
            //clear outputs last data (because data in connections is never serialized but stored inside the outputs info)
            for (var i = 0; i < this.outputs.length; i++) {
                delete this.outputs[i]._data;
            }
            o.outputs = this.outputs;
        }

        if (this.title && this.title != this.constructor.title) {
            o.title = this.title;
        }

        if (this.properties) {
            o.properties = LiteGraph.cloneObject(this.properties);
        }

        if (this.widgets && this.serialize_widgets) {
            o.widgets_values = [];
            for (var i = 0; i < this.widgets.length; ++i) {
				if(this.widgets[i])
	                o.widgets_values[i] = this.widgets[i].value;
				else
					o.widgets_values[i] = null;
            }
        }

        if (!o.type) {
            o.type = this.constructor.type;
        }

        if (this.color) {
            o.color = this.color;
        }
        if (this.bgcolor) {
            o.bgcolor = this.bgcolor;
        }
        if (this.boxcolor) {
            o.boxcolor = this.boxcolor;
        }
        if (this.shape) {
            o.shape = this.shape;
        }

        if (this.onSerialize) {
            if (this.onSerialize(o)) {
                console.warn(
                    "node onSerialize shouldnt return anything, data should be stored in the object pass in the first parameter"
                );
            }
        }

        return o;
    };

    /* Creates a clone of this node */
    LGraphNode.prototype.clone = function() {
        var node = LiteGraph.createNode(this.type);
        if (!node) {
            return null;
        }

        //we clone it because serialize returns shared containers
        var data = LiteGraph.cloneObject(this.serialize());

        //remove links
        if (data.inputs) {
            for (var i = 0; i < data.inputs.length; ++i) {
                data.inputs[i].link = null;
            }
        }

        if (data.outputs) {
            for (var i = 0; i < data.outputs.length; ++i) {
                if (data.outputs[i].links) {
                    data.outputs[i].links.length = 0;
                }
            }
        }

        delete data["id"];
        //remove links
        node.configure(data);

        return node;
    };

    /**
     * serialize and stringify
     * @method toString
     */

    LGraphNode.prototype.toString = function() {
        return JSON.stringify(this.serialize());
    };
    //LGraphNode.prototype.deserialize = function(info) {} //this cannot be done from within, must be done in LiteGraph

    /**
     * get the title string
     * @method getTitle
     */

    LGraphNode.prototype.getTitle = function() {
        return this.title || this.constructor.title;
    };

    /**
     * sets the value of a property
     * @method setProperty
     * @param {String} name
     * @param {*} value
     */
    LGraphNode.prototype.setProperty = function(name, value) {
        if (!this.properties) {
            this.properties = {};
        }
		if( value === this.properties[name] )
			return;
		var prev_value = this.properties[name];
        this.properties[name] = value;
        if (this.onPropertyChanged) {
            if( this.onPropertyChanged(name, value, prev_value) === false ) //abort change
				this.properties[name] = prev_value;
        }
		if(this.widgets) //widgets could be linked to properties
			for(var i = 0; i < this.widgets.length; ++i)
			{
				var w = this.widgets[i];
				if(!w)
					continue;
				if(w.options.property == name)
				{
					w.value = value;
					break;
				}
			}
    };

    // Execution *************************
    /**
     * sets the output data
     * @method setOutputData
     * @param {number} slot
     * @param {*} data
     */
    LGraphNode.prototype.setOutputData = function(slot, data) {
        if (!this.outputs) {
            return;
        }

        //this maybe slow and a niche case
        //if(slot && slot.constructor === String)
        //	slot = this.findOutputSlot(slot);

        if (slot == -1 || slot >= this.outputs.length) {
            return;
        }

        var output_info = this.outputs[slot];
        if (!output_info) {
            return;
        }

        //store data in the output itself in case we want to debug
        output_info._data = data;

        //if there are connections, pass the data to the connections
        if (this.outputs[slot].links) {
            for (var i = 0; i < this.outputs[slot].links.length; i++) {
                var link_id = this.outputs[slot].links[i];
				var link = this.graph.links[link_id];
				if(link)
					link.data = data;
            }
        }
    };

    /**
     * sets the output data type, useful when you want to be able to overwrite the data type
     * @method setOutputDataType
     * @param {number} slot
     * @param {String} datatype
     */
    LGraphNode.prototype.setOutputDataType = function(slot, type) {
        if (!this.outputs) {
            return;
        }
        if (slot == -1 || slot >= this.outputs.length) {
            return;
        }
        var output_info = this.outputs[slot];
        if (!output_info) {
            return;
        }
        //store data in the output itself in case we want to debug
        output_info.type = type;

        //if there are connections, pass the data to the connections
        if (this.outputs[slot].links) {
            for (var i = 0; i < this.outputs[slot].links.length; i++) {
                var link_id = this.outputs[slot].links[i];
                this.graph.links[link_id].type = type;
            }
        }
    };

    /**
     * Retrieves the input data (data traveling through the connection) from one slot
     * @method getInputData
     * @param {number} slot
     * @param {boolean} force_update if set to true it will force the connected node of this slot to output data into this link
     * @return {*} data or if it is not connected returns undefined
     */
    LGraphNode.prototype.getInputData = function(slot, force_update) {
        if (!this.inputs) {
            return;
        } //undefined;

        if (slot >= this.inputs.length || this.inputs[slot].link == null) {
            return;
        }

        var link_id = this.inputs[slot].link;
        var link = this.graph.links[link_id];
        if (!link) {
            //bug: weird case but it happens sometimes
            return null;
        }

        if (!force_update) {
            return link.data;
        }

        //special case: used to extract data from the incoming connection before the graph has been executed
        var node = this.graph.getNodeById(link.origin_id);
        if (!node) {
            return link.data;
        }

        if (node.updateOutputData) {
            node.updateOutputData(link.origin_slot);
        } else if (node.onExecute) {
            node.onExecute();
        }

        return link.data;
    };

    /**
     * Retrieves the input data type (in case this supports multiple input types)
     * @method getInputDataType
     * @param {number} slot
     * @return {String} datatype in string format
     */
    LGraphNode.prototype.getInputDataType = function(slot) {
        if (!this.inputs) {
            return null;
        } //undefined;

        if (slot >= this.inputs.length || this.inputs[slot].link == null) {
            return null;
        }
        var link_id = this.inputs[slot].link;
        var link = this.graph.links[link_id];
        if (!link) {
            //bug: weird case but it happens sometimes
            return null;
        }
        var node = this.graph.getNodeById(link.origin_id);
        if (!node) {
            return link.type;
        }
        var output_info = node.outputs[link.origin_slot];
        if (output_info) {
            return output_info.type;
        }
        return null;
    };

    /**
     * Retrieves the input data from one slot using its name instead of slot number
     * @method getInputDataByName
     * @param {String} slot_name
     * @param {boolean} force_update if set to true it will force the connected node of this slot to output data into this link
     * @return {*} data or if it is not connected returns null
     */
    LGraphNode.prototype.getInputDataByName = function(
        slot_name,
        force_update
    ) {
        var slot = this.findInputSlot(slot_name);
        if (slot == -1) {
            return null;
        }
        return this.getInputData(slot, force_update);
    };

    /**
     * tells you if there is a connection in one input slot
     * @method isInputConnected
     * @param {number} slot
     * @return {boolean}
     */
    LGraphNode.prototype.isInputConnected = function(slot) {
        if (!this.inputs) {
            return false;
        }
        return slot < this.inputs.length && this.inputs[slot].link != null;
    };

    /**
     * tells you info about an input connection (which node, type, etc)
     * @method getInputInfo
     * @param {number} slot
     * @return {Object} object or null { link: id, name: string, type: string or 0 }
     */
    LGraphNode.prototype.getInputInfo = function(slot) {
        if (!this.inputs) {
            return null;
        }
        if (slot < this.inputs.length) {
            return this.inputs[slot];
        }
        return null;
    };

    /**
     * Returns the link info in the connection of an input slot
     * @method getInputLink
     * @param {number} slot
     * @return {LLink} object or null
     */
    LGraphNode.prototype.getInputLink = function(slot) {
        if (!this.inputs) {
            return null;
        }
        if (slot < this.inputs.length) {
            var slot_info = this.inputs[slot];
			return this.graph.links[ slot_info.link ];
        }
        return null;
    };

    /**
     * returns the node connected in the input slot
     * @method getInputNode
     * @param {number} slot
     * @return {LGraphNode} node or null
     */
    LGraphNode.prototype.getInputNode = function(slot) {
        if (!this.inputs) {
            return null;
        }
        if (slot >= this.inputs.length) {
            return null;
        }
        var input = this.inputs[slot];
        if (!input || input.link === null) {
            return null;
        }
        var link_info = this.graph.links[input.link];
        if (!link_info) {
            return null;
        }
        return this.graph.getNodeById(link_info.origin_id);
    };

    /**
     * returns the value of an input with this name, otherwise checks if there is a property with that name
     * @method getInputOrProperty
     * @param {string} name
     * @return {*} value
     */
    LGraphNode.prototype.getInputOrProperty = function(name) {
        if (!this.inputs || !this.inputs.length) {
            return this.properties ? this.properties[name] : null;
        }

        for (var i = 0, l = this.inputs.length; i < l; ++i) {
            var input_info = this.inputs[i];
            if (name == input_info.name && input_info.link != null) {
                var link = this.graph.links[input_info.link];
                if (link) {
                    return link.data;
                }
            }
        }
        return this.properties[name];
    };

    /**
     * tells you the last output data that went in that slot
     * @method getOutputData
     * @param {number} slot
     * @return {Object}  object or null
     */
    LGraphNode.prototype.getOutputData = function(slot) {
        if (!this.outputs) {
            return null;
        }
        if (slot >= this.outputs.length) {
            return null;
        }

        var info = this.outputs[slot];
        return info._data;
    };

    /**
     * tells you info about an output connection (which node, type, etc)
     * @method getOutputInfo
     * @param {number} slot
     * @return {Object}  object or null { name: string, type: string, links: [ ids of links in number ] }
     */
    LGraphNode.prototype.getOutputInfo = function(slot) {
        if (!this.outputs) {
            return null;
        }
        if (slot < this.outputs.length) {
            return this.outputs[slot];
        }
        return null;
    };

    /**
     * tells you if there is a connection in one output slot
     * @method isOutputConnected
     * @param {number} slot
     * @return {boolean}
     */
    LGraphNode.prototype.isOutputConnected = function(slot) {
        if (!this.outputs) {
            return false;
        }
        return (
            slot < this.outputs.length &&
            this.outputs[slot].links &&
            this.outputs[slot].links.length
        );
    };

    /**
     * tells you if there is any connection in the output slots
     * @method isAnyOutputConnected
     * @return {boolean}
     */
    LGraphNode.prototype.isAnyOutputConnected = function() {
        if (!this.outputs) {
            return false;
        }
        for (var i = 0; i < this.outputs.length; ++i) {
            if (this.outputs[i].links && this.outputs[i].links.length) {
                return true;
            }
        }
        return false;
    };

    /**
     * retrieves all the nodes connected to this output slot
     * @method getOutputNodes
     * @param {number} slot
     * @return {array}
     */
    LGraphNode.prototype.getOutputNodes = function(slot) {
        if (!this.outputs || this.outputs.length == 0) {
            return null;
        }

        if (slot >= this.outputs.length) {
            return null;
        }

        var output = this.outputs[slot];
        if (!output.links || output.links.length == 0) {
            return null;
        }

        var r = [];
        for (var i = 0; i < output.links.length; i++) {
            var link_id = output.links[i];
            var link = this.graph.links[link_id];
            if (link) {
                var target_node = this.graph.getNodeById(link.target_id);
                if (target_node) {
                    r.push(target_node);
                }
            }
        }
        return r;
    };

    /**
     * Triggers an event in this node, this will trigger any output with the same name
     * @method trigger
     * @param {String} event name ( "on_play", ... ) if action is equivalent to false then the event is send to all
     * @param {*} param
     */
    LGraphNode.prototype.trigger = function(action, param) {
        if (!this.outputs || !this.outputs.length) {
            return;
        }

        if (this.graph)
            this.graph._last_trigger_time = LiteGraph.getTime();

        for (var i = 0; i < this.outputs.length; ++i) {
            var output = this.outputs[i];
            if ( !output || output.type !== LiteGraph.EVENT || (action && output.name != action) )
                continue;
            this.triggerSlot(i, param);
        }
    };

    /**
     * Triggers an slot event in this node
     * @method triggerSlot
     * @param {Number} slot the index of the output slot
     * @param {*} param
     * @param {Number} link_id [optional] in case you want to trigger and specific output link in a slot
     */
    LGraphNode.prototype.triggerSlot = function(slot, param, link_id) {
        if (!this.outputs) {
            return;
        }

        var output = this.outputs[slot];
        if (!output) {
            return;
        }

        var links = output.links;
        if (!links || !links.length) {
            return;
        }

        if (this.graph) {
            this.graph._last_trigger_time = LiteGraph.getTime();
        }

        //for every link attached here
        for (var k = 0; k < links.length; ++k) {
            var id = links[k];
            if (link_id != null && link_id != id) {
                //to skip links
                continue;
            }
            var link_info = this.graph.links[links[k]];
            if (!link_info) {
                //not connected
                continue;
            }
            link_info._last_time = LiteGraph.getTime();
            var node = this.graph.getNodeById(link_info.target_id);
            if (!node) {
                //node not found?
                continue;
            }

            //used to mark events in graph
            var target_connection = node.inputs[link_info.target_slot];

            if (node.onAction) {
                node.onAction(target_connection.name, param);
            } else if (node.mode === LiteGraph.ON_TRIGGER) {
                if (node.onExecute) {
                    node.onExecute(param);
                }
            }
        }
    };

    /**
     * clears the trigger slot animation
     * @method clearTriggeredSlot
     * @param {Number} slot the index of the output slot
     * @param {Number} link_id [optional] in case you want to trigger and specific output link in a slot
     */
    LGraphNode.prototype.clearTriggeredSlot = function(slot, link_id) {
        if (!this.outputs) {
            return;
        }

        var output = this.outputs[slot];
        if (!output) {
            return;
        }

        var links = output.links;
        if (!links || !links.length) {
            return;
        }

        //for every link attached here
        for (var k = 0; k < links.length; ++k) {
            var id = links[k];
            if (link_id != null && link_id != id) {
                //to skip links
                continue;
            }
            var link_info = this.graph.links[links[k]];
            if (!link_info) {
                //not connected
                continue;
            }
            link_info._last_time = 0;
        }
    };

    /**
     * changes node size and triggers callback
     * @method setSize
     * @param {vec2} size
     */
    LGraphNode.prototype.setSize = function(size)
	{
		this.size = size;
		if(this.onResize)
			this.onResize(this.size);
	}

    /**
     * add a new property to this node
     * @method addProperty
     * @param {string} name
     * @param {*} default_value
     * @param {string} type string defining the output type ("vec3","number",...)
     * @param {Object} extra_info this can be used to have special properties of the property (like values, etc)
     */
    LGraphNode.prototype.addProperty = function(
        name,
        default_value,
        type,
        extra_info
    ) {
        var o = { name: name, type: type, default_value: default_value };
        if (extra_info) {
            for (var i in extra_info) {
                o[i] = extra_info[i];
            }
        }
        if (!this.properties_info) {
            this.properties_info = [];
        }
        this.properties_info.push(o);
        if (!this.properties) {
            this.properties = {};
        }
        this.properties[name] = default_value;
        return o;
    };

    //connections

    /**
     * add a new output slot to use in this node
     * @method addOutput
     * @param {string} name
     * @param {string} type string defining the output type ("vec3","number",...)
     * @param {Object} extra_info this can be used to have special properties of an output (label, special color, position, etc)
     */
    LGraphNode.prototype.addOutput = function(name, type, extra_info) {
        var o = { name: name, type: type, links: null };
        if (extra_info) {
            for (var i in extra_info) {
                o[i] = extra_info[i];
            }
        }

        if (!this.outputs) {
            this.outputs = [];
        }
        this.outputs.push(o);
        if (this.onOutputAdded) {
            this.onOutputAdded(o);
        }
        this.setSize( this.computeSize() );
        this.setDirtyCanvas(true, true);
        return o;
    };

    /**
     * add a new output slot to use in this node
     * @method addOutputs
     * @param {Array} array of triplets like [[name,type,extra_info],[...]]
     */
    LGraphNode.prototype.addOutputs = function(array) {
        for (var i = 0; i < array.length; ++i) {
            var info = array[i];
            var o = { name: info[0], type: info[1], link: null };
            if (array[2]) {
                for (var j in info[2]) {
                    o[j] = info[2][j];
                }
            }

            if (!this.outputs) {
                this.outputs = [];
            }
            this.outputs.push(o);
            if (this.onOutputAdded) {
                this.onOutputAdded(o);
            }
        }

        this.setSize( this.computeSize() );
        this.setDirtyCanvas(true, true);
    };

    /**
     * remove an existing output slot
     * @method removeOutput
     * @param {number} slot
     */
    LGraphNode.prototype.removeOutput = function(slot) {
        this.disconnectOutput(slot);
        this.outputs.splice(slot, 1);
        for (var i = slot; i < this.outputs.length; ++i) {
            if (!this.outputs[i] || !this.outputs[i].links) {
                continue;
            }
            var links = this.outputs[i].links;
            for (var j = 0; j < links.length; ++j) {
                var link = this.graph.links[links[j]];
                if (!link) {
                    continue;
                }
                link.origin_slot -= 1;
            }
        }

        this.setSize( this.computeSize() );
        if (this.onOutputRemoved) {
            this.onOutputRemoved(slot);
        }
        this.setDirtyCanvas(true, true);
    };

    /**
     * add a new input slot to use in this node
     * @method addInput
     * @param {string} name
     * @param {string} type string defining the input type ("vec3","number",...), it its a generic one use 0
     * @param {Object} extra_info this can be used to have special properties of an input (label, color, position, etc)
     */
    LGraphNode.prototype.addInput = function(name, type, extra_info) {
        type = type || 0;
        var o = { name: name, type: type, link: null };
        if (extra_info) {
            for (var i in extra_info) {
                o[i] = extra_info[i];
            }
        }

        if (!this.inputs) {
            this.inputs = [];
        }
        this.inputs.push(o);
        this.setSize( this.computeSize() );

        if (this.onInputAdded) {
            this.onInputAdded(o);
        }

        this.setDirtyCanvas(true, true);
        return o;
    };

    /**
     * add several new input slots in this node
     * @method addInputs
     * @param {Array} array of triplets like [[name,type,extra_info],[...]]
     */
    LGraphNode.prototype.addInputs = function(array) {
        for (var i = 0; i < array.length; ++i) {
            var info = array[i];
            var o = { name: info[0], type: info[1], link: null };
            if (array[2]) {
                for (var j in info[2]) {
                    o[j] = info[2][j];
                }
            }

            if (!this.inputs) {
                this.inputs = [];
            }
            this.inputs.push(o);
            if (this.onInputAdded) {
                this.onInputAdded(o);
            }
        }

        this.setSize( this.computeSize() );
        this.setDirtyCanvas(true, true);
    };

    /**
     * remove an existing input slot
     * @method removeInput
     * @param {number} slot
     */
    LGraphNode.prototype.removeInput = function(slot) {
        this.disconnectInput(slot);
        var slot_info = this.inputs.splice(slot, 1);
        for (var i = slot; i < this.inputs.length; ++i) {
            if (!this.inputs[i]) {
                continue;
            }
            var link = this.graph.links[this.inputs[i].link];
            if (!link) {
                continue;
            }
            link.target_slot -= 1;
        }
        this.setSize( this.computeSize() );
        if (this.onInputRemoved) {
            this.onInputRemoved(slot, slot_info[0] );
        }
        this.setDirtyCanvas(true, true);
    };

    /**
     * add an special connection to this node (used for special kinds of graphs)
     * @method addConnection
     * @param {string} name
     * @param {string} type string defining the input type ("vec3","number",...)
     * @param {[x,y]} pos position of the connection inside the node
     * @param {string} direction if is input or output
     */
    LGraphNode.prototype.addConnection = function(name, type, pos, direction) {
        var o = {
            name: name,
            type: type,
            pos: pos,
            direction: direction,
            links: null
        };
        this.connections.push(o);
        return o;
    };

    /**
     * computes the minimum size of a node according to its inputs and output slots
     * @method computeSize
     * @param {number} minHeight
     * @return {number} the total size
     */
    LGraphNode.prototype.computeSize = function(out) {
        if (this.constructor.size) {
            return this.constructor.size.concat();
        }

        var rows = Math.max(
            this.inputs ? this.inputs.length : 1,
            this.outputs ? this.outputs.length : 1
        );
        var size = out || new Float32Array([0, 0]);
        rows = Math.max(rows, 1);
        var font_size = LiteGraph.NODE_TEXT_SIZE; //although it should be graphcanvas.inner_text_font size

        var font_size = font_size;
        var title_width = compute_text_size(this.title);
        var input_width = 0;
        var output_width = 0;

        if (this.inputs) {
            for (var i = 0, l = this.inputs.length; i < l; ++i) {
                var input = this.inputs[i];
                var text = input.label || input.name || "";
                var text_width = compute_text_size(text);
                if (input_width < text_width) {
                    input_width = text_width;
                }
            }
        }

        if (this.outputs) {
            for (var i = 0, l = this.outputs.length; i < l; ++i) {
                var output = this.outputs[i];
                var text = output.label || output.name || "";
                var text_width = compute_text_size(text);
                if (output_width < text_width) {
                    output_width = text_width;
                }
            }
        }

        size[0] = Math.max(input_width + output_width + 10, title_width);
        size[0] = Math.max(size[0], LiteGraph.NODE_WIDTH);
        if (this.widgets && this.widgets.length) {
            size[0] = Math.max(size[0], LiteGraph.NODE_WIDTH * 1.5);
        }

        size[1] = (this.constructor.slot_start_y || 0) + rows * LiteGraph.NODE_SLOT_HEIGHT;

        var widgets_height = 0;
        if (this.widgets && this.widgets.length) {
            for (var i = 0, l = this.widgets.length; i < l; ++i) {
                if (this.widgets[i].computeSize)
                    widgets_height += this.widgets[i].computeSize(size[0])[1] + 4;
                else
                    widgets_height += LiteGraph.NODE_WIDGET_HEIGHT + 4;
            }
            widgets_height += 8;
        }

        //compute height using widgets height
        if( this.widgets_up )
            size[1] = Math.max( size[1], widgets_height );
        else if( this.widgets_start_y != null )
            size[1] = Math.max( size[1], widgets_height + this.widgets_start_y );
        else
            size[1] += widgets_height;

        function compute_text_size(text) {
            if (!text) {
                return 0;
            }
            return font_size * text.length * 0.6;
        }

        if (
            this.constructor.min_height &&
            size[1] < this.constructor.min_height
        ) {
            size[1] = this.constructor.min_height;
        }

        size[1] += 6; //margin

        return size;
    };

    /**
     * returns all the info available about a property of this node.
     *
     * @method getPropertyInfo
     * @param {String} property name of the property
     * @return {Object} the object with all the available info
    */
    LGraphNode.prototype.getPropertyInfo = function( property )
	{
        var info = null;

		//there are several ways to define info about a property
		//legacy mode
		if (this.properties_info) {
            for (var i = 0; i < this.properties_info.length; ++i) {
                if (this.properties_info[i].name == property) {
                    info = this.properties_info[i];
                    break;
                }
            }
        }
		//litescene mode using the constructor
		if(this.constructor["@" + property])
			info = this.constructor["@" + property];

		//litescene mode using the constructor
		if (this.onGetPropertyInfo) {
            info = this.onGetPropertyInfo(property);
        }

        if (!info)
            info = {};
		if(!info.type)
			info.type = typeof this.properties[property];

		return info;
	}

    /**
     * Defines a widget inside the node, it will be rendered on top of the node, you can control lots of properties
     *
     * @method addWidget
     * @param {String} type the widget type (could be "number","string","combo"
     * @param {String} name the text to show on the widget
     * @param {String} value the default value
     * @param {Function|String} callback function to call when it changes (optionally, it can be the name of the property to modify)
     * @param {Object} options the object that contains special properties of this widget 
     * @return {Object} the created widget object
     */
    LGraphNode.prototype.addWidget = function( type, name, value, callback, options )
	{
        if (!this.widgets) {
            this.widgets = [];
        }

		if(!options && callback && callback.constructor === Object)
		{
			options = callback;
			callback = null;
		}

		if(options && options.constructor === String) //options can be the property name
			options = { property: options };

		if(callback && callback.constructor === String) //callback can be the property name
		{
			if(!options)
				options = {};
			options.property = callback;
			callback = null;
		}

		if(callback && callback.constructor !== Function)
		{
			console.warn("addWidget: callback must be a function");
			callback = null;
		}

        var w = {
            type: type.toLowerCase(),
            name: name,
            value: value,
            callback: callback,
            options: options || {}
        };

        if (w.options.y !== undefined) {
            w.y = w.options.y;
        }

        if (!callback && !w.options.callback && !w.options.property) {
            console.warn("LiteGraph addWidget(...) without a callback or property assigned");
        }
        if (type == "combo" && !w.options.values) {
            throw "LiteGraph addWidget('combo',...) requires to pass values in options: { values:['red','blue'] }";
        }
        this.widgets.push(w);
		this.setSize( this.computeSize() );
        return w;
    };

    LGraphNode.prototype.addCustomWidget = function(custom_widget) {
        if (!this.widgets) {
            this.widgets = [];
        }
        this.widgets.push(custom_widget);
        return custom_widget;
    };

    /**
     * returns the bounding of the object, used for rendering purposes
     * bounding is: [topleft_cornerx, topleft_cornery, width, height]
     * @method getBounding
     * @return {Float32Array[4]} the total size
     */
    LGraphNode.prototype.getBounding = function(out) {
        out = out || new Float32Array(4);
        out[0] = this.pos[0] - 4;
        out[1] = this.pos[1] - LiteGraph.NODE_TITLE_HEIGHT;
        out[2] = this.size[0] + 4;
        out[3] = this.size[1] + LiteGraph.NODE_TITLE_HEIGHT;

        if (this.onBounding) {
            this.onBounding(out);
        }
        return out;
    };

    /**
     * checks if a point is inside the shape of a node
     * @method isPointInside
     * @param {number} x
     * @param {number} y
     * @return {boolean}
     */
    LGraphNode.prototype.isPointInside = function(x, y, margin, skip_title) {
        margin = margin || 0;

        var margin_top = this.graph && this.graph.isLive() ? 0 : LiteGraph.NODE_TITLE_HEIGHT;
        if (skip_title) {
            margin_top = 0;
        }
        if (this.flags && this.flags.collapsed) {
            //if ( distance([x,y], [this.pos[0] + this.size[0]*0.5, this.pos[1] + this.size[1]*0.5]) < LiteGraph.NODE_COLLAPSED_RADIUS)
            if (
                isInsideRectangle(
                    x,
                    y,
                    this.pos[0] - margin,
                    this.pos[1] - LiteGraph.NODE_TITLE_HEIGHT - margin,
                    (this._collapsed_width || LiteGraph.NODE_COLLAPSED_WIDTH) +
                        2 * margin,
                    LiteGraph.NODE_TITLE_HEIGHT + 2 * margin
                )
            ) {
                return true;
            }
        } else if (
            this.pos[0] - 4 - margin < x &&
            this.pos[0] + this.size[0] + 4 + margin > x &&
            this.pos[1] - margin_top - margin < y &&
            this.pos[1] + this.size[1] + margin > y
        ) {
            return true;
        }
        return false;
    };

    /**
     * checks if a point is inside a node slot, and returns info about which slot
     * @method getSlotInPosition
     * @param {number} x
     * @param {number} y
     * @return {Object} if found the object contains { input|output: slot object, slot: number, link_pos: [x,y] }
     */
    LGraphNode.prototype.getSlotInPosition = function(x, y) {
        //search for inputs
        var link_pos = new Float32Array(2);
        if (this.inputs) {
            for (var i = 0, l = this.inputs.length; i < l; ++i) {
                var input = this.inputs[i];
                this.getConnectionPos(true, i, link_pos);
                if (
                    isInsideRectangle(
                        x,
                        y,
                        link_pos[0] - 10,
                        link_pos[1] - 5,
                        20,
                        10
                    )
                ) {
                    return { input: input, slot: i, link_pos: link_pos };
                }
            }
        }

        if (this.outputs) {
            for (var i = 0, l = this.outputs.length; i < l; ++i) {
                var output = this.outputs[i];
                this.getConnectionPos(false, i, link_pos);
                if (
                    isInsideRectangle(
                        x,
                        y,
                        link_pos[0] - 10,
                        link_pos[1] - 5,
                        20,
                        10
                    )
                ) {
                    return { output: output, slot: i, link_pos: link_pos };
                }
            }
        }

        return null;
    };

    /**
     * returns the input slot with a given name (used for dynamic slots), -1 if not found
     * @method findInputSlot
     * @param {string} name the name of the slot
     * @return {number} the slot (-1 if not found)
     */
    LGraphNode.prototype.findInputSlot = function(name) {
        if (!this.inputs) {
            return -1;
        }
        for (var i = 0, l = this.inputs.length; i < l; ++i) {
            if (name == this.inputs[i].name) {
                return i;
            }
        }
        return -1;
    };

    /**
     * returns the output slot with a given name (used for dynamic slots), -1 if not found
     * @method findOutputSlot
     * @param {string} name the name of the slot
     * @return {number} the slot (-1 if not found)
     */
    LGraphNode.prototype.findOutputSlot = function(name) {
        if (!this.outputs) {
            return -1;
        }
        for (var i = 0, l = this.outputs.length; i < l; ++i) {
            if (name == this.outputs[i].name) {
                return i;
            }
        }
        return -1;
    };

    /**
     * connect this node output to the input of another node
     * @method connect
     * @param {number_or_string} slot (could be the number of the slot or the string with the name of the slot)
     * @param {LGraphNode} node the target node
     * @param {number_or_string} target_slot the input slot of the target node (could be the number of the slot or the string with the name of the slot, or -1 to connect a trigger)
     * @return {Object} the link_info is created, otherwise null
     */
    LGraphNode.prototype.connect = function(slot, target_node, target_slot) {
        target_slot = target_slot || 0;

        if (!this.graph) {
            //could be connected before adding it to a graph
            console.log(
                "Connect: Error, node doesn't belong to any graph. Nodes must be added first to a graph before connecting them."
            ); //due to link ids being associated with graphs
            return null;
        }

        //seek for the output slot
        if (slot.constructor === String) {
            slot = this.findOutputSlot(slot);
            if (slot == -1) {
                if (LiteGraph.debug) {
                    console.log("Connect: Error, no slot of name " + slot);
                }
                return null;
            }
        } else if (!this.outputs || slot >= this.outputs.length) {
            if (LiteGraph.debug) {
                console.log("Connect: Error, slot number not found");
            }
            return null;
        }

        if (target_node && target_node.constructor === Number) {
            target_node = this.graph.getNodeById(target_node);
        }
        if (!target_node) {
            throw "target node is null";
        }

        //avoid loopback
        if (target_node == this) {
            return null;
        }

        //you can specify the slot by name
        if (target_slot.constructor === String) {
            target_slot = target_node.findInputSlot(target_slot);
            if (target_slot == -1) {
                if (LiteGraph.debug) {
                    console.log(
                        "Connect: Error, no slot of name " + target_slot
                    );
                }
                return null;
            }
        } else if (target_slot === LiteGraph.EVENT) {
            //search for first slot with event?
            /*
		//create input for trigger
		var input = target_node.addInput("onTrigger", LiteGraph.EVENT );
		target_slot = target_node.inputs.length - 1; //last one is the one created
		target_node.mode = LiteGraph.ON_TRIGGER;
		*/
            return null;
        } else if (
            !target_node.inputs ||
            target_slot >= target_node.inputs.length
        ) {
            if (LiteGraph.debug) {
                console.log("Connect: Error, slot number not found");
            }
            return null;
        }

        //if there is something already plugged there, disconnect
        if (target_node.inputs[target_slot].link != null) {
            target_node.disconnectInput(target_slot);
        }

        //why here??
        //this.setDirtyCanvas(false,true);
        //this.graph.connectionChange( this );

        var output = this.outputs[slot];

        //allows nodes to block connection
        if (target_node.onConnectInput) {
            if ( target_node.onConnectInput(target_slot, output.type, output, this, slot) === false ) {
                return null;
            }
        }

        var input = target_node.inputs[target_slot];
        var link_info = null;

        if (LiteGraph.isValidConnection(output.type, input.type)) {
            link_info = new LLink(
                ++this.graph.last_link_id,
                input.type,
                this.id,
                slot,
                target_node.id,
                target_slot
            );

            //add to graph links list
            this.graph.links[link_info.id] = link_info;

            //connect in output
            if (output.links == null) {
                output.links = [];
            }
            output.links.push(link_info.id);
            //connect in input
            target_node.inputs[target_slot].link = link_info.id;
            if (this.graph) {
                this.graph._version++;
            }
            if (this.onConnectionsChange) {
                this.onConnectionsChange(
                    LiteGraph.OUTPUT,
                    slot,
                    true,
                    link_info,
                    output
                );
            } //link_info has been created now, so its updated
            if (target_node.onConnectionsChange) {
                target_node.onConnectionsChange(
                    LiteGraph.INPUT,
                    target_slot,
                    true,
                    link_info,
                    input
                );
            }
            if (this.graph && this.graph.onNodeConnectionChange) {
                this.graph.onNodeConnectionChange(
                    LiteGraph.INPUT,
                    target_node,
                    target_slot,
                    this,
                    slot
                );
                this.graph.onNodeConnectionChange(
                    LiteGraph.OUTPUT,
                    this,
                    slot,
                    target_node,
                    target_slot
                );
            }
        }

        this.setDirtyCanvas(false, true);
        this.graph.connectionChange(this, link_info);

        return link_info;
    };

    /**
     * disconnect one output to an specific node
     * @method disconnectOutput
     * @param {number_or_string} slot (could be the number of the slot or the string with the name of the slot)
     * @param {LGraphNode} target_node the target node to which this slot is connected [Optional, if not target_node is specified all nodes will be disconnected]
     * @return {boolean} if it was disconnected successfully
     */
    LGraphNode.prototype.disconnectOutput = function(slot, target_node) {
        if (slot.constructor === String) {
            slot = this.findOutputSlot(slot);
            if (slot == -1) {
                if (LiteGraph.debug) {
                    console.log("Connect: Error, no slot of name " + slot);
                }
                return false;
            }
        } else if (!this.outputs || slot >= this.outputs.length) {
            if (LiteGraph.debug) {
                console.log("Connect: Error, slot number not found");
            }
            return false;
        }

        //get output slot
        var output = this.outputs[slot];
        if (!output || !output.links || output.links.length == 0) {
            return false;
        }

        //one of the output links in this slot
        if (target_node) {
            if (target_node.constructor === Number) {
                target_node = this.graph.getNodeById(target_node);
            }
            if (!target_node) {
                throw "Target Node not found";
            }

            for (var i = 0, l = output.links.length; i < l; i++) {
                var link_id = output.links[i];
                var link_info = this.graph.links[link_id];

                //is the link we are searching for...
                if (link_info.target_id == target_node.id) {
                    output.links.splice(i, 1); //remove here
                    var input = target_node.inputs[link_info.target_slot];
                    input.link = null; //remove there
                    delete this.graph.links[link_id]; //remove the link from the links pool
                    if (this.graph) {
                        this.graph._version++;
                    }
                    if (target_node.onConnectionsChange) {
                        target_node.onConnectionsChange(
                            LiteGraph.INPUT,
                            link_info.target_slot,
                            false,
                            link_info,
                            input
                        );
                    } //link_info hasn't been modified so its ok
                    if (this.onConnectionsChange) {
                        this.onConnectionsChange(
                            LiteGraph.OUTPUT,
                            slot,
                            false,
                            link_info,
                            output
                        );
                    }
                    if (this.graph && this.graph.onNodeConnectionChange) {
                        this.graph.onNodeConnectionChange(
                            LiteGraph.OUTPUT,
                            this,
                            slot
                        );
                    }
                    if (this.graph && this.graph.onNodeConnectionChange) {
                        this.graph.onNodeConnectionChange(
                            LiteGraph.OUTPUT,
                            this,
                            slot
                        );
                        this.graph.onNodeConnectionChange(
                            LiteGraph.INPUT,
                            target_node,
                            link_info.target_slot
                        );
                    }
                    break;
                }
            }
        } //all the links in this output slot
        else {
            for (var i = 0, l = output.links.length; i < l; i++) {
                var link_id = output.links[i];
                var link_info = this.graph.links[link_id];
                if (!link_info) {
                    //bug: it happens sometimes
                    continue;
                }

                var target_node = this.graph.getNodeById(link_info.target_id);
                var input = null;
                if (this.graph) {
                    this.graph._version++;
                }
                if (target_node) {
                    input = target_node.inputs[link_info.target_slot];
                    input.link = null; //remove other side link
                    if (target_node.onConnectionsChange) {
                        target_node.onConnectionsChange(
                            LiteGraph.INPUT,
                            link_info.target_slot,
                            false,
                            link_info,
                            input
                        );
                    } //link_info hasn't been modified so its ok
                    if (this.graph && this.graph.onNodeConnectionChange) {
                        this.graph.onNodeConnectionChange(
                            LiteGraph.INPUT,
                            target_node,
                            link_info.target_slot
                        );
                    }
                }
                delete this.graph.links[link_id]; //remove the link from the links pool
                if (this.onConnectionsChange) {
                    this.onConnectionsChange(
                        LiteGraph.OUTPUT,
                        slot,
                        false,
                        link_info,
                        output
                    );
                }
                if (this.graph && this.graph.onNodeConnectionChange) {
                    this.graph.onNodeConnectionChange(
                        LiteGraph.OUTPUT,
                        this,
                        slot
                    );
                    this.graph.onNodeConnectionChange(
                        LiteGraph.INPUT,
                        target_node,
                        link_info.target_slot
                    );
                }
            }
            output.links = null;
        }

        this.setDirtyCanvas(false, true);
        this.graph.connectionChange(this);
        return true;
    };

    /**
     * disconnect one input
     * @method disconnectInput
     * @param {number_or_string} slot (could be the number of the slot or the string with the name of the slot)
     * @return {boolean} if it was disconnected successfully
     */
    LGraphNode.prototype.disconnectInput = function(slot) {
        //seek for the output slot
        if (slot.constructor === String) {
            slot = this.findInputSlot(slot);
            if (slot == -1) {
                if (LiteGraph.debug) {
                    console.log("Connect: Error, no slot of name " + slot);
                }
                return false;
            }
        } else if (!this.inputs || slot >= this.inputs.length) {
            if (LiteGraph.debug) {
                console.log("Connect: Error, slot number not found");
            }
            return false;
        }

        var input = this.inputs[slot];
        if (!input) {
            return false;
        }

        var link_id = this.inputs[slot].link;
        this.inputs[slot].link = null;

        //remove other side
        var link_info = this.graph.links[link_id];
        if (link_info) {
            var target_node = this.graph.getNodeById(link_info.origin_id);
            if (!target_node) {
                return false;
            }

            var output = target_node.outputs[link_info.origin_slot];
            if (!output || !output.links || output.links.length == 0) {
                return false;
            }

            //search in the inputs list for this link
            for (var i = 0, l = output.links.length; i < l; i++) {
                if (output.links[i] == link_id) {
                    output.links.splice(i, 1);
                    break;
                }
            }

            delete this.graph.links[link_id]; //remove from the pool
            if (this.graph) {
                this.graph._version++;
            }
            if (this.onConnectionsChange) {
                this.onConnectionsChange(
                    LiteGraph.INPUT,
                    slot,
                    false,
                    link_info,
                    input
                );
            }
            if (target_node.onConnectionsChange) {
                target_node.onConnectionsChange(
                    LiteGraph.OUTPUT,
                    i,
                    false,
                    link_info,
                    output
                );
            }
            if (this.graph && this.graph.onNodeConnectionChange) {
                this.graph.onNodeConnectionChange(
                    LiteGraph.OUTPUT,
                    target_node,
                    i
                );
                this.graph.onNodeConnectionChange(LiteGraph.INPUT, this, slot);
            }
        }

        this.setDirtyCanvas(false, true);
        this.graph.connectionChange(this);
        return true;
    };

    /**
     * returns the center of a connection point in canvas coords
     * @method getConnectionPos
     * @param {boolean} is_input true if if a input slot, false if it is an output
     * @param {number_or_string} slot (could be the number of the slot or the string with the name of the slot)
     * @param {vec2} out [optional] a place to store the output, to free garbage
     * @return {[x,y]} the position
     **/
    LGraphNode.prototype.getConnectionPos = function(
        is_input,
        slot_number,
        out
    ) {
        out = out || new Float32Array(2);
        var num_slots = 0;
        if (is_input && this.inputs) {
            num_slots = this.inputs.length;
        }
        if (!is_input && this.outputs) {
            num_slots = this.outputs.length;
        }

        var offset = LiteGraph.NODE_SLOT_HEIGHT * 0.5;

        if (this.flags.collapsed) {
            var w = this._collapsed_width || LiteGraph.NODE_COLLAPSED_WIDTH;
            if (this.horizontal) {
                out[0] = this.pos[0] + w * 0.5;
                if (is_input) {
                    out[1] = this.pos[1] - LiteGraph.NODE_TITLE_HEIGHT;
                } else {
                    out[1] = this.pos[1];
                }
            } else {
                if (is_input) {
                    out[0] = this.pos[0];
                } else {
                    out[0] = this.pos[0] + w;
                }
                out[1] = this.pos[1] - LiteGraph.NODE_TITLE_HEIGHT * 0.5;
            }
            return out;
        }

        //weird feature that never got finished
        if (is_input && slot_number == -1) {
            out[0] = this.pos[0] + LiteGraph.NODE_TITLE_HEIGHT * 0.5;
            out[1] = this.pos[1] + LiteGraph.NODE_TITLE_HEIGHT * 0.5;
            return out;
        }

        //hard-coded pos
        if (
            is_input &&
            num_slots > slot_number &&
            this.inputs[slot_number].pos
        ) {
            out[0] = this.pos[0] + this.inputs[slot_number].pos[0];
            out[1] = this.pos[1] + this.inputs[slot_number].pos[1];
            return out;
        } else if (
            !is_input &&
            num_slots > slot_number &&
            this.outputs[slot_number].pos
        ) {
            out[0] = this.pos[0] + this.outputs[slot_number].pos[0];
            out[1] = this.pos[1] + this.outputs[slot_number].pos[1];
            return out;
        }

        //horizontal distributed slots
        if (this.horizontal) {
            out[0] =
                this.pos[0] + (slot_number + 0.5) * (this.size[0] / num_slots);
            if (is_input) {
                out[1] = this.pos[1] - LiteGraph.NODE_TITLE_HEIGHT;
            } else {
                out[1] = this.pos[1] + this.size[1];
            }
            return out;
        }

        //default vertical slots
        if (is_input) {
            out[0] = this.pos[0] + offset;
        } else {
            out[0] = this.pos[0] + this.size[0] + 1 - offset;
        }
        out[1] =
            this.pos[1] +
            (slot_number + 0.7) * LiteGraph.NODE_SLOT_HEIGHT +
            (this.constructor.slot_start_y || 0);
        return out;
    };

    /* Force align to grid */
    LGraphNode.prototype.alignToGrid = function() {
        this.pos[0] =
            LiteGraph.CANVAS_GRID_SIZE *
            Math.round(this.pos[0] / LiteGraph.CANVAS_GRID_SIZE);
        this.pos[1] =
            LiteGraph.CANVAS_GRID_SIZE *
            Math.round(this.pos[1] / LiteGraph.CANVAS_GRID_SIZE);
    };

    /* Console output */
    LGraphNode.prototype.trace = function(msg) {
        if (!this.console) {
            this.console = [];
        }

        this.console.push(msg);
        if (this.console.length > LGraphNode.MAX_CONSOLE) {
            this.console.shift();
        }

		if(this.graph.onNodeTrace)
	        this.graph.onNodeTrace(this, msg);
    };

    /* Forces to redraw or the main canvas (LGraphNode) or the bg canvas (links) */
    LGraphNode.prototype.setDirtyCanvas = function(
        dirty_foreground,
        dirty_background
    ) {
        if (!this.graph) {
            return;
        }
        this.graph.sendActionToCanvas("setDirty", [
            dirty_foreground,
            dirty_background
        ]);
    };

    LGraphNode.prototype.loadImage = function(url) {
        var img = new Image();
        img.src = LiteGraph.node_images_path + url;
        img.ready = false;

        var that = this;
        img.onload = function() {
            this.ready = true;
            that.setDirtyCanvas(true);
        };
        return img;
    };

    //safe LGraphNode action execution (not sure if safe)
    /*
LGraphNode.prototype.executeAction = function(action)
{
	if(action == "") return false;

	if( action.indexOf(";") != -1 || action.indexOf("}") != -1)
	{
		this.trace("Error: Action contains unsafe characters");
		return false;
	}

	var tokens = action.split("(");
	var func_name = tokens[0];
	if( typeof(this[func_name]) != "function")
	{
		this.trace("Error: Action not found on node: " + func_name);
		return false;
	}

	var code = action;

	try
	{
		var _foo = eval;
		eval = null;
		(new Function("with(this) { " + code + "}")).call(this);
		eval = _foo;
	}
	catch (err)
	{
		this.trace("Error executing action {" + action + "} :" + err);
		return false;
	}

	return true;
}
*/

    /* Allows to get onMouseMove and onMouseUp events even if the mouse is out of focus */
    LGraphNode.prototype.captureInput = function(v) {
        if (!this.graph || !this.graph.list_of_graphcanvas) {
            return;
        }

        var list = this.graph.list_of_graphcanvas;

        for (var i = 0; i < list.length; ++i) {
            var c = list[i];
            //releasing somebody elses capture?!
            if (!v && c.node_capturing_input != this) {
                continue;
            }

            //change
            c.node_capturing_input = v ? this : null;
        }
    };

    /**
     * Collapse the node to make it smaller on the canvas
     * @method collapse
     **/
    LGraphNode.prototype.collapse = function(force) {
        this.graph._version++;
        if (this.constructor.collapsable === false && !force) {
            return;
        }
        if (!this.flags.collapsed) {
            this.flags.collapsed = true;
        } else {
            this.flags.collapsed = false;
        }
        this.setDirtyCanvas(true, true);
    };

    /**
     * Forces the node to do not move or realign on Z
     * @method pin
     **/

    LGraphNode.prototype.pin = function(v) {
        this.graph._version++;
        if (v === undefined) {
            this.flags.pinned = !this.flags.pinned;
        } else {
            this.flags.pinned = v;
        }
    };

    LGraphNode.prototype.localToScreen = function(x, y, graphcanvas) {
        return [
            (x + this.pos[0]) * graphcanvas.scale + graphcanvas.offset[0],
            (y + this.pos[1]) * graphcanvas.scale + graphcanvas.offset[1]
        ];
    };

    function LGraphGroup(title) {
        this._ctor(title);
    }

    global.LGraphGroup = LiteGraph.LGraphGroup = LGraphGroup;

    LGraphGroup.prototype._ctor = function(title) {
        this.title = title || "Group";
        this.font_size = 24;
        this.color = LGraphCanvas.node_colors.pale_blue
            ? LGraphCanvas.node_colors.pale_blue.groupcolor
            : "#AAA";
        this._bounding = new Float32Array([10, 10, 140, 80]);
        this._pos = this._bounding.subarray(0, 2);
        this._size = this._bounding.subarray(2, 4);
        this._nodes = [];
        this.graph = null;

        Object.defineProperty(this, "pos", {
            set: function(v) {
                if (!v || v.length < 2) {
                    return;
                }
                this._pos[0] = v[0];
                this._pos[1] = v[1];
            },
            get: function() {
                return this._pos;
            },
            enumerable: true
        });

        Object.defineProperty(this, "size", {
            set: function(v) {
                if (!v || v.length < 2) {
                    return;
                }
                this._size[0] = Math.max(140, v[0]);
                this._size[1] = Math.max(80, v[1]);
            },
            get: function() {
                return this._size;
            },
            enumerable: true
        });
    };

    LGraphGroup.prototype.configure = function(o) {
        this.title = o.title;
        this._bounding.set(o.bounding);
        this.color = o.color;
        this.font = o.font;
    };

    LGraphGroup.prototype.serialize = function() {
        var b = this._bounding;
        return {
            title: this.title,
            bounding: [
                Math.round(b[0]),
                Math.round(b[1]),
                Math.round(b[2]),
                Math.round(b[3])
            ],
            color: this.color,
            font: this.font
        };
    };

    LGraphGroup.prototype.move = function(deltax, deltay, ignore_nodes) {
        this._pos[0] += deltax;
        this._pos[1] += deltay;
        if (ignore_nodes) {
            return;
        }
        for (var i = 0; i < this._nodes.length; ++i) {
            var node = this._nodes[i];
            node.pos[0] += deltax;
            node.pos[1] += deltay;
        }
    };

    LGraphGroup.prototype.recomputeInsideNodes = function() {
        this._nodes.length = 0;
        var nodes = this.graph._nodes;
        var node_bounding = new Float32Array(4);

        for (var i = 0; i < nodes.length; ++i) {
            var node = nodes[i];
            node.getBounding(node_bounding);
            if (!overlapBounding(this._bounding, node_bounding)) {
                continue;
            } //out of the visible area
            this._nodes.push(node);
        }
    };

    LGraphGroup.prototype.isPointInside = LGraphNode.prototype.isPointInside;
    LGraphGroup.prototype.setDirtyCanvas = LGraphNode.prototype.setDirtyCanvas;

    //****************************************

    //Scale and Offset
    function DragAndScale(element, skip_events) {
        this.offset = new Float32Array([0, 0]);
        this.scale = 1;
        this.max_scale = 10;
        this.min_scale = 0.1;
        this.onredraw = null;
        this.enabled = true;
        this.last_mouse = [0, 0];
        this.element = null;
        this.visible_area = new Float32Array(4);

        if (element) {
            this.element = element;
            if (!skip_events) {
                this.bindEvents(element);
            }
        }
    }

    LiteGraph.DragAndScale = DragAndScale;

    DragAndScale.prototype.bindEvents = function(element) {
        this.last_mouse = new Float32Array(2);

        this._binded_mouse_callback = this.onMouse.bind(this);

        element.addEventListener("mousedown", this._binded_mouse_callback);
        element.addEventListener("mousemove", this._binded_mouse_callback);

        element.addEventListener(
            "mousewheel",
            this._binded_mouse_callback,
            false
        );
        element.addEventListener("wheel", this._binded_mouse_callback, false);
    };

    DragAndScale.prototype.computeVisibleArea = function() {
        if (!this.element) {
            this.visible_area[0] = this.visible_area[1] = this.visible_area[2] = this.visible_area[3] = 0;
            return;
        }
        var width = this.element.width;
        var height = this.element.height;
        var startx = -this.offset[0];
        var starty = -this.offset[1];
        var endx = startx + width / this.scale;
        var endy = starty + height / this.scale;
        this.visible_area[0] = startx;
        this.visible_area[1] = starty;
        this.visible_area[2] = endx - startx;
        this.visible_area[3] = endy - starty;
    };

    DragAndScale.prototype.onMouse = function(e) {
        if (!this.enabled) {
            return;
        }

        var canvas = this.element;
        var rect = canvas.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        e.canvasx = x;
        e.canvasy = y;
        e.dragging = this.dragging;

        var ignore = false;
        if (this.onmouse) {
            ignore = this.onmouse(e);
        }

        if (e.type == "mousedown") {
            this.dragging = true;
            canvas.removeEventListener(
                "mousemove",
                this._binded_mouse_callback
            );
            document.body.addEventListener(
                "mousemove",
                this._binded_mouse_callback
            );
            document.body.addEventListener(
                "mouseup",
                this._binded_mouse_callback
            );
        } else if (e.type == "mousemove") {
            if (!ignore) {
                var deltax = x - this.last_mouse[0];
                var deltay = y - this.last_mouse[1];
                if (this.dragging) {
                    this.mouseDrag(deltax, deltay);
                }
            }
        } else if (e.type == "mouseup") {
            this.dragging = false;
            document.body.removeEventListener(
                "mousemove",
                this._binded_mouse_callback
            );
            document.body.removeEventListener(
                "mouseup",
                this._binded_mouse_callback
            );
            canvas.addEventListener("mousemove", this._binded_mouse_callback);
        } else if (
            e.type == "mousewheel" ||
            e.type == "wheel" ||
            e.type == "DOMMouseScroll"
        ) {
            e.eventType = "mousewheel";
            if (e.type == "wheel") {
                e.wheel = -e.deltaY;
            } else {
                e.wheel =
                    e.wheelDeltaY != null ? e.wheelDeltaY : e.detail * -60;
            }

            //from stack overflow
            e.delta = e.wheelDelta
                ? e.wheelDelta / 40
                : e.deltaY
                ? -e.deltaY / 3
                : 0;
            this.changeDeltaScale(1.0 + e.delta * 0.05);
        }

        this.last_mouse[0] = x;
        this.last_mouse[1] = y;

        e.preventDefault();
        e.stopPropagation();
        return false;
    };

    DragAndScale.prototype.toCanvasContext = function(ctx) {
        ctx.scale(this.scale, this.scale);
        ctx.translate(this.offset[0], this.offset[1]);
    };

    DragAndScale.prototype.convertOffsetToCanvas = function(pos) {
        //return [pos[0] / this.scale - this.offset[0], pos[1] / this.scale - this.offset[1]];
        return [
            (pos[0] + this.offset[0]) * this.scale,
            (pos[1] + this.offset[1]) * this.scale
        ];
    };

    DragAndScale.prototype.convertCanvasToOffset = function(pos, out) {
        out = out || [0, 0];
        out[0] = pos[0] / this.scale - this.offset[0];
        out[1] = pos[1] / this.scale - this.offset[1];
        return out;
    };

    DragAndScale.prototype.mouseDrag = function(x, y) {
        this.offset[0] += x / this.scale;
        this.offset[1] += y / this.scale;

        if (this.onredraw) {
            this.onredraw(this);
        }
    };

    DragAndScale.prototype.changeScale = function(value, zooming_center) {
        if (value < this.min_scale) {
            value = this.min_scale;
        } else if (value > this.max_scale) {
            value = this.max_scale;
        }

        if (value == this.scale) {
            return;
        }

        if (!this.element) {
            return;
        }

        var rect = this.element.getBoundingClientRect();
        if (!rect) {
            return;
        }

        zooming_center = zooming_center || [
            rect.width * 0.5,
            rect.height * 0.5
        ];
        var center = this.convertCanvasToOffset(zooming_center);
        this.scale = value;
        if (Math.abs(this.scale - 1) < 0.01) {
            this.scale = 1;
        }

        var new_center = this.convertCanvasToOffset(zooming_center);
        var delta_offset = [
            new_center[0] - center[0],
            new_center[1] - center[1]
        ];

        this.offset[0] += delta_offset[0];
        this.offset[1] += delta_offset[1];

        if (this.onredraw) {
            this.onredraw(this);
        }
    };

    DragAndScale.prototype.changeDeltaScale = function(value, zooming_center) {
        this.changeScale(this.scale * value, zooming_center);
    };

    DragAndScale.prototype.reset = function() {
        this.scale = 1;
        this.offset[0] = 0;
        this.offset[1] = 0;
    };

    //*********************************************************************************
    // LGraphCanvas: LGraph renderer CLASS
    //*********************************************************************************

    /**
     * This class is in charge of rendering one graph inside a canvas. And provides all the interaction required.
     * Valid callbacks are: onNodeSelected, onNodeDeselected, onShowNodePanel, onNodeDblClicked
     *
     * @class LGraphCanvas
     * @constructor
     * @param {HTMLCanvas} canvas the canvas where you want to render (it accepts a selector in string format or the canvas element itself)
     * @param {LGraph} graph [optional]
     * @param {Object} options [optional] { skip_rendering, autoresize }
     */
    function LGraphCanvas(canvas, graph, options) {
        options = options || {};

        //if(graph === undefined)
        //	throw ("No graph assigned");
        this.background_image =
            "data:image/png;base64,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s+Gee+6566679u/fr+v64ODgNddcc8UVV9CrBV6pqloul7/xjW9897vfbffq3e9+d7VaxeZW3gL6Yl5pmmYYxgKvrr322t///d/XdR2770mS4GPECTW9WuAV4xW9+nV59Ytf/MI0zf7+/iuuuOJd73rX7OysaZqoL8qbWtgGFV4hYTAMQ9f13bt333nnnZwHDwdle6j7UFW1o6PjiPNgrVYzDGMF50H1hhtuWMEBEjVVsMQ0TcuyduzYccstt0xOTkZR5Pt+q9X69re/7brupk2bsAqU5qvZ8mYVAr00f5ZqmuaOHTt27tyJbdEsyyYmJh566KGJiYnLL7/c931R35a3D+9wryRJuvHGG2+77bbZ2dksy6Ioqtfrd999t+/79Eqar+3D8sYwjB07dnz+859v9+rhhx8WXqFGmV4d0au5ubm77rorCIJNmzaJ/VR6tZhXjFeLefXxj398165d9OoNeZUkiSRJk5OTDz300Pj4+GWXXYYMLIdeSZK0wCvLsmRZvvHGGxfzivMgVoOapgmvkItieXz0zIMrlrjjuhsukaBKW9M0y7K+8Y1v7Ny5s7u7W1VVWZYdx0nT1HGcxx9/vKura8uWLbgqh2CXw00aVFmlaWqa5v33379z587+/n5EcNzF6enpeeyxx/r6+jZu3NhsNvMWsxbzavfu3Z/5zGc6OjowU2K53NPT88gjj9ArRGrP85A07NmzZ+fOnYODg7gDJ7x6/PHH+/v74RViVntkx8jnzat77733s5/9bLtXkiR1d3fDq82bN9OrI3q1WLyiV/Bqz549C+KVJEldXV2PPvoovVrCK13XJUkKw7Cnp+eJJ54YHBy84IIL5ubmUDeStw0+2IWkU9d127bvvffeJbziPKiqqud5kiRZlnXffffdcsstg4OD7esfzIOIV41GY6W8UlZQLKSb0vwFXlmWG43G7t27C4UCDndQeoUoPzAwcM899zSbTfQiwJIoh7fFkySxbds0Td/3v/rVr6IAC/dOGo0G7uV0d3ffeeedtVoN1Ww53Ik53Ks77rjDcRzbtjVNs207DMMwDKMoolftXqG876tf/WqxWETvHcMw4FUcx11dXXfccQe9avfqW9/6lm3btm2rqmrbdhRFS3iVw64pi3nFePWGvFo6XtGr9njVbDZFvPrWt741NzdXLBZz6JU0v+8u9tEbjcY3v/lNy7La41UURXEccx4EuIfanl+hdYyYB5MkwTxYrVZXMF4pK+sW1oIovUqSZHp6+uDBgxgjeGOapq7raZqGYTg5Oblv377u7m4c8UiSlEOxULiGU+a5uTlYpSiK7/tdXV1xHLuua5rm2NjYgQMHcG6Yw5h1RK8KhYLrummatlotBC9c8KJXUAhNYyYmJmq1GsI3LjN1dXVFUYQWRqOjowcPHsxnu8zFvHIcp9VqwSvbtnEfDvd69+7d29XVJbzK4fe4mFeMV8uJV+1eIWmgV0t75bouIjnKtQ8dOvTqq6/msLRPHFKh4gWXTaempuBVs9ls94r5VTvCq2q1ihaQ6E3U2dkZhiFaGI2Pjw8PD6+k/yv44WErXTTLxFeHpk7iAALLaMQ1LKbRkBvRCudiuQKXcnRd932/Xq8j+8SZl+u6uq6jrS/a2aIOsj3Nkuf5nd/EQqiCS67rSvOd10STLFFEhMteYt8LJW453GlAVV+9XnddF62KZFnG6BmGgctwaP1x+ET4O18NKT4iXN5CSQPyKtEsWdM0BH0MiKZpvu+jHBk/zKFXEANN6FqtFnawcPkSNywxOEmS0Kt2r5A8ybKMu5VIzVFRQ6+W9goFohgTWZZ938/hZXqEdET1NE3b58EoipAnqKqKwREGep4HA3PrFTIEZFPwChUN+CpxtRcDK2qKFqj128mvlBX88PDXxr9Cl97eXiwBcasXE6HooxnH8bHHHhvHMUI8SgPzJhYWwWma9vT0oJ02MlHP8xzHERe8yuVyf3//684Wv5MfntT2CA6Sqp6eHsuysJsFeXzfxzRpWdYCr8T/I3nbwUIQP+aYYwqFAi6WoOOVbdvwSpZleLVYYPqd90p0REba1NPTg3NVsU7G/ZM0TdEIec2aNdj8w2smOfRKrJB7e3s7OzvbAz4Wh9ipKRaLg4ODi23E5NAry7J0XVcUpV6v49EJpPL0ammv0jSFV8KxwcHBfCagi82DUAghHRsNeK+DXkmSFIYh9hGQX+GZMyyqi8UiTuzxXEB/f/8KeqWs4IeH6R/5Nzbdu7q6LrrooqmpKV3X0Xi1WCximEZGRi699NL+/n602MR3m8PaPlVVEcdXrVp15plnzs7OwifUQaLxar1eP/PMM4eGhlqt1uFT4O/23oOIU9L8qY4kSZ2dnVu3bkXbWtu2FUUpFApRFBWLxZGRkUsuuaSvry/nXkmSVCgU5ubm+vr6zj///NnZWbzKcUSvms1m3rxqzyDRckF4NTExgYsTGMMoihCvtm/f3tvbi/0taf5wP29S4Zi+Xq8PDg6eddZZ1Wq1XC77vo9tY9M0DcMIguDcc8895phjZmdn6ZXwampqyjAMdAIplUp4MYdeLe0VdpGFV+ecc84RvcqDUYvNgyK/oleL5VeNRgP51czMDPIrXdeDIDBN0zTNMAzPPffcNWvWVKvV3CXuaFiBX6OiA5Zcd91169evr1arOOTCK6ojIyOnnXbaO9/5Tuy+Y/NvwaMVOSGOY0VRTNP0PO/973//0NAQnpnAb6GEpru7+73vfS+ODvM2PuJMWfwTJ87vfve7TzjhhFqthmOcMAwdxxkfH1/glVhV5m3cEK9RjfbBD35waGhoamqqVCpJ86dhQRDAK7wonmevsIzB9/Xud7/7+OOPh1dBEARB4DjO2NjYaaed9sd//Mdi9DCD5tMr1Ht4nve+971vaGgIl7pwHK8oSqPRKJfL119/PW400St4dd11151yyinT09N4ixftUxCv6NUyvSqVSn/xF39Br9rnwXe9610nnHAC8qsgCPCS4+joKL0SU7+qqpZlifwKzw7CKzzTWy6X/+Iv/gLP1R9eGPPb2WtYsXaQOIgRLWxxSphlWX9//8knnzw+Pr5//35JkoIg8Dzv7LPP/pu/+ZtTTz0VSQOW1HEco6lfrsRCfoCRGRgY2LZt21NPPTUzM1OtVm3bbjQaJ5544m233bZu3TohUK66sYp1HY50cJdXkqT+/v4TTzxxbGwMr3r5vu+6rvAKj57ggT2sf/LmlWVZtVoNS5dKpbJ169ann34aF79s2242myeeeOKuXbuOP/548TB7rrxCvBJeialxYGDgxBNPHB8ff+WVV+CV7/vw6uSTT8afCcMQcV/MiPnBMAxcoA/DcGBg4KKLLnriiSemp6er1aplWY1G44QTToBX2Tz0SpKkvr6+U045ZWRk5NVXX43jOIqiZrN51lln/e3f/i29Wtor0zTr9TrmQXglze9Acx4U8+C+ffuQRbiue8YZZ3zsYx+jV+35FbwS+RVe8qrX6+vXr9+1a9e6devEPLgirNjLqdL8CQ4Mw6+x797T01OtVp9++umf/vSnhULhuOOOu/TSS03TbLVaKPLD2T0up+btQj0Kh4IgQJZQKpVUVX3ggQcOHjwYhuH69eu3bNmCIfI8r1wu5+1iOO6YyrIsHiDETgM6+87Ozj7zzDM//elPHcc57rjjtm/fjuwhjmNRyY2pNG+bDSjLxkUcz/OKxaKmaQu8wikhvMphIwvMf1EUIV5BsCiKuru7Z2dnf/KTnzz99NOFQuH444+/+OKLHceZm5vDTICqdzGP5m3nr1Ao4PpEe7zav39/HMcnnXTSRRddZJpmEATNZjOHbfsW8wrxqlar/ehHP/r5z39uGMb69evp1TK9OvHEEy+66CIENHiVwwXhcuZB5Ff06vD8SpIk4dUPfvCDvXv3tnuFh0FXMF6tWOLefiG3/YtC95harTY4OCh+ODExgfMLcaDveR5eEMjhU8+e5xmGgf11XK/EyKCvUxAEuEKOHk95u5eDDgy4TYI6SAQsPFk1NzfXfmd3cnISb9Di8XDUR6J9St6qQURNJNqwYtAqlYoo/cd1XuFV3ho64V164RUmQtGeqNFoDAwMiGEcGxtD/wFsLui67nlePr1CxaNhGI7jNJtNxCt0NoRpruuimEG80E6v4BUapPT19UnzT2DiNgW9el2voihCgxTDMMRmc67UetPzYM69QkEH8qt2r/A9JkmCeAWvVnD3asUSdxTJoCcR+nvgLT2RHKCYGzd8S6USevnhTwoR89mfFUMnOqKgi5MYENG2D1Esb0dd2FRArilumuI8B4VVovQ/SRK03Bb9RkUTybxFeRHo8QGiYAbFM7icKrzCuyf57Bvt+z5uzCOLwqoYmTo2SsU8hz4zqqpi6HChIp93TrC9IjpXwC7f9xGv0LEBXuF3c5i4H9ErkYCKDzMIgo6ODgwgvVrMK5TQKIoi2iDid3OYuC82D2IvD99aHMdpmuJknl5J8xfEl8ivRJtp9OFZKalWslSGEEIIIYQQstwFBoeAEEIIIYQQJu6EEEIIIYQQJu6EEEIIIYQwcSeEEEIIIYQwcSeEEEIIIYQwcSeEEEIIIYSJOyGEEEIIIYSJOyGEEEIIIYSJOyGEEEIIIUzcCSGEEEIIIUzcCSGEEEIIYeJOCCGEEEIIYeJOCCGEEEIIYeJOCCGEEEIIE3dCCCGEEEIIE3dCCCGEEEIIE3dCCCGEEEKYuBNCCCGEEEKYuBNCCCGEEEKYuBNCCCGEEMLEnRBCCCGEEMLEnRBCCCGEECbuhBBCCCGEECbuhBBCCCGEECbuhBBCCCGEMHEnhBBCCCGEMHEnhBBCCCGEMHEnhBBCCCGEiTshhBBCCCGEiTshhBBCCCFM3AkhhBBCCCFHaeKeZVmappIkybKcZZksy6qqyrLMoQFpmiqKoihKmqbtv+bIAE3TMBqqqmKIJElKkiTLMvxTuCTLsqJwoUiv6BW9WklUVRXCiOmPXtErekWvjjZgC+TBP9M0zbJMrtfrqqpmWRbHcZZl4te6rnPUJElSFCWOY3yWSB3aswoSRZGmaYhQ+OqyLBP/iviFsIVf4w8TekWv6NWKJAqwKMsyTdN0XU/TNIoi4Ri9olf0il4dVfOgLMtpmsqyDG2SJFFkWY6iCJm6aZoYr46ODg6ZGDhVVcVnpmmaqqpRFHFkQKlUUlU1SRJVVU3TjOPY930c2hzuVblc5ojRK3pFr1YK27YVRdF1vVAoyLLcarXCMDRNk17RK3pFr442kIqnaWqapq7rURRFUSTL8i933OGWaZqqqoZhGIahZVkcNSwEcRaB4y2x7sHSkHieZ9s2RilJEmWeNE3pFb2iV/TqqALjgPqrLMsMw5Bl2fd9kTHQK3pFr+jVUYLv+4ZhGIaRJEkYhqqq6rqeJIk8MzPTXtSOkhouegRxHOMQB2tl6JUkCY+6gGEYQRDIsizLchzHyK6CIIBFOBmkV/SKXtGrowEIoygKJkJUh+K8nl7RK3pFr44qkKZjNYif4NaEnKZpq9WK4xi5OwYxDEPWuC8YPtM0JUkKgoCfXDv43jRNy7IsCAJVVR3H0TRNURTXdaMognCo0wqCgF7RK3pFr1Y2x8ImH3SSZRlbofSKXtErenW0LWygCo4gYFehUNAeeOCBtWvXnnDCCaqqzszMxHFcKBR4M6BdqTRNR0ZG9u3bJ0nS8ccfPzg4qCgK9RLRyjAM13XTNO3u7s6ybN++fQcOHJAkaWhoaP369bIsT09Pp2mKxIsjRq/oFb1awQWhZVlIsIrFYhzH+/fvHx0djeOYXtErekWvjio0TdM0rdVqZVnW09OTJMnevXuHh4flE0880TTNq6666t3vfveaNWvq9XqSJFwOCprN5he/+MU9e/Z4nidJkm3bV1111Z//+Z8Xi0UOjjTfzgnxaHx8/J/+6Z/uvvtutHayLOvKK6+87rrr1q5d22g0eJWeXtErerWyiIKrcrn82muv/dM//dN9990XBEGWZfSKXtErenVUIcsyStvL5fLw8PBXvvKV++67LwxD9dhjj03T9Kmnntq3b9/27dtxlJPDPqNY5KGNPfID0zRd133f+963Z8+eYrGoKAoumjz55JMvvfTS5Zdfbtu2+E9QeIST/byNG+r5giD4wAc+cM899ziOgxvQcRw/+eST+/fvv/TSS1GClU+vRIn2cry67LLLisUijlZR4Y37OjkcN+Tuvu//1V/91d13310oFOBVkiTCqzzHK+EVgo9lWcuPV2ma5jNeYS5UVdXzPMQry7Lo1ZuOV/Sq3StN01zX/cAHPnDvvffato1rhXEcP/XUU6+88krO86sjevX+979/9+7dhUIBW8uyLD/xxBO/+MUvLr/8csdxwjBsD3E59ApTPwpE4ZXjOJZlqf39/VEU9fX1Pf/887IsX3rppb7vt78XkBPwV25v/m+a5pe//OW77rprcHDQ8zxYFYZhd3f3L37xC9u2L7jgAtwNQOYqRjlXiP5WO3fuvPPOO9euXev7PsYhjuOBgYHnn39eUZRLL700CIJ8DpHwCn/3pb1yHOf8888Xd05y+1QHAnS5XL7lllvuuuuuoaEhz/MwjEmS9Pf3P/fcc4hXQRDkc20jzXexkOYri77yla8sM16JRz0YrxCvkBnQK+GVaOvxhubBnHtVKpXglYhXeBWH+dViXt19992rVq1C+x20zuzp6YFX559/fpIkwqvc5ldZlnV0dOzcuRPzIOKVEsex4zjNZrOzs/PRRx+dnp7GPl8OrRJ/6yzLdF2vVqv3338/thPa+4xGUWTb9n333VetVnVdF+/CiJvjOcxKZ2ZmHnnkkUql0mw2HcdJkqTdq0ceeWRmZiafOaiI0Xh343W9uv/++6vVKtaBIn/NJ8Krzs5OeBXHsfCqUqnAq3wGK/EQlXjPpVar3XfffUt7JeJVPmfB5cQreiUmMjEP0qs3Ha+SJFngVT7XNot5hYsBeHEJcSyOY8uy7rvvvlqthp8jyok3+PIWr3D79NFHH61UKo1Gw7btOI4VtF1D29Gpqanh4WFc781nzMIWS5qmhmGMjo5Wq1XbttsfRcMayLbtWq02OjpqGIb4T3KbY5mmefDgwampKWz7+b6v67qmaVhGS5I0NTV18OBBwzDymShgMw+7xYZhjI2NLeHV3NzcyMgIruygx21ut/0Mw4BXSBSgkxCsPV7ldpNP3ARAvKrVaot5Va1WGa+WiFf0aol5kF4tJ86bpjk8PIytT13X0TpG13W04oZXBw8eZH7V7pVlWfghvMLvWpbVnl+J6prceiXiFXTSdT2nB/GEEEIIIYT8v4WCh3nxZEBvb+/atWtRi5zPxQ2OYxRFCcNw1apVnZ2dqFTD74qyY8/zKpXKqlWrcHkiz7V9kiQFQTA0NNTb25tlGd6Ew0NxOAWTJKm3t3doaCgMw3xuM4hrW/BqcHBwCa86OjpWr14dRRHe8kBL4HxuYoVhCK8kSRI6CcHa41U+x0fc9BLxqlKpLOZVZ2cn49US8YpeLTEP0qvlxPkgCNauXdvT05NlWRRFpmnigXrLskR+NTQ0xPyq3Svf9/FDeIXf9X2/Pb9CiMttqW17vIJOURQpuAddLBar1eq2bdugXT4DVnuVXhRFnZ2db3vb2zzPQ4MU/Bb64Xued+WVV3Z2duI2vTRfEZHP2jV02r744otrtVqxWHRdV1XVdq8uvvji7u7u3B51tb+Z97peve1tb+vs7BQ3eHKbXUmSJLyqVqvwCp0H4FWtVoNXuc2ucMQMr+I4rlQqV1555dJeiXgl5fX6xOvGK3olJjIxD9KrNx2v8ABTu1f5rCZazCsUQIqGM6h3933/yiuvrFQq+Hmeu6uhzra7u3vbtm21Wq1UKuGCuLp69WpJksbGxrZu3XrjjTfiyxR343K1fYWr8ejtiEYxJ5100s9//vOXXnqpo6MjSZIsywzDGB8f37Rp00c+8hEEsvYOkvhv8zZukiRFUXTOOee8+OKLzz33HFo74UMdHR3dunXrjh078DJFnr3CzsHrevXhD38YS2oxtrltB4kNhrPPPvvFF1989tlni8Uizh9EvNqxYwdGL59eoeUCBgr3ut5QvMpt+9ojxit6tcCrNz0P5tmrOI4Rr55//vlisaiqKj7P8fHxbdu2YR7MbX51RK9eeOGFn//85+VyWfxwbGxsy5YtH/nIRwzDwMmzqHHPZ36FeVDEK8yDarlc1jTtmmuu+dCHPtTX1+f7Pi7S5XBlg7Vde19ITdMuueSSLMt+8YtfBEGAkHTttdf+9V//teM4OMERW6q5LWmQJClJkkKhsHHjRkmS/vM//zNJkjAMDcO49tprP/CBD/T19eGsMJ8rZnxNy/SqUCggwImxym33DxzRFIvFDRs2qKq6d+9ez/PiOF7gVW53YoRXYl4UXv3Xf/0Xuhnqun7NNdccHq9Exp9Dr5B60qs3Ea/o1TK9UhQFXqFm5tprr/3gBz/Y09OD+qvc5leHe3XxxRdLkvTyyy9jHsQ3+NGPfhS9nhaEuBx6Ja7zFotF5FcvvfRSGIby97//fTzJq6oqLkQ7jtN+8pVz0OhqdHR0//79kiStW7du1apVOOvh4Ejz7Ypc15Ukqbu7O0mS/fv3Hzx4UJblNWvWHH/88cKrQqGAfXcOGr1aTsAyTdP3/TRNcRb/yiuvjI6OpmlKr5YAm51jY2PtT4jLsiyKHOgVvaJXvzWvJElatWrVcccdhwaIiqJYloU3Vjlo9GqZqYLruijEStN07969Bw4ckNM0bbVa4sEXHOKEYajrOodMmt/v1DQNXZyCIIBSDOgiYKEtKwZHURTHcXD03Gw2Retf0emJAYteLXN80jSN4xj1xzDHcRxZlunV0uB7FF5xF4Ze0auV8kqSJGRdqJnMeb8BevUm8ivk7mmaIr+ybVvTNHlmZkZUYknzd8bRQJqjJkmSOK/BCIpf57BM7YjgHQBxQw5npkEQqKoqbs5hxPBWNneU6dUyJ0Jx7I4mRZgRscVAr17XK9xvhk70il7RqxXxSpIkka/jlQDxohAHjV69Lrquh2EIu8QV3iAIFLwRkKYp7gFompYkSbPZ5JCJxFR0KRJ9i/L5ltARmZubk2W5/YUzSZJM01QUBaOE7lemaaZpWq/XOWL0ajmEYYgJDx36HMdBVzV6tTTi2SB04JHmn/DgyNArevXb9wptRh3HQUKPN3rz2RmZXr3p/ArXvsUPLcuSG40G1jpYDmL3FM2MOGpYCOJsS+yMihMxDg4+PEQi8UocnsIWxVfYg8eFS1QBctDo1XJ2GjAaaPq7YGeUXi3tlbjaizUhvaJX9GpFvJLadtzxDih+zZMcerUcxCsTeN3Zdd0oihzHkev1OsYIK0U03EGXVo6aNN/ODytCfIT4dT67kh9OFEVQBWdeuGsiWjvRK3r1pgO6aKCJU2Y8RaGqKr1aAiSd0vyhs/g1j+bpFb367XslzW8qo35GNFRhYkqvloNYw7QfzmdZJtfrddHOCa1nxO9x1CRJQtOi9tQKv+alJYDNA/iDX+CCBP7ZXkUD7cTTQvSKXi29sJHaethjlDAd0it6Ra/o1f8TXmEpKEZMdEXkBg29Wg6qqoZhiNMb8bpLkiQyy/gIIYQQQgj5f2ChyCEghBBCCCGEiTshhBBCCCGEiTshhBBCCCFM3AkhhBBCCCFM3AkhhBBCCCFM3AkhhBBCCGHiTgghhBBCCGHiTgghhBBCCGHiTgghhBBCCBN3QgghhBBCCBN3QgghhBBCmLgTQgghhBBCmLgTQgghhBBCmLgTQgghhBDCxJ0QQgghhBDCxJ0QQgghhBDCxJ0QQgghhBAm7oQQQgghhBAm7oQQQgghhBAm7oQQQgghhDBxJ4QQQgghhDBxJ4QQQgghhIk7IYQQQgghhIn74siyLElSlmXtP8myrP0n+CH+ZK7Isgx/6zRNJUnSNE1RlDRNNU1LkiQMwzRNDx9AsphXYlSFYPSq3Std19M0jaIoTVNFUfBncjg+jFe/Xq9UVU2SJIqiLMsURRHfIHWiV/Tqt+wVBorzYPv4wCtVVRVFSZLkaMuv5Hq9fnStJBQlDENVVVVVjaIIAxeGoaZp/OREwEIKFcdxHMeKohiGEQSBaZoIW3EcYyQZsOjVr9crRHN6Ra9+da8Mw8B0mCQJB4pe0asV8UpV1SAI6FW7V6qqSpIUxzGG6CjMr466xB2r5ziOkyQxDCNNU/wCH2H7SIl1Ya7E0nU9DMMkSRRFwUIZ8QsyZVmGnVFN07Isi+MYCpLFvEIy2q4WvRJeqaoahiEydXrFePUb8grZA72iV/Tqt5CY6rqOE1TOg//v5ldHY+KeZRnWf2EYYmWDowp+dZIkRVGk6zpGI0kSmISSBiwW29MsVVUhHHldr0TYymfACsMQO1VLeJWmqdiQ4G4W49WvyyvGK3pFr35roLBWlmVRUIRFDudBkV/BoqPZq6Mucc+yDOvmJElM08QwGYaB4EVwQNP+XWFpGEVR+4cn0ixRvsZZ8IheBUEgtdXz5bYIZIFXkEqWZfHdtQ8RvWK8+hW9EvFKqMV4Ra/oFefBo80rpFhHW3511CXuSZLghAsOoaJIrAjb13/5NEyc2uCwRtwaxPENlozYqmEt8pvwKrdhC2OywCsMV7tXqLWlV4xXv3avVFXFhTBCr+jVb9Qrsc7hPLic/Opwr1Y8vzrqEndN01zXLZVKSZIcOnTIMIzVq1dnWYYVIcE5F+qrFEWxLAuqTUxM6LpeLBZt206SxPM8FLFxxOjVMr0S9aCapgmvxsfH6RW9+g15VSgUHMdJksR1Xez8ccToFb2iVyvuFVY4lmXh9vPRll8djTXuuq7v2bPnjjvumJyc9DxvaGjoD/7gD6666iqJl3LaruCkaVoqlZrN5ve///277777tdde8zxv/fr1f/RHf7R9+/ZyuQy3eES4TK+EWrntdahpmvCq1Wp973vfu/vuu0dGRjzPO/7444VXvu+LlliE8epX8WrdunXwqqOjg17RK3rFefCoyq+EV0dbfqXecMMNKzVAqBMS7aKDIEDnnb/7u7/79Kc/3Wg0fN+XZfnQoUMPPPBAo9HYsmWLNH+xF8cW+exfixHAyu+zn/3sZz/72cnJSUmSoiianZ39zne+02q1tmzZkiQJAlauRmkxr0zT/P/+v//vc5/7XK1Ww/nXyMjIAw880Gw2t2zZIkYVq+18qiXLchAEhUIhy7Kbb775lltuGRkZwT7W1NTU9773Pdd1N23aJEmS6AtJrzRN++QnP/mZz3xmdnYWLRqGh4cfeuihWq22fft23/dRBykqJvOZK3ieB68+/elPf/7zn6dXy/dqZmYG+8qHDh2iV8vxKooieOV53ubNm7MsC8NQvEGRN6/wTyxyNE07olcPP/xwvV5HfiW1nerndrXj+367V6Ojo2iaWa1W77vvvkajsXXr1gW3KfKSuIutAsMwIJCu67Zt79mz55Of/GR/f780f+PEcRzDMP793/+9Uqls2rTJ933TNEWlUQ5r+zBchULhX//1X7/whS9UKhXTNEWZWrlcfvTRR/v7+zds2IB8NG+f3xG92r1796c//enOzk7IY9u2ruuWZf34xz+uVCqbN29Go9Y4jvPpFU4Gsc3w9a9/fdeuXd3d3Y7jYAxt27Zt++GHHx4aGjr11FN1XU+ShF7Ztn3vvfd+7nOfwzeYJIlt25qmFYvFH/3oR+VyecuWLWEY6rqOwrYcXg+AV1mWlcvlr33ta7t27erp6aFXy/fKsiwMFCpA6NVyvLIsy7btRx55ZGho6LTTTsMrcvn0Cu1Q4JVlWUf0qlgsPvXUU8ivPM8zDKP9BascepUkSalU+trXvnbrrbd2d3fbto21n6ZplUrl8ccfHxwcPPvss3E/dUUSd2UFrcJ1XVwcQaOrZrP5L//yL8ViEZ8ZGo42m01d103T/N73vjczM5OmKV4QgF55EwvvJhQKBc/zvv3tb6dpil6/iFaox+ru7r7rrrtarVYOWxAs5tXXv/510zRxfb5UKuE8BxbBK9xEya1XGBnLslzX/e53v4sXTKIoEl4lSdLd3X3nnXe2Wq0cFkQu4RXah/m+XywW6/V6EASyLCP3qlarsix7nocIlsPvEX9ry7Jw6IzwFYYhvVraq6997WvwyvO8YrEozp/p1dJeJUlCr4RX4gIlDnNardaCeNVoNBCvRH4lSRKyfDR3z6FXQRDYtr3AqyzLbNvGZYBKpXLHHXe0Wq0VHJ+VTNyxQ4wkCb8eHR0dHx9HghVFERIpy7J83y+VSocOHTp48GCxWEScEk8G5IogCIrFYpIkIyMjr776KvYYUJiFNAs3VoeHh4eHh23bzmHAOqJXY2NjhUIBsazVamGnIQzDcrm8wCs8vpC3cQvD0HGcMAwPHjz46quvFgoFdLHFdkKr1dI0rVAo7N27d2JiIoeXvZbwCl+ZLMuNRgNe+b4Pr/ANRlGkKApKIHLuFTZl6NVy5kF4pShKo9GwLIteLccrzIau67Z7ZZqmlD/QCwVJJ04nRkZGFotXpVJpeHgY8yBUbG/unh+iKMIIHDp06NVXXy2VSghWmqYhv8Im18GDBw8dOlQoFHKXuLf3hBZLQ+SdURTV63XLsvBbeN/L8zxkVFg74hc5TLA0TfN9X1EU/FOMJE5LUcrmeZ5lWRjDvI3PEl7FcTw3Nwev8PmlaYqrS+JxEwS4fD6zB21wAQAlQ/jQpPl7YK7r0qsFXuF5y0aj4TgOPkPbttM0dV1XTJymaSLB0nU9n14hyxS95+jVG/IKW/LY8KNXy/QqiqI8eyWWhdJ8M3JRMNPuFc5wsixDfoUTe9EpMp817sIrzIPwqv0ZJpQ8zM3NrWCesJKJOwbFMAzRzX5gYCDLMuz24YZEHMf1eh1l7qqqdnd3R1GEz9K27Rwe5eCNCUVRBgcHEY/EewqapmGVbNu2LMtr1qxxXTeH43NEryRJMk1TVVXf9x3H8TwPYV14hforHL/m0CsEdFVVBwYGHMfBNSZxBIG74KZpWpbV19eXw6PnxbzCzgLyJ9u2Xdd1Xdc0TdQwdHV1BUGAd3Py6RViOLwqFAr0avleIQ31fd+2bc/zPM+jV8v0CisZeoVcc8E8iHglvEK8sm3bMIze3l7kV/Aqt6XIiqL09/c7joN3AHAXHOWjsiwj71qzZo3v+7lL3IVe7XefOzs7L7vsstnZ2b6+PiwBUWuFer7zzz+/r68PFweDIMjnirDZbPb09DQajUqlcv7551erVcMw8CmiuKhYLE5PT5977rlr1qzJ7TvPh3t16aWXNhqNcrmcZVmr1SqVSvhKW63WeeedB68kSQqCIJ+9w3zf7+rqqtVq5XJ548aNjUYDeQMWivBqamrqnHPOOeaYY+iV8OqSSy6Zm5srlUppmjYajWKxiD/muu6GDRt6enosy8IGPNbV+fSqWq0Kr7BUplfL9CrLsnq9Tq/ekFdxHJdKJeEVnmrKm1HS/MPqC+bBw72SJMl1XeRXSLdQYJPDiobDvdJ1XdM03JsPw9C27fHx8bPPPnvt2rUreCN8JbvK4KCh/QRH07ShoaEf/ehH+/fv7+3txelhlmVzc3Pd3d0333xzf3//9PQ0FohYKebtNj0uTyCjOuussx588MHJyUnLsrA0NE1zbGxszZo1n/vc57Ankbc2WIt5deyxxz755JMHDhyoVCpon6IoSrVaFV7Nzs7Cq1arhQ4PedvBQr8mSZLe+ta3/uAHPxgbG0NYx+MmExMTQ0NDn/rUpxzHEQbSq3Xr1j3++OOHDh3q6upCuZqu67Ozsz09PTfddNPAwEC9XseHmc8FoaZp2CqGVw8++CC9WqZXjz322PDwcFdXF+r3dF2fmZnp7e2lV0t4lWUZZsPx8fG1a9fefPPNKIWnV/DquOOOQ7zq7OwUXs3OznZ2dt500039/f0zMzN5zq9Q8Y+/+Omnn/6DH/xgfHwcXsmyXCgUxsfHh4aGbrnlFlFWJOWzHaQ03+IQZVUDAwOnn3765OTkc889h9tLvu+fccYZt912W19fH1aQonIrhzEriiI0nvN9f2Bg4Kyzznr55ZeHh4dbrZYsyzMzMxs2bPjkJz+5fv16lBjl8NXiJbyamJh4/vnn273atWtXf39/+wV81LvnzStc9nJdN4qiwcHBM84448CBA/v37/d9P0mSWq12/vnn//3f//2JJ56Iq3JS/jiiV319fWecccbExISIV67rnnnmmbfeeuvAwACCldiAyGFv1jAM0QILXp1++ukLvLrgggs+8YlPnHDCCfRqgVdnnnkmvXqjXuEovlqtnn/++Z/4xCcYr5YZr3bt2gWvsDef2/xKtBlttVqrVq3asGHDSy+9NDw83Gw2NU1DLcNNN920fv16XO2VVujJl6Pl5dR2yUzTnJ2dfeGFF1566aUwDE8//fSNGzdiBYlrKGio2f7KV36wbXt2drarq8vzvLm5udWrV9fr9R/+8If79u1rNptnnXXWhRdeqGkaKiBxxVDKMa/rlahdg1dilyJvA2VZVq1Wq1QqQRDMzc0NDg42m80nn3zy5ZdfTpLklFNO2bhxY7lcbrVa2KTJbVXDG/IqTdMoimRZRiFWDtVa2qtTTz31ggsuwAuF0vxFC3pFr+gVvVqp/KparQqvVq1a1Wg0nnrqqb1797que/bZZ2/evBmPMeFBmJX633nUJe54wLJUKuGGBCpA6vU6+kzjxqq4iZ/DxjIo99c0DYekiEp4aU+SpDiOW62WaOSEMzIGrCW8Mk0TV09QH4k/nMOdBpTP4vYb2jepqgq10BcyCIJms2mapmmazWYzt40a3lC8wnQo/mQOd0aX9kqSpCAIUKBsmmar1aJX9Ipe0asVBA/joOl2FEW4v4Q8KkmSZrMpbtWvYH51tCTuwhUULWAHFFmp6EwURREuYmJkcVyYz/I+fHJIp4RDhmEgZqGrTBiGovwj5yztFT4/LKCRsufzuVk8wYiGTjirQTTHu3FZluFKE559yeF9uDfhFeIVOtblM14t5hWaO+GLQwmp7/v0il7RK3q1gqRpivp+OOO6Ltplos0O9rDwwtfKttw5urarUV+FQitN09BqFN15NE0zDANVDeJNgRzeepbmWxBkWYYn1iuVCmTC7RPc8arVauiWxWi1fK/wzjM2IfIplfDKcZzOzk54heZO8Gpubk7sN5DX9UpV1TiOxds69Ep4Zds2vCoUCvSKXtErenU0gBHAMU4UReVyGTfp0Xxc5Fcr7tXRteMOsP6DNNgBxe4yNo+xqaxpGhog5m1FCHuwr2CaZr1eR80xVopBEKA/a/u6mQHrjXqVw4JILPOiKEJv+0ajgWWh+AOI5rZtK4rSbDZzXoL1ul7h1ziYFjtb+YxXS3uFbtPIIVqtFr2iV/SKXq0U4v1dVCP7vu95Ht5SRcqOZwpxPr+Ce6NHXeIu7jLjF+KEC7d98WuUueOMLIe1feKfWCubpomqGDyhJ+6kiqcEGKpe1yvxrDGy9nzenRA1QojXWAdiKHBrQtziFSNGFvMK44ZREufROVxIL+0VCh7QuBZbEvSKXtErerWC4yOaNcEcXddxFI9Sbbz+KbU91bQy/zuPtoELwxD7x57niSI2XDoRDxpjEPN58xJBCiOA+5Se50E1NLWFVbgezlKZ5XilaRpGEqVs4uG9vHmFU0LxWYm74Aj0WBlCPxaMLtOrBfEqh0f2y/QKPZ2YXdErekWvVtYrZOoYFuRROKM4qvKro7FUhhBCCCGEELIA1lEQQgghhBDCxJ0QQgghhBDCxJ0QQgghhBAm7oQQQgghhBAm7oQQQgghhBAm7oQQQgghhDBxJ4QQQgghhDBxJ4QQQgghhDBxJ4QQQgghhIk7IYQQQgghhIk7IYQQQgghTNwJIYQQQgghTNwJIYQQQgghTNwJIYQQQghh4k4IIYQQQghh4k4IIYQQQghh4k4IIYQQQggTd0IIIYQQQggTd0IIIYQQQggTd0IIIYQQQpi4E0IIIYQQQpi4E0IIIYQQwsSdEEIIIYQQwsSdEEIIIYQQwsSdEEIIIYQQJu6EEEIIIYQQJu6EEEIIIYQQJu6EEEIIIYQwcSeEEEIIIYQwcSeEEEIIIYSJOyGEEEIIIeRoTdzjOJYkKQgCTdNkWU7TNJ8DkWWZrutRFOEXkiQlSYKfJ0kihiVN0yRJsiwTf0DX9SzLwjDUNA0/zxuyLOMvrihKGIayLEdRFMdxmqZxHON3FUVJ01SW5Tx7ZRgGFMKHliQJFIJLQjN6JcZEUZQsy2RZxvgIr5IkEV6JMaRX+L7SNMWgYYggFcZQBLcoinRdz2G0x6eE8VFVdUG8oldLzINpmrbPg0IzeiXAN6iqahAEkiTFcSy8UhQFUyTnweV4JT5VfIlJkpimmcNPEp/Y4fmVUqlUZFkul8v1ej1NU1VVEfFzOEBxHOu6jtEJgqBYLMZxrKpqmqaGYTiO4ziOYRgYpSiKCoVCEARhGKqqip/ndv2H8F2v10ulkizLnZ2dlUpF1/VCodBsNjG8eU5ADcNANA+CoFAowBl6tTQiA2g2mxiidq9arRYCPVY49ApeITPQdd22bdu2MYaKogivgiBQFMUwjHwmpghWyAYQryRJqlQq9Op150H4JuJVkiTt8SrnXiFrQlRvNBrlcllRlM7Ozo6ODk3THMdpNBrISjGS9Grp/CrLMtM0W61WmqamacqyjM3lfHqFqN5oNER+pV5wwQWyLHd1dRUKhSiKZFnGHnzecneEcoyRJEn4urBQ7ujoOHDgwHPPPXfgwAFZllevXh0EAVIKsYzGxryqqvncZoBYWAQODw//7Gc/27t3r2EYpVKpVCph1wHJPUYsP6iqimMHfFDCK1mWOzo6Dh48+Oyzzx44cEBRFHp1+N6VGKg4jsfGxp5++un9+/cbhlEsFkulEvZvhIH0SgzXgQMHhFerVq3yfR9eYV8GY5XneIV0oVKpSJKEeEWvlp4HsbvXHq9WrVol4hW9QmKKjLOjo0OSpIMHD/70pz+FV+3zIOZKeiXyK3iF/Ep4heAmNvvE0WsOvRInz8Krn/zkJ/K6det6enq2b9/+53/+54ODg7VaDbs4edvnE2LhnFTX9Wq12tfXV6vVbr755ieffHJsbEySpMHBwS1btnz4wx+uVCpTU1OVSiWKIjFWGN+8JRBJkoRh2NHRMTY29uUvf/nBBx+cmZlJkmRgYGDr1q3vec97BgcHZ2ZmHMeR5s+/8uaV+LWu67Varbe3t1qtfupTn3riiSfGx8clSRoYGLjwwgs/9KEPdXZ20iuxceC6bldX19jY2D/+4z8+9thjExMTkiT19/dv3br1f/7P/zk4ODg7O0uvDvdqQbyiV+3xKk3TIAgQr770pS899NBD09PTWZbRqyXmQcar5YxbGIaVSgVePfjgg9PT07Is9/f3X3TRRZgHhVfMr5bOr8rlcrVarVQqruuiugZFNfncUIZXo6Oj/8ers88+u9Vq1ev1iy666Pbbb69UKtVqFUWTeVvZ4CAGxw5pmmqa5nne9ddf/8wzz+AcB5mE67rnnnvu7bff7jhOHMdYQOOGQBRFeVtJZ1kWBEFXV9fc3Nx73vOexx9/vFwuFwoFRVHq9Xqr1dq8efMXvvCF7u7uyclJx3HyFtDFmTvcwL+6rnv99dc//fTThULBtm1JkjzPa7VaGzZsoFcicXddt6+vb2Zm5vrrr3/qqaccxymVSoqizM3Nwavbb7+9p6dnamrKcZy8TYRLePW68SpJEl3X8+mVJElBEHR2dlar1euvv/6JJ57o6OhAvKJXv+I8mHOvwjDs7Oys1Wrvec97nnjiCcyDsizX6/Vms7nAq7zNg2/Uqy9+8YuoiTdNU3yDoto7V/Mg4lWtVrv++usff/xxxCu1r6/Ptu1yufzaa6+FYXjOOedYluV5Xt5Ou7CYw3GMruue51UqlS9/+cv33HNPX1+fuEKBk529e/cWCoUtW7Y0Gg3btoVMOVwRhmFYKpXCMLz99tsffPDBrq4uwzBQbWUYRldX1/DwcBiGGzZswHeYw4WN2H+CVx0dHV/+8pfvvvtueAW14NXLL79Mr0AURbZtp2m6a9euH/zgB319ffg8sftCrxbzCvFKmr/mpaoq4pXjOBdeeGG9XhdeiXCXt3hVLBaDIPjCF77w4IMPdnd3m6YZxzG9Ws48KM3fJhTzIL1a4NU//MM/YB40TTOKInye8CqKovPOO49etXt199139/b2tudXpVLp5Zdftm37wgsvbDabmAXgVT7nQXiF/Kq7uxvXSBR0rvB9P4qihx9+eG5uLssyy7LytlzGESp2DrIss217Zmbm3nvvxajpuo6SLF3Xca9i9+7dMzMziFbi4nMOa/uweVCv1x955JE4jsMwxBhKkhTHcavViuP4kUceqVarsiybpplDr5IkEeWPh3uFzgP0agGWZcmyPDs7+8gjjyRJ0mq12rs8ua6bpuljjz1WrVaxRKRX8Ao3BTVNgzmapuHe6u7du6enp7GtJQpMc+gVvqxGo/Hoo4/iDBqNGujVcuZBTdMQr+AV4hW9QrxK07Rerz/88MNRFKG7gOjy5HlelmWPPfZYrVZTFIX51evOg3fddVetVsPFgPYFYc698n0fDYt+uWdjWRaGcmpqStd13/fzNkCKoiiKgojTbDYLhcLIyEij0cDZH5SCXlgytlqt0dFR0TUln614JEnyPE/TtImJiampKcuyxFSHq+KaphUKhWq1OjY2Ztu267o5HCJxIwdejY6Otlot3K+P49gwDJxRoPKPXgmvbNseHR1FVaimaaLpoa7r8Gp2dpZeHe4V9mk0TdM0Tez5tVqtsbExeCWaRebTK13XJycnp6enRbzCbh+9WmIeRJ0DUnak75IkaZpGr4RXhmFMTk5i28WyLNFaQNM0VVUdx5mdnR0ZGTFNE7GdXiG/OuI8GATB8PCwaZpi2xQ5WN7Gzfd9xCt4hQY7aZoq7UuZfHZVA9k8C6bGI45JngdqAQhMOMMStWu4hiK2A0UPrBwWPsrzHO7PAoso1QKEP1mWoYmKWBOiyyHqJvPZF/lNeChCnBAyt+9OIFItSDTp1euOW/tWgvgnvZLm+4AtSBgURWmfE9vnSuq0TN/wvAny/ny+OyFe5Gj/tYJ1YRAEnuf19PT09vZGUZTDoxxpvnpPkqRisdhqtVatWlUoFHBSo2kaDlXRnyiO40KhsGrVqlarVSwWpflHT3I4aDjqWr16dXd3t+u6WBnjSqUkSajC6u3t7e/vj+MYFzFzBTbzUOYBr1avXi1azi3wCk2R6ZUkSbZtx3Hc39/f29vr+34YhiJpyLLM933P87q6uvr6+vIcr+BGe7wSXkVRhH33I3p1+CZF3rzq6+tD93F6tZx4tcx5MLdeoaK9t7e3p6cH9QxiZShJUhAEnAfp1ZuLV1EU9fX1dXd3e54XBMEvs3ZJkgzDsCxL1/VLLrmko6NDUZQclsqgMk/sFnue193d/fa3v73ZbOKbVFUV703gqOvtb387hhLdpnEclsOHFRChKpXK1q1bFUWxbRtSYfvKNE1N0y6++GI8HJDDo2ecM4iNFuFVq9WyLKvdK8uyWq0WvQIYgXK5fPHFF6NOBruhsiwbhgGvLrnkEvSZQfqVw3iFylHh1Tve8Q54hcMKHFPAq3e84x3CK5yA5dYrSZJKpdLFF1+sqipEolevG68WmwfpFfB9H08oXHrppZj4DMPAVqCmaQvmwXzmV/TqzXmFi+CXXHIJvMJFQXX16tWtVmtqamrDhg033nhjqVSam5vLZztIFGDhAWecy5x88snPPvvsvn37VFW1LAuPFM7NzW3YsOGGG25of1QcL1Dk8BRMVdVWq1Uul0855ZRnnnnmxRdfxDJRVdVmswmvPvaxj5VKJTwRkLfxwXN6yMJx5Jckycknn/zcc8/t3bsXqQOeXp+bmzvvvPPolfDK87xSqXTqqaf+x3/8xwsvvCDLsmVZKKuFVzt27CiXy3Nzczm89LwgXiGDf914hfPVnHvlum65XD711FOffvrpF154AZcF6dXS8YpeLSdewatnnnlGxCtFUdq9Qn5Fr+jVMtE0zXXdUql02mmnIV6hyYfqOE5XV9cf/uEf3nDDDT09PWjijtLSvH14mAKhi2ma9XodT1PVarXJycmpqSlUE/3e7/3eTTfd1NXVhVvPol4Za+scPjxhGMbc3FxXV9fmzZvjOJ6enp6dnY2iqKen5+qrr4ZXiFY5HB/hFcYKXvX29l566aXwanp62vd9enX4uGHO6+jo2LhxoyRJExMTtVotCILu7u4F8Sq3D74sFq+mpqbgVW9vb7tXxWIR1YBiOsxbAoEjrGaz2dHRsWnTJkmSxsfH5+bm6NXS8WrpeZBeIV41Gg3EqyzLxsfHa7Ua5kF41dvbW6vVxCEPvaJXy4nzsiwjXm3cuDFN09HR0Wq1Kn//+98fGho67rjjME3idBV/Om8DhL849tqx6Y6iq1KptH///uHhYUmS1q5du27dukajgXvQWALiP0GClcOHYJBDqKqKVnSjo6NYQw8NDb3lLW/JsqzVaqEGKZ+XU/EXp1dvQi2Eo0KhIEnSq6++evDgQUmS4BXilfhsc3iSI7zCCfIyvZLmW7NheHNYOYoKtCRJCoVClmWvvvrq8PBwlmX06leJV/TqiF5hrN7ylrdIkuS6LgJaDhNQevXmEDt3SZKg9TbGSs6yrNlsGoZRrVZFgbKUv4vhOG7GDpZ4Y7Zer5umGYahaByG25aGYQRBUC6XUf7R/h/mLdCLsiJJkvCqAm7CIU4ZhoE2RghVOYzmItzgpA9eNRoNwzDo1et6hbDlum53d3cURY7jyLLcarVEvBLDks94JZbNYRh2dHQ0Go0l4pUog2z/D3Pb4CLLMs/zOjs7RbyiV28uXtErab4FijTftb2rqysMQ2Tw8Gp2drY9v+I8SK+W7xXu5rquK7ySZ2dn8ZgCnnfO57YohsYwDNd1cZUkDENxNIMNrfZGV+LnKBQJgiCOY8dxxJsLuRILDVaRaQVBILo44ZuEV/jw8tnOSXhlGEYUReKBEoyGuMsrzZ+L0av2QI9NGtd10dNXlmW0ICgUCohX4kpA3rzSdd11XV3XD/dKtLMQtTTS/H1WXdfDMMQqCM+P523cYIumadhcR/do0dqCXh0xXiEuHT4PolU5vRJRS3jV/nKq8ArvwOTwZVl69avPhmIejONYrtfrEiGEEEIIIeToRuEQEEIIIYQQwsSdEEIIIYQQwsSdEEIIIYQQJu6EEEIIIYQQJu6EEEIIIYQQJu6EEEIIIYQwcSeEEEIIIYQwcSeEEEIIIYQwcSeEEEIIIYSJOyGEEEIIIYSJOyGEEEIIIUzcCSGEEEIIIUzcCSGEEEIIIUzcCSGEEEIIYeJOCCGEEEIIYeJOCCGEEEIIYeJOCCGEEEIIE3dCCCGEEEIIE3dCCCGEEEIIE3dCCCGEEEKYuBNCCCGEEEKYuBNCCCGEEMLEnRBCCCGEEMLEnRBCCCGEEMLEnRBCCCGEECbuhBBCCCGEECbuhBBCCCGEECbuhBBCCCGEMHEnhBBCCCGEMHEnhBBCCCGEiTshhBBCCCGEifv/haZpSZJkWaaqKn4iy3KaplmWybIcx7GiKFEU4SeKosiynGVZmqaKoqiqGsexrutZluXt/2CyLCdJgtGQZTmKIjGAQRD88v+oioKBjaIob+OzmFdpmqqqmqapLMthGMqyLEkS/pVetZMkiaZpcRwLkXzfl2VZlmVVVTGwYRjSK3iVJAmGRVEUDEuWZfg28bsYtziONU1L05RewSvGqzfqFdSiV0t7laZpEARIGBRFwTDid3OFruuHe5UkCQZEzIPtXnEeFNEbXomIhMHxfR9/5miYB1cscY/jWFVVOITsXIxIEAS2bSdJUigUSqWS67pJkoRhWCgUJEmKoiiKIsuy4GUOAz0+S1VVW62WaZqI46Zp2rYty3IQBHEcp2nqum6lUsnb+CzmlWEYrutimiwWi6ZpNptNTdPoVXswMgxDVdVms2maZpZlcRxbluU4jiRJvu9jIe26bmdnJ71q9wpTXaFQsCyr1WrBq2KxiD0IeJXP7GoxrxivlvZK1/UFXol4Ra+W8KpQKCB5cF03jmNZlj3PK5fLeRufMAyRgguvZFnWdR1eYR5c4BXnQWRWsizDK9d1LcvCesa27UKhgHgVhmGSJK1WawXjlVyv11fk/+M0TTVNw6D8n/81shzHcbFYxIc3OTlZLBb7+/sVRfE8r9VqdXR0IInHghJfb94+SMMwoiiybRvpVLFY9DxvcnJSkqShoSFd12dnZxHQfd83TTNX47OYV1EUOY6TZVmSJJOTk4Zh9PT0YDeLXkmSFASBZVlhGFqWhZhVKBSCIJicnMyybO3atYZhzMzM2LaNvQfDMOgVdq0w4cVxLLxSVTUIAtd1Ozo64jimV4d7NTExwXj1ul61x6ve3l5FUejV0l5NT08nSXLMMcdYljU7O+s4DnIJy7JyNT44iIBg0vyeMfxpj1e6rvf29iJecR5EfmVZFuxq92pqagrzoK7rMzMzSOhXMF6tWOIOjbAmNgwjSZIoihRFURRF1/X77rtvz549+/fvz7Kst7f32muvveqqqzRNw2IRGzZYEaLmIVc7DVhAY0nd0dHxzW9+8zvf+c7LL7+Mj/CKK6740z/902q1ahhGDjdjFvMKmw333HPPXXfdtX//fl3XBwcHr7nmmiuuuIJeLfBKVdVyufyNb3zju9/9brtX7373u6vVKja38hbQF/NK0zTDMBZ4de211/7+7/++ruvYfU+SBB8jTqjp1QKvGK/o1a/Lq1/84hemafb3919xxRXvete7ZmdnTdNEfVHe1MI2qPAKCYNhGLqu7969+8477+Q8eDgo20Pdh6qqHR0dR5wHa7WaYRgrOA+qN9xwwwoOkKipgiWmaVqWtWPHjltuuWVycjKKIt/3W63Wt7/9bdd1N23ahFWgNF/NljerEOil+bNU0zR37Nixc+dObItmWTYxMfHQQw9NTExcfvnlvu+L+ra8fXiHeyVJ0o033njbbbfNzs5mWRZFUb1ev/vuu33fp1fSfG0fljeGYezYsePzn/98u1cPP/yw8Ao1yvTqiF7Nzc3dddddQRBs2rRJ7KfSq8W8YrxazKuPf/zju3btoldvyKskSSRJmpycfOihh8bHxy+77DJkYDn0SpKkBV5ZliXL8o033riYV5wHsRrUNE14hVwUy+OjZx5cscQd191wiQRV2pqmWZb1jW98Y+fOnd3d3aqqyrLsOE6apo7jPP74411dXVu2bMFVOQS7HG7SoMoqTVPTNO+///6dO3f29/cjguMuTk9Pz2OPPdbX17dx48Zms5m3mLWYV7t37/7MZz7T0dGBmRLL5Z6enkceeYReIVJ7noekYc+ePTt37hwcHMQdOOHV448/3t/fD68Qs9ojO0Y+b17de++9n/3sZ9u9kiSpu7sbXm3evJleHdGrxeIVvYJXe/bsWRCvJEnq6up69NFH6dUSXum6LklSGIY9PT1PPPHE4ODgBRdcMDc3h7qRvG3wwS4knbqu27Z97733LuEV50FVVT3PkyTJsqz77rvvlltuGRwcbF//YB5EvGo0GivllbKCYiHdlOYv8Mqy3Gg0du/eXSgUcLiD0itE+YGBgXvuuafZbKIXAZZEObwtniSJbdumafq+/9WvfhUFWLh30mg0cC+nu7v7zjvvrNVqqGbL4U7M4V7dcccdjuPYtq1pmm3bYRiGYRhFEb1q9wrlfV/96leLxSJ67xiGAa/iOO7q6rrjjjvoVbtX3/rWt2zbtm1bVVXbtqMoWsKrHHZNWcwrxqs35NXS8YpetcerZrMp4tW3vvWtubm5YrGYQ6+k+X13sY/eaDS++c1vWpbVHq+iKIrjmPMgwD3U9vwKrWPEPJgkCebBarW6gvFKWVm3sBZE6VWSJNPT0wcPHsQYwRvTNHVdT9M0DMPJycl9+/Z1d3fjiEeSpByKhcI1nDLPzc3BKkVRfN/v6uqK49h1XdM0x8bGDhw4gHPDHMasI3pVKBRc103TtNVqIXjhghe9gkJoGjMxMVGr1RC+cZmpq6sriiK0MBodHT148GA+22Uu5pXjOK1WC17Zto37cLjXu3fv3q6uLuFVDr/HxbxivFpOvGr3CkkDvVraK9d1EclRrn3o0KFXX301h6V94pAKFS+4bDo1NQWvms1mu1fMr9oRXlWrVbSARG+izs7OMAzRwmh8fHx4eHgl/V/BDw9b6aJZJr46xCCc4KDph2hei8U0GnIjWuFcLFfgUo6u677v1+t1ZAmSJKHNE9pEol1rEASog8znJhZCFfocu66LDxIbWuI2GM4BcdlL7HuhxC2HE6Esy5qmtVqtVqtVKBR838eYtFotXGlCeuF5Xm7vlmAvKo5jlDS0Wi2xoYX6UQR9UfwgxlAUh+Rw3FRV1TSt2WyKFliapmH0dF0XPVXyWYu8mFdpmuIxE9ytpFfL9wr9DQ3DQKFIEATZPAtS29/tOCYqZOCSmAdFOZbwShjoeR5+Fz/M4TwIJZASNJtNVDTgsjjmQRTZogWWuMm6QKrfglfKCg4QSqnwr9Clt7cXdTJoTgTnRGf3OI6PPfbYOI4xZIhieRNLvL7U09PT2dkpStl837dt2/M8TH6lUqmvry+HV+nx1xeP4CC+9/T0WJaFm/LID8IwhFqWZS3wSvw/krdtBsQjeIWojQiOSRGd6Uql0uDgYD4XzNL81SUs+TRN6+npMU0T09vc3JxpmkjloyhC7501a9agQzlCWQ4nQuzLyLK8evVq7DJYloXTebGjHEVRoVDo7+/P4Xe3mFco6lMUpdFoWJbleR7SdHq1HK+wAyi8yuf4HHEeXCxeoXH7mjVrcFiB15dy+D1ieZymaW9vL+ZBZKpoU44Te3g1MDCw2Pj8FnZLlZUdIIwLjr0kScK1m6mpKbS7R71RkiQdHR0jIyOXXnppf38/Wmxi3z2HtX3IqObm5latWnXmmWdWq9Vyuez7fqFQwGtnkiQ1m82zzz772GOPxQo7bzsxYkGIqU6SpM7Ozq1bt6JtrW3biqIUi8U4jkul0sjIyCWXXNLX15dzr7C312g0Vq9efdZZZ83OziJOqaqKru1YTp9zzjnHHHPMzMyMlEuEV1gSd3Z2btu2bWpqStd1y7IURSmXy3jh67XXXrv88st7enrQGBhO5rCkAe+8zM3N9fb2nnfeebVaDUtlTdPwxZmmGYbhueeeu3bt2mq1Sq/a45WmaegwUyqV4jh2HIdeLccrtKeDV2vWrMmhV4vNg4vFq5GRke3bt/f29kZRhCxCZGV5A9dvVq1adfbZZ4v86vB4dUSvfmsNIpUV/PDEgQJOS2HJddddt379+nq9ju73nufZtj06Onraaae9853vxKYgCh4WPFqRn4CFc3nXdd/3vvcNDQ3hmQlJkpC4B0HQ3d393ve+Fw1uczg+0vylHPwTGzN/8id/csIJJ1SrVWy3+75vWdbY2NgCr8SqMoc7Dbiu5Hne+973vrVr187MzDiOg0137PyVSqXrr78eN08OPxD83W7u3u4V3iVBX+R3vetdp5xyytTUFN7ilSQJXp166qnXXXcd9MP2VT7jFQr2cG3pAx/4wLHHHjs9PV0qlcSWXrPZLJfLf/EXf4FneukVvLruuuvgFQpE0T6FXi3fq0ajIbzKebxqnwcXi1ennXbaH//xH0vztQ8YmdzmV6ZpLsivcLSlKEqz2ezo6PjLv/xLxKuV+t+5Yu0g8XWJFrY4nsiybPXq1evXr3/ttdf27duHNZ/ruqeddtqOHTtOPfVU1Bvhwao4jlFvlCuxDMPA9fkwDAcGBi666KInn3xyamoKr3k1Go0TTjjh1ltvXbdunXiyOFcVyWJdhyMdHHJJktTf33/iiSeOjo6+8sorePPMdd2zzjrrb//2b0899VQ8eoIH9rD+yZtX6OCEGXFgYGDr1q1PPfXUzMwMXrWEV7fddtvxxx+f25up7V6JqXFgYODkk08eGRl59dVXcTrfaDTg1SmnnIJ75NgIzGe8chynXq8jFahUKtu2bfuP//iP0dFRvLhUr9fXr1+/a9eu448/HvGfXsGrwcHBU045BV6hRrnZbNKr5Xhlmqbwat26dTl8LW6JeXCJeHXyySfDvTAMsV+TwztyIr8KgqC/v3/r1q3Ir4RXIr9CvFqpN6pW7OVUaf4EB4bh1zj16+rqqlarzzzzzNNPP10sFtetW7d161YURKIYC3vJuJyat1NC1PDhwk0QBKVSSVXVBx544NVXXw3DcP369Vu2bMEQeZ5XLpdxCzNXEyHWgeIBQuw0RFHU3d09Ozv7zDPP/PSnP3Uc5y1vecv27dtt2240GnEc27aNJ2AwleZtswF1e7gL7vs+vHrwwQf37t0bx/FJJ5100UUXmaYZBEGz2cxhezVpvtgRV5yxp4B/dnd312q1H/7whz//+c9N01y/fv22bdsKhUK9Xhd1ouISYd68Qts+NL/yPK9UKmma9r//9//et2+f8ApN/ZrNZqlUymGOdUSv0M0QXr3wwguGYaxfv/7iiy9GwkqvlvAqSRLGq6XnwSPGq7m5OUmSkLK35/05zK/QTEbMgz/4wQ/27t0rvLIsy/f9lY1XK5a4o9bl8C1hdI9BUydp/uRicnJSURTcPsGLVrisk8MneeGTYRiiCR06G4oS7SAIsBODHk/4/HI1C+KwDysWNDmGbIZhzM3N9ff3iz88MTGBhrV4PBz13HhLPG/3nrHHYBgGVjKYF3HDBI1ZPc/D3p70f9e55QTkUsIrTIRY4KGRRV9fX3u80jQNi0A0esI3m8PqNTHxo9Eh0oiOjg5E8iRJXNcVxQz5bMO6mFeqqrZard7eXoyMpmkTExPQiV69rlee5+GOuJTLdplLzINHjFd4ix3RXtd1tOjJ4TyI/Mo0Tdu22/MrDCa8wjy4svFqxRJ3FMlgekMbLOwcYNO9Pa1HeR/2GPAnhYi5fXodDR9RL4S3vrDLjrU1fhe25W1tgyIirGHETVPMjjhQxihJ89eboBP+sGgiKeWsvkj8ffF2o2EY4pqXyCREe01UE+Uwcce9CGn+IXEcKMMrRHD074uiCB1/RYhzXRem5fAVcU3TcPSMLUA8+dxoNHDHq90r9A2jV/AKn6Fop02vlu8VAv6CeJXDjZgjzoMivC/wSjRbg4GO44iJMldgzYziNOwUo0smPsajZx5cyVIZQgghhBBCyHIX/BwCQgghhBBCmLgTQgghhBBCmLgTQgghhBDCxJ0QQgghhBDCxJ0QQgghhBDCxJ0QQgghhBAm7oQQQgghhBAm7oQQQgghhBAm7oQQQgghhDBxJ4QQQgghhDBxJ4QQQgghhIk7IYQQQgghhIk7IYQQQgghhIk7IYQQQgghTNwJIYQQQgghTNwJIYQQQgghTNwJIYQQQghh4k4IIYQQQghh4k4IIYQQQghh4k4IIYQQQggTd0IIIYQQQggTd0IIIYQQQpi4E0IIIYQQQpi4E0IIIYQQQpi4E0IIIYQQwsSdEEIIIYQQwsSdEEIIIYQQwsSdEEIIIYQQJu6EEEIIIYQQJu6EEEIIIYQwcSeEEEIIIYQcpYl7mqayLKdpmmWZpmn4taZpHBqQpqmiKIqipGna/muODNA0DaOhqiqGSJKkJEmyLMM/Zfn/Z+/Ng+y8yjv/d1/vvX1vr+oWatmWvMULWLZkW5aRvADJJJYhFJUxmSpIQkEgUwUFhOBhBvMjFHjBGw4wLAkDoUIAb2ob2zFeZCwnBDwQrzGWZLtb6kW93dt3e/f3/f3xRWduWlK7LRtazvv9/OFqy9IMOvm8z3nOOc95jozfKcuyonChSK+WhaqqYpRUVU2SJIoiWZbpFb16NcAWyIN/Yu6jV/TqVSVSHVLJspwkSRzH4mdkWUIqekWvjsIrRVEQpiRJkhuNBn4VA4ffFMexruscNQxcHMcik8CoiWyVRFGEZV6WZfjqsiwT/5plGeZFpFxcE9Kr5Xulqiq0kWVZ5PEYOnpFr15NvMJ8J8sytMEo0St6ddQkSdLpjGEYWZYFQaAoCnxDKo9pEQk9B41eLX8e7NxK+PUKx/f9OI4ty9I0LUkSVVWLxSKHrHPgNE3DroymaaqqRlHEkQHFYhEboqqqmqYZx7Hv+1AtiiKsAE3TxHdYKpU4You8wr/Sq0O9QpDSdR2CiQ1RekWvjpquri7MfKZp6roOl5BI0St6ddSYpqmqqmEYjuNIkuR5XhRFuq4bhhGGYbvdlmXZdV1d12VZtiyLI0avXlG8MgxD07Q4jnHyLDcaDbHNoCiKrutxHHueZ9s2Rw0Lwc6jLowSfpGDgwhl27aqqnEcJ0miHCRNU3yBcRwjqIVhGIYhY5bwSmzA4MvE/h+9El5ZlmUYRhRFQRAYhoE0C7vv9IpeHR2+7xuGYRhGkiRhGKqqqus6pj96Ra9eZQKKiS/LMtM0ZVlutVqKoliWlWXZr/MtWcYGBE9y6NXRxSscR8gzMzOWZaFOBvvKkiRhmchRkyQJySjWNtLBkiNkpRwcqBIEAUJSHMfI2nFEKEodpIOnPFxMC+I4XlT+AdkY0IVXURR1LpgF9IpeHTW6rmMjRvgjykbpFb06ahCmMCxY/qFIBiELcQyHh2maMiulV0cdr+CPHEVRkiTtdhunh0i/xAgShHKceUmSFIahuCTHwRHfGyJUEASqqjqOo2maoijtdjuKIgwU6vyCIODdiUWfpWmakiQFQcAUYdGCWVVV8ZUlSaLreqFQkCSJXtGrV5MooP4YyRNiu+u69Ipevco8IU1T5Os4w5Fl2XGcLMvCMMTGaBRFyObFfgShV0sTRZFpmlmWIS3HWDmOo27evFmW5cHBQcdxGo1Gmqa2bVOsTqUURZmYmHj88cdfeOEFXde7urqwbubgANM0fd+Poqinp8c0zRdeeOEXv/jF3r174ZVlWc1mE6eHnU0b6JUsyxMTEz//+c/37t2r63qpVOKlnM6J0DAMXL/p7u42TfOll1765S9/Sa/o1asBmZPneUmSdHd367pOr+jVqwf7nnEcp2laKpVkWR4dHX3qqadeeumlLMv6+vpM0/Q8DzfBkMFz0OjVcuJV5zxoGMaLL774i1/8Qj711FMVRXnnO9/5vve9b9WqVe12G3VaFAs0Go2vf/3rO3bs8DxPkiTbti+//PL3v//9vL8rAhaEcRxnamrqb//2b2+77TZsMFiWtX379j/5kz8ZHh7GmpDnX4Jms/m1r31tkVcf+MAHsKlMcMSsKIpt2/v27fv2t789MjKCO170il69mokwDENFUUql0tjY2N/+7d+OjIyEYZhlGb2iV69mowG3nF3X3b9////5P/9nZGTE8zwRr9773veuWbMGTfywJc9Bo1fLAdVEhUJhbGzs7/7u70ZGRnzfV4eHh2VZfuyxx3bv3v2Wt7wFNQ85LOBWFEVcfUPeaZpmu93+yEc+smPHjkKhgK0aVVV37dr17//+729961tt2xZ/BGev4pJArsYNwgRB8NGPfvT22293HMc0TSyaH3vssT179lxyySU4cc7hahDtrjpb1cKrD3/4w4d69eyzz9IrMW74p+/7H//4x2+//XbLstD5il4t8gqSWJa1hFdvectbCoUCSkFwIyW3x6r4sjzP+9jHPnbHHXfYts14ddTxil4JqSRJwmEOvMLdetyzhFeXXnopCm5zOD6v1Ku3ve1tjuNgjS1CXA7nQXF3QnjlOI5t22p/f38cx/39/U888YQsy5dcconv+zk8IsRfubP5v2ma3/jGN2699dbBwUHP81D1GIZhT0/Pc889Z9v2eeedh0W2WOrk8IMUfdNuvPHGH/7wh8PDw77vY0ziOB4YGMi5V9LBi25iPqNX9Oq1QtTsobLom9/85pG8chzn3HPPhVdSjq8w0atleiUuUC4dr+hVp1fFYhFerV271vM8ZJz06qi9Et3x4VU+58Esy7q6um688cZbb7117dq1iFdKkiSO4zSbzUql8vDDD8/N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o9H4+te/vmPHDtR4WJZ1+eWXv//97y8WixwcenXUtFqtw8YrHK6SI3mlqqplWdu3b3/ve9+7Zs0aNPHDrg1HTMyDIyMjwqvt27dzHuwEZQulUmnfvn3f/OY3d+zYEQSBunbt2izLdu3atXv37re+9a1YAOVwOYi2RJ2tak3TbLfbH/7wh3fs2FEoFHDIparqrl27nn322be97W04mhAdbVHwl8NNZdxS8jzvYx/72B133GHbtmmauGf52GOP7d2799JLL6VXi7z6yEc+cscdd7iui4xBluVHH330ueeee+tb30qvpINH8OjJ8LGPfey2224zTdO2bQzFrl279uzZ85a3vAU1oznMrpbwCvEKXyXi1b//+7+/9a1vtSxLNH2CVzn8HunVq5wHhVePPvros88+S6/EuGG70/f9j3/847fffrtlWaZpokPDrl279u7d+5a3vAVG5fAYB4fJkGdpr5BfvfWtbxVHXjhFzG1+hdu67Xb7ox/96J133um6rmVZ6sDAQBRF/f39Tz75pCzLl1xyie/7otl73ui8zmya5je+8Y1bb711cHAQbQdkWQ7DsKen57nnnnMc59xzz0VzTXHXPoeDhp2DUql04403/vCHPxweHvZ9XxT8DQwMPPHEE/TqUK9uu+22oaEh3/fhVRRFvb29zz33nG3b9Oplverv76dXou8q/u5Lxyvbts8777xOr/L5JdKr13YepFeHenXrrbcODw97noeVDPMrSZLwV+58DG45XuHOgNjyy6Fa+AxFvELxgizLShzHjuM0m81KpbJz587Z2dl8vg4AsbCew+2uarU6MjKCZZ/YetE0LYoi27ZHRkZqtZq4No6Ylc/tdlSFPvzww+VyudlsOo6DxyaEVw8//DDKRnMY0I/klWVZuP0mGjrFcWxZFr1a2qskSeiV8Eo62LIJXt11111Hild33XVXrVZDpbLYyMnhuNGr13YepFdi3ODVzp07y+Vyo9E4dB7Mc37VmXYLr5aIVyMjI9VqVXjVqSXjVRRFCjr0GYYhy/LMzMzY2Biu9+bz28P2VZqmhmFMTEzUajXbtsWjaPAmTVPbtmu12sTEBPoPiFPFfI6baZqjo6MzMzPof+z7Phq3B0Gg67osy7Ozs/AqnwHrsF6hByuCEaISHuagVy/rFX6QJEnEq3xut+P4GJIYhjE5OVmtVo8Ur6rV6uTk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";

        if (canvas && canvas.constructor === String) {
            canvas = document.querySelector(canvas);
        }

        this.ds = new DragAndScale();
        this.zoom_modify_alpha = true; //otherwise it generates ugly patterns when scaling down too much

        this.title_text_font = "" + LiteGraph.NODE_TEXT_SIZE + "px Arial";
        this.inner_text_font =
            "normal " + LiteGraph.NODE_SUBTEXT_SIZE + "px Arial";
        this.node_title_color = LiteGraph.NODE_TITLE_COLOR;
        this.default_link_color = LiteGraph.LINK_COLOR;
        this.default_connection_color = {
            input_off: "#778",
            input_on: "#7F7",
            output_off: "#778",
            output_on: "#7F7"
        };

        this.highquality_render = true;
        this.use_gradients = false; //set to true to render titlebar with gradients
        this.editor_alpha = 1; //used for transition
        this.pause_rendering = false;
        this.clear_background = true;

		this.read_only = false; //if set to true users cannot modify the graph
        this.render_only_selected = true;
        this.live_mode = false;
        this.show_info = true;
        this.allow_dragcanvas = true;
        this.allow_dragnodes = true;
        this.allow_interaction = true; //allow to control widgets, buttons, collapse, etc
        this.allow_searchbox = true;
        this.allow_reconnect_links = false; //allows to change a connection with having to redo it again

        this.drag_mode = false;
        this.dragging_rectangle = null;

        this.filter = null; //allows to filter to only accept some type of nodes in a graph

		this.set_canvas_dirty_on_mouse_event = true; //forces to redraw the canvas if the mouse does anything
        this.always_render_background = false;
        this.render_shadows = true;
        this.render_canvas_border = true;
        this.render_connections_shadows = false; //too much cpu
        this.render_connections_border = true;
        this.render_curved_connections = false;
        this.render_connection_arrows = false;
        this.render_collapsed_slots = true;
        this.render_execution_order = false;
        this.render_title_colored = true;
		this.render_link_tooltip = true;

        this.links_render_mode = LiteGraph.SPLINE_LINK;

        this.mouse = [0, 0]; //mouse in canvas coordinates, where 0,0 is the top-left corner of the blue rectangle
        this.graph_mouse = [0, 0]; //mouse in graph coordinates, where 0,0 is the top-left corner of the blue rectangle
		this.canvas_mouse = this.graph_mouse; //LEGACY: REMOVE THIS, USE GRAPH_MOUSE INSTEAD

        //to personalize the search box
        this.onSearchBox = null;
        this.onSearchBoxSelection = null;

        //callbacks
        this.onMouse = null;
        this.onDrawBackground = null; //to render background objects (behind nodes and connections) in the canvas affected by transform
        this.onDrawForeground = null; //to render foreground objects (above nodes and connections) in the canvas affected by transform
        this.onDrawOverlay = null; //to render foreground objects not affected by transform (for GUIs)
		this.onDrawLinkTooltip = null; //called when rendering a tooltip
		this.onNodeMoved = null; //called after moving a node
		this.onSelectionChange = null; //called if the selection changes

        this.connections_width = 3;
        this.round_radius = 8;

        this.current_node = null;
        this.node_widget = null; //used for widgets
		this.over_link_center = null;
        this.last_mouse_position = [0, 0];
        this.visible_area = this.ds.visible_area;
        this.visible_links = [];

        //link canvas and graph
        if (graph) {
            graph.attachCanvas(this);
        }

        this.setCanvas(canvas);
        this.clear();

        if (!options.skip_render) {
            this.startRendering();
        }

        this.autoresize = options.autoresize;
    }

    global.LGraphCanvas = LiteGraph.LGraphCanvas = LGraphCanvas;

    LGraphCanvas.link_type_colors = {
        "-1": LiteGraph.EVENT_LINK_COLOR,
        number: "#AAA",
        node: "#DCA"
    };
    LGraphCanvas.gradients = {}; //cache of gradients

    /**
     * clears all the data inside
     *
     * @method clear
     */
    LGraphCanvas.prototype.clear = function() {
        this.frame = 0;
        this.last_draw_time = 0;
        this.render_time = 0;
        this.fps = 0;

        //this.scale = 1;
        //this.offset = [0,0];

        this.dragging_rectangle = null;

        this.selected_nodes = {};
        this.selected_group = null;

        this.visible_nodes = [];
        this.node_dragged = null;
        this.node_over = null;
        this.node_capturing_input = null;
        this.connecting_node = null;
        this.highlighted_links = {};

		this.dragging_canvas = false;

        this.dirty_canvas = true;
        this.dirty_bgcanvas = true;
        this.dirty_area = null;

        this.node_in_panel = null;
        this.node_widget = null;

        this.last_mouse = [0, 0];
        this.last_mouseclick = 0;
        this.visible_area.set([0, 0, 0, 0]);

        if (this.onClear) {
            this.onClear();
        }
    };

    /**
     * assigns a graph, you can reassign graphs to the same canvas
     *
     * @method setGraph
     * @param {LGraph} graph
     */
    LGraphCanvas.prototype.setGraph = function(graph, skip_clear) {
        if (this.graph == graph) {
            return;
        }

        if (!skip_clear) {
            this.clear();
        }

        if (!graph && this.graph) {
            this.graph.detachCanvas(this);
            return;
        }

        graph.attachCanvas(this);

		//remove the graph stack in case a subgraph was open
		if (this._graph_stack)
			this._graph_stack = null;

        this.setDirty(true, true);
    };

    /**
     * returns the top level graph (in case there are subgraphs open on the canvas)
     *
     * @method getTopGraph
     * @return {LGraph} graph
     */
	LGraphCanvas.prototype.getTopGraph = function()
	{
		if(this._graph_stack.length)
			return this._graph_stack[0];
		return this.graph;
	}

    /**
     * opens a graph contained inside a node in the current graph
     *
     * @method openSubgraph
     * @param {LGraph} graph
     */
    LGraphCanvas.prototype.openSubgraph = function(graph) {
        if (!graph) {
            throw "graph cannot be null";
        }

        if (this.graph == graph) {
            throw "graph cannot be the same";
        }

        this.clear();

        if (this.graph) {
            if (!this._graph_stack) {
                this._graph_stack = [];
            }
            this._graph_stack.push(this.graph);
        }

        graph.attachCanvas(this);
		this.checkPanels();
        this.setDirty(true, true);
    };

    /**
     * closes a subgraph contained inside a node
     *
     * @method closeSubgraph
     * @param {LGraph} assigns a graph
     */
    LGraphCanvas.prototype.closeSubgraph = function() {
        if (!this._graph_stack || this._graph_stack.length == 0) {
            return;
        }
        var subgraph_node = this.graph._subgraph_node;
        var graph = this._graph_stack.pop();
        this.selected_nodes = {};
        this.highlighted_links = {};
        graph.attachCanvas(this);
        this.setDirty(true, true);
        if (subgraph_node) {
            this.centerOnNode(subgraph_node);
            this.selectNodes([subgraph_node]);
        }
    };

    /**
     * returns the visualy active graph (in case there are more in the stack)
     * @method getCurrentGraph
     * @return {LGraph} the active graph
     */
    LGraphCanvas.prototype.getCurrentGraph = function() {
        return this.graph;
    };

    /**
     * assigns a canvas
     *
     * @method setCanvas
     * @param {Canvas} assigns a canvas (also accepts the ID of the element (not a selector)
     */
    LGraphCanvas.prototype.setCanvas = function(canvas, skip_events) {
        var that = this;

        if (canvas) {
            if (canvas.constructor === String) {
                canvas = document.getElementById(canvas);
                if (!canvas) {
                    throw "Error creating LiteGraph canvas: Canvas not found";
                }
            }
        }

        if (canvas === this.canvas) {
            return;
        }

        if (!canvas && this.canvas) {
            //maybe detach events from old_canvas
            if (!skip_events) {
                this.unbindEvents();
            }
        }

        this.canvas = canvas;
        this.ds.element = canvas;

        if (!canvas) {
            return;
        }

        //this.canvas.tabindex = "1000";
        canvas.className += " lgraphcanvas";
        canvas.data = this;
        canvas.tabindex = "1"; //to allow key events

        //bg canvas: used for non changing stuff
        this.bgcanvas = null;
        if (!this.bgcanvas) {
            this.bgcanvas = document.createElement("canvas");
            this.bgcanvas.width = this.canvas.width;
            this.bgcanvas.height = this.canvas.height;
        }

        if (canvas.getContext == null) {
            if (canvas.localName != "canvas") {
                throw "Element supplied for LGraphCanvas must be a <canvas> element, you passed a " +
                    canvas.localName;
            }
            throw "This browser doesn't support Canvas";
        }

        var ctx = (this.ctx = canvas.getContext("2d"));
        if (ctx == null) {
            if (!canvas.webgl_enabled) {
                console.warn(
                    "This canvas seems to be WebGL, enabling WebGL renderer"
                );
            }
            this.enableWebGL();
        }

        //input:  (move and up could be unbinded)
        this._mousemove_callback = this.processMouseMove.bind(this);
        this._mouseup_callback = this.processMouseUp.bind(this);

        if (!skip_events) {
            this.bindEvents();
        }
    };

    //used in some events to capture them
    LGraphCanvas.prototype._doNothing = function doNothing(e) {
        e.preventDefault();
        return false;
    };
    LGraphCanvas.prototype._doReturnTrue = function doNothing(e) {
        e.preventDefault();
        return true;
    };

    /**
     * binds mouse, keyboard, touch and drag events to the canvas
     * @method bindEvents
     **/
    LGraphCanvas.prototype.bindEvents = function() {
        if (this._events_binded) {
            console.warn("LGraphCanvas: events already binded");
            return;
        }

        var canvas = this.canvas;

        var ref_window = this.getCanvasWindow();
        var document = ref_window.document; //hack used when moving canvas between windows

        this._mousedown_callback = this.processMouseDown.bind(this);
        this._mousewheel_callback = this.processMouseWheel.bind(this);

        canvas.addEventListener("mousedown", this._mousedown_callback, true); //down do not need to store the binded
        canvas.addEventListener("mousemove", this._mousemove_callback);
        canvas.addEventListener("mousewheel", this._mousewheel_callback, false);

        canvas.addEventListener("contextmenu", this._doNothing);
        canvas.addEventListener(
            "DOMMouseScroll",
            this._mousewheel_callback,
            false
        );

        //touch events
        //if( 'touchstart' in document.documentElement )
        {
            canvas.addEventListener("touchstart", this.touchHandler, true);
            canvas.addEventListener("touchmove", this.touchHandler, true);
            canvas.addEventListener("touchend", this.touchHandler, true);
            canvas.addEventListener("touchcancel", this.touchHandler, true);
        }

        //Keyboard ******************
        this._key_callback = this.processKey.bind(this);

        canvas.addEventListener("keydown", this._key_callback, true);
        document.addEventListener("keyup", this._key_callback, true); //in document, otherwise it doesn't fire keyup

        //Dropping Stuff over nodes ************************************
        this._ondrop_callback = this.processDrop.bind(this);

        canvas.addEventListener("dragover", this._doNothing, false);
        canvas.addEventListener("dragend", this._doNothing, false);
        canvas.addEventListener("drop", this._ondrop_callback, false);
        canvas.addEventListener("dragenter", this._doReturnTrue, false);

        this._events_binded = true;
    };

    /**
     * unbinds mouse events from the canvas
     * @method unbindEvents
     **/
    LGraphCanvas.prototype.unbindEvents = function() {
        if (!this._events_binded) {
            console.warn("LGraphCanvas: no events binded");
            return;
        }

        var ref_window = this.getCanvasWindow();
        var document = ref_window.document;

        this.canvas.removeEventListener("mousedown", this._mousedown_callback);
        this.canvas.removeEventListener(
            "mousewheel",
            this._mousewheel_callback
        );
        this.canvas.removeEventListener(
            "DOMMouseScroll",
            this._mousewheel_callback
        );
        this.canvas.removeEventListener("keydown", this._key_callback);
        document.removeEventListener("keyup", this._key_callback);
        this.canvas.removeEventListener("contextmenu", this._doNothing);
        this.canvas.removeEventListener("drop", this._ondrop_callback);
        this.canvas.removeEventListener("dragenter", this._doReturnTrue);

        this.canvas.removeEventListener("touchstart", this.touchHandler);
        this.canvas.removeEventListener("touchmove", this.touchHandler);
        this.canvas.removeEventListener("touchend", this.touchHandler);
        this.canvas.removeEventListener("touchcancel", this.touchHandler);

        this._mousedown_callback = null;
        this._mousewheel_callback = null;
        this._key_callback = null;
        this._ondrop_callback = null;

        this._events_binded = false;
    };

    LGraphCanvas.getFileExtension = function(url) {
        var question = url.indexOf("?");
        if (question != -1) {
            url = url.substr(0, question);
        }
        var point = url.lastIndexOf(".");
        if (point == -1) {
            return "";
        }
        return url.substr(point + 1).toLowerCase();
    };

    /**
     * this function allows to render the canvas using WebGL instead of Canvas2D
     * this is useful if you plant to render 3D objects inside your nodes, it uses litegl.js for webgl and canvas2DtoWebGL to emulate the Canvas2D calls in webGL
     * @method enableWebGL
     **/
    LGraphCanvas.prototype.enableWebGL = function() {
        if (typeof GL === undefined) {
            throw "litegl.js must be included to use a WebGL canvas";
        }
        if (typeof enableWebGLCanvas === undefined) {
            throw "webglCanvas.js must be included to use this feature";
        }

        this.gl = this.ctx = enableWebGLCanvas(this.canvas);
        this.ctx.webgl = true;
        this.bgcanvas = this.canvas;
        this.bgctx = this.gl;
        this.canvas.webgl_enabled = true;

        /*
	GL.create({ canvas: this.bgcanvas });
	this.bgctx = enableWebGLCanvas( this.bgcanvas );
	window.gl = this.gl;
	*/
    };

    /**
     * marks as dirty the canvas, this way it will be rendered again
     *
     * @class LGraphCanvas
     * @method setDirty
     * @param {bool} fgcanvas if the foreground canvas is dirty (the one containing the nodes)
     * @param {bool} bgcanvas if the background canvas is dirty (the one containing the wires)
     */
    LGraphCanvas.prototype.setDirty = function(fgcanvas, bgcanvas) {
        if (fgcanvas) {
            this.dirty_canvas = true;
        }
        if (bgcanvas) {
            this.dirty_bgcanvas = true;
        }
    };

    /**
     * Used to attach the canvas in a popup
     *
     * @method getCanvasWindow
     * @return {window} returns the window where the canvas is attached (the DOM root node)
     */
    LGraphCanvas.prototype.getCanvasWindow = function() {
        if (!this.canvas) {
            return window;
        }
        var doc = this.canvas.ownerDocument;
        return doc.defaultView || doc.parentWindow;
    };

    /**
     * starts rendering the content of the canvas when needed
     *
     * @method startRendering
     */
    LGraphCanvas.prototype.startRendering = function() {
        if (this.is_rendering) {
            return;
        } //already rendering

        this.is_rendering = true;
        renderFrame.call(this);

        function renderFrame() {
            if (!this.pause_rendering) {
                this.draw();
            }

            var window = this.getCanvasWindow();
            if (this.is_rendering) {
                window.requestAnimationFrame(renderFrame.bind(this));
            }
        }
    };

    /**
     * stops rendering the content of the canvas (to save resources)
     *
     * @method stopRendering
     */
    LGraphCanvas.prototype.stopRendering = function() {
        this.is_rendering = false;
        /*
	if(this.rendering_timer_id)
	{
		clearInterval(this.rendering_timer_id);
		this.rendering_timer_id = null;
	}
	*/
    };

    /* LiteGraphCanvas input */

	//used to block future mouse events (because of im gui)
	LGraphCanvas.prototype.blockClick = function()
	{
		this.block_click = true;
		this.last_mouseclick = 0;
	}

    LGraphCanvas.prototype.processMouseDown = function(e) {

		if( this.set_canvas_dirty_on_mouse_event )
			this.dirty_canvas = true;
		
		if (!this.graph) {
            return;
        }

        this.adjustMouseEvent(e);

        var ref_window = this.getCanvasWindow();
        var document = ref_window.document;
        LGraphCanvas.active_canvas = this;
        var that = this;

        //move mouse move event to the window in case it drags outside of the canvas
        this.canvas.removeEventListener("mousemove", this._mousemove_callback);
        ref_window.document.addEventListener(
            "mousemove",
            this._mousemove_callback,
            true
        ); //catch for the entire window
        ref_window.document.addEventListener(
            "mouseup",
            this._mouseup_callback,
            true
        );

        var node = this.graph.getNodeOnPos(
            e.canvasX,
            e.canvasY,
            this.visible_nodes,
            5
        );
        var skip_dragging = false;
        var skip_action = false;
        var now = LiteGraph.getTime();
        var is_double_click = now - this.last_mouseclick < 300;
		this.mouse[0] = e.localX;
		this.mouse[1] = e.localY;
        this.graph_mouse[0] = e.canvasX;
        this.graph_mouse[1] = e.canvasY;
		this.last_click_position = [this.mouse[0],this.mouse[1]];

        this.canvas.focus();

        LiteGraph.closeAllContextMenus(ref_window);

        if (this.onMouse) {
            if (this.onMouse(e) == true) {
                return;
            }
        }

        if (e.which == 1) {
            //left button mouse
            if (e.ctrlKey) {
                this.dragging_rectangle = new Float32Array(4);
                this.dragging_rectangle[0] = e.canvasX;
                this.dragging_rectangle[1] = e.canvasY;
                this.dragging_rectangle[2] = 1;
                this.dragging_rectangle[3] = 1;
                skip_action = true;
            }

            var clicking_canvas_bg = false;

            //when clicked on top of a node
            //and it is not interactive
            if (node && this.allow_interaction && !skip_action && !this.read_only) {
                if (!this.live_mode && !node.flags.pinned) {
                    this.bringToFront(node);
                } //if it wasn't selected?

                //not dragging mouse to connect two slots
                if (
                    !this.connecting_node &&
                    !node.flags.collapsed &&
                    !this.live_mode
                ) {
                    //Search for corner for resize
                    if (
                        !skip_action &&
                        node.resizable !== false &&
                        isInsideRectangle(
                            e.canvasX,
                            e.canvasY,
                            node.pos[0] + node.size[0] - 5,
                            node.pos[1] + node.size[1] - 5,
                            10,
                            10
                        )
                    ) {
                        this.resizing_node = node;
                        this.canvas.style.cursor = "se-resize";
                        skip_action = true;
                    } else {
                        //search for outputs
                        if (node.outputs) {
                            for (
                                var i = 0, l = node.outputs.length;
                                i < l;
                                ++i
                            ) {
                                var output = node.outputs[i];
                                var link_pos = node.getConnectionPos(false, i);
                                if (
                                    isInsideRectangle(
                                        e.canvasX,
                                        e.canvasY,
                                        link_pos[0] - 15,
                                        link_pos[1] - 10,
                                        30,
                                        20
                                    )
                                ) {
                                    this.connecting_node = node;
                                    this.connecting_output = output;
                                    this.connecting_pos = node.getConnectionPos( false, i );
                                    this.connecting_slot = i;

                                    if (e.shiftKey) {
                                        node.disconnectOutput(i);
                                    }

                                    if (is_double_click) {
                                        if (node.onOutputDblClick) {
                                            node.onOutputDblClick(i, e);
                                        }
                                    } else {
                                        if (node.onOutputClick) {
                                            node.onOutputClick(i, e);
                                        }
                                    }

                                    skip_action = true;
                                    break;
                                }
                            }
                        }

                        //search for inputs
                        if (node.inputs) {
                            for (
                                var i = 0, l = node.inputs.length;
                                i < l;
                                ++i
                            ) {
                                var input = node.inputs[i];
                                var link_pos = node.getConnectionPos(true, i);
                                if (
                                    isInsideRectangle(
                                        e.canvasX,
                                        e.canvasY,
                                        link_pos[0] - 15,
                                        link_pos[1] - 10,
                                        30,
                                        20
                                    )
                                ) {
                                    if (is_double_click) {
                                        if (node.onInputDblClick) {
                                            node.onInputDblClick(i, e);
                                        }
                                    } else {
                                        if (node.onInputClick) {
                                            node.onInputClick(i, e);
                                        }
                                    }

                                    if (input.link !== null) {
                                        var link_info = this.graph.links[
                                            input.link
                                        ]; //before disconnecting
                                        node.disconnectInput(i);

                                        if (
                                            this.allow_reconnect_links ||
                                            e.shiftKey
                                        ) {
                                            this.connecting_node = this.graph._nodes_by_id[
                                                link_info.origin_id
                                            ];
                                            this.connecting_slot =
                                                link_info.origin_slot;
                                            this.connecting_output = this.connecting_node.outputs[
                                                this.connecting_slot
                                            ];
                                            this.connecting_pos = this.connecting_node.getConnectionPos( false, this.connecting_slot );
                                        }

                                        this.dirty_bgcanvas = true;
                                        skip_action = true;
                                    }
                                }
                            }
                        }
                    } //not resizing
                }

                //Search for corner for collapsing
                /*
				if( !skip_action && isInsideRectangle( e.canvasX, e.canvasY, node.pos[0], node.pos[1] - LiteGraph.NODE_TITLE_HEIGHT, LiteGraph.NODE_TITLE_HEIGHT, LiteGraph.NODE_TITLE_HEIGHT ))
				{
					node.collapse();
					skip_action = true;
				}
				*/

                //it wasn't clicked on the links boxes
                if (!skip_action) {
                    var block_drag_node = false;
					var pos = [e.canvasX - node.pos[0], e.canvasY - node.pos[1]];

                    //widgets
                    var widget = this.processNodeWidgets( node, this.graph_mouse, e );
                    if (widget) {
                        block_drag_node = true;
                        this.node_widget = [node, widget];
                    }

                    //double clicking
                    if (is_double_click && this.selected_nodes[node.id]) {
                        //double click node
                        if (node.onDblClick) {
                            node.onDblClick( e, pos, this );
                        }
                        this.processNodeDblClicked(node);
                        block_drag_node = true;
                    }

                    //if do not capture mouse
                    if ( node.onMouseDown && node.onMouseDown( e, pos, this ) ) {
                        block_drag_node = true;
                    } else {
						//open subgraph button
						if(node.subgraph && !node.skip_subgraph_button)
						{
							if ( !node.flags.collapsed && pos[0] > node.size[0] - LiteGraph.NODE_TITLE_HEIGHT && pos[1] < 0 ) {
								var that = this;
								setTimeout(function() {
									that.openSubgraph(node.subgraph);
								}, 10);
							}
						}

						if (this.live_mode) {
							clicking_canvas_bg = true;
	                        block_drag_node = true;
						}
                    }

                    if (!block_drag_node) {
                        if (this.allow_dragnodes) {
                            this.node_dragged = node;
                        }
                        if (!this.selected_nodes[node.id]) {
                            this.processNodeSelected(node, e);
                        }
                    }

                    this.dirty_canvas = true;
                }
            } //clicked outside of nodes
            else {
                //search for link connector
				if(!this.read_only) 
					for (var i = 0; i < this.visible_links.length; ++i) {
						var link = this.visible_links[i];
						var center = link._pos;
						if (
							!center ||
							e.canvasX < center[0] - 4 ||
							e.canvasX > center[0] + 4 ||
							e.canvasY < center[1] - 4 ||
							e.canvasY > center[1] + 4
						) {
							continue;
						}
						//link clicked
						this.showLinkMenu(link, e);
						this.over_link_center = null; //clear tooltip
						break;
					}

                this.selected_group = this.graph.getGroupOnPos( e.canvasX, e.canvasY );
                this.selected_group_resizing = false;
                if (this.selected_group && !this.read_only ) {
                    if (e.ctrlKey) {
                        this.dragging_rectangle = null;
                    }

                    var dist = distance( [e.canvasX, e.canvasY], [ this.selected_group.pos[0] + this.selected_group.size[0], this.selected_group.pos[1] + this.selected_group.size[1] ] );
                    if (dist * this.ds.scale < 10) {
                        this.selected_group_resizing = true;
                    } else {
                        this.selected_group.recomputeInsideNodes();
                    }
                }

                if (is_double_click && !this.read_only && this.allow_searchbox) {
                    this.showSearchBox(e);
                }

                clicking_canvas_bg = true;
            }

            if (!skip_action && clicking_canvas_bg && this.allow_dragcanvas) {
                this.dragging_canvas = true;
            }
        } else if (e.which == 2) {
            //middle button
        } else if (e.which == 3) {
            //right button
			if(!this.read_only)
	            this.processContextMenu(node, e);
        }

        //TODO
        //if(this.node_selected != prev_selected)
        //	this.onNodeSelectionChange(this.node_selected);

        this.last_mouse[0] = e.localX;
        this.last_mouse[1] = e.localY;
        this.last_mouseclick = LiteGraph.getTime();
        this.last_mouse_dragging = true;

        /*
	if( (this.dirty_canvas || this.dirty_bgcanvas) && this.rendering_timer_id == null)
		this.draw();
	*/

        this.graph.change();

        //this is to ensure to defocus(blur) if a text input element is on focus
        if (
            !ref_window.document.activeElement ||
            (ref_window.document.activeElement.nodeName.toLowerCase() !=
                "input" &&
                ref_window.document.activeElement.nodeName.toLowerCase() !=
                    "textarea")
        ) {
            e.preventDefault();
        }
        e.stopPropagation();

        if (this.onMouseDown) {
            this.onMouseDown(e);
        }

        return false;
    };

    /**
     * Called when a mouse move event has to be processed
     * @method processMouseMove
     **/
    LGraphCanvas.prototype.processMouseMove = function(e) {
        if (this.autoresize) {
            this.resize();
        }

		if( this.set_canvas_dirty_on_mouse_event )
			this.dirty_canvas = true;

        if (!this.graph) {
            return;
        }

        LGraphCanvas.active_canvas = this;
        this.adjustMouseEvent(e);
        var mouse = [e.localX, e.localY];
		this.mouse[0] = mouse[0];
		this.mouse[1] = mouse[1];
        var delta = [
            mouse[0] - this.last_mouse[0],
            mouse[1] - this.last_mouse[1]
        ];
        this.last_mouse = mouse;
        this.graph_mouse[0] = e.canvasX;
        this.graph_mouse[1] = e.canvasY;

		if(this.block_click)
		{
			e.preventDefault();
			return false;
		}

        e.dragging = this.last_mouse_dragging;

        if (this.node_widget) {
            this.processNodeWidgets(
                this.node_widget[0],
                this.graph_mouse,
                e,
                this.node_widget[1]
            );
            this.dirty_canvas = true;
        }

        if (this.dragging_rectangle)
		{
            this.dragging_rectangle[2] = e.canvasX - this.dragging_rectangle[0];
            this.dragging_rectangle[3] = e.canvasY - this.dragging_rectangle[1];
            this.dirty_canvas = true;
        } 
		else if (this.selected_group && !this.read_only)
		{
            //moving/resizing a group
            if (this.selected_group_resizing) {
                this.selected_group.size = [
                    e.canvasX - this.selected_group.pos[0],
                    e.canvasY - this.selected_group.pos[1]
                ];
            } else {
                var deltax = delta[0] / this.ds.scale;
                var deltay = delta[1] / this.ds.scale;
                this.selected_group.move(deltax, deltay, e.ctrlKey);
                if (this.selected_group._nodes.length) {
                    this.dirty_canvas = true;
                }
            }
            this.dirty_bgcanvas = true;
        } else if (this.dragging_canvas) {
            this.ds.offset[0] += delta[0] / this.ds.scale;
            this.ds.offset[1] += delta[1] / this.ds.scale;
            this.dirty_canvas = true;
            this.dirty_bgcanvas = true;
        } else if (this.allow_interaction && !this.read_only) {
            if (this.connecting_node) {
                this.dirty_canvas = true;
            }

            //get node over
            var node = this.graph.getNodeOnPos(e.canvasX,e.canvasY,this.visible_nodes);

            //remove mouseover flag
            for (var i = 0, l = this.graph._nodes.length; i < l; ++i) {
                if (this.graph._nodes[i].mouseOver && node != this.graph._nodes[i] ) {
                    //mouse leave
                    this.graph._nodes[i].mouseOver = false;
                    if (this.node_over && this.node_over.onMouseLeave) {
                        this.node_over.onMouseLeave(e);
                    }
                    this.node_over = null;
                    this.dirty_canvas = true;
                }
            }

            //mouse over a node
            if (node) {

				if(node.redraw_on_mouse)
                    this.dirty_canvas = true;

                //this.canvas.style.cursor = "move";
                if (!node.mouseOver) {
                    //mouse enter
                    node.mouseOver = true;
                    this.node_over = node;
                    this.dirty_canvas = true;

                    if (node.onMouseEnter) {
                        node.onMouseEnter(e);
                    }
                }

                //in case the node wants to do something
                if (node.onMouseMove) {
                    node.onMouseMove( e, [e.canvasX - node.pos[0], e.canvasY - node.pos[1]], this );
                }

                //if dragging a link
                if (this.connecting_node) {
                    var pos = this._highlight_input || [0, 0]; //to store the output of isOverNodeInput

                    //on top of input
                    if (this.isOverNodeBox(node, e.canvasX, e.canvasY)) {
                        //mouse on top of the corner box, don't know what to do
                    } else {
                        //check if I have a slot below de mouse
                        var slot = this.isOverNodeInput( node, e.canvasX, e.canvasY, pos );
                        if (slot != -1 && node.inputs[slot]) {
                            var slot_type = node.inputs[slot].type;
                            if ( LiteGraph.isValidConnection( this.connecting_output.type, slot_type ) ) {
                                this._highlight_input = pos;
                            }
                        } else {
                            this._highlight_input = null;
                        }
                    }
                }

                //Search for corner
                if (this.canvas) {
                    if (
                        isInsideRectangle(
                            e.canvasX,
                            e.canvasY,
                            node.pos[0] + node.size[0] - 5,
                            node.pos[1] + node.size[1] - 5,
                            5,
                            5
                        )
                    ) {
                        this.canvas.style.cursor = "se-resize";
                    } else {
                        this.canvas.style.cursor = "crosshair";
                    }
                }
            } else { //not over a node

                //search for link connector
				var over_link = null;
				for (var i = 0; i < this.visible_links.length; ++i) {
					var link = this.visible_links[i];
					var center = link._pos;
					if (
						!center ||
						e.canvasX < center[0] - 4 ||
						e.canvasX > center[0] + 4 ||
						e.canvasY < center[1] - 4 ||
						e.canvasY > center[1] + 4
					) {
						continue;
					}
					over_link = link;
					break;
				}
				if( over_link != this.over_link_center )
				{
					this.over_link_center = over_link;
	                this.dirty_canvas = true;
				}

				if (this.canvas) {
	                this.canvas.style.cursor = "";
				}
			} //end

			//send event to node if capturing input (used with widgets that allow drag outside of the area of the node)
            if ( this.node_capturing_input && this.node_capturing_input != node && this.node_capturing_input.onMouseMove ) {
                this.node_capturing_input.onMouseMove(e,[e.canvasX - this.node_capturing_input.pos[0],e.canvasY - this.node_capturing_input.pos[1]], this);
            }

			//node being dragged
            if (this.node_dragged && !this.live_mode) {
				//console.log("draggin!",this.selected_nodes);
                for (var i in this.selected_nodes) {
                    var n = this.selected_nodes[i];
                    n.pos[0] += delta[0] / this.ds.scale;
                    n.pos[1] += delta[1] / this.ds.scale;
                }

                this.dirty_canvas = true;
                this.dirty_bgcanvas = true;
            }

            if (this.resizing_node && !this.live_mode) {
                //convert mouse to node space
				var desired_size = [ e.canvasX - this.resizing_node.pos[0], e.canvasY - this.resizing_node.pos[1] ];
				var min_size = this.resizing_node.computeSize();
				desired_size[0] = Math.max( min_size[0], desired_size[0] );
				desired_size[1] = Math.max( min_size[1], desired_size[1] );
				this.resizing_node.setSize( desired_size );

                this.canvas.style.cursor = "se-resize";
                this.dirty_canvas = true;
                this.dirty_bgcanvas = true;
            }
        }

        e.preventDefault();
        return false;
    };

    /**
     * Called when a mouse up event has to be processed
     * @method processMouseUp
     **/
    LGraphCanvas.prototype.processMouseUp = function(e) {

		if( this.set_canvas_dirty_on_mouse_event )
			this.dirty_canvas = true;

        if (!this.graph)
            return;

        var window = this.getCanvasWindow();
        var document = window.document;
        LGraphCanvas.active_canvas = this;

        //restore the mousemove event back to the canvas
        document.removeEventListener("mousemove",this._mousemove_callback,true);
        this.canvas.addEventListener("mousemove",this._mousemove_callback,true);
        document.removeEventListener("mouseup", this._mouseup_callback, true);

        this.adjustMouseEvent(e);
        var now = LiteGraph.getTime();
        e.click_time = now - this.last_mouseclick;
        this.last_mouse_dragging = false;
		this.last_click_position = null;

		if(this.block_click)
		{
			console.log("foo");
			this.block_click = false; //used to avoid sending twice a click in a immediate button
		}

        if (e.which == 1) {

			if( this.node_widget )
			{
				this.processNodeWidgets( this.node_widget[0], this.graph_mouse, e );
			}

            //left button
            this.node_widget = null;

            if (this.selected_group) {
                var diffx =
                    this.selected_group.pos[0] -
                    Math.round(this.selected_group.pos[0]);
                var diffy =
                    this.selected_group.pos[1] -
                    Math.round(this.selected_group.pos[1]);
                this.selected_group.move(diffx, diffy, e.ctrlKey);
                this.selected_group.pos[0] = Math.round(
                    this.selected_group.pos[0]
                );
                this.selected_group.pos[1] = Math.round(
                    this.selected_group.pos[1]
                );
                if (this.selected_group._nodes.length) {
                    this.dirty_canvas = true;
                }
                this.selected_group = null;
            }
            this.selected_group_resizing = false;

            if (this.dragging_rectangle) {
                if (this.graph) {
                    var nodes = this.graph._nodes;
                    var node_bounding = new Float32Array(4);
                    this.deselectAllNodes();
                    //compute bounding and flip if left to right
                    var w = Math.abs(this.dragging_rectangle[2]);
                    var h = Math.abs(this.dragging_rectangle[3]);
                    var startx =
                        this.dragging_rectangle[2] < 0
                            ? this.dragging_rectangle[0] - w
                            : this.dragging_rectangle[0];
                    var starty =
                        this.dragging_rectangle[3] < 0
                            ? this.dragging_rectangle[1] - h
                            : this.dragging_rectangle[1];
                    this.dragging_rectangle[0] = startx;
                    this.dragging_rectangle[1] = starty;
                    this.dragging_rectangle[2] = w;
                    this.dragging_rectangle[3] = h;

                    //test against all nodes (not visible because the rectangle maybe start outside
                    var to_select = [];
                    for (var i = 0; i < nodes.length; ++i) {
                        var node = nodes[i];
                        node.getBounding(node_bounding);
                        if (
                            !overlapBounding(
                                this.dragging_rectangle,
                                node_bounding
                            )
                        ) {
                            continue;
                        } //out of the visible area
                        to_select.push(node);
                    }
                    if (to_select.length) {
                        this.selectNodes(to_select);
                    }
                }
                this.dragging_rectangle = null;
            } else if (this.connecting_node) {
                //dragging a connection
                this.dirty_canvas = true;
                this.dirty_bgcanvas = true;

                var node = this.graph.getNodeOnPos(
                    e.canvasX,
                    e.canvasY,
                    this.visible_nodes
                );

                //node below mouse
                if (node) {
                    if (
                        this.connecting_output.type == LiteGraph.EVENT &&
                        this.isOverNodeBox(node, e.canvasX, e.canvasY)
                    ) {
                        this.connecting_node.connect(
                            this.connecting_slot,
                            node,
                            LiteGraph.EVENT
                        );
                    } else {
                        //slot below mouse? connect
                        var slot = this.isOverNodeInput(
                            node,
                            e.canvasX,
                            e.canvasY
                        );
                        if (slot != -1) {
                            this.connecting_node.connect(
                                this.connecting_slot,
                                node,
                                slot
                            );
                        } else {
                            //not on top of an input
                            var input = node.getInputInfo(0);
                            //auto connect
                            if (
                                this.connecting_output.type == LiteGraph.EVENT
                            ) {
                                this.connecting_node.connect(
                                    this.connecting_slot,
                                    node,
                                    LiteGraph.EVENT
                                );
                            } else if (
                                input &&
                                !input.link &&
                                LiteGraph.isValidConnection(
                                    input.type && this.connecting_output.type
                                )
                            ) {
                                this.connecting_node.connect(
                                    this.connecting_slot,
                                    node,
                                    0
                                );
                            }
                        }
                    }
                }

                this.connecting_output = null;
                this.connecting_pos = null;
                this.connecting_node = null;
                this.connecting_slot = -1;
            } //not dragging connection
            else if (this.resizing_node) {
                this.dirty_canvas = true;
                this.dirty_bgcanvas = true;
                this.resizing_node = null;
            } else if (this.node_dragged) {
                //node being dragged?
                var node = this.node_dragged;
                if (
                    node &&
                    e.click_time < 300 &&
                    isInsideRectangle( e.canvasX, e.canvasY, node.pos[0], node.pos[1] - LiteGraph.NODE_TITLE_HEIGHT, LiteGraph.NODE_TITLE_HEIGHT, LiteGraph.NODE_TITLE_HEIGHT )
                ) {
                    node.collapse();
                }

                this.dirty_canvas = true;
                this.dirty_bgcanvas = true;
                this.node_dragged.pos[0] = Math.round(this.node_dragged.pos[0]);
                this.node_dragged.pos[1] = Math.round(this.node_dragged.pos[1]);
                if (this.graph.config.align_to_grid) {
                    this.node_dragged.alignToGrid();
                }
				if( this.onNodeMoved )
					this.onNodeMoved( this.node_dragged );
                this.node_dragged = null;
            } //no node being dragged
            else {
                //get node over
                var node = this.graph.getNodeOnPos(
                    e.canvasX,
                    e.canvasY,
                    this.visible_nodes
                );

                if (!node && e.click_time < 300) {
                    this.deselectAllNodes();
                }

                this.dirty_canvas = true;
                this.dragging_canvas = false;

                if (this.node_over && this.node_over.onMouseUp) {
                    this.node_over.onMouseUp( e, [ e.canvasX - this.node_over.pos[0], e.canvasY - this.node_over.pos[1] ], this );
                }
                if (
                    this.node_capturing_input &&
                    this.node_capturing_input.onMouseUp
                ) {
                    this.node_capturing_input.onMouseUp(e, [
                        e.canvasX - this.node_capturing_input.pos[0],
                        e.canvasY - this.node_capturing_input.pos[1]
                    ]);
                }
            }
        } else if (e.which == 2) {
            //middle button
            //trace("middle");
            this.dirty_canvas = true;
            this.dragging_canvas = false;
        } else if (e.which == 3) {
            //right button
            //trace("right");
            this.dirty_canvas = true;
            this.dragging_canvas = false;
        }

        /*
	if((this.dirty_canvas || this.dirty_bgcanvas) && this.rendering_timer_id == null)
		this.draw();
	*/

        this.graph.change();

        e.stopPropagation();
        e.preventDefault();
        return false;
    };

    /**
     * Called when a mouse wheel event has to be processed
     * @method processMouseWheel
     **/
    LGraphCanvas.prototype.processMouseWheel = function(e) {
        if (!this.graph || !this.allow_dragcanvas) {
            return;
        }

        var delta = e.wheelDeltaY != null ? e.wheelDeltaY : e.detail * -60;

        this.adjustMouseEvent(e);

        var scale = this.ds.scale;

        if (delta > 0) {
            scale *= 1.1;
        } else if (delta < 0) {
            scale *= 1 / 1.1;
        }

        //this.setZoom( scale, [ e.localX, e.localY ] );
        this.ds.changeScale(scale, [e.localX, e.localY]);

        this.graph.change();

        e.preventDefault();
        return false; // prevent default
    };

    /**
     * returns true if a position (in graph space) is on top of a node little corner box
     * @method isOverNodeBox
     **/
    LGraphCanvas.prototype.isOverNodeBox = function(node, canvasx, canvasy) {
        var title_height = LiteGraph.NODE_TITLE_HEIGHT;
        if (
            isInsideRectangle(
                canvasx,
                canvasy,
                node.pos[0] + 2,
                node.pos[1] + 2 - title_height,
                title_height - 4,
                title_height - 4
            )
        ) {
            return true;
        }
        return false;
    };

    /**
     * returns true if a position (in graph space) is on top of a node input slot
     * @method isOverNodeInput
     **/
    LGraphCanvas.prototype.isOverNodeInput = function(
        node,
        canvasx,
        canvasy,
        slot_pos
    ) {
        if (node.inputs) {
            for (var i = 0, l = node.inputs.length; i < l; ++i) {
                var input = node.inputs[i];
                var link_pos = node.getConnectionPos(true, i);
                var is_inside = false;
                if (node.horizontal) {
                    is_inside = isInsideRectangle(
                        canvasx,
                        canvasy,
                        link_pos[0] - 5,
                        link_pos[1] - 10,
                        10,
                        20
                    );
                } else {
                    is_inside = isInsideRectangle(
                        canvasx,
                        canvasy,
                        link_pos[0] - 10,
                        link_pos[1] - 5,
                        40,
                        10
                    );
                }
                if (is_inside) {
                    if (slot_pos) {
                        slot_pos[0] = link_pos[0];
                        slot_pos[1] = link_pos[1];
                    }
                    return i;
                }
            }
        }
        return -1;
    };

    /**
     * process a key event
     * @method processKey
     **/
    LGraphCanvas.prototype.processKey = function(e) {
        if (!this.graph) {
            return;
        }

        var block_default = false;
        //console.log(e); //debug

        if (e.target.localName == "input") {
            return;
        }

        if (e.type == "keydown") {
            if (e.keyCode == 32) {
                //esc
                this.dragging_canvas = true;
                block_default = true;
            }

            //select all Control A
            if (e.keyCode == 65 && e.ctrlKey) {
                this.selectNodes();
                block_default = true;
            }

            if (e.code == "KeyC" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
                //copy
                if (this.selected_nodes) {
                    this.copyToClipboard();
                    block_default = true;
                }
            }

            if (e.code == "KeyV" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
                //paste
                this.pasteFromClipboard();
            }

            //delete or backspace
            if (e.keyCode == 46 || e.keyCode == 8) {
                if (
                    e.target.localName != "input" &&
                    e.target.localName != "textarea"
                ) {
                    this.deleteSelectedNodes();
                    block_default = true;
                }
            }

            //collapse
            //...

            //TODO
            if (this.selected_nodes) {
                for (var i in this.selected_nodes) {
                    if (this.selected_nodes[i].onKeyDown) {
                        this.selected_nodes[i].onKeyDown(e);
                    }
                }
            }
        } else if (e.type == "keyup") {
            if (e.keyCode == 32) {
                this.dragging_canvas = false;
            }

            if (this.selected_nodes) {
                for (var i in this.selected_nodes) {
                    if (this.selected_nodes[i].onKeyUp) {
                        this.selected_nodes[i].onKeyUp(e);
                    }
                }
            }
        }

        this.graph.change();

        if (block_default) {
            e.preventDefault();
            e.stopImmediatePropagation();
            return false;
        }
    };

    LGraphCanvas.prototype.copyToClipboard = function() {
        var clipboard_info = {
            nodes: [],
            links: []
        };
        var index = 0;
        var selected_nodes_array = [];
        for (var i in this.selected_nodes) {
            var node = this.selected_nodes[i];
            node._relative_id = index;
            selected_nodes_array.push(node);
            index += 1;
        }

        for (var i = 0; i < selected_nodes_array.length; ++i) {
            var node = selected_nodes_array[i];
			var cloned = node.clone();
			if(!cloned)
			{
				console.warn("node type not found: " + node.type );
				continue;
			}
            clipboard_info.nodes.push(cloned.serialize());
            if (node.inputs && node.inputs.length) {
                for (var j = 0; j < node.inputs.length; ++j) {
                    var input = node.inputs[j];
                    if (!input || input.link == null) {
                        continue;
                    }
                    var link_info = this.graph.links[input.link];
                    if (!link_info) {
                        continue;
                    }
                    var target_node = this.graph.getNodeById(
                        link_info.origin_id
                    );
                    if (!target_node || !this.selected_nodes[target_node.id]) {
                        //improve this by allowing connections to non-selected nodes
                        continue;
                    } //not selected
                    clipboard_info.links.push([
                        target_node._relative_id,
                        link_info.origin_slot, //j,
                        node._relative_id,
                        link_info.target_slot
                    ]);
                }
            }
        }
        localStorage.setItem(
            "litegrapheditor_clipboard",
            JSON.stringify(clipboard_info)
        );
    };

    LGraphCanvas.prototype.pasteFromClipboard = function() {
        var data = localStorage.getItem("litegrapheditor_clipboard");
        if (!data) {
            return;
        }

        //create nodes
        var clipboard_info = JSON.parse(data);
        var nodes = [];
        for (var i = 0; i < clipboard_info.nodes.length; ++i) {
            var node_data = clipboard_info.nodes[i];
            var node = LiteGraph.createNode(node_data.type);
            if (node) {
                node.configure(node_data);
                node.pos[0] += 5;
                node.pos[1] += 5;
                this.graph.add(node);
                nodes.push(node);
            }
        }

        //create links
        for (var i = 0; i < clipboard_info.links.length; ++i) {
            var link_info = clipboard_info.links[i];
            var origin_node = nodes[link_info[0]];
            var target_node = nodes[link_info[2]];
			if( origin_node && target_node )
	            origin_node.connect(link_info[1], target_node, link_info[3]);
			else
				console.warn("Warning, nodes missing on pasting");
        }

        this.selectNodes(nodes);
    };

    /**
     * process a item drop event on top the canvas
     * @method processDrop
     **/
    LGraphCanvas.prototype.processDrop = function(e) {
        e.preventDefault();
        this.adjustMouseEvent(e);

        var pos = [e.canvasX, e.canvasY];
        var node = this.graph ? this.graph.getNodeOnPos(pos[0], pos[1]) : null;

        if (!node) {
            var r = null;
            if (this.onDropItem) {
                r = this.onDropItem(event);
            }
            if (!r) {
                this.checkDropItem(e);
            }
            return;
        }

        if (node.onDropFile || node.onDropData) {
            var files = e.dataTransfer.files;
            if (files && files.length) {
                for (var i = 0; i < files.length; i++) {
                    var file = e.dataTransfer.files[0];
                    var filename = file.name;
                    var ext = LGraphCanvas.getFileExtension(filename);
                    //console.log(file);

                    if (node.onDropFile) {
                        node.onDropFile(file);
                    }

                    if (node.onDropData) {
                        //prepare reader
                        var reader = new FileReader();
                        reader.onload = function(event) {
                            //console.log(event.target);
                            var data = event.target.result;
                            node.onDropData(data, filename, file);
                        };

                        //read data
                        var type = file.type.split("/")[0];
                        if (type == "text" || type == "") {
                            reader.readAsText(file);
                        } else if (type == "image") {
                            reader.readAsDataURL(file);
                        } else {
                            reader.readAsArrayBuffer(file);
                        }
                    }
                }
            }
        }

        if (node.onDropItem) {
            if (node.onDropItem(event)) {
                return true;
            }
        }

        if (this.onDropItem) {
            return this.onDropItem(event);
        }

        return false;
    };

    //called if the graph doesn't have a default drop item behaviour
    LGraphCanvas.prototype.checkDropItem = function(e) {
        if (e.dataTransfer.files.length) {
            var file = e.dataTransfer.files[0];
            var ext = LGraphCanvas.getFileExtension(file.name).toLowerCase();
            var nodetype = LiteGraph.node_types_by_file_extension[ext];
            if (nodetype) {
                var node = LiteGraph.createNode(nodetype.type);
                node.pos = [e.canvasX, e.canvasY];
                this.graph.add(node);
                if (node.onDropFile) {
                    node.onDropFile(file);
                }
            }
        }
    };

    LGraphCanvas.prototype.processNodeDblClicked = function(n) {
        if (this.onShowNodePanel) {
            this.onShowNodePanel(n);
        }
		else
		{
			this.showShowNodePanel(n);
		}

        if (this.onNodeDblClicked) {
            this.onNodeDblClicked(n);
        }

        this.setDirty(true);
    };

    LGraphCanvas.prototype.processNodeSelected = function(node, e) {
        this.selectNode(node, e && e.shiftKey);
        if (this.onNodeSelected) {
            this.onNodeSelected(node);
        }
    };

    /**
     * selects a given node (or adds it to the current selection)
     * @method selectNode
     **/
    LGraphCanvas.prototype.selectNode = function(
        node,
        add_to_current_selection
    ) {
        if (node == null) {
            this.deselectAllNodes();
        } else {
            this.selectNodes([node], add_to_current_selection);
        }
    };

    /**
     * selects several nodes (or adds them to the current selection)
     * @method selectNodes
     **/
    LGraphCanvas.prototype.selectNodes = function( nodes, add_to_current_selection )
	{
        if (!add_to_current_selection) {
            this.deselectAllNodes();
        }

        nodes = nodes || this.graph._nodes;
        for (var i = 0; i < nodes.length; ++i) {
            var node = nodes[i];
            if (node.is_selected) {
                continue;
            }

            if (!node.is_selected && node.onSelected) {
                node.onSelected();
            }
            node.is_selected = true;
            this.selected_nodes[node.id] = node;

            if (node.inputs) {
                for (var j = 0; j < node.inputs.length; ++j) {
                    this.highlighted_links[node.inputs[j].link] = true;
                }
            }
            if (node.outputs) {
                for (var j = 0; j < node.outputs.length; ++j) {
                    var out = node.outputs[j];
                    if (out.links) {
                        for (var k = 0; k < out.links.length; ++k) {
                            this.highlighted_links[out.links[k]] = true;
                        }
                    }
                }
            }
        }

		if(	this.onSelectionChange )
			this.onSelectionChange( this.selected_nodes );

        this.setDirty(true);
    };

    /**
     * removes a node from the current selection
     * @method deselectNode
     **/
    LGraphCanvas.prototype.deselectNode = function(node) {
        if (!node.is_selected) {
            return;
        }
        if (node.onDeselected) {
            node.onDeselected();
        }
        node.is_selected = false;

        if (this.onNodeDeselected) {
            this.onNodeDeselected(node);
        }

        //remove highlighted
        if (node.inputs) {
            for (var i = 0; i < node.inputs.length; ++i) {
                delete this.highlighted_links[node.inputs[i].link];
            }
        }
        if (node.outputs) {
            for (var i = 0; i < node.outputs.length; ++i) {
                var out = node.outputs[i];
                if (out.links) {
                    for (var j = 0; j < out.links.length; ++j) {
                        delete this.highlighted_links[out.links[j]];
                    }
                }
            }
        }
    };

    /**
     * removes all nodes from the current selection
     * @method deselectAllNodes
     **/
    LGraphCanvas.prototype.deselectAllNodes = function() {
        if (!this.graph) {
            return;
        }
        var nodes = this.graph._nodes;
        for (var i = 0, l = nodes.length; i < l; ++i) {
            var node = nodes[i];
            if (!node.is_selected) {
                continue;
            }
            if (node.onDeselected) {
                node.onDeselected();
            }
            node.is_selected = false;
			if (this.onNodeDeselected) {
				this.onNodeDeselected(node);
			}
        }
        this.selected_nodes = {};
        this.current_node = null;
        this.highlighted_links = {};
		if(	this.onSelectionChange )
			this.onSelectionChange( this.selected_nodes );
        this.setDirty(true);
    };

    /**
     * deletes all nodes in the current selection from the graph
     * @method deleteSelectedNodes
     **/
    LGraphCanvas.prototype.deleteSelectedNodes = function() {
        for (var i in this.selected_nodes) {
            var node = this.selected_nodes[i];

			if(node.block_delete)
				continue;

			//autoconnect when possible (very basic, only takes into account first input-output)
			if(node.inputs && node.inputs.length && node.outputs && node.outputs.length && LiteGraph.isValidConnection( node.inputs[0].type, node.outputs[0].type ) && node.inputs[0].link && node.outputs[0].links && node.outputs[0].links.length ) 
			{
				var input_link = node.graph.links[ node.inputs[0].link ];
				var output_link = node.graph.links[ node.outputs[0].links[0] ];
				var input_node = node.getInputNode(0);
				var output_node = node.getOutputNodes(0)[0];
				if(input_node && output_node)
					input_node.connect( input_link.origin_slot, output_node, output_link.target_slot );
			}
            this.graph.remove(node);
			if (this.onNodeDeselected) {
				this.onNodeDeselected(node);
			}
        }
        this.selected_nodes = {};
        this.current_node = null;
        this.highlighted_links = {};
        this.setDirty(true);
    };

    /**
     * centers the camera on a given node
     * @method centerOnNode
     **/
    LGraphCanvas.prototype.centerOnNode = function(node) {
        this.ds.offset[0] =
            -node.pos[0] -
            node.size[0] * 0.5 +
            (this.canvas.width * 0.5) / this.ds.scale;
        this.ds.offset[1] =
            -node.pos[1] -
            node.size[1] * 0.5 +
            (this.canvas.height * 0.5) / this.ds.scale;
        this.setDirty(true, true);
    };

    /**
     * adds some useful properties to a mouse event, like the position in graph coordinates
     * @method adjustMouseEvent
     **/
    LGraphCanvas.prototype.adjustMouseEvent = function(e) {
        if (this.canvas) {
            var b = this.canvas.getBoundingClientRect();
            e.localX = e.clientX - b.left;
            e.localY = e.clientY - b.top;
        } else {
            e.localX = e.clientX;
            e.localY = e.clientY;
        }

        e.deltaX = e.localX - this.last_mouse_position[0];
        e.deltaY = e.localY - this.last_mouse_position[1];

        this.last_mouse_position[0] = e.localX;
        this.last_mouse_position[1] = e.localY;

        e.canvasX = e.localX / this.ds.scale - this.ds.offset[0];
        e.canvasY = e.localY / this.ds.scale - this.ds.offset[1];
    };

    /**
     * changes the zoom level of the graph (default is 1), you can pass also a place used to pivot the zoom
     * @method setZoom
     **/
    LGraphCanvas.prototype.setZoom = function(value, zooming_center) {
        this.ds.changeScale(value, zooming_center);
        /*
	if(!zooming_center && this.canvas)
		zooming_center = [this.canvas.width * 0.5,this.canvas.height * 0.5];

	var center = this.convertOffsetToCanvas( zooming_center );

	this.ds.scale = value;

	if(this.scale > this.max_zoom)
		this.scale = this.max_zoom;
	else if(this.scale < this.min_zoom)
		this.scale = this.min_zoom;

	var new_center = this.convertOffsetToCanvas( zooming_center );
	var delta_offset = [new_center[0] - center[0], new_center[1] - center[1]];

	this.offset[0] += delta_offset[0];
	this.offset[1] += delta_offset[1];
	*/

        this.dirty_canvas = true;
        this.dirty_bgcanvas = true;
    };

    /**
     * converts a coordinate from graph coordinates to canvas2D coordinates
     * @method convertOffsetToCanvas
     **/
    LGraphCanvas.prototype.convertOffsetToCanvas = function(pos, out) {
        return this.ds.convertOffsetToCanvas(pos, out);
    };

    /**
     * converts a coordinate from Canvas2D coordinates to graph space
     * @method convertCanvasToOffset
     **/
    LGraphCanvas.prototype.convertCanvasToOffset = function(pos, out) {
        return this.ds.convertCanvasToOffset(pos, out);
    };

    //converts event coordinates from canvas2D to graph coordinates
    LGraphCanvas.prototype.convertEventToCanvasOffset = function(e) {
        var rect = this.canvas.getBoundingClientRect();
        return this.convertCanvasToOffset([
            e.clientX - rect.left,
            e.clientY - rect.top
        ]);
    };

    /**
     * brings a node to front (above all other nodes)
     * @method bringToFront
     **/
    LGraphCanvas.prototype.bringToFront = function(node) {
        var i = this.graph._nodes.indexOf(node);
        if (i == -1) {
            return;
        }

        this.graph._nodes.splice(i, 1);
        this.graph._nodes.push(node);
    };

    /**
     * sends a node to the back (below all other nodes)
     * @method sendToBack
     **/
    LGraphCanvas.prototype.sendToBack = function(node) {
        var i = this.graph._nodes.indexOf(node);
        if (i == -1) {
            return;
        }

        this.graph._nodes.splice(i, 1);
        this.graph._nodes.unshift(node);
    };

    /* Interaction */

    /* LGraphCanvas render */
    var temp = new Float32Array(4);

    /**
     * checks which nodes are visible (inside the camera area)
     * @method computeVisibleNodes
     **/
    LGraphCanvas.prototype.computeVisibleNodes = function(nodes, out) {
        var visible_nodes = out || [];
        visible_nodes.length = 0;
        nodes = nodes || this.graph._nodes;
        for (var i = 0, l = nodes.length; i < l; ++i) {
            var n = nodes[i];

            //skip rendering nodes in live mode
            if (this.live_mode && !n.onDrawBackground && !n.onDrawForeground) {
                continue;
            }

            if (!overlapBounding(this.visible_area, n.getBounding(temp))) {
                continue;
            } //out of the visible area

            visible_nodes.push(n);
        }
        return visible_nodes;
    };

    /**
     * renders the whole canvas content, by rendering in two separated canvas, one containing the background grid and the connections, and one containing the nodes)
     * @method draw
     **/
    LGraphCanvas.prototype.draw = function(force_canvas, force_bgcanvas) {
        if (!this.canvas || this.canvas.width == 0 || this.canvas.height == 0) {
            return;
        }

        //fps counting
        var now = LiteGraph.getTime();
        this.render_time = (now - this.last_draw_time) * 0.001;
        this.last_draw_time = now;

        if (this.graph) {
            this.ds.computeVisibleArea();
        }

        if (
            this.dirty_bgcanvas ||
            force_bgcanvas ||
            this.always_render_background ||
            (this.graph &&
                this.graph._last_trigger_time &&
                now - this.graph._last_trigger_time < 1000)
        ) {
            this.drawBackCanvas();
        }

        if (this.dirty_canvas || force_canvas) {
            this.drawFrontCanvas();
        }

        this.fps = this.render_time ? 1.0 / this.render_time : 0;
        this.frame += 1;
    };

    /**
     * draws the front canvas (the one containing all the nodes)
     * @method drawFrontCanvas
     **/
    LGraphCanvas.prototype.drawFrontCanvas = function() {
        this.dirty_canvas = false;

        if (!this.ctx) {
            this.ctx = this.bgcanvas.getContext("2d");
        }
        var ctx = this.ctx;
        if (!ctx) {
            //maybe is using webgl...
            return;
        }

        if (ctx.start2D) {
            ctx.start2D();
        }

        var canvas = this.canvas;

        //reset in case of error
        ctx.restore();
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        //clip dirty area if there is one, otherwise work in full canvas
        if (this.dirty_area) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(
                this.dirty_area[0],
                this.dirty_area[1],
                this.dirty_area[2],
                this.dirty_area[3]
            );
            ctx.clip();
        }

        //clear
        //canvas.width = canvas.width;
        if (this.clear_background) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        //draw bg canvas
        if (this.bgcanvas == this.canvas) {
            this.drawBackCanvas();
        } else {
            ctx.drawImage( this.bgcanvas, 0, 0 );
        }

        //rendering
        if (this.onRender) {
            this.onRender(canvas, ctx);
        }

        //info widget
        if (this.show_info) {
            this.renderInfo(ctx);
        }

        if (this.graph) {
            //apply transformations
            ctx.save();
            this.ds.toCanvasContext(ctx);

            //draw nodes
            var drawn_nodes = 0;
            var visible_nodes = this.computeVisibleNodes(
                null,
                this.visible_nodes
            );

            for (var i = 0; i < visible_nodes.length; ++i) {
                var node = visible_nodes[i];

                //transform coords system
                ctx.save();
                ctx.translate(node.pos[0], node.pos[1]);

                //Draw
                this.drawNode(node, ctx);
                drawn_nodes += 1;

                //Restore
                ctx.restore();
            }

            //on top (debug)
            if (this.render_execution_order) {
                this.drawExecutionOrder(ctx);
            }

            //connections ontop?
            if (this.graph.config.links_ontop) {
                if (!this.live_mode) {
                    this.drawConnections(ctx);
                }
            }

            //current connection (the one being dragged by the mouse)
            if (this.connecting_pos != null) {
                ctx.lineWidth = this.connections_width;
                var link_color = null;

                switch (this.connecting_output.type) {
                    case LiteGraph.EVENT:
                        link_color = LiteGraph.EVENT_LINK_COLOR;
                        break;
                    default:
                        link_color = LiteGraph.CONNECTING_LINK_COLOR;
                }

                //the connection being dragged by the mouse
                this.renderLink(
                    ctx,
                    this.connecting_pos,
                    [this.graph_mouse[0], this.graph_mouse[1]],
                    null,
                    false,
                    null,
                    link_color,
                    this.connecting_output.dir ||
                        (this.connecting_node.horizontal
                            ? LiteGraph.DOWN
                            : LiteGraph.RIGHT),
                    LiteGraph.CENTER
                );

                ctx.beginPath();
                if (
                    this.connecting_output.type === LiteGraph.EVENT ||
                    this.connecting_output.shape === LiteGraph.BOX_SHAPE
                ) {
                    ctx.rect(
                        this.connecting_pos[0] - 6 + 0.5,
                        this.connecting_pos[1] - 5 + 0.5,
                        14,
                        10
                    );
                } else {
                    ctx.arc(
                        this.connecting_pos[0],
                        this.connecting_pos[1],
                        4,
                        0,
                        Math.PI * 2
                    );
                }
                ctx.fill();

                ctx.fillStyle = "#ffcc00";
                if (this._highlight_input) {
                    ctx.beginPath();
                    ctx.arc(
                        this._highlight_input[0],
                        this._highlight_input[1],
                        6,
                        0,
                        Math.PI * 2
                    );
                    ctx.fill();
                }
            }

			//the selection rectangle
            if (this.dragging_rectangle) {
                ctx.strokeStyle = "#FFF";
                ctx.strokeRect(
                    this.dragging_rectangle[0],
                    this.dragging_rectangle[1],
                    this.dragging_rectangle[2],
                    this.dragging_rectangle[3]
                );
            }

			//on top of link center
			if(this.over_link_center && this.render_link_tooltip)
				this.drawLinkTooltip( ctx, this.over_link_center );
			else
				if(this.onDrawLinkTooltip) //to remove
					this.onDrawLinkTooltip(ctx,null);

			//custom info
            if (this.onDrawForeground) {
                this.onDrawForeground(ctx, this.visible_rect);
            }

            ctx.restore();
        }

		//draws panel in the corner 
		if (this._graph_stack && this._graph_stack.length) {
			this.drawSubgraphPanel( ctx );
		}


        if (this.onDrawOverlay) {
            this.onDrawOverlay(ctx);
        }

        if (this.dirty_area) {
            ctx.restore();
            //this.dirty_area = null;
        }

        if (ctx.finish2D) {
            //this is a function I use in webgl renderer
            ctx.finish2D();
        }
    };

    /**
     * draws the panel in the corner that shows subgraph properties
     * @method drawSubgraphPanel
     **/
	LGraphCanvas.prototype.drawSubgraphPanel = function(ctx) {
		var subgraph = this.graph;
		var subnode = subgraph._subgraph_node;
		if(!subnode)
		{
			console.warn("subgraph without subnode");
			return;
		}

		var num = subnode.inputs ? subnode.inputs.length : 0;
		var w = 300;
		var h = Math.floor(LiteGraph.NODE_SLOT_HEIGHT * 1.6);

		ctx.fillStyle = "#111";
		ctx.globalAlpha = 0.8;
		ctx.beginPath();
		ctx.roundRect(10,10,w, (num + 1) * h + 50,8 );
		ctx.fill();
		ctx.globalAlpha = 1;

		ctx.fillStyle = "#888";
		ctx.font = "14px Arial";
		ctx.textAlign = "left";
		ctx.fillText( "Graph Inputs", 20, 34 );
		var pos = this.mouse;

		if( this.drawButton( w - 20, 20,20,20, "X", "#151515" ) )
		{
			this.closeSubgraph();
			return;
		}

		var y = 50;
		ctx.font = "20px Arial";
		if(subnode.inputs)
		for(var i = 0; i < subnode.inputs.length; ++i)
		{
			var input = subnode.inputs[i];
			if(input.not_subgraph_input)
				continue;

			//input button clicked
			if( this.drawButton( 20,y+2,w - 20, h - 2 ) )
			{
				var type = subnode.constructor.input_node_type || "graph/input";
				var newnode = LiteGraph.createNode( type );
				if(newnode)
				{
					subgraph.add( newnode );
					this.block_click = false;
					this.last_click_position = null;
					this.selectNodes([newnode]);
					this.node_dragged = newnode;
					this.dragging_canvas = false;
					newnode.setProperty("name",input.name);
					newnode.setProperty("type",input.type);
					this.node_dragged.pos[0] = this.graph_mouse[0] - 5;
					this.node_dragged.pos[1] = this.graph_mouse[1] - 5;
				}
				else
					console.error("graph input node not found:",type);
			}

			ctx.fillStyle = "#9C9";
			ctx.beginPath();
			ctx.arc(w - 16,y + h * 0.5,5,0,2*Math.PI);
			ctx.fill();

			ctx.fillStyle = "#AAA";
			ctx.fillText( input.name, 50, y + h*0.75 );
			var tw = ctx.measureText( input.name );
			ctx.fillStyle = "#777";
			ctx.fillText( input.type, 50 + tw.width + 10, y + h*0.75 );

			y += h;
		}

		//add + button
		if( this.drawButton( 20,y+2,w - 20, h - 2, "+", "#151515", "#222" ) )
		{
			this.showSubgraphPropertiesDialog( subnode );
		}
	}

	//Draws a button into the canvas overlay and computes if it was clicked using the immediate gui paradigm
	LGraphCanvas.prototype.drawButton = function( x,y,w,h, text, bgcolor, hovercolor, textcolor )
	{
		var ctx = this.ctx;
		bgcolor = bgcolor || LiteGraph.NODE_DEFAULT_COLOR;
		hovercolor = hovercolor || "#555";
		textcolor = textcolor || LiteGraph.NODE_TEXT_COLOR;

		var pos = this.mouse;
		var hover = LiteGraph.isInsideRectangle( pos[0], pos[1], x,y,w,h );
		pos = this.last_click_position;
		var clicked = pos && LiteGraph.isInsideRectangle( pos[0], pos[1], x,y,w,h );

		ctx.fillStyle = hover ? hovercolor : bgcolor;
		if(clicked)
			ctx.fillStyle = "#AAA";
		ctx.beginPath();
		ctx.roundRect(x,y,w,h,4 );
		ctx.fill();

		if(text != null)
		{
			if(text.constructor == String)
			{
				ctx.fillStyle = textcolor;
				ctx.textAlign = "center";
				ctx.font = ((h * 0.65)|0) + "px Arial";
				ctx.fillText( text, x + w * 0.5,y + h * 0.75 );
				ctx.textAlign = "left";
			}
		}

		var was_clicked = clicked && !this.block_click;
		if(clicked)
			this.blockClick();
		return was_clicked;
	}

	LGraphCanvas.prototype.isAreaClicked = function( x,y,w,h, hold_click )
	{
		var pos = this.mouse;
		var hover = LiteGraph.isInsideRectangle( pos[0], pos[1], x,y,w,h );
		pos = this.last_click_position;
		var clicked = pos && LiteGraph.isInsideRectangle( pos[0], pos[1], x,y,w,h );
		var was_clicked = clicked && !this.block_click;
		if(clicked && hold_click)
			this.blockClick();
		return was_clicked;
	}

    /**
     * draws some useful stats in the corner of the canvas
     * @method renderInfo
     **/
    LGraphCanvas.prototype.renderInfo = function(ctx, x, y) {
        x = x || 10;
        y = y || this.canvas.height - 80;

        ctx.save();
        ctx.translate(x, y);

        ctx.font = "10px Arial";
        ctx.fillStyle = "#888";
        if (this.graph) {
            ctx.fillText( "T: " + this.graph.globaltime.toFixed(2) + "s", 5, 13 * 1 );
            ctx.fillText("I: " + this.graph.iteration, 5, 13 * 2 );
            ctx.fillText("N: " + this.graph._nodes.length + " [" + this.visible_nodes.length + "]", 5, 13 * 3 );
            ctx.fillText("V: " + this.graph._version, 5, 13 * 4);
            ctx.fillText("FPS:" + this.fps.toFixed(2), 5, 13 * 5);
        } else {
            ctx.fillText("No graph selected", 5, 13 * 1);
        }
        ctx.restore();
    };

    /**
     * draws the back canvas (the one containing the background and the connections)
     * @method drawBackCanvas
     **/
    LGraphCanvas.prototype.drawBackCanvas = function() {
        var canvas = this.bgcanvas;
        if (
            canvas.width != this.canvas.width ||
            canvas.height != this.canvas.height
        ) {
            canvas.width = this.canvas.width;
            canvas.height = this.canvas.height;
        }

        if (!this.bgctx) {
            this.bgctx = this.bgcanvas.getContext("2d");
        }
        var ctx = this.bgctx;
        if (ctx.start) {
            ctx.start();
        }

        //clear
        if (this.clear_background) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        if (this._graph_stack && this._graph_stack.length) {
            ctx.save();
            var parent_graph = this._graph_stack[this._graph_stack.length - 1];
            var subgraph_node = this.graph._subgraph_node;
            ctx.strokeStyle = subgraph_node.bgcolor;
            ctx.lineWidth = 10;
            ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
            ctx.lineWidth = 1;
            ctx.font = "40px Arial";
            ctx.textAlign = "center";
            ctx.fillStyle = subgraph_node.bgcolor || "#AAA";
            var title = "";
            for (var i = 1; i < this._graph_stack.length; ++i) {
                title +=
                    this._graph_stack[i]._subgraph_node.getTitle() + " >> ";
            }
            ctx.fillText(
                title + subgraph_node.getTitle(),
                canvas.width * 0.5,
                40
            );
            ctx.restore();
        }

        var bg_already_painted = false;
        if (this.onRenderBackground) {
            bg_already_painted = this.onRenderBackground(canvas, ctx);
        }

        //reset in case of error
        ctx.restore();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.visible_links.length = 0;

        if (this.graph) {
            //apply transformations
            ctx.save();
            this.ds.toCanvasContext(ctx);

            //render BG
            if (
                this.background_image &&
                this.ds.scale > 0.5 &&
                !bg_already_painted
            ) {
                if (this.zoom_modify_alpha) {
                    ctx.globalAlpha =
                        (1.0 - 0.5 / this.ds.scale) * this.editor_alpha;
                } else {
                    ctx.globalAlpha = this.editor_alpha;
                }
                ctx.imageSmoothingEnabled = ctx.mozImageSmoothingEnabled = ctx.imageSmoothingEnabled = false;
                if (
                    !this._bg_img ||
                    this._bg_img.name != this.background_image
                ) {
                    this._bg_img = new Image();
                    this._bg_img.name = this.background_image;
                    this._bg_img.src = this.background_image;
                    var that = this;
                    this._bg_img.onload = function() {
                        that.draw(true, true);
                    };
                }

                var pattern = null;
                if (this._pattern == null && this._bg_img.width > 0) {
                    pattern = ctx.createPattern(this._bg_img, "repeat");
                    this._pattern_img = this._bg_img;
                    this._pattern = pattern;
                } else {
                    pattern = this._pattern;
                }
                if (pattern) {
                    ctx.fillStyle = pattern;
                    ctx.fillRect(
                        this.visible_area[0],
                        this.visible_area[1],
                        this.visible_area[2],
                        this.visible_area[3]
                    );
                    ctx.fillStyle = "transparent";
                }

                ctx.globalAlpha = 1.0;
                ctx.imageSmoothingEnabled = ctx.mozImageSmoothingEnabled = ctx.imageSmoothingEnabled = true;
            }

            //groups
            if (this.graph._groups.length && !this.live_mode) {
                this.drawGroups(canvas, ctx);
            }

            if (this.onDrawBackground) {
                this.onDrawBackground(ctx, this.visible_area);
            }
            if (this.onBackgroundRender) {
                //LEGACY
                console.error(
                    "WARNING! onBackgroundRender deprecated, now is named onDrawBackground "
                );
                this.onBackgroundRender = null;
            }

            //DEBUG: show clipping area
            //ctx.fillStyle = "red";
            //ctx.fillRect( this.visible_area[0] + 10, this.visible_area[1] + 10, this.visible_area[2] - 20, this.visible_area[3] - 20);

            //bg
            if (this.render_canvas_border) {
                ctx.strokeStyle = "#235";
                ctx.strokeRect(0, 0, canvas.width, canvas.height);
            }

            if (this.render_connections_shadows) {
                ctx.shadowColor = "#000";
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                ctx.shadowBlur = 6;
            } else {
                ctx.shadowColor = "rgba(0,0,0,0)";
            }

            //draw connections
            if (!this.live_mode) {
                this.drawConnections(ctx);
            }

            ctx.shadowColor = "rgba(0,0,0,0)";

            //restore state
            ctx.restore();
        }

        if (ctx.finish) {
            ctx.finish();
        }

        this.dirty_bgcanvas = false;
        this.dirty_canvas = true; //to force to repaint the front canvas with the bgcanvas
    };

    var temp_vec2 = new Float32Array(2);

    /**
     * draws the given node inside the canvas
     * @method drawNode
     **/
    LGraphCanvas.prototype.drawNode = function(node, ctx) {
        var glow = false;
        this.current_node = node;

        var color = node.color || node.constructor.color || LiteGraph.NODE_DEFAULT_COLOR;
        var bgcolor = node.bgcolor || node.constructor.bgcolor || LiteGraph.NODE_DEFAULT_BGCOLOR;

        //shadow and glow
        if (node.mouseOver) {
            glow = true;
        }

        var low_quality = this.ds.scale < 0.6; //zoomed out

        //only render if it forces it to do it
        if (this.live_mode) {
            if (!node.flags.collapsed) {
                ctx.shadowColor = "transparent";
                if (node.onDrawForeground) {
                    node.onDrawForeground(ctx, this, this.canvas);
                }
            }
            return;
        }

        var editor_alpha = this.editor_alpha;
        ctx.globalAlpha = editor_alpha;

        if (this.render_shadows && !low_quality) {
            ctx.shadowColor = LiteGraph.DEFAULT_SHADOW_COLOR;
            ctx.shadowOffsetX = 2 * this.ds.scale;
            ctx.shadowOffsetY = 2 * this.ds.scale;
            ctx.shadowBlur = 3 * this.ds.scale;
        } else {
            ctx.shadowColor = "transparent";
        }

        //custom draw collapsed method (draw after shadows because they are affected)
        if (
            node.flags.collapsed &&
            node.onDrawCollapsed &&
            node.onDrawCollapsed(ctx, this) == true
        ) {
            return;
        }

        //clip if required (mask)
        var shape = node._shape || LiteGraph.BOX_SHAPE;
        var size = temp_vec2;
        temp_vec2.set(node.size);
        var horizontal = node.horizontal; // || node.flags.horizontal;

        if (node.flags.collapsed) {
            ctx.font = this.inner_text_font;
            var title = node.getTitle ? node.getTitle() : node.title;
            if (title != null) {
                node._collapsed_width = Math.min(
                    node.size[0],
                    ctx.measureText(title).width +
                        LiteGraph.NODE_TITLE_HEIGHT * 2
                ); //LiteGraph.NODE_COLLAPSED_WIDTH;
                size[0] = node._collapsed_width;
                size[1] = 0;
            }
        }

        if (node.clip_area) {
            //Start clipping
            ctx.save();
            ctx.beginPath();
            if (shape == LiteGraph.BOX_SHAPE) {
                ctx.rect(0, 0, size[0], size[1]);
            } else if (shape == LiteGraph.ROUND_SHAPE) {
                ctx.roundRect(0, 0, size[0], size[1], 10);
            } else if (shape == LiteGraph.CIRCLE_SHAPE) {
                ctx.arc(
                    size[0] * 0.5,
                    size[1] * 0.5,
                    size[0] * 0.5,
                    0,
                    Math.PI * 2
                );
            }
            ctx.clip();
        }

        //draw shape
        if (node.has_errors) {
            bgcolor = "red";
        }
        this.drawNodeShape(
            node,
            ctx,
            size,
            color,
            bgcolor,
            node.is_selected,
            node.mouseOver
        );
        ctx.shadowColor = "transparent";

        //draw foreground
        if (node.onDrawForeground) {
            node.onDrawForeground(ctx, this, this.canvas);
        }

        //connection slots
        ctx.textAlign = horizontal ? "center" : "left";
        ctx.font = this.inner_text_font;

        var render_text = !low_quality;

        var out_slot = this.connecting_output;
        ctx.lineWidth = 1;

        var max_y = 0;
        var slot_pos = new Float32Array(2); //to reuse

        //render inputs and outputs
        if (!node.flags.collapsed) {
            //input connection slots
            if (node.inputs) {
                for (var i = 0; i < node.inputs.length; i++) {
                    var slot = node.inputs[i];

                    ctx.globalAlpha = editor_alpha;
                    //change opacity of incompatible slots when dragging a connection
                    if ( this.connecting_node && !LiteGraph.isValidConnection( slot.type , out_slot.type) ) {
                        ctx.globalAlpha = 0.4 * editor_alpha;
                    }

                    ctx.fillStyle =
                        slot.link != null
                            ? slot.color_on ||
                              this.default_connection_color.input_on
                            : slot.color_off ||
                              this.default_connection_color.input_off;

                    var pos = node.getConnectionPos(true, i, slot_pos);
                    pos[0] -= node.pos[0];
                    pos[1] -= node.pos[1];
                    if (max_y < pos[1] + LiteGraph.NODE_SLOT_HEIGHT * 0.5) {
                        max_y = pos[1] + LiteGraph.NODE_SLOT_HEIGHT * 0.5;
                    }

                    ctx.beginPath();

                    if (
                        slot.type === LiteGraph.EVENT ||
                        slot.shape === LiteGraph.BOX_SHAPE
                    ) {
                        if (horizontal) {
                            ctx.rect(
                                pos[0] - 5 + 0.5,
                                pos[1] - 8 + 0.5,
                                10,
                                14
                            );
                        } else {
                            ctx.rect(
                                pos[0] - 6 + 0.5,
                                pos[1] - 5 + 0.5,
                                14,
                                10
                            );
                        }
                    } else if (slot.shape === LiteGraph.ARROW_SHAPE) {
                        ctx.moveTo(pos[0] + 8, pos[1] + 0.5);
                        ctx.lineTo(pos[0] - 4, pos[1] + 6 + 0.5);
                        ctx.lineTo(pos[0] - 4, pos[1] - 6 + 0.5);
                        ctx.closePath();
                    } else {
						if(low_quality)
	                        ctx.rect(pos[0] - 4, pos[1] - 4, 8, 8 ); //faster
						else
	                        ctx.arc(pos[0], pos[1], 4, 0, Math.PI * 2);
                    }
                    ctx.fill();

                    //render name
                    if (render_text) {
                        var text = slot.label != null ? slot.label : slot.name;
                        if (text) {
                            ctx.fillStyle = LiteGraph.NODE_TEXT_COLOR;
                            if (horizontal || slot.dir == LiteGraph.UP) {
                                ctx.fillText(text, pos[0], pos[1] - 10);
                            } else {
                                ctx.fillText(text, pos[0] + 10, pos[1] + 5);
                            }
                        }
                    }
                }
            }

            //output connection slots
            if (this.connecting_node) {
                ctx.globalAlpha = 0.4 * editor_alpha;
            }

            ctx.textAlign = horizontal ? "center" : "right";
            ctx.strokeStyle = "black";
            if (node.outputs) {
                for (var i = 0; i < node.outputs.length; i++) {
                    var slot = node.outputs[i];

                    var pos = node.getConnectionPos(false, i, slot_pos);
                    pos[0] -= node.pos[0];
                    pos[1] -= node.pos[1];
                    if (max_y < pos[1] + LiteGraph.NODE_SLOT_HEIGHT * 0.5) {
                        max_y = pos[1] + LiteGraph.NODE_SLOT_HEIGHT * 0.5;
                    }

                    ctx.fillStyle =
                        slot.links && slot.links.length
                            ? slot.color_on ||
                              this.default_connection_color.output_on
                            : slot.color_off ||
                              this.default_connection_color.output_off;
                    ctx.beginPath();
                    //ctx.rect( node.size[0] - 14,i*14,10,10);

                    if (
                        slot.type === LiteGraph.EVENT ||
                        slot.shape === LiteGraph.BOX_SHAPE
                    ) {
                        if (horizontal) {
                            ctx.rect(
                                pos[0] - 5 + 0.5,
                                pos[1] - 8 + 0.5,
                                10,
                                14
                            );
                        } else {
                            ctx.rect(
                                pos[0] - 6 + 0.5,
                                pos[1] - 5 + 0.5,
                                14,
                                10
                            );
                        }
                    } else if (slot.shape === LiteGraph.ARROW_SHAPE) {
                        ctx.moveTo(pos[0] + 8, pos[1] + 0.5);
                        ctx.lineTo(pos[0] - 4, pos[1] + 6 + 0.5);
                        ctx.lineTo(pos[0] - 4, pos[1] - 6 + 0.5);
                        ctx.closePath();
                    } else {
						if(low_quality)
	                        ctx.rect(pos[0] - 4, pos[1] - 4, 8, 8 );
						else
	                        ctx.arc(pos[0], pos[1], 4, 0, Math.PI * 2);
                    }

                    //trigger
                    //if(slot.node_id != null && slot.slot == -1)
                    //	ctx.fillStyle = "#F85";

                    //if(slot.links != null && slot.links.length)
                    ctx.fill();
					if(!low_quality)
	                    ctx.stroke();

                    //render output name
                    if (render_text) {
                        var text = slot.label != null ? slot.label : slot.name;
                        if (text) {
                            ctx.fillStyle = LiteGraph.NODE_TEXT_COLOR;
                            if (horizontal || slot.dir == LiteGraph.DOWN) {
                                ctx.fillText(text, pos[0], pos[1] - 8);
                            } else {
                                ctx.fillText(text, pos[0] - 10, pos[1] + 5);
                            }
                        }
                    }
                }
            }

            ctx.textAlign = "left";
            ctx.globalAlpha = 1;

            if (node.widgets) {
				var widgets_y = max_y;
                if (horizontal || node.widgets_up) {
                    widgets_y = 2;
                }
				if( node.widgets_start_y != null )
                    widgets_y = node.widgets_start_y;
                this.drawNodeWidgets(
                    node,
                    widgets_y,
                    ctx,
                    this.node_widget && this.node_widget[0] == node
                        ? this.node_widget[1]
                        : null
                );
            }
        } else if (this.render_collapsed_slots) {
            //if collapsed
            var input_slot = null;
            var output_slot = null;

            //get first connected slot to render
            if (node.inputs) {
                for (var i = 0; i < node.inputs.length; i++) {
                    var slot = node.inputs[i];
                    if (slot.link == null) {
                        continue;
                    }
                    input_slot = slot;
                    break;
                }
            }
            if (node.outputs) {
                for (var i = 0; i < node.outputs.length; i++) {
                    var slot = node.outputs[i];
                    if (!slot.links || !slot.links.length) {
                        continue;
                    }
                    output_slot = slot;
                }
            }

            if (input_slot) {
                var x = 0;
                var y = LiteGraph.NODE_TITLE_HEIGHT * -0.5; //center
                if (horizontal) {
                    x = node._collapsed_width * 0.5;
                    y = -LiteGraph.NODE_TITLE_HEIGHT;
                }
                ctx.fillStyle = "#686";
                ctx.beginPath();
                if (
                    slot.type === LiteGraph.EVENT ||
                    slot.shape === LiteGraph.BOX_SHAPE
                ) {
                    ctx.rect(x - 7 + 0.5, y - 4, 14, 8);
                } else if (slot.shape === LiteGraph.ARROW_SHAPE) {
                    ctx.moveTo(x + 8, y);
                    ctx.lineTo(x + -4, y - 4);
                    ctx.lineTo(x + -4, y + 4);
                    ctx.closePath();
                } else {
                    ctx.arc(x, y, 4, 0, Math.PI * 2);
                }
                ctx.fill();
            }

            if (output_slot) {
                var x = node._collapsed_width;
                var y = LiteGraph.NODE_TITLE_HEIGHT * -0.5; //center
                if (horizontal) {
                    x = node._collapsed_width * 0.5;
                    y = 0;
                }
                ctx.fillStyle = "#686";
                ctx.strokeStyle = "black";
                ctx.beginPath();
                if (
                    slot.type === LiteGraph.EVENT ||
                    slot.shape === LiteGraph.BOX_SHAPE
                ) {
                    ctx.rect(x - 7 + 0.5, y - 4, 14, 8);
                } else if (slot.shape === LiteGraph.ARROW_SHAPE) {
                    ctx.moveTo(x + 6, y);
                    ctx.lineTo(x - 6, y - 4);
                    ctx.lineTo(x - 6, y + 4);
                    ctx.closePath();
                } else {
                    ctx.arc(x, y, 4, 0, Math.PI * 2);
                }
                ctx.fill();
                //ctx.stroke();
            }
        }

        if (node.clip_area) {
            ctx.restore();
        }

        ctx.globalAlpha = 1.0;
    };

	//used by this.over_link_center
	LGraphCanvas.prototype.drawLinkTooltip = function( ctx, link )
	{
		var pos = link._pos;
		ctx.fillStyle = "black";
		ctx.beginPath();
		ctx.arc( pos[0], pos[1], 3, 0, Math.PI * 2 );
		ctx.fill();

		if(link.data == null)
			return;

		if(this.onDrawLinkTooltip)
			if( this.onDrawLinkTooltip(ctx,link,this) == true )
				return;

		var data = link.data;
		var text = null;

		if( data.constructor === Number )
			text = data.toFixed(2);
		else if( data.constructor === String )
			text = "\"" + data + "\"";
		else if( data.constructor === Boolean )
			text = String(data);
		else if (data.toToolTip)
			text = data.toToolTip();
		else
			text = "[" + data.constructor.name + "]";

		if(text == null)
			return;
		text = text.substr(0,30); //avoid weird

		ctx.font = "14px Courier New";
		var info = ctx.measureText(text);
		var w = info.width + 20;
		var h = 24;
		ctx.shadowColor = "black";
		ctx.shadowOffsetX = 2;
		ctx.shadowOffsetY = 2;
		ctx.shadowBlur = 3;
		ctx.fillStyle = "#454";
		ctx.beginPath();
		ctx.roundRect( pos[0] - w*0.5, pos[1] - 15 - h, w, h,3, 3);
		ctx.moveTo( pos[0] - 10, pos[1] - 15 );
		ctx.lineTo( pos[0] + 10, pos[1] - 15 );
		ctx.lineTo( pos[0], pos[1] - 5 );
		ctx.fill();
        ctx.shadowColor = "transparent";
		ctx.textAlign = "center";
		ctx.fillStyle = "#CEC";
		ctx.fillText(text, pos[0], pos[1] - 15 - h * 0.3);
	}

    /**
     * draws the shape of the given node in the canvas
     * @method drawNodeShape
     **/
    var tmp_area = new Float32Array(4);

    LGraphCanvas.prototype.drawNodeShape = function(
        node,
        ctx,
        size,
        fgcolor,
        bgcolor,
        selected,
        mouse_over
    ) {
        //bg rect
        ctx.strokeStyle = fgcolor;
        ctx.fillStyle = bgcolor;

        var title_height = LiteGraph.NODE_TITLE_HEIGHT;
        var low_quality = this.ds.scale < 0.5;

        //render node area depending on shape
        var shape =
            node._shape || node.constructor.shape || LiteGraph.ROUND_SHAPE;

        var title_mode = node.constructor.title_mode;

        var render_title = true;
        if (title_mode == LiteGraph.TRANSPARENT_TITLE) {
            render_title = false;
        } else if (title_mode == LiteGraph.AUTOHIDE_TITLE && mouse_over) {
            render_title = true;
        }

        var area = tmp_area;
        area[0] = 0; //x
        area[1] = render_title ? -title_height : 0; //y
        area[2] = size[0] + 1; //w
        area[3] = render_title ? size[1] + title_height : size[1]; //h

        var old_alpha = ctx.globalAlpha;

        //full node shape
        //if(node.flags.collapsed)
        {
            ctx.beginPath();
            if (shape == LiteGraph.BOX_SHAPE || low_quality) {
                ctx.fillRect(area[0], area[1], area[2], area[3]);
            } else if (
                shape == LiteGraph.ROUND_SHAPE ||
                shape == LiteGraph.CARD_SHAPE
            ) {
                ctx.roundRect(
                    area[0],
                    area[1],
                    area[2],
                    area[3],
                    this.round_radius,
                    shape == LiteGraph.CARD_SHAPE ? 0 : this.round_radius
                );
            } else if (shape == LiteGraph.CIRCLE_SHAPE) {
                ctx.arc(
                    size[0] * 0.5,
                    size[1] * 0.5,
                    size[0] * 0.5,
                    0,
                    Math.PI * 2
                );
            }
            ctx.fill();

			//separator
			if(!node.flags.collapsed)
			{
				ctx.shadowColor = "transparent";
				ctx.fillStyle = "rgba(0,0,0,0.2)";
				ctx.fillRect(0, -1, area[2], 2);
			}
        }
        ctx.shadowColor = "transparent";

        if (node.onDrawBackground) {
            node.onDrawBackground(ctx, this, this.canvas, this.graph_mouse );
        }

        //title bg (remember, it is rendered ABOVE the node)
        if (render_title || title_mode == LiteGraph.TRANSPARENT_TITLE) {
            //title bar
            if (node.onDrawTitleBar) {
                node.onDrawTitleBar( ctx, title_height, size, this.ds.scale, fgcolor );
            } else if (
                title_mode != LiteGraph.TRANSPARENT_TITLE &&
                (node.constructor.title_color || this.render_title_colored)
            ) {
                var title_color = node.constructor.title_color || fgcolor;

                if (node.flags.collapsed) {
                    ctx.shadowColor = LiteGraph.DEFAULT_SHADOW_COLOR;
                }

                //* gradient test
                if (this.use_gradients) {
                    var grad = LGraphCanvas.gradients[title_color];
                    if (!grad) {
                        grad = LGraphCanvas.gradients[ title_color ] = ctx.createLinearGradient(0, 0, 400, 0);
                        grad.addColorStop(0, title_color);
                        grad.addColorStop(1, "#000");
                    }
                    ctx.fillStyle = grad;
                } else {
                    ctx.fillStyle = title_color;
                }

                //ctx.globalAlpha = 0.5 * old_alpha;
                ctx.beginPath();
                if (shape == LiteGraph.BOX_SHAPE || low_quality) {
                    ctx.rect(0, -title_height, size[0] + 1, title_height);
                } else if (  shape == LiteGraph.ROUND_SHAPE || shape == LiteGraph.CARD_SHAPE ) {
                    ctx.roundRect(
                        0,
                        -title_height,
                        size[0] + 1,
                        title_height,
                        this.round_radius,
                        node.flags.collapsed ? this.round_radius : 0
                    );
                }
                ctx.fill();
                ctx.shadowColor = "transparent";
            }

            //title box
            var box_size = 10;
            if (node.onDrawTitleBox) {
                node.onDrawTitleBox(ctx, title_height, size, this.ds.scale);
            } else if (
                shape == LiteGraph.ROUND_SHAPE ||
                shape == LiteGraph.CIRCLE_SHAPE ||
                shape == LiteGraph.CARD_SHAPE
            ) {
                if (low_quality) {
                    ctx.fillStyle = "black";
                    ctx.beginPath();
                    ctx.arc(
                        title_height * 0.5,
                        title_height * -0.5,
                        box_size * 0.5 + 1,
                        0,
                        Math.PI * 2
                    );
                    ctx.fill();
                }

                ctx.fillStyle = node.boxcolor || LiteGraph.NODE_DEFAULT_BOXCOLOR;
				if(low_quality)
					ctx.fillRect( title_height * 0.5 - box_size *0.5, title_height * -0.5 - box_size *0.5, box_size , box_size  );
				else
				{
					ctx.beginPath();
					ctx.arc(
						title_height * 0.5,
						title_height * -0.5,
						box_size * 0.5,
						0,
						Math.PI * 2
					);
					ctx.fill();
				}
            } else {
                if (low_quality) {
                    ctx.fillStyle = "black";
                    ctx.fillRect(
                        (title_height - box_size) * 0.5 - 1,
                        (title_height + box_size) * -0.5 - 1,
                        box_size + 2,
                        box_size + 2
                    );
                }
                ctx.fillStyle = node.boxcolor || LiteGraph.NODE_DEFAULT_BOXCOLOR;
                ctx.fillRect(
                    (title_height - box_size) * 0.5,
                    (title_height + box_size) * -0.5,
                    box_size,
                    box_size
                );
            }
            ctx.globalAlpha = old_alpha;

            //title text
            if (node.onDrawTitleText) {
                node.onDrawTitleText(
                    ctx,
                    title_height,
                    size,
                    this.ds.scale,
                    this.title_text_font,
                    selected
                );
            }
            if (!low_quality) {
                ctx.font = this.title_text_font;
                var title = String(node.getTitle());
                if (title) {
                    if (selected) {
                        ctx.fillStyle = "white";
                    } else {
                        ctx.fillStyle =
                            node.constructor.title_text_color ||
                            this.node_title_color;
                    }
                    if (node.flags.collapsed) {
                        ctx.textAlign = "left";
                        var measure = ctx.measureText(title);
                        ctx.fillText(
                            title.substr(0,20), //avoid urls too long
                            title_height,// + measure.width * 0.5,
                            LiteGraph.NODE_TITLE_TEXT_Y - title_height
                        );
                        ctx.textAlign = "left";
                    } else {
                        ctx.textAlign = "left";
                        ctx.fillText(
                            title,
                            title_height,
                            LiteGraph.NODE_TITLE_TEXT_Y - title_height
                        );
                    }
                }
            }

			//subgraph box
			if (!node.flags.collapsed && node.subgraph && !node.skip_subgraph_button) {
				var w = LiteGraph.NODE_TITLE_HEIGHT;
				var x = node.size[0] - w;
				var over = LiteGraph.isInsideRectangle( this.graph_mouse[0] - node.pos[0], this.graph_mouse[1] - node.pos[1], x+2, -w+2, w-4, w-4 );
				ctx.fillStyle = over ? "#888" : "#555";
				if( shape == LiteGraph.BOX_SHAPE || low_quality)
					ctx.fillRect(x+2, -w+2, w-4, w-4);
				else
				{
					ctx.beginPath();
					ctx.roundRect(x+2, -w+2, w-4, w-4,4);
					ctx.fill();
				}
				ctx.fillStyle = "#333";
				ctx.beginPath();
				ctx.moveTo(x + w * 0.2, -w * 0.6);
				ctx.lineTo(x + w * 0.8, -w * 0.6);
				ctx.lineTo(x + w * 0.5, -w * 0.3);
				ctx.fill();
			}

			//custom title render
            if (node.onDrawTitle) {
                node.onDrawTitle(ctx);
            }
        }

        //render selection marker
        if (selected) {
            if (node.onBounding) {
                node.onBounding(area);
            }

            if (title_mode == LiteGraph.TRANSPARENT_TITLE) {
                area[1] -= title_height;
                area[3] += title_height;
            }
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            if (shape == LiteGraph.BOX_SHAPE) {
                ctx.rect(
                    -6 + area[0],
                    -6 + area[1],
                    12 + area[2],
                    12 + area[3]
                );
            } else if (
                shape == LiteGraph.ROUND_SHAPE ||
                (shape == LiteGraph.CARD_SHAPE && node.flags.collapsed)
            ) {
                ctx.roundRect(
                    -6 + area[0],
                    -6 + area[1],
                    12 + area[2],
                    12 + area[3],
                    this.round_radius * 2
                );
            } else if (shape == LiteGraph.CARD_SHAPE) {
                ctx.roundRect(
                    -6 + area[0],
                    -6 + area[1],
                    12 + area[2],
                    12 + area[3],
                    this.round_radius * 2,
                    2
                );
            } else if (shape == LiteGraph.CIRCLE_SHAPE) {
                ctx.arc(
                    size[0] * 0.5,
                    size[1] * 0.5,
                    size[0] * 0.5 + 6,
                    0,
                    Math.PI * 2
                );
            }
            ctx.strokeStyle = "#FFF";
            ctx.stroke();
            ctx.strokeStyle = fgcolor;
            ctx.globalAlpha = 1;
        }
    };

    var margin_area = new Float32Array(4);
    var link_bounding = new Float32Array(4);
    var tempA = new Float32Array(2);
    var tempB = new Float32Array(2);

    /**
     * draws every connection visible in the canvas
     * OPTIMIZE THIS: pre-catch connections position instead of recomputing them every time
     * @method drawConnections
     **/
    LGraphCanvas.prototype.drawConnections = function(ctx) {
        var now = LiteGraph.getTime();
        var visible_area = this.visible_area;
        margin_area[0] = visible_area[0] - 20;
        margin_area[1] = visible_area[1] - 20;
        margin_area[2] = visible_area[2] + 40;
        margin_area[3] = visible_area[3] + 40;

        //draw connections
        ctx.lineWidth = this.connections_width;

        ctx.fillStyle = "#AAA";
        ctx.strokeStyle = "#AAA";
        ctx.globalAlpha = this.editor_alpha;
        //for every node
        var nodes = this.graph._nodes;
        for (var n = 0, l = nodes.length; n < l; ++n) {
            var node = nodes[n];
            //for every input (we render just inputs because it is easier as every slot can only have one input)
            if (!node.inputs || !node.inputs.length) {
                continue;
            }

            for (var i = 0; i < node.inputs.length; ++i) {
                var input = node.inputs[i];
                if (!input || input.link == null) {
                    continue;
                }
                var link_id = input.link;
                var link = this.graph.links[link_id];
                if (!link) {
                    continue;
                }

                //find link info
                var start_node = this.graph.getNodeById(link.origin_id);
                if (start_node == null) {
                    continue;
                }
                var start_node_slot = link.origin_slot;
                var start_node_slotpos = null;
                if (start_node_slot == -1) {
                    start_node_slotpos = [
                        start_node.pos[0] + 10,
                        start_node.pos[1] + 10
                    ];
                } else {
                    start_node_slotpos = start_node.getConnectionPos(
                        false,
                        start_node_slot,
                        tempA
                    );
                }
                var end_node_slotpos = node.getConnectionPos(true, i, tempB);

                //compute link bounding
                link_bounding[0] = start_node_slotpos[0];
                link_bounding[1] = start_node_slotpos[1];
                link_bounding[2] = end_node_slotpos[0] - start_node_slotpos[0];
                link_bounding[3] = end_node_slotpos[1] - start_node_slotpos[1];
                if (link_bounding[2] < 0) {
                    link_bounding[0] += link_bounding[2];
                    link_bounding[2] = Math.abs(link_bounding[2]);
                }
                if (link_bounding[3] < 0) {
                    link_bounding[1] += link_bounding[3];
                    link_bounding[3] = Math.abs(link_bounding[3]);
                }

                //skip links outside of the visible area of the canvas
                if (!overlapBounding(link_bounding, margin_area)) {
                    continue;
                }

                var start_slot = start_node.outputs[start_node_slot];
                var end_slot = node.inputs[i];
                if (!start_slot || !end_slot) {
                    continue;
                }
                var start_dir =
                    start_slot.dir ||
                    (start_node.horizontal ? LiteGraph.DOWN : LiteGraph.RIGHT);
                var end_dir =
                    end_slot.dir ||
                    (node.horizontal ? LiteGraph.UP : LiteGraph.LEFT);

                this.renderLink(
                    ctx,
                    start_node_slotpos,
                    end_node_slotpos,
                    link,
                    false,
                    0,
                    null,
                    start_dir,
                    end_dir
                );

                //event triggered rendered on top
                if (link && link._last_time && now - link._last_time < 1000) {
                    var f = 2.0 - (now - link._last_time) * 0.002;
                    var tmp = ctx.globalAlpha;
                    ctx.globalAlpha = tmp * f;
                    this.renderLink(
                        ctx,
                        start_node_slotpos,
                        end_node_slotpos,
                        link,
                        true,
                        f,
                        "white",
                        start_dir,
                        end_dir
                    );
                    ctx.globalAlpha = tmp;
                }
            }
        }
        ctx.globalAlpha = 1;
    };

    /**
     * draws a link between two points
     * @method renderLink
     * @param {vec2} a start pos
     * @param {vec2} b end pos
     * @param {Object} link the link object with all the link info
     * @param {boolean} skip_border ignore the shadow of the link
     * @param {boolean} flow show flow animation (for events)
     * @param {string} color the color for the link
     * @param {number} start_dir the direction enum
     * @param {number} end_dir the direction enum
     * @param {number} num_sublines number of sublines (useful to represent vec3 or rgb)
     **/
    LGraphCanvas.prototype.renderLink = function(
        ctx,
        a,
        b,
        link,
        skip_border,
        flow,
        color,
        start_dir,
        end_dir,
        num_sublines
    ) {
        if (link) {
            this.visible_links.push(link);
        }

        //choose color
        if (!color && link) {
            color = link.color || LGraphCanvas.link_type_colors[link.type];
        }
        if (!color) {
            color = this.default_link_color;
        }
        if (link != null && this.highlighted_links[link.id]) {
            color = "#FFF";
        }

        start_dir = start_dir || LiteGraph.RIGHT;
        end_dir = end_dir || LiteGraph.LEFT;

        var dist = distance(a, b);

        if (this.render_connections_border && this.ds.scale > 0.6) {
            ctx.lineWidth = this.connections_width + 4;
        }
        ctx.lineJoin = "round";
        num_sublines = num_sublines || 1;
        if (num_sublines > 1) {
            ctx.lineWidth = 0.5;
        }

        //begin line shape
        ctx.beginPath();
        for (var i = 0; i < num_sublines; i += 1) {
            var offsety = (i - (num_sublines - 1) * 0.5) * 5;

            if (this.links_render_mode == LiteGraph.SPLINE_LINK) {
                ctx.moveTo(a[0], a[1] + offsety);
                var start_offset_x = 0;
                var start_offset_y = 0;
                var end_offset_x = 0;
                var end_offset_y = 0;
                switch (start_dir) {
                    case LiteGraph.LEFT:
                        start_offset_x = dist * -0.25;
                        break;
                    case LiteGraph.RIGHT:
                        start_offset_x = dist * 0.25;
                        break;
                    case LiteGraph.UP:
                        start_offset_y = dist * -0.25;
                        break;
                    case LiteGraph.DOWN:
                        start_offset_y = dist * 0.25;
                        break;
                }
                switch (end_dir) {
                    case LiteGraph.LEFT:
                        end_offset_x = dist * -0.25;
                        break;
                    case LiteGraph.RIGHT:
                        end_offset_x = dist * 0.25;
                        break;
                    case LiteGraph.UP:
                        end_offset_y = dist * -0.25;
                        break;
                    case LiteGraph.DOWN:
                        end_offset_y = dist * 0.25;
                        break;
                }
                ctx.bezierCurveTo(
                    a[0] + start_offset_x,
                    a[1] + start_offset_y + offsety,
                    b[0] + end_offset_x,
                    b[1] + end_offset_y + offsety,
                    b[0],
                    b[1] + offsety
                );
            } else if (this.links_render_mode == LiteGraph.LINEAR_LINK) {
                ctx.moveTo(a[0], a[1] + offsety);
                var start_offset_x = 0;
                var start_offset_y = 0;
                var end_offset_x = 0;
                var end_offset_y = 0;
                switch (start_dir) {
                    case LiteGraph.LEFT:
                        start_offset_x = -1;
                        break;
                    case LiteGraph.RIGHT:
                        start_offset_x = 1;
                        break;
                    case LiteGraph.UP:
                        start_offset_y = -1;
                        break;
                    case LiteGraph.DOWN:
                        start_offset_y = 1;
                        break;
                }
                switch (end_dir) {
                    case LiteGraph.LEFT:
                        end_offset_x = -1;
                        break;
                    case LiteGraph.RIGHT:
                        end_offset_x = 1;
                        break;
                    case LiteGraph.UP:
                        end_offset_y = -1;
                        break;
                    case LiteGraph.DOWN:
                        end_offset_y = 1;
                        break;
                }
                var l = 15;
                ctx.lineTo(
                    a[0] + start_offset_x * l,
                    a[1] + start_offset_y * l + offsety
                );
                ctx.lineTo(
                    b[0] + end_offset_x * l,
                    b[1] + end_offset_y * l + offsety
                );
                ctx.lineTo(b[0], b[1] + offsety);
            } else if (this.links_render_mode == LiteGraph.STRAIGHT_LINK) {
                ctx.moveTo(a[0], a[1]);
                var start_x = a[0];
                var start_y = a[1];
                var end_x = b[0];
                var end_y = b[1];
                if (start_dir == LiteGraph.RIGHT) {
                    start_x += 10;
                } else {
                    start_y += 10;
                }
                if (end_dir == LiteGraph.LEFT) {
                    end_x -= 10;
                } else {
                    end_y -= 10;
                }
                ctx.lineTo(start_x, start_y);
                ctx.lineTo((start_x + end_x) * 0.5, start_y);
                ctx.lineTo((start_x + end_x) * 0.5, end_y);
                ctx.lineTo(end_x, end_y);
                ctx.lineTo(b[0], b[1]);
            } else {
                return;
            } //unknown
        }

        //rendering the outline of the connection can be a little bit slow
        if (
            this.render_connections_border &&
            this.ds.scale > 0.6 &&
            !skip_border
        ) {
            ctx.strokeStyle = "rgba(0,0,0,0.5)";
            ctx.stroke();
        }

        ctx.lineWidth = this.connections_width;
        ctx.fillStyle = ctx.strokeStyle = color;
        ctx.stroke();
        //end line shape

        var pos = this.computeConnectionPoint(a, b, 0.5, start_dir, end_dir);
        if (link && link._pos) {
            link._pos[0] = pos[0];
            link._pos[1] = pos[1];
        }

        //render arrow in the middle
        if (
            this.ds.scale >= 0.6 &&
            this.highquality_render &&
            end_dir != LiteGraph.CENTER
        ) {
            //render arrow
            if (this.render_connection_arrows) {
                //compute two points in the connection
                var posA = this.computeConnectionPoint(
                    a,
                    b,
                    0.25,
                    start_dir,
                    end_dir
                );
                var posB = this.computeConnectionPoint(
                    a,
                    b,
                    0.26,
                    start_dir,
                    end_dir
                );
                var posC = this.computeConnectionPoint(
                    a,
                    b,
                    0.75,
                    start_dir,
                    end_dir
                );
                var posD = this.computeConnectionPoint(
                    a,
                    b,
                    0.76,
                    start_dir,
                    end_dir
                );

                //compute the angle between them so the arrow points in the right direction
                var angleA = 0;
                var angleB = 0;
                if (this.render_curved_connections) {
                    angleA = -Math.atan2(posB[0] - posA[0], posB[1] - posA[1]);
                    angleB = -Math.atan2(posD[0] - posC[0], posD[1] - posC[1]);
                } else {
                    angleB = angleA = b[1] > a[1] ? 0 : Math.PI;
                }

                //render arrow
                ctx.save();
                ctx.translate(posA[0], posA[1]);
                ctx.rotate(angleA);
                ctx.beginPath();
                ctx.moveTo(-5, -3);
                ctx.lineTo(0, +7);
                ctx.lineTo(+5, -3);
                ctx.fill();
                ctx.restore();
                ctx.save();
                ctx.translate(posC[0], posC[1]);
                ctx.rotate(angleB);
                ctx.beginPath();
                ctx.moveTo(-5, -3);
                ctx.lineTo(0, +7);
                ctx.lineTo(+5, -3);
                ctx.fill();
                ctx.restore();
            }

            //circle
            ctx.beginPath();
            ctx.arc(pos[0], pos[1], 5, 0, Math.PI * 2);
            ctx.fill();
        }

        //render flowing points
        if (flow) {
            ctx.fillStyle = color;
            for (var i = 0; i < 5; ++i) {
                var f = (LiteGraph.getTime() * 0.001 + i * 0.2) % 1;
                var pos = this.computeConnectionPoint(
                    a,
                    b,
                    f,
                    start_dir,
                    end_dir
                );
                ctx.beginPath();
                ctx.arc(pos[0], pos[1], 5, 0, 2 * Math.PI);
                ctx.fill();
            }
        }
    };

    //returns the link center point based on curvature
    LGraphCanvas.prototype.computeConnectionPoint = function(
        a,
        b,
        t,
        start_dir,
        end_dir
    ) {
        start_dir = start_dir || LiteGraph.RIGHT;
        end_dir = end_dir || LiteGraph.LEFT;

        var dist = distance(a, b);
        var p0 = a;
        var p1 = [a[0], a[1]];
        var p2 = [b[0], b[1]];
        var p3 = b;

        switch (start_dir) {
            case LiteGraph.LEFT:
                p1[0] += dist * -0.25;
                break;
            case LiteGraph.RIGHT:
                p1[0] += dist * 0.25;
                break;
            case LiteGraph.UP:
                p1[1] += dist * -0.25;
                break;
            case LiteGraph.DOWN:
                p1[1] += dist * 0.25;
                break;
        }
        switch (end_dir) {
            case LiteGraph.LEFT:
                p2[0] += dist * -0.25;
                break;
            case LiteGraph.RIGHT:
                p2[0] += dist * 0.25;
                break;
            case LiteGraph.UP:
                p2[1] += dist * -0.25;
                break;
            case LiteGraph.DOWN:
                p2[1] += dist * 0.25;
                break;
        }

        var c1 = (1 - t) * (1 - t) * (1 - t);
        var c2 = 3 * ((1 - t) * (1 - t)) * t;
        var c3 = 3 * (1 - t) * (t * t);
        var c4 = t * t * t;

        var x = c1 * p0[0] + c2 * p1[0] + c3 * p2[0] + c4 * p3[0];
        var y = c1 * p0[1] + c2 * p1[1] + c3 * p2[1] + c4 * p3[1];
        return [x, y];
    };

    LGraphCanvas.prototype.drawExecutionOrder = function(ctx) {
        ctx.shadowColor = "transparent";
        ctx.globalAlpha = 0.25;

        ctx.textAlign = "center";
        ctx.strokeStyle = "white";
        ctx.globalAlpha = 0.75;

        var visible_nodes = this.visible_nodes;
        for (var i = 0; i < visible_nodes.length; ++i) {
            var node = visible_nodes[i];
            ctx.fillStyle = "black";
            ctx.fillRect(
                node.pos[0] - LiteGraph.NODE_TITLE_HEIGHT,
                node.pos[1] - LiteGraph.NODE_TITLE_HEIGHT,
                LiteGraph.NODE_TITLE_HEIGHT,
                LiteGraph.NODE_TITLE_HEIGHT
            );
            if (node.order == 0) {
                ctx.strokeRect(
                    node.pos[0] - LiteGraph.NODE_TITLE_HEIGHT + 0.5,
                    node.pos[1] - LiteGraph.NODE_TITLE_HEIGHT + 0.5,
                    LiteGraph.NODE_TITLE_HEIGHT,
                    LiteGraph.NODE_TITLE_HEIGHT
                );
            }
            ctx.fillStyle = "#FFF";
            ctx.fillText(
                node.order,
                node.pos[0] + LiteGraph.NODE_TITLE_HEIGHT * -0.5,
                node.pos[1] - 6
            );
        }
        ctx.globalAlpha = 1;
    };

    /**
     * draws the widgets stored inside a node
     * @method drawNodeWidgets
     **/
    LGraphCanvas.prototype.drawNodeWidgets = function(
        node,
        posY,
        ctx,
        active_widget
    ) {
        if (!node.widgets || !node.widgets.length) {
            return 0;
        }
        var width = node.size[0];
        var widgets = node.widgets;
        posY += 2;
        var H = LiteGraph.NODE_WIDGET_HEIGHT;
        var show_text = this.ds.scale > 0.5;
        ctx.save();
        ctx.globalAlpha = this.editor_alpha;
        var outline_color = LiteGraph.WIDGET_OUTLINE_COLOR;
        var background_color = LiteGraph.WIDGET_BGCOLOR;
        var text_color = LiteGraph.WIDGET_TEXT_COLOR;
		var secondary_text_color = LiteGraph.WIDGET_SECONDARY_TEXT_COLOR;
        var margin = 15;

        for (var i = 0; i < widgets.length; ++i) {
            var w = widgets[i];
            var y = posY;
            if (w.y) {
                y = w.y;
            }
            w.last_y = y;
            ctx.strokeStyle = outline_color;
            ctx.fillStyle = "#222";
            ctx.textAlign = "left";
			if(w.disabled)
				ctx.globalAlpha *= 0.5;

            switch (w.type) {
                case "button":
                    if (w.clicked) {
                        ctx.fillStyle = "#AAA";
                        w.clicked = false;
                        this.dirty_canvas = true;
                    }
                    ctx.fillRect(margin, y, width - margin * 2, H);
					if(show_text && !w.disabled)
	                    ctx.strokeRect( margin, y, width - margin * 2, H );
                    if (show_text) {
                        ctx.textAlign = "center";
                        ctx.fillStyle = text_color;
                        ctx.fillText(w.name, width * 0.5, y + H * 0.7);
                    }
                    break;
                case "toggle":
                    ctx.textAlign = "left";
                    ctx.strokeStyle = outline_color;
                    ctx.fillStyle = background_color;
                    ctx.beginPath();
                    if (show_text)
	                    ctx.roundRect(margin, posY, width - margin * 2, H, H * 0.5);
					else
	                    ctx.rect(margin, posY, width - margin * 2, H );
                    ctx.fill();
					if(show_text && !w.disabled)
	                    ctx.stroke();
                    ctx.fillStyle = w.value ? "#89A" : "#333";
                    ctx.beginPath();
                    ctx.arc( width - margin * 2, y + H * 0.5, H * 0.36, 0, Math.PI * 2 );
                    ctx.fill();
                    if (show_text) {
                        ctx.fillStyle = secondary_text_color;
                        if (w.name != null) {
                            ctx.fillText(w.name, margin * 2, y + H * 0.7);
                        }
                        ctx.fillStyle = w.value ? text_color : secondary_text_color;
                        ctx.textAlign = "right";
                        ctx.fillText(
                            w.value
                                ? w.options.on || "true"
                                : w.options.off || "false",
                            width - 40,
                            y + H * 0.7
                        );
                    }
                    break;
                case "slider":
                    ctx.fillStyle = background_color;
                    ctx.fillRect(margin, y, width - margin * 2, H);
                    var range = w.options.max - w.options.min;
                    var nvalue = (w.value - w.options.min) / range;
                    ctx.fillStyle = active_widget == w ? "#89A" : "#678";
                    ctx.fillRect(margin, y, nvalue * (width - margin * 2), H);
					if(show_text && !w.disabled)
	                    ctx.strokeRect(margin, y, width - margin * 2, H);
                    if (w.marker) {
                        var marker_nvalue = (w.marker - w.options.min) / range;
                        ctx.fillStyle = "#AA9";
                        ctx.fillRect( margin + marker_nvalue * (width - margin * 2), y, 2, H );
                    }
                    if (show_text) {
                        ctx.textAlign = "center";
                        ctx.fillStyle = text_color;
                        ctx.fillText(
                            w.name + "  " + Number(w.value).toFixed(3),
                            width * 0.5,
                            y + H * 0.7
                        );
                    }
                    break;
                case "number":
                case "combo":
                    ctx.textAlign = "left";
                    ctx.strokeStyle = outline_color;
                    ctx.fillStyle = background_color;
                    ctx.beginPath();
					if(show_text)
	                    ctx.roundRect(margin, posY, width - margin * 2, H, H * 0.5);
					else
	                    ctx.rect(margin, posY, width - margin * 2, H );
                    ctx.fill();
                    if (show_text) {
						if(!w.disabled)
		                    ctx.stroke();
                        ctx.fillStyle = text_color;
						if(!w.disabled)
						{
							ctx.beginPath();
							ctx.moveTo(margin + 16, posY + 5);
							ctx.lineTo(margin + 6, posY + H * 0.5);
							ctx.lineTo(margin + 16, posY + H - 5);
							ctx.fill();
							ctx.beginPath();
							ctx.moveTo(width - margin - 16, posY + 5);
							ctx.lineTo(width - margin - 6, posY + H * 0.5);
							ctx.lineTo(width - margin - 16, posY + H - 5);
							ctx.fill();
						}
                        ctx.fillStyle = secondary_text_color;
                        ctx.fillText(w.name, margin * 2 + 5, y + H * 0.7);
                        ctx.fillStyle = text_color;
                        ctx.textAlign = "right";
                        if (w.type == "number") {
                            ctx.fillText(
                                Number(w.value).toFixed(
                                    w.options.precision !== undefined
                                        ? w.options.precision
                                        : 3
                                ),
                                width - margin * 2 - 20,
                                y + H * 0.7
                            );
                        } else {
							var v = w.value;
							if( w.options.values )
							{
								var values = w.options.values;
								if( values.constructor === Function )
									values = values();
								if(values && values.constructor !== Array)
									v = values[ w.value ];
							}
                            ctx.fillText(
                                v,
                                width - margin * 2 - 20,
                                y + H * 0.7
                            );
                        }
                    }
                    break;
                case "string":
                case "text":
                    ctx.textAlign = "left";
                    ctx.strokeStyle = outline_color;
                    ctx.fillStyle = background_color;
                    ctx.beginPath();
                    if (show_text)
	                    ctx.roundRect(margin, posY, width - margin * 2, H, H * 0.5);
					else
	                    ctx.rect( margin, posY, width - margin * 2, H );
                    ctx.fill();
                    if (show_text) {
						ctx.save();
						ctx.beginPath();
						ctx.rect(margin, posY, width - margin * 2, H);
						ctx.clip();

	                    ctx.stroke();
                        ctx.fillStyle = secondary_text_color;
                        if (w.name != null) {
                            ctx.fillText(w.name, margin * 2, y + H * 0.7);
                        }
                        ctx.fillStyle = text_color;
                        ctx.textAlign = "right";
                        ctx.fillText(String(w.value).substr(0,30), width - margin * 2, y + H * 0.7); //30 chars max
						ctx.restore();
                    }
                    break;
                default:
                    if (w.draw) {
                        w.draw(ctx, node, width, y, H);
                    }
                    break;
            }
            posY += (w.computeSize ? w.computeSize(width)[1] : H) + 4;
			ctx.globalAlpha = this.editor_alpha;

        }
        ctx.restore();
		ctx.textAlign = "left";
    };

    /**
     * process an event on widgets
     * @method processNodeWidgets
     **/
    LGraphCanvas.prototype.processNodeWidgets = function(
        node,
        pos,
        event,
        active_widget
    ) {
        if (!node.widgets || !node.widgets.length) {
            return null;
        }

        var x = pos[0] - node.pos[0];
        var y = pos[1] - node.pos[1];
        var width = node.size[0];
        var that = this;
        var ref_window = this.getCanvasWindow();

        for (var i = 0; i < node.widgets.length; ++i) {
            var w = node.widgets[i];
			if(!w || w.disabled)
				continue;
			var widget_height = w.computeSize ? w.computeSize(width)[1] : LiteGraph.NODE_WIDGET_HEIGHT;
            if ( w == active_widget || (x > 6 && x < width - 12 && y > w.last_y && y < w.last_y + widget_height) ) {
                //inside widget
                switch (w.type) {
                    case "button":
                        if (event.type === "mousemove") {
                            break;
                        }
                        if (w.callback) {
                            setTimeout(function() {
                                w.callback(w, that, node, pos, event);
                            }, 20);
                        }
                        w.clicked = true;
                        this.dirty_canvas = true;
                        break;
                    case "slider":
                        var range = w.options.max - w.options.min;
                        var nvalue = Math.clamp((x - 10) / (width - 20), 0, 1);
                        w.value =
                            w.options.min +
                            (w.options.max - w.options.min) * nvalue;
                        if (w.callback) {
                            setTimeout(function() {
                                inner_value_change(w, w.value);
                            }, 20);
                        }
                        this.dirty_canvas = true;
                        break;
                    case "number":
                    case "combo":
						var old_value = w.value;
                        if (event.type == "mousemove" && w.type == "number") {
                            w.value += event.deltaX * 0.1 * (w.options.step || 1);
                            if ( w.options.min != null && w.value < w.options.min ) {
                                w.value = w.options.min;
                            }
                            if ( w.options.max != null && w.value > w.options.max ) {
                                w.value = w.options.max;
                            }
                        } else if (event.type == "mousedown") {
                            var values = w.options.values;
                            if (values && values.constructor === Function) {
                                values = w.options.values(w, node);
                            }
							var values_list = null;
							
							if( w.type != "number")
								values_list = values.constructor === Array ? values : Object.keys(values);

                            var delta = x < 40 ? -1 : x > width - 40 ? 1 : 0;
                            if (w.type == "number") {
                                w.value += delta * 0.1 * (w.options.step || 1);
                                if ( w.options.min != null && w.value < w.options.min ) {
                                    w.value = w.options.min;
                                }
                                if ( w.options.max != null && w.value > w.options.max ) {
                                    w.value = w.options.max;
                                }
                            } else if (delta) { //clicked in arrow, used for combos 
								var index = -1;
								this.last_mouseclick = 0; //avoids dobl click event
								if(values.constructor === Object)
									index = values_list.indexOf( String( w.value ) ) + delta;
								else
									index = values_list.indexOf( w.value ) + delta;
                                if (index >= values_list.length) {
                                    index = values_list.length - 1;
                                }
                                if (index < 0) {
                                    index = 0;
                                }
								if( values.constructor === Array )
	                                w.value = values[index];
								else
	                                w.value = index;
                            } else { //combo clicked 
								var text_values = values != values_list ? Object.values(values) : values;
                                var menu = new LiteGraph.ContextMenu(text_values, {
                                        scale: Math.max(1, this.ds.scale),
                                        event: event,
                                        className: "dark",
                                        callback: inner_clicked.bind(w)
                                    },
                                    ref_window);
                                function inner_clicked(v, option, event) {
									if(values != values_list)
										v = text_values.indexOf(v);
                                    this.value = v;
                                    inner_value_change(this, v);
                                    that.dirty_canvas = true;
                                    return false;
                                }
                            }
                        } //end mousedown
						else if(event.type == "mouseup" && w.type == "number")
						{
                            var delta = x < 40 ? -1 : x > width - 40 ? 1 : 0;
							if (event.click_time < 200 && delta == 0) {
								this.prompt("Value",w.value,function(v) {
										this.value = Number(v);
										inner_value_change(this, this.value);
									}.bind(w),
									event);
							}
						}

						if( old_value != w.value )
							setTimeout(
								function() {
									inner_value_change(this, this.value);
								}.bind(w),
								20
							);
                        this.dirty_canvas = true;
                        break;
                    case "toggle":
                        if (event.type == "mousedown") {
                            w.value = !w.value;
							setTimeout(function() {
								inner_value_change(w, w.value);
                            }, 20);
                        }
                        break;
                    case "string":
                    case "text":
                        if (event.type == "mousedown") {
                            this.prompt("Value",w.value,function(v) {
                                    this.value = v;
                                    inner_value_change(this, v);
                                }.bind(w),
                                event);
                        }
                        break;
                    default:
                        if (w.mouse) {
                            this.dirty_canvas = w.mouse(event, [x, y], node);
                        }
                        break;
                } //end switch

                return w;
            }
        }

        function inner_value_change(widget, value) {
            widget.value = value;
            if ( widget.options && widget.options.property && node.properties[widget.options.property] !== undefined ) {
                node.setProperty( widget.options.property, value );
            }
            if (widget.callback) {
                widget.callback(widget.value, that, node, pos, event);
            }
        }

        return null;
    };

    /**
     * draws every group area in the background
     * @method drawGroups
     **/
    LGraphCanvas.prototype.drawGroups = function(canvas, ctx) {
        if (!this.graph) {
            return;
        }

        var groups = this.graph._groups;

        ctx.save();
        ctx.globalAlpha = 0.5 * this.editor_alpha;

        for (var i = 0; i < groups.length; ++i) {
            var group = groups[i];

            if (!overlapBounding(this.visible_area, group._bounding)) {
                continue;
            } //out of the visible area

            ctx.fillStyle = group.color || "#335";
            ctx.strokeStyle = group.color || "#335";
            var pos = group._pos;
            var size = group._size;
            ctx.globalAlpha = 0.25 * this.editor_alpha;
            ctx.beginPath();
            ctx.rect(pos[0] + 0.5, pos[1] + 0.5, size[0], size[1]);
            ctx.fill();
            ctx.globalAlpha = this.editor_alpha;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(pos[0] + size[0], pos[1] + size[1]);
            ctx.lineTo(pos[0] + size[0] - 10, pos[1] + size[1]);
            ctx.lineTo(pos[0] + size[0], pos[1] + size[1] - 10);
            ctx.fill();

            var font_size =
                group.font_size || LiteGraph.DEFAULT_GROUP_FONT_SIZE;
            ctx.font = font_size + "px Arial";
            ctx.fillText(group.title, pos[0] + 4, pos[1] + font_size);
        }

        ctx.restore();
    };

    LGraphCanvas.prototype.adjustNodesSize = function() {
        var nodes = this.graph._nodes;
        for (var i = 0; i < nodes.length; ++i) {
            nodes[i].size = nodes[i].computeSize();
        }
        this.setDirty(true, true);
    };

    /**
     * resizes the canvas to a given size, if no size is passed, then it tries to fill the parentNode
     * @method resize
     **/
    LGraphCanvas.prototype.resize = function(width, height) {
        if (!width && !height) {
            var parent = this.canvas.parentNode;
            width = parent.offsetWidth;
            height = parent.offsetHeight;
        }

        if (this.canvas.width == width && this.canvas.height == height) {
            return;
        }

        this.canvas.width = width;
        this.canvas.height = height;
        this.bgcanvas.width = this.canvas.width;
        this.bgcanvas.height = this.canvas.height;
        this.setDirty(true, true);
    };

    /**
     * switches to live mode (node shapes are not rendered, only the content)
     * this feature was designed when graphs where meant to create user interfaces
     * @method switchLiveMode
     **/
    LGraphCanvas.prototype.switchLiveMode = function(transition) {
        if (!transition) {
            this.live_mode = !this.live_mode;
            this.dirty_canvas = true;
            this.dirty_bgcanvas = true;
            return;
        }

        var self = this;
        var delta = this.live_mode ? 1.1 : 0.9;
        if (this.live_mode) {
            this.live_mode = false;
            this.editor_alpha = 0.1;
        }

        var t = setInterval(function() {
            self.editor_alpha *= delta;
            self.dirty_canvas = true;
            self.dirty_bgcanvas = true;

            if (delta < 1 && self.editor_alpha < 0.01) {
                clearInterval(t);
                if (delta < 1) {
                    self.live_mode = true;
                }
            }
            if (delta > 1 && self.editor_alpha > 0.99) {
                clearInterval(t);
                self.editor_alpha = 1;
            }
        }, 1);
    };

    LGraphCanvas.prototype.onNodeSelectionChange = function(node) {
        return; //disabled
    };

    LGraphCanvas.prototype.touchHandler = function(event) {
        //alert("foo");
        var touches = event.changedTouches,
            first = touches[0],
            type = "";

        switch (event.type) {
            case "touchstart":
                type = "mousedown";
                break;
            case "touchmove":
                type = "mousemove";
                break;
            case "touchend":
                type = "mouseup";
                break;
            default:
                return;
        }

        //initMouseEvent(type, canBubble, cancelable, view, clickCount,
        //           screenX, screenY, clientX, clientY, ctrlKey,
        //           altKey, shiftKey, metaKey, button, relatedTarget);

        var window = this.getCanvasWindow();
        var document = window.document;

        var simulatedEvent = document.createEvent("MouseEvent");
        simulatedEvent.initMouseEvent(
            type,
            true,
            true,
            window,
            1,
            first.screenX,
            first.screenY,
            first.clientX,
            first.clientY,
            false,
            false,
            false,
            false,
            0 /*left*/,
            null
        );
        first.target.dispatchEvent(simulatedEvent);
        event.preventDefault();
    };

    /* CONTEXT MENU ********************/

    LGraphCanvas.onGroupAdd = function(info, entry, mouse_event) {
        var canvas = LGraphCanvas.active_canvas;
        var ref_window = canvas.getCanvasWindow();

        var group = new LiteGraph.LGraphGroup();
        group.pos = canvas.convertEventToCanvasOffset(mouse_event);
        canvas.graph.add(group);
    };

    LGraphCanvas.onMenuAdd = function(node, options, e, prev_menu, callback) {
        var canvas = LGraphCanvas.active_canvas;
        var ref_window = canvas.getCanvasWindow();
		var graph = canvas.graph;
		if(!graph)
			return;

        var values = LiteGraph.getNodeTypesCategories( canvas.filter || graph.filter );
        var entries = [];
        for (var i in values) {
            if (values[i]) {
                entries.push({ value: values[i], content: values[i], has_submenu: true });
            }
        }

        //show categories
        var menu = new LiteGraph.ContextMenu( entries, { event: e, callback: inner_clicked, parentMenu: prev_menu }, ref_window );

        function inner_clicked(v, option, e) {
            var category = v.value;
            var node_types = LiteGraph.getNodeTypesInCategory( category, canvas.filter || graph.filter );
            var values = [];
            for (var i in node_types) {
                if (!node_types[i].skip_list) {
                    values.push({
                        content: node_types[i].title,
                        value: node_types[i].type
                    });
                }
            }

            new LiteGraph.ContextMenu( values, { event: e, callback: inner_create, parentMenu: menu }, ref_window );
            return false;
        }

        function inner_create(v, e) {
            var first_event = prev_menu.getFirstEvent();
            var node = LiteGraph.createNode(v.value);
            if (node) {
                node.pos = canvas.convertEventToCanvasOffset(first_event);
                canvas.graph.add(node);
            }
			if(callback)
				callback(node);
        }

        return false;
    };

    LGraphCanvas.onMenuCollapseAll = function() {};

    LGraphCanvas.onMenuNodeEdit = function() {};

    LGraphCanvas.showMenuNodeOptionalInputs = function(
        v,
        options,
        e,
        prev_menu,
        node
    ) {
        if (!node) {
            return;
        }

        var that = this;
        var canvas = LGraphCanvas.active_canvas;
        var ref_window = canvas.getCanvasWindow();

        var options = node.optional_inputs;
        if (node.onGetInputs) {
            options = node.onGetInputs();
        }

        var entries = [];
        if (options) {
            for (var i in options) {
                var entry = options[i];
                if (!entry) {
                    entries.push(null);
                    continue;
                }
                var label = entry[0];
                if (entry[2] && entry[2].label) {
                    label = entry[2].label;
                }
                var data = { content: label, value: entry };
                if (entry[1] == LiteGraph.ACTION) {
                    data.className = "event";
                }
                entries.push(data);
            }
        }

        if (this.onMenuNodeInputs) {
            entries = this.onMenuNodeInputs(entries);
        }

        if (!entries.length) {
			console.log("no input entries");
            return;
        }

        var menu = new LiteGraph.ContextMenu(
            entries,
            {
                event: e,
                callback: inner_clicked,
                parentMenu: prev_menu,
                node: node
            },
            ref_window
        );

        function inner_clicked(v, e, prev) {
            if (!node) {
                return;
            }

            if (v.callback) {
                v.callback.call(that, node, v, e, prev);
            }

            if (v.value) {
                node.addInput(v.value[0], v.value[1], v.value[2]);
                node.setDirtyCanvas(true, true);
            }
        }

        return false;
    };

    LGraphCanvas.showMenuNodeOptionalOutputs = function(
        v,
        options,
        e,
        prev_menu,
        node
    ) {
        if (!node) {
            return;
        }

        var that = this;
        var canvas = LGraphCanvas.active_canvas;
        var ref_window = canvas.getCanvasWindow();

        var options = node.optional_outputs;
        if (node.onGetOutputs) {
            options = node.onGetOutputs();
        }

        var entries = [];
        if (options) {
            for (var i in options) {
                var entry = options[i];
                if (!entry) {
                    //separator?
                    entries.push(null);
                    continue;
                }

                if (
                    node.flags &&
                    node.flags.skip_repeated_outputs &&
                    node.findOutputSlot(entry[0]) != -1
                ) {
                    continue;
                } //skip the ones already on
                var label = entry[0];
                if (entry[2] && entry[2].label) {
                    label = entry[2].label;
                }
                var data = { content: label, value: entry };
                if (entry[1] == LiteGraph.EVENT) {
                    data.className = "event";
                }
                entries.push(data);
            }
        }

        if (this.onMenuNodeOutputs) {
            entries = this.onMenuNodeOutputs(entries);
        }

        if (!entries.length) {
            return;
        }

        var menu = new LiteGraph.ContextMenu(
            entries,
            {
                event: e,
                callback: inner_clicked,
                parentMenu: prev_menu,
                node: node
            },
            ref_window
        );

        function inner_clicked(v, e, prev) {
            if (!node) {
                return;
            }

            if (v.callback) {
                v.callback.call(that, node, v, e, prev);
            }

            if (!v.value) {
                return;
            }

            var value = v.value[1];

            if (
                value &&
                (value.constructor === Object || value.constructor === Array)
            ) {
                //submenu why?
                var entries = [];
                for (var i in value) {
                    entries.push({ content: i, value: value[i] });
                }
                new LiteGraph.ContextMenu(entries, {
                    event: e,
                    callback: inner_clicked,
                    parentMenu: prev_menu,
                    node: node
                });
                return false;
            } else {
                node.addOutput(v.value[0], v.value[1], v.value[2]);
                node.setDirtyCanvas(true, true);
            }
        }

        return false;
    };

    LGraphCanvas.onShowMenuNodeProperties = function(
        value,
        options,
        e,
        prev_menu,
        node
    ) {
        if (!node || !node.properties) {
            return;
        }

        var that = this;
        var canvas = LGraphCanvas.active_canvas;
        var ref_window = canvas.getCanvasWindow();

        var entries = [];
        for (var i in node.properties) {
            var value = node.properties[i] !== undefined ? node.properties[i] : " ";
			if( typeof value == "object" )
				value = JSON.stringify(value);
            //value could contain invalid html characters, clean that
            value = LGraphCanvas.decodeHTML(value);
            entries.push({
                content:
                    "<span class='property_name'>" +
                    i +
                    "</span>" +
                    "<span class='property_value'>" +
                    value +
                    "</span>",
                value: i
            });
        }
        if (!entries.length) {
            return;
        }

        var menu = new LiteGraph.ContextMenu(
            entries,
            {
                event: e,
                callback: inner_clicked,
                parentMenu: prev_menu,
                allow_html: true,
                node: node
            },
            ref_window
        );

        function inner_clicked(v, options, e, prev) {
            if (!node) {
                return;
            }
            var rect = this.getBoundingClientRect();
            canvas.showEditPropertyValue(node, v.value, {
                position: [rect.left, rect.top]
            });
        }

        return false;
    };

    LGraphCanvas.decodeHTML = function(str) {
        var e = document.createElement("div");
        e.innerText = str;
        return e.innerHTML;
    };

    LGraphCanvas.onResizeNode = function(value, options, e, menu, node) {
        if (!node) {
            return;
        }
        node.size = node.computeSize();
        if (node.onResize)
            node.onResize(node.size);
        node.setDirtyCanvas(true, true);
    };

    LGraphCanvas.prototype.showLinkMenu = function(link, e) {
        var that = this;
		console.log(link);
		var options = ["Add Node",null,"Delete"];
        var menu = new LiteGraph.ContextMenu(options, {
            event: e,
			title: link.data != null ? link.data.constructor.name : null,
            callback: inner_clicked
        });

        function inner_clicked(v,options,e) {
            switch (v) {
                case "Add Node":
					LGraphCanvas.onMenuAdd(null, null, e, menu, function(node){
						console.log("node autoconnect");
						var node_left = that.graph.getNodeById( link.origin_id );
						var node_right = that.graph.getNodeById( link.target_id );
						if(!node.inputs || !node.inputs.length || !node.outputs || !node.outputs.length)
							return;
						if( node_left.outputs[ link.origin_slot ].type == node.inputs[0].type && node.outputs[0].type == node_right.inputs[0].type )
						{
							node_left.connect( link.origin_slot, node, 0 );
							node.connect( 0, node_right, link.target_slot );
							node.pos[0] -= node.size[0] * 0.5;
						}
					});
					break;
                case "Delete":
                    that.graph.removeLink(link.id);
                    break;
                default:
            }
        }

        return false;
    };

    LGraphCanvas.onShowPropertyEditor = function(item, options, e, menu, node) {
        var input_html = "";
        var property = item.property || "title";
        var value = node[property];

        var dialog = document.createElement("div");
        dialog.className = "graphdialog";
        dialog.innerHTML =
            "<span class='name'></span><input autofocus type='text' class='value'/><button>OK</button>";
        var title = dialog.querySelector(".name");
        title.innerText = property;
        var input = dialog.querySelector("input");
        if (input) {
            input.value = value;
            input.addEventListener("blur", function(e) {
                this.focus();
            });
            input.addEventListener("keydown", function(e) {
                if (e.keyCode != 13) {
                    return;
                }
                inner();
                e.preventDefault();
                e.stopPropagation();
            });
        }

        var graphcanvas = LGraphCanvas.active_canvas;
        var canvas = graphcanvas.canvas;

        var rect = canvas.getBoundingClientRect();
        var offsetx = -20;
        var offsety = -20;
        if (rect) {
            offsetx -= rect.left;
            offsety -= rect.top;
        }

        if (event) {
            dialog.style.left = event.clientX + offsetx + "px";
            dialog.style.top = event.clientY + offsety + "px";
        } else {
            dialog.style.left = canvas.width * 0.5 + offsetx + "px";
            dialog.style.top = canvas.height * 0.5 + offsety + "px";
        }

        var button = dialog.querySelector("button");
        button.addEventListener("click", inner);
        canvas.parentNode.appendChild(dialog);

        function inner() {
            setValue(input.value);
        }

        function setValue(value) {
            if (item.type == "Number") {
                value = Number(value);
            } else if (item.type == "Boolean") {
                value = Boolean(value);
            }
            node[property] = value;
            if (dialog.parentNode) {
                dialog.parentNode.removeChild(dialog);
            }
            node.setDirtyCanvas(true, true);
        }
    };

    LGraphCanvas.prototype.prompt = function(title, value, callback, event) {
        var that = this;
        var input_html = "";
        title = title || "";

        var modified = false;

        var dialog = document.createElement("div");
        dialog.className = "graphdialog rounded";
        dialog.innerHTML =
            "<span class='name'></span> <input autofocus type='text' class='value'/><button class='rounded'>OK</button>";
        dialog.close = function() {
            that.prompt_box = null;
            if (dialog.parentNode) {
                dialog.parentNode.removeChild(dialog);
            }
        };

        if (this.ds.scale > 1) {
            dialog.style.transform = "scale(" + this.ds.scale + ")";
        }

        dialog.addEventListener("mouseleave", function(e) {
            if (!modified) {
                dialog.close();
            }
        });

        if (that.prompt_box) {
            that.prompt_box.close();
        }
        that.prompt_box = dialog;

        var first = null;
        var timeout = null;
        var selected = null;

        var name_element = dialog.querySelector(".name");
        name_element.innerText = title;
        var value_element = dialog.querySelector(".value");
        value_element.value = value;

        var input = dialog.querySelector("input");
        input.addEventListener("keydown", function(e) {
            modified = true;
            if (e.keyCode == 27) {
                //ESC
                dialog.close();
            } else if (e.keyCode == 13) {
                if (callback) {
                    callback(this.value);
                }
                dialog.close();
            } else {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
        });

        var button = dialog.querySelector("button");
        button.addEventListener("click", function(e) {
            if (callback) {
                callback(input.value);
            }
            that.setDirty(true);
            dialog.close();
        });

        var graphcanvas = LGraphCanvas.active_canvas;
        var canvas = graphcanvas.canvas;

        var rect = canvas.getBoundingClientRect();
        var offsetx = -20;
        var offsety = -20;
        if (rect) {
            offsetx -= rect.left;
            offsety -= rect.top;
        }

        if (event) {
            dialog.style.left = event.clientX + offsetx + "px";
            dialog.style.top = event.clientY + offsety + "px";
        } else {
            dialog.style.left = canvas.width * 0.5 + offsetx + "px";
            dialog.style.top = canvas.height * 0.5 + offsety + "px";
        }

        canvas.parentNode.appendChild(dialog);
        setTimeout(function() {
            input.focus();
        }, 10);

        return dialog;
    };

    LGraphCanvas.search_limit = -1;
    LGraphCanvas.prototype.showSearchBox = function(event) {
        var that = this;
        var input_html = "";
        var graphcanvas = LGraphCanvas.active_canvas;
        var canvas = graphcanvas.canvas;
        var root_document = canvas.ownerDocument || document;

        var dialog = document.createElement("div");
        dialog.className = "litegraph litesearchbox graphdialog rounded";
        dialog.innerHTML =
            "<span class='name'>Search</span> <input autofocus type='text' class='value rounded'/><div class='helper'></div>";
        dialog.close = function() {
            that.search_box = null;
            root_document.body.focus();
			root_document.body.style.overflow = "";

            setTimeout(function() {
                that.canvas.focus();
            }, 20); //important, if canvas loses focus keys wont be captured
            if (dialog.parentNode) {
                dialog.parentNode.removeChild(dialog);
            }
        };

        var timeout_close = null;

        if (this.ds.scale > 1) {
            dialog.style.transform = "scale(" + this.ds.scale + ")";
        }

        dialog.addEventListener("mouseenter", function(e) {
            if (timeout_close) {
                clearTimeout(timeout_close);
                timeout_close = null;
            }
        });

        dialog.addEventListener("mouseleave", function(e) {
            //dialog.close();
            timeout_close = setTimeout(function() {
                dialog.close();
            }, 500);
        });

        if (that.search_box) {
            that.search_box.close();
        }
        that.search_box = dialog;

        var helper = dialog.querySelector(".helper");

        var first = null;
        var timeout = null;
        var selected = null;

        var input = dialog.querySelector("input");
        if (input) {
            input.addEventListener("blur", function(e) {
                this.focus();
            });
            input.addEventListener("keydown", function(e) {
                if (e.keyCode == 38) {
                    //UP
                    changeSelection(false);
                } else if (e.keyCode == 40) {
                    //DOWN
                    changeSelection(true);
                } else if (e.keyCode == 27) {
                    //ESC
                    dialog.close();
                } else if (e.keyCode == 13) {
                    if (selected) {
                        select(selected.innerHTML);
                    } else if (first) {
                        select(first);
                    } else {
                        dialog.close();
                    }
                } else {
                    if (timeout) {
                        clearInterval(timeout);
                    }
                    timeout = setTimeout(refreshHelper, 10);
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
				e.stopImmediatePropagation();
				return true;
            });
        }

		if( root_document.fullscreenElement )
	        root_document.fullscreenElement.appendChild(dialog);
		else
		{
		    root_document.body.appendChild(dialog);
			root_document.body.style.overflow = "hidden";
		}

        //compute best position
        var rect = canvas.getBoundingClientRect();

        var left = ( event ? event.clientX : (rect.left + rect.width * 0.5) ) - 80;
        var top = ( event ? event.clientY : (rect.top + rect.height * 0.5) ) - 20;
        dialog.style.left = left + "px";
        dialog.style.top = top + "px";

		//To avoid out of screen problems
		if(event.layerY > (rect.height - 200)) 
            helper.style.maxHeight = (rect.height - event.layerY - 20) + "px";

		/*
        var offsetx = -20;
        var offsety = -20;
        if (rect) {
            offsetx -= rect.left;
            offsety -= rect.top;
        }

        if (event) {
            dialog.style.left = event.clientX + offsetx + "px";
            dialog.style.top = event.clientY + offsety + "px";
        } else {
            dialog.style.left = canvas.width * 0.5 + offsetx + "px";
            dialog.style.top = canvas.height * 0.5 + offsety + "px";
        }
        canvas.parentNode.appendChild(dialog);
		*/

        input.focus();

        function select(name) {
            if (name) {
                if (that.onSearchBoxSelection) {
                    that.onSearchBoxSelection(name, event, graphcanvas);
                } else {
                    var extra = LiteGraph.searchbox_extras[name.toLowerCase()];
                    if (extra) {
                        name = extra.type;
                    }

                    var node = LiteGraph.createNode(name);
                    if (node) {
                        node.pos = graphcanvas.convertEventToCanvasOffset(
                            event
                        );
                        graphcanvas.graph.add(node);
                    }

                    if (extra && extra.data) {
                        if (extra.data.properties) {
                            for (var i in extra.data.properties) {
                                node.addProperty( i, extra.data.properties[i] );
                            }
                        }
                        if (extra.data.inputs) {
                            node.inputs = [];
                            for (var i in extra.data.inputs) {
                                node.addOutput(
                                    extra.data.inputs[i][0],
                                    extra.data.inputs[i][1]
                                );
                            }
                        }
                        if (extra.data.outputs) {
                            node.outputs = [];
                            for (var i in extra.data.outputs) {
                                node.addOutput(
                                    extra.data.outputs[i][0],
                                    extra.data.outputs[i][1]
                                );
                            }
                        }
                        if (extra.data.title) {
                            node.title = extra.data.title;
                        }
                        if (extra.data.json) {
                            node.configure(extra.data.json);
                        }
                    }
                }
            }

            dialog.close();
        }

        function changeSelection(forward) {
            var prev = selected;
            if (selected) {
                selected.classList.remove("selected");
            }
            if (!selected) {
                selected = forward
                    ? helper.childNodes[0]
                    : helper.childNodes[helper.childNodes.length];
            } else {
                selected = forward
                    ? selected.nextSibling
                    : selected.previousSibling;
                if (!selected) {
                    selected = prev;
                }
            }
            if (!selected) {
                return;
            }
            selected.classList.add("selected");
            selected.scrollIntoView({block: "end", behavior: "smooth"});
        }

        function refreshHelper() {
            timeout = null;
            var str = input.value;
            first = null;
            helper.innerHTML = "";
            if (!str) {
                return;
            }

            if (that.onSearchBox) {
                var list = that.onSearchBox(helper, str, graphcanvas);
                if (list) {
                    for (var i = 0; i < list.length; ++i) {
                        addResult(list[i]);
                    }
                }
            } else {
                var c = 0;
                str = str.toLowerCase();
				var filter = graphcanvas.filter || graphcanvas.graph.filter;

                //extras
                for (var i in LiteGraph.searchbox_extras) {
                    var extra = LiteGraph.searchbox_extras[i];
                    if (extra.desc.toLowerCase().indexOf(str) === -1) {
                        continue;
                    }
					var ctor = LiteGraph.registered_node_types[ extra.type ];
					if( ctor && ctor.filter && ctor.filter != filter )
						continue;
                    addResult( extra.desc, "searchbox_extra" );
                    if ( LGraphCanvas.search_limit !== -1 && c++ > LGraphCanvas.search_limit ) {
                        break;
                    }
                }

				var filtered = null;
                if (Array.prototype.filter) { //filter supported
                    var keys = Object.keys( LiteGraph.registered_node_types ); //types
                    var filtered = keys.filter( inner_test_filter );
                } else {
					filtered = [];
                    for (var i in LiteGraph.registered_node_types) {
						if( inner_test_filter(i) )
							filtered.push(i);
                    }
                }

				for (var i = 0; i < filtered.length; i++) {
					addResult(filtered[i]);
					if ( LGraphCanvas.search_limit !== -1 && c++ > LGraphCanvas.search_limit ) {
						break;
					}
				}

				function inner_test_filter( type )
				{
					var ctor = LiteGraph.registered_node_types[ type ];
					if(filter && ctor.filter != filter )
						return false;
					return type.toLowerCase().indexOf(str) !== -1;
				}
            }

            function addResult(type, className) {
                var help = document.createElement("div");
                if (!first) {
                    first = type;
                }
                help.innerText = type;
                help.dataset["type"] = escape(type);
                help.className = "litegraph lite-search-item";
                if (className) {
                    help.className += " " + className;
                }
                help.addEventListener("click", function(e) {
                    select(unescape(this.dataset["type"]));
                });
                helper.appendChild(help);
            }
        }

        return dialog;
    };

    LGraphCanvas.prototype.showEditPropertyValue = function( node, property, options ) {
        if (!node || node.properties[property] === undefined) {
            return;
        }

        options = options || {};
        var that = this;

        var info = node.getPropertyInfo(property);
		var type = info.type;

        var input_html = "";

        if (type == "string" || type == "number" || type == "array" || type == "object") {
            input_html = "<input autofocus type='text' class='value'/>";
        } else if (type == "enum" && info.values) {
            input_html = "<select autofocus type='text' class='value'>";
            for (var i in info.values) {
                var v = info.values.constructor === Array ? info.values[i] : i;
                input_html +=
                    "<option value='" +
                    v +
                    "' " +
                    (v == node.properties[property] ? "selected" : "") +
                    ">" +
                    info.values[i] +
                    "</option>";
            }
            input_html += "</select>";
        } else if (type == "boolean") {
            input_html =
                "<input autofocus type='checkbox' class='value' " +
                (node.properties[property] ? "checked" : "") +
                "/>";
        } else {
            console.warn("unknown type: " + type);
            return;
        }

        var dialog = this.createDialog(
            "<span class='name'>" +
                property +
                "</span>" +
                input_html +
                "<button>OK</button>",
            options
        );

        if (type == "enum" && info.values) {
            var input = dialog.querySelector("select");
            input.addEventListener("change", function(e) {
                setValue(e.target.value);
                //var index = e.target.value;
                //setValue( e.options[e.selectedIndex].value );
            });
        } else if (type == "boolean") {
            var input = dialog.querySelector("input");
            if (input) {
                input.addEventListener("click", function(e) {
                    setValue(!!input.checked);
                });
            }
        } else {
            var input = dialog.querySelector("input");
            if (input) {
                input.addEventListener("blur", function(e) {
                    this.focus();
                });
				var v = node.properties[property] !== undefined ? node.properties[property] : "";
				v = JSON.stringify(v);
                input.value = v;
                input.addEventListener("keydown", function(e) {
                    if (e.keyCode != 13) {
                        return;
                    }
                    inner();
                    e.preventDefault();
                    e.stopPropagation();
                });
            }
        }

        var button = dialog.querySelector("button");
        button.addEventListener("click", inner);

        function inner() {
            setValue(input.value);
        }

        function setValue(value) {
            if (typeof node.properties[property] == "number") {
                value = Number(value);
            }
            if (type == "array" || type == "object") {
                value = JSON.parse(value);
            }
            node.properties[property] = value;
            if (node._graph) {
                node._graph._version++;
            }
            if (node.onPropertyChanged) {
                node.onPropertyChanged(property, value);
            }
			if(options.onclose)
				options.onclose();
            dialog.close();
            node.setDirtyCanvas(true, true);
        }

		return dialog;
    };

    LGraphCanvas.prototype.createDialog = function(html, options) {
        options = options || {};

        var dialog = document.createElement("div");
        dialog.className = "graphdialog";
        dialog.innerHTML = html;

        var rect = this.canvas.getBoundingClientRect();
        var offsetx = -20;
        var offsety = -20;
        if (rect) {
            offsetx -= rect.left;
            offsety -= rect.top;
        }

        if (options.position) {
            offsetx += options.position[0];
            offsety += options.position[1];
        } else if (options.event) {
            offsetx += options.event.clientX;
            offsety += options.event.clientY;
        } //centered
        else {
            offsetx += this.canvas.width * 0.5;
            offsety += this.canvas.height * 0.5;
        }

        dialog.style.left = offsetx + "px";
        dialog.style.top = offsety + "px";

        this.canvas.parentNode.appendChild(dialog);

        dialog.close = function() {
            if (this.parentNode) {
                this.parentNode.removeChild(this);
            }
        };

        return dialog;
    };

	LGraphCanvas.prototype.createPanel = function(title, options) {
		options = options || {};

		var ref_window = options.window || window;
		var root = document.createElement("div");
		root.className = "litegraph dialog";
		root.innerHTML = "<div class='dialog-header'><span class='dialog-title'></span></div><div class='dialog-content'></div><div class='dialog-footer'></div>";
		root.header = root.querySelector(".dialog-header");

		if(options.width)
			root.style.width = options.width + (options.width.constructor === Number ? "px" : "");
		if(options.height)
			root.style.height = options.height + (options.height.constructor === Number ? "px" : "");
		if(options.closable)
		{
			var close = document.createElement("span");
			close.innerHTML = "&#10005;";
			close.classList.add("close");
			close.addEventListener("click",function(){
				root.close();
			});
			root.header.appendChild(close);
		}
		root.title_element = root.querySelector(".dialog-title");
		root.title_element.innerText = title;
		root.content = root.querySelector(".dialog-content");
		root.footer = root.querySelector(".dialog-footer");

		root.close = function()
		{
			this.parentNode.removeChild(this);
		}

		root.clear = function()
		{
			this.content.innerHTML = "";
		}

		root.addHTML = function(code, classname, on_footer)
		{
			var elem = document.createElement("div");
			if(classname)
				elem.className = classname;
			elem.innerHTML = code;
			if(on_footer)
				root.footer.appendChild(elem);
			else
				root.content.appendChild(elem);
			return elem;
		}

		root.addButton = function( name, callback, options )
		{
			var elem = document.createElement("button");
			elem.innerText = name;
			elem.options = options;
			elem.classList.add("btn");
			elem.addEventListener("click",callback);
			root.footer.appendChild(elem);
			return elem;
		}

		root.addSeparator = function()
		{
			var elem = document.createElement("div");
			elem.className = "separator";
			root.content.appendChild(elem);
		}

		root.addWidget = function( type, name, value, options, callback )
		{
			options = options || {};
			var str_value = String(value);
			if(type == "number")
				str_value = value.toFixed(3);

			var elem = document.createElement("div");
			elem.className = "property";
			elem.innerHTML = "<span class='property_name'></span><span class='property_value'></span>";
			elem.querySelector(".property_name").innerText = name;
			var value_element = elem.querySelector(".property_value");
			value_element.innerText = str_value;
			elem.dataset["property"] = name;
			elem.dataset["type"] = options.type || type;
			elem.options = options;
			elem.value = value;

			//if( type == "code" )
			//	elem.addEventListener("click", function(){ inner_showCodePad( node, this.dataset["property"] ); });
			if (type == "boolean")
			{
				elem.classList.add("boolean");
				if(value)
					elem.classList.add("bool-on");
				elem.addEventListener("click", function(){ 
					//var v = node.properties[this.dataset["property"]]; 
					//node.setProperty(this.dataset["property"],!v); this.innerText = v ? "true" : "false"; 
					var propname = this.dataset["property"];
					this.value = !this.value;
					this.classList.toggle("bool-on");
					this.querySelector(".property_value").innerText = this.value ? "true" : "false";
					innerChange(propname, this.value );
				});
			}
			else if (type == "string" || type == "number")
			{
				value_element.setAttribute("contenteditable",true);
				value_element.addEventListener("keydown", function(e){ 
					if(e.code == "Enter")
					{
						e.preventDefault();
						this.blur();
					}
				});
				value_element.addEventListener("blur", function(){ 
					var v = this.innerText;
					var propname = this.parentNode.dataset["property"];
					var proptype = this.parentNode.dataset["type"];
					if( proptype == "number")
						v = Number(v);
					innerChange(propname, v);
				});
			}
			else if (type == "enum")
				value_element.addEventListener("click", function(event){ 
					var values = options.values || [];
					var propname = this.parentNode.dataset["property"];
					var elem_that = this;
					var menu = new LiteGraph.ContextMenu(values,{
							event: event,
							className: "dark",
							callback: inner_clicked
						},
						ref_window);
					function inner_clicked(v, option, event) {
						//node.setProperty(propname,v); 
						//graphcanvas.dirty_canvas = true;
						elem_that.innerText = v;
						innerChange(propname,v);
						return false;
					}
				});

			root.content.appendChild(elem);

			function innerChange(name, value)
			{
				console.log("change",name,value);
				//that.dirty_canvas = true;
				if(options.callback)
					options.callback(name,value);
				if(callback)
					callback(name,value);
			}

			return elem;
		}

		return root;
	};

	LGraphCanvas.prototype.showShowNodePanel = function( node )
	{
		window.SELECTED_NODE = node;
		var panel = document.querySelector("#node-panel");
		if(panel)
			panel.close();
		var ref_window = this.getCanvasWindow();
		panel = this.createPanel(node.title || "",{closable: true, window: ref_window });
		panel.id = "node-panel";
		panel.node = node;
		panel.classList.add("settings");
		var that = this;
		var graphcanvas = this;

		function inner_refresh()
		{
			panel.content.innerHTML = ""; //clear
			panel.addHTML("<span class='node_type'>"+node.type+"</span><span class='node_desc'>"+(node.constructor.desc || "")+"</span><span class='separator'></span>");

			panel.addHTML("<h3>Properties</h3>");

			for(var i in node.properties)
			{
				var value = node.properties[i];
				var info = node.getPropertyInfo(i);
				var type = info.type || "string";

				//in case the user wants control over the side panel widget
				if( node.onAddPropertyToPanel && node.onAddPropertyToPanel(i,panel) )
					continue;

				panel.addWidget( info.widget || info.type, i, value, info, function(name,value){
					node.setProperty(name,value);
					graphcanvas.dirty_canvas = true;
				});
			}

			panel.addSeparator();

			if(node.onShowCustomPanelInfo)
				node.onShowCustomPanelInfo(panel);

			/*
			panel.addHTML("<h3>Connections</h3>");
			var connection_containers = panel.addHTML("<div class='inputs connections_side'></div><div class='outputs connections_side'></div>","connections");
			var inputs = connection_containers.querySelector(".inputs");
			var outputs = connection_containers.querySelector(".outputs");
			*/

			panel.addButton("Delete",function(){
				if(node.block_delete)
					return;
				node.graph.remove(node);
				panel.close();
			}).classList.add("delete");
		}

		function inner_showCodePad( node, propname )
		{
			panel.style.top = "calc( 50% - 250px)";
			panel.style.left = "calc( 50% - 400px)";
			panel.style.width = "800px";
			panel.style.height = "500px";

			if(window.CodeFlask) //disabled for now
			{
				panel.content.innerHTML = "<div class='code'></div>";
				var flask = new CodeFlask( "div.code", { language: 'js' });
				flask.updateCode(node.properties[propname]);
				flask.onUpdate( function(code) {
					node.setProperty(propname, code);
				});
			}
			else
			{
				panel.content.innerHTML = "<textarea class='code'></textarea>";
				var textarea = panel.content.querySelector("textarea");
				textarea.value = node.properties[propname];
				textarea.addEventListener("keydown", function(e){
					//console.log(e);
					if(e.code == "Enter" && e.ctrlKey )
					{
						console.log("Assigned");
						node.setProperty(propname, textarea.value);
					}
				});
				textarea.style.height = "calc(100% - 40px)";
			}
			var assign = that.createButton( "Assign", null, function(){
				node.setProperty(propname, textarea.value);
			});
			panel.content.appendChild(assign);
			var button = that.createButton( "Close", null, function(){
				panel.style.height = "";
				inner_refresh();
			});
			button.style.float = "right";
			panel.content.appendChild(button);
		}

		inner_refresh();

		this.canvas.parentNode.appendChild( panel );
	}
	
	LGraphCanvas.prototype.showSubgraphPropertiesDialog = function(node)
	{
		console.log("showing subgraph properties dialog");

		var old_panel = this.canvas.parentNode.querySelector(".subgraph_dialog");
		if(old_panel)
			old_panel.close();

		var panel = this.createPanel("Subgraph Inputs",{closable:true, width: 500});
		panel.node = node;
		panel.classList.add("subgraph_dialog");

		function inner_refresh()
		{
			panel.clear();

			//show currents
			if(node.inputs)
				for(var i = 0; i < node.inputs.length; ++i)
				{
					var input = node.inputs[i];
					if(input.not_subgraph_input)
						continue;
					var html = "<button>&#10005;</button> <span class='bullet_icon'></span><span class='name'></span><span class='type'></span>";
					var elem = panel.addHTML(html,"subgraph_property");
					elem.dataset["name"] = input.name;
					elem.dataset["slot"] = i;
					elem.querySelector(".name").innerText = input.name;
					elem.querySelector(".type").innerText = input.type;
					elem.querySelector("button").addEventListener("click",function(e){
						node.removeInput( Number( this.parentNode.dataset["slot"] ) );
						inner_refresh();
					});
				}
		}

		//add extra
		var html = " + <span class='label'>Name</span><input class='name'/><span class='label'>Type</span><input class='type'></input><button>+</button>";
		var elem = panel.addHTML(html,"subgraph_property extra", true);
		elem.querySelector("button").addEventListener("click", function(e){
			var elem = this.parentNode;
			var name = elem.querySelector(".name").value;
			var type = elem.querySelector(".type").value;
			if(!name || node.findInputSlot(name) != -1)
				return;
			node.addInput(name,type);
			elem.querySelector(".name").value = "";
			elem.querySelector(".type").value = "";
			inner_refresh();
		});

		inner_refresh();
	    this.canvas.parentNode.appendChild(panel);
		return panel;
	}

	LGraphCanvas.prototype.checkPanels = function()
	{
		if(!this.canvas)
			return;
		var panels = this.canvas.parentNode.querySelectorAll(".litegraph.dialog");
		for(var i = 0; i < panels.length; ++i)
		{
			var panel = panels[i];
			if( !panel.node )
				continue;
			if( !panel.node.graph || panel.graph != this.graph )
				panel.close();
		}
	}

    LGraphCanvas.onMenuNodeCollapse = function(value, options, e, menu, node) {
        node.collapse();
    };

    LGraphCanvas.onMenuNodePin = function(value, options, e, menu, node) {
        node.pin();
    };

    LGraphCanvas.onMenuNodeMode = function(value, options, e, menu, node) {
        new LiteGraph.ContextMenu(
            ["Always", "On Event", "On Trigger", "Never"],
            { event: e, callback: inner_clicked, parentMenu: menu, node: node }
        );

        function inner_clicked(v) {
            if (!node) {
                return;
            }
            switch (v) {
                case "On Event":
                    node.mode = LiteGraph.ON_EVENT;
                    break;
                case "On Trigger":
                    node.mode = LiteGraph.ON_TRIGGER;
                    break;
                case "Never":
                    node.mode = LiteGraph.NEVER;
                    break;
                case "Always":
                default:
                    node.mode = LiteGraph.ALWAYS;
                    break;
            }
        }

        return false;
    };

    LGraphCanvas.onMenuNodeColors = function(value, options, e, menu, node) {
        if (!node) {
            throw "no node for color";
        }

        var values = [];
        values.push({
            value: null,
            content:
                "<span style='display: block; padding-left: 4px;'>No color</span>"
        });

        for (var i in LGraphCanvas.node_colors) {
            var color = LGraphCanvas.node_colors[i];
            var value = {
                value: i,
                content:
                    "<span style='display: block; color: #999; padding-left: 4px; border-left: 8px solid " +
                    color.color +
                    "; background-color:" +
                    color.bgcolor +
                    "'>" +
                    i +
                    "</span>"
            };
            values.push(value);
        }
        new LiteGraph.ContextMenu(values, {
            event: e,
            callback: inner_clicked,
            parentMenu: menu,
            node: node
        });

        function inner_clicked(v) {
            if (!node) {
                return;
            }

            var color = v.value ? LGraphCanvas.node_colors[v.value] : null;
            if (color) {
                if (node.constructor === LiteGraph.LGraphGroup) {
                    node.color = color.groupcolor;
                } else {
                    node.color = color.color;
                    node.bgcolor = color.bgcolor;
                }
            } else {
                delete node.color;
                delete node.bgcolor;
            }
            node.setDirtyCanvas(true, true);
        }

        return false;
    };

    LGraphCanvas.onMenuNodeShapes = function(value, options, e, menu, node) {
        if (!node) {
            throw "no node passed";
        }

        new LiteGraph.ContextMenu(LiteGraph.VALID_SHAPES, {
            event: e,
            callback: inner_clicked,
            parentMenu: menu,
            node: node
        });

        function inner_clicked(v) {
            if (!node) {
                return;
            }
            node.shape = v;
            node.setDirtyCanvas(true);
        }

        return false;
    };

    LGraphCanvas.onMenuNodeRemove = function(value, options, e, menu, node) {
        if (!node) {
            throw "no node passed";
        }

        if (node.removable === false) {
            return;
        }

        node.graph.remove(node);
        node.setDirtyCanvas(true, true);
    };

    LGraphCanvas.onMenuNodeToSubgraph = function(value, options, e, menu, node) {
		var graph = node.graph;
		var graphcanvas = LGraphCanvas.active_canvas;
		if(!graphcanvas) //??
			return;

		var nodes_list = Object.values( graphcanvas.selected_nodes || {} );
		if( !nodes_list.length )
			nodes_list = [ node ];

		var subgraph_node = LiteGraph.createNode("graph/subgraph");
		subgraph_node.pos = node.pos.concat();
		graph.add(subgraph_node);

		subgraph_node.buildFromNodes( nodes_list );

		graphcanvas.deselectAllNodes();
        node.setDirtyCanvas(true, true);
    };

    LGraphCanvas.onMenuNodeClone = function(value, options, e, menu, node) {
        if (node.clonable == false) {
            return;
        }
        var newnode = node.clone();
        if (!newnode) {
            return;
        }
        newnode.pos = [node.pos[0] + 5, node.pos[1] + 5];
        node.graph.add(newnode);
        node.setDirtyCanvas(true, true);
    };

    LGraphCanvas.node_colors = {
        red: { color: "#322", bgcolor: "#533", groupcolor: "#A88" },
        brown: { color: "#332922", bgcolor: "#593930", groupcolor: "#b06634" },
        green: { color: "#232", bgcolor: "#353", groupcolor: "#8A8" },
        blue: { color: "#223", bgcolor: "#335", groupcolor: "#88A" },
        pale_blue: {
            color: "#2a363b",
            bgcolor: "#3f5159",
            groupcolor: "#3f789e"
        },
        cyan: { color: "#233", bgcolor: "#355", groupcolor: "#8AA" },
        purple: { color: "#323", bgcolor: "#535", groupcolor: "#a1309b" },
        yellow: { color: "#432", bgcolor: "#653", groupcolor: "#b58b2a" },
        black: { color: "#222", bgcolor: "#000", groupcolor: "#444" }
    };

    LGraphCanvas.prototype.getCanvasMenuOptions = function() {
        var options = null;
        if (this.getMenuOptions) {
            options = this.getMenuOptions();
        } else {
            options = [
                {
                    content: "Add Node",
                    has_submenu: true,
                    callback: LGraphCanvas.onMenuAdd
                },
                { content: "Add Group", callback: LGraphCanvas.onGroupAdd }
                //{content:"Collapse All", callback: LGraphCanvas.onMenuCollapseAll }
            ];

            if (this._graph_stack && this._graph_stack.length > 0) {
                options.push(null, {
                    content: "Close subgraph",
                    callback: this.closeSubgraph.bind(this)
                });
            }
        }

        if (this.getExtraMenuOptions) {
            var extra = this.getExtraMenuOptions(this, options);
            if (extra) {
                options = options.concat(extra);
            }
        }

        return options;
    };

    //called by processContextMenu to extract the menu list
    LGraphCanvas.prototype.getNodeMenuOptions = function(node) {
        var options = null;

        if (node.getMenuOptions) {
            options = node.getMenuOptions(this);
        } else {
            options = [
                {
                    content: "Inputs",
                    has_submenu: true,
                    disabled: true,
                    callback: LGraphCanvas.showMenuNodeOptionalInputs
                },
                {
                    content: "Outputs",
                    has_submenu: true,
                    disabled: true,
                    callback: LGraphCanvas.showMenuNodeOptionalOutputs
                },
                null,
                {
                    content: "Properties",
                    has_submenu: true,
                    callback: LGraphCanvas.onShowMenuNodeProperties
                },
                null,
                {
                    content: "Title",
                    callback: LGraphCanvas.onShowPropertyEditor
                },
                {
                    content: "Mode",
                    has_submenu: true,
                    callback: LGraphCanvas.onMenuNodeMode
                },
                { content: "Resize", callback: LGraphCanvas.onResizeNode },
                {
                    content: "Collapse",
                    callback: LGraphCanvas.onMenuNodeCollapse
                },
                { content: "Pin", callback: LGraphCanvas.onMenuNodePin },
                {
                    content: "Colors",
                    has_submenu: true,
                    callback: LGraphCanvas.onMenuNodeColors
                },
                {
                    content: "Shapes",
                    has_submenu: true,
                    callback: LGraphCanvas.onMenuNodeShapes
                },
                null
            ];
        }

        if (node.onGetInputs) {
            var inputs = node.onGetInputs();
            if (inputs && inputs.length) {
                options[0].disabled = false;
            }
        }

        if (node.onGetOutputs) {
            var outputs = node.onGetOutputs();
            if (outputs && outputs.length) {
                options[1].disabled = false;
            }
        }

        if (node.getExtraMenuOptions) {
            var extra = node.getExtraMenuOptions(this);
            if (extra) {
                extra.push(null);
                options = extra.concat(options);
            }
        }

        if (node.clonable !== false) {
            options.push({
                content: "Clone",
                callback: LGraphCanvas.onMenuNodeClone
            });
        }

		if(0) //TODO
		options.push({
			content: "To Subgraph",
			callback: LGraphCanvas.onMenuNodeToSubgraph
		});

		options.push(null, {
			content: "Remove",
			disabled: !(node.removable !== false && !node.block_delete ),
			callback: LGraphCanvas.onMenuNodeRemove
		});

        if (node.graph && node.graph.onGetNodeMenuOptions) {
            node.graph.onGetNodeMenuOptions(options, node);
        }

        return options;
    };

    LGraphCanvas.prototype.getGroupMenuOptions = function(node) {
        var o = [
            { content: "Title", callback: LGraphCanvas.onShowPropertyEditor },
            {
                content: "Color",
                has_submenu: true,
                callback: LGraphCanvas.onMenuNodeColors
            },
            {
                content: "Font size",
                property: "font_size",
                type: "Number",
                callback: LGraphCanvas.onShowPropertyEditor
            },
            null,
            { content: "Remove", callback: LGraphCanvas.onMenuNodeRemove }
        ];

        return o;
    };

    LGraphCanvas.prototype.processContextMenu = function(node, event) {
        var that = this;
        var canvas = LGraphCanvas.active_canvas;
        var ref_window = canvas.getCanvasWindow();

        var menu_info = null;
        var options = {
            event: event,
            callback: inner_option_clicked,
            extra: node
        };

		if(node)
			options.title = node.type;

        //check if mouse is in input
        var slot = null;
        if (node) {
            slot = node.getSlotInPosition(event.canvasX, event.canvasY);
            LGraphCanvas.active_node = node;
        }

        if (slot) {
            //on slot
            menu_info = [];
            if (node.getSlotMenuOptions) {
                menu_info = node.getSlotMenuOptions(slot);
            } else {
                if (
                    slot &&
                    slot.output &&
                    slot.output.links &&
                    slot.output.links.length
                ) {
                    menu_info.push({ content: "Disconnect Links", slot: slot });
                }
                var _slot = slot.input || slot.output;
                menu_info.push(
                    _slot.locked
                        ? "Cannot remove"
                        : { content: "Remove Slot", slot: slot }
                );
                menu_info.push(
                    _slot.nameLocked
                        ? "Cannot rename"
                        : { content: "Rename Slot", slot: slot }
                );
    
            }
            options.title =
                (slot.input ? slot.input.type : slot.output.type) || "*";
            if (slot.input && slot.input.type == LiteGraph.ACTION) {
                options.title = "Action";
            }
            if (slot.output && slot.output.type == LiteGraph.EVENT) {
                options.title = "Event";
            }
        } else {
            if (node) {
                //on node
                menu_info = this.getNodeMenuOptions(node);
            } else {
                menu_info = this.getCanvasMenuOptions();
                var group = this.graph.getGroupOnPos(
                    event.canvasX,
                    event.canvasY
                );
                if (group) {
                    //on group
                    menu_info.push(null, {
                        content: "Edit Group",
                        has_submenu: true,
                        submenu: {
                            title: "Group",
                            extra: group,
                            options: this.getGroupMenuOptions(group)
                        }
                    });
                }
            }
        }

        //show menu
        if (!menu_info) {
            return;
        }

        var menu = new LiteGraph.ContextMenu(menu_info, options, ref_window);

        function inner_option_clicked(v, options, e) {
            if (!v) {
                return;
            }

            if (v.content == "Remove Slot") {
                var info = v.slot;
                if (info.input) {
                    node.removeInput(info.slot);
                } else if (info.output) {
                    node.removeOutput(info.slot);
                }
                return;
            } else if (v.content == "Disconnect Links") {
                var info = v.slot;
                if (info.output) {
                    node.disconnectOutput(info.slot);
                } else if (info.input) {
                    node.disconnectInput(info.slot);
                }
                return;
            } else if (v.content == "Rename Slot") {
                var info = v.slot;
                var slot_info = info.input
                    ? node.getInputInfo(info.slot)
                    : node.getOutputInfo(info.slot);
                var dialog = that.createDialog(
                    "<span class='name'>Name</span><input autofocus type='text'/><button>OK</button>",
                    options
                );
                var input = dialog.querySelector("input");
                if (input && slot_info) {
                    input.value = slot_info.label || "";
                }
                dialog
                    .querySelector("button")
                    .addEventListener("click", function(e) {
                        if (input.value) {
                            if (slot_info) {
                                slot_info.label = input.value;
                            }
                            that.setDirty(true);
                        }
                        dialog.close();
                    });
            }

            //if(v.callback)
            //	return v.callback.call(that, node, options, e, menu, that, event );
        }
    };

    //API *************************************************
    //like rect but rounded corners
    if (typeof(window) != "undefined" && window.CanvasRenderingContext2D) {
        window.CanvasRenderingContext2D.prototype.roundRect = function(
            x,
            y,
            width,
            height,
            radius,
            radius_low
        ) {
            if (radius === undefined) {
                radius = 5;
            }

            if (radius_low === undefined) {
                radius_low = radius;
            }

            this.moveTo(x + radius, y);
            this.lineTo(x + width - radius, y);
            this.quadraticCurveTo(x + width, y, x + width, y + radius);

            this.lineTo(x + width, y + height - radius_low);
            this.quadraticCurveTo(
                x + width,
                y + height,
                x + width - radius_low,
                y + height
            );
            this.lineTo(x + radius_low, y + height);
            this.quadraticCurveTo(x, y + height, x, y + height - radius_low);
            this.lineTo(x, y + radius);
            this.quadraticCurveTo(x, y, x + radius, y);
        };
    }

    function compareObjects(a, b) {
        for (var i in a) {
            if (a[i] != b[i]) {
                return false;
            }
        }
        return true;
    }
    LiteGraph.compareObjects = compareObjects;

    function distance(a, b) {
        return Math.sqrt(
            (b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1])
        );
    }
    LiteGraph.distance = distance;

    function colorToString(c) {
        return (
            "rgba(" +
            Math.round(c[0] * 255).toFixed() +
            "," +
            Math.round(c[1] * 255).toFixed() +
            "," +
            Math.round(c[2] * 255).toFixed() +
            "," +
            (c.length == 4 ? c[3].toFixed(2) : "1.0") +
            ")"
        );
    }
    LiteGraph.colorToString = colorToString;

    function isInsideRectangle(x, y, left, top, width, height) {
        if (left < x && left + width > x && top < y && top + height > y) {
            return true;
        }
        return false;
    }
    LiteGraph.isInsideRectangle = isInsideRectangle;

    //[minx,miny,maxx,maxy]
    function growBounding(bounding, x, y) {
        if (x < bounding[0]) {
            bounding[0] = x;
        } else if (x > bounding[2]) {
            bounding[2] = x;
        }

        if (y < bounding[1]) {
            bounding[1] = y;
        } else if (y > bounding[3]) {
            bounding[3] = y;
        }
    }
    LiteGraph.growBounding = growBounding;

    //point inside bounding box
    function isInsideBounding(p, bb) {
        if (
            p[0] < bb[0][0] ||
            p[1] < bb[0][1] ||
            p[0] > bb[1][0] ||
            p[1] > bb[1][1]
        ) {
            return false;
        }
        return true;
    }
    LiteGraph.isInsideBounding = isInsideBounding;

    //bounding overlap, format: [ startx, starty, width, height ]
    function overlapBounding(a, b) {
        var A_end_x = a[0] + a[2];
        var A_end_y = a[1] + a[3];
        var B_end_x = b[0] + b[2];
        var B_end_y = b[1] + b[3];

        if (
            a[0] > B_end_x ||
            a[1] > B_end_y ||
            A_end_x < b[0] ||
            A_end_y < b[1]
        ) {
            return false;
        }
        return true;
    }
    LiteGraph.overlapBounding = overlapBounding;

    //Convert a hex value to its decimal value - the inputted hex must be in the
    //	format of a hex triplet - the kind we use for HTML colours. The function
    //	will return an array with three values.
    function hex2num(hex) {
        if (hex.charAt(0) == "#") {
            hex = hex.slice(1);
        } //Remove the '#' char - if there is one.
        hex = hex.toUpperCase();
        var hex_alphabets = "0123456789ABCDEF";
        var value = new Array(3);
        var k = 0;
        var int1, int2;
        for (var i = 0; i < 6; i += 2) {
            int1 = hex_alphabets.indexOf(hex.charAt(i));
            int2 = hex_alphabets.indexOf(hex.charAt(i + 1));
            value[k] = int1 * 16 + int2;
            k++;
        }
        return value;
    }

    LiteGraph.hex2num = hex2num;

    //Give a array with three values as the argument and the function will return
    //	the corresponding hex triplet.
    function num2hex(triplet) {
        var hex_alphabets = "0123456789ABCDEF";
        var hex = "#";
        var int1, int2;
        for (var i = 0; i < 3; i++) {
            int1 = triplet[i] / 16;
            int2 = triplet[i] % 16;

            hex += hex_alphabets.charAt(int1) + hex_alphabets.charAt(int2);
        }
        return hex;
    }

    LiteGraph.num2hex = num2hex;

    /* LiteGraph GUI elements used for canvas editing *************************************/

    /**
     * ContextMenu from LiteGUI
     *
     * @class ContextMenu
     * @constructor
     * @param {Array} values (allows object { title: "Nice text", callback: function ... })
     * @param {Object} options [optional] Some options:\
     * - title: title to show on top of the menu
     * - callback: function to call when an option is clicked, it receives the item information
     * - ignore_item_callbacks: ignores the callback inside the item, it just calls the options.callback
     * - event: you can pass a MouseEvent, this way the ContextMenu appears in that position
     */
    function ContextMenu(values, options) {
        options = options || {};
        this.options = options;
        var that = this;

        //to link a menu with its parent
        if (options.parentMenu) {
            if (options.parentMenu.constructor !== this.constructor) {
                console.error(
                    "parentMenu must be of class ContextMenu, ignoring it"
                );
                options.parentMenu = null;
            } else {
                this.parentMenu = options.parentMenu;
                this.parentMenu.lock = true;
                this.parentMenu.current_submenu = this;
            }
        }

		var eventClass = null;
		if(options.event) //use strings because comparing classes between windows doesnt work
			eventClass = options.event.constructor.name;
        if ( eventClass !== "MouseEvent" &&
            eventClass !== "CustomEvent" &&
			eventClass !== "PointerEvent"
        ) {
            console.error(
                "Event passed to ContextMenu is not of type MouseEvent or CustomEvent. Ignoring it."
            );
            options.event = null;
        }

        var root = document.createElement("div");
        root.className = "litegraph litecontextmenu litemenubar-panel";
        if (options.className) {
            root.className += " " + options.className;
        }
        root.style.minWidth = 100;
        root.style.minHeight = 1;
        root.style.pointerEvents = "none";
        setTimeout(function() {
            root.style.pointerEvents = "auto";
        }, 100); //delay so the mouse up event is not caught by this element

        //this prevents the default context browser menu to open in case this menu was created when pressing right button
        root.addEventListener(
            "mouseup",
            function(e) {
                e.preventDefault();
                return true;
            },
            true
        );
        root.addEventListener(
            "contextmenu",
            function(e) {
                if (e.button != 2) {
                    //right button
                    return false;
                }
                e.preventDefault();
                return false;
            },
            true
        );

        root.addEventListener(
            "mousedown",
            function(e) {
                if (e.button == 2) {
                    that.close();
                    e.preventDefault();
                    return true;
                }
            },
            true
        );

        function on_mouse_wheel(e) {
            var pos = parseInt(root.style.top);
            root.style.top =
                (pos + e.deltaY * options.scroll_speed).toFixed() + "px";
            e.preventDefault();
            return true;
        }

        if (!options.scroll_speed) {
            options.scroll_speed = 0.1;
        }

        root.addEventListener("wheel", on_mouse_wheel, true);
        root.addEventListener("mousewheel", on_mouse_wheel, true);

        this.root = root;

        //title
        if (options.title) {
            var element = document.createElement("div");
            element.className = "litemenu-title";
            element.innerHTML = options.title;
            root.appendChild(element);
        }

        //entries
        var num = 0;
        for (var i in values) {
            var name = values.constructor == Array ? values[i] : i;
            if (name != null && name.constructor !== String) {
                name = name.content === undefined ? String(name) : name.content;
            }
            var value = values[i];
            this.addItem(name, value, options);
            num++;
        }

        //close on leave
        root.addEventListener("mouseleave", function(e) {
            if (that.lock) {
                return;
            }
            if (root.closing_timer) {
                clearTimeout(root.closing_timer);
            }
            root.closing_timer = setTimeout(that.close.bind(that, e), 500);
            //that.close(e);
        });

        root.addEventListener("mouseenter", function(e) {
            if (root.closing_timer) {
                clearTimeout(root.closing_timer);
            }
        });

        //insert before checking position
        var root_document = document;
        if (options.event) {
            root_document = options.event.target.ownerDocument;
        }

        if (!root_document) {
            root_document = document;
        }

		if( root_document.fullscreenElement )
	        root_document.fullscreenElement.appendChild(root);
		else
		    root_document.body.appendChild(root);

        //compute best position
        var left = options.left || 0;
        var top = options.top || 0;
        if (options.event) {
            left = options.event.clientX - 10;
            top = options.event.clientY - 10;
            if (options.title) {
                top -= 20;
            }

            if (options.parentMenu) {
                var rect = options.parentMenu.root.getBoundingClientRect();
                left = rect.left + rect.width;
            }

            var body_rect = document.body.getBoundingClientRect();
            var root_rect = root.getBoundingClientRect();
			if(body_rect.height == 0)
				console.error("document.body height is 0. That is dangerous, set html,body { height: 100%; }");

            if (body_rect.width && left > body_rect.width - root_rect.width - 10) {
                left = body_rect.width - root_rect.width - 10;
            }
            if (body_rect.height && top > body_rect.height - root_rect.height - 10) {
                top = body_rect.height - root_rect.height - 10;
            }
        }

        root.style.left = left + "px";
        root.style.top = top + "px";

        if (options.scale) {
            root.style.transform = "scale(" + options.scale + ")";
        }
    }

    ContextMenu.prototype.addItem = function(name, value, options) {
        var that = this;
        options = options || {};

        var element = document.createElement("div");
        element.className = "litemenu-entry submenu";

        var disabled = false;

        if (value === null) {
            element.classList.add("separator");
            //element.innerHTML = "<hr/>"
            //continue;
        } else {
            element.innerHTML = value && value.title ? value.title : name;
            element.value = value;

            if (value) {
                if (value.disabled) {
                    disabled = true;
                    element.classList.add("disabled");
                }
                if (value.submenu || value.has_submenu) {
                    element.classList.add("has_submenu");
                }
            }

            if (typeof value == "function") {
                element.dataset["value"] = name;
                element.onclick_callback = value;
            } else {
                element.dataset["value"] = value;
            }

            if (value.className) {
                element.className += " " + value.className;
            }
        }

        this.root.appendChild(element);
        if (!disabled) {
            element.addEventListener("click", inner_onclick);
        }
        if (options.autoopen) {
            element.addEventListener("mouseenter", inner_over);
        }

        function inner_over(e) {
            var value = this.value;
            if (!value || !value.has_submenu) {
                return;
            }
            //if it is a submenu, autoopen like the item was clicked
            inner_onclick.call(this, e);
        }

        //menu option clicked
        function inner_onclick(e) {
            var value = this.value;
            var close_parent = true;

            if (that.current_submenu) {
                that.current_submenu.close(e);
            }

            //global callback
            if (options.callback) {
                var r = options.callback.call(
                    this,
                    value,
                    options,
                    e,
                    that,
                    options.node
                );
                if (r === true) {
                    close_parent = false;
                }
            }

            //special cases
            if (value) {
                if (
                    value.callback &&
                    !options.ignore_item_callbacks &&
                    value.disabled !== true
                ) {
                    //item callback
                    var r = value.callback.call(
                        this,
                        value,
                        options,
                        e,
                        that,
                        options.extra
                    );
                    if (r === true) {
                        close_parent = false;
                    }
                }
                if (value.submenu) {
                    if (!value.submenu.options) {
                        throw "ContextMenu submenu needs options";
                    }
                    var submenu = new that.constructor(value.submenu.options, {
                        callback: value.submenu.callback,
                        event: e,
                        parentMenu: that,
                        ignore_item_callbacks:
                            value.submenu.ignore_item_callbacks,
                        title: value.submenu.title,
                        extra: value.submenu.extra,
                        autoopen: options.autoopen
                    });
                    close_parent = false;
                }
            }

            if (close_parent && !that.lock) {
                that.close();
            }
        }

        return element;
    };

    ContextMenu.prototype.close = function(e, ignore_parent_menu) {
        if (this.root.parentNode) {
            this.root.parentNode.removeChild(this.root);
        }
        if (this.parentMenu && !ignore_parent_menu) {
            this.parentMenu.lock = false;
            this.parentMenu.current_submenu = null;
            if (e === undefined) {
                this.parentMenu.close();
            } else if (
                e &&
                !ContextMenu.isCursorOverElement(e, this.parentMenu.root)
            ) {
                ContextMenu.trigger(this.parentMenu.root, "mouseleave", e);
            }
        }
        if (this.current_submenu) {
            this.current_submenu.close(e, true);
        }

        if (this.root.closing_timer) {
            clearTimeout(this.root.closing_timer);
        }
    };

    //this code is used to trigger events easily (used in the context menu mouseleave
    ContextMenu.trigger = function(element, event_name, params, origin) {
        var evt = document.createEvent("CustomEvent");
        evt.initCustomEvent(event_name, true, true, params); //canBubble, cancelable, detail
        evt.srcElement = origin;
        if (element.dispatchEvent) {
            element.dispatchEvent(evt);
        } else if (element.__events) {
            element.__events.dispatchEvent(evt);
        }
        //else nothing seems binded here so nothing to do
        return evt;
    };

    //returns the top most menu
    ContextMenu.prototype.getTopMenu = function() {
        if (this.options.parentMenu) {
            return this.options.parentMenu.getTopMenu();
        }
        return this;
    };

    ContextMenu.prototype.getFirstEvent = function() {
        if (this.options.parentMenu) {
            return this.options.parentMenu.getFirstEvent();
        }
        return this.options.event;
    };

    ContextMenu.isCursorOverElement = function(event, element) {
        var left = event.clientX;
        var top = event.clientY;
        var rect = element.getBoundingClientRect();
        if (!rect) {
            return false;
        }
        if (
            top > rect.top &&
            top < rect.top + rect.height &&
            left > rect.left &&
            left < rect.left + rect.width
        ) {
            return true;
        }
        return false;
    };

    LiteGraph.ContextMenu = ContextMenu;

    LiteGraph.closeAllContextMenus = function(ref_window) {
        ref_window = ref_window || window;

        var elements = ref_window.document.querySelectorAll(".litecontextmenu");
        if (!elements.length) {
            return;
        }

        var result = [];
        for (var i = 0; i < elements.length; i++) {
            result.push(elements[i]);
        }

        for (var i in result) {
            if (result[i].close) {
                result[i].close();
            } else if (result[i].parentNode) {
                result[i].parentNode.removeChild(result[i]);
            }
        }
    };

    LiteGraph.extendClass = function(target, origin) {
        for (var i in origin) {
            //copy class properties
            if (target.hasOwnProperty(i)) {
                continue;
            }
            target[i] = origin[i];
        }

        if (origin.prototype) {
            //copy prototype properties
            for (var i in origin.prototype) {
                //only enumerable
                if (!origin.prototype.hasOwnProperty(i)) {
                    continue;
                }

                if (target.prototype.hasOwnProperty(i)) {
                    //avoid overwriting existing ones
                    continue;
                }

                //copy getters
                if (origin.prototype.__lookupGetter__(i)) {
                    target.prototype.__defineGetter__(
                        i,
                        origin.prototype.__lookupGetter__(i)
                    );
                } else {
                    target.prototype[i] = origin.prototype[i];
                }

                //and setters
                if (origin.prototype.__lookupSetter__(i)) {
                    target.prototype.__defineSetter__(
                        i,
                        origin.prototype.__lookupSetter__(i)
                    );
                }
            }
        }
    };

	//used by some widgets to render a curve editor
	function CurveEditor( points )
	{
		this.points = points;
		this.selected = -1;
		this.nearest = -1;
		this.size = null; //stores last size used
		this.must_update = true;
		this.margin = 5;
	}

	CurveEditor.sampleCurve = function(f,points)
	{
		if(!points)
			return;
		for(var i = 0; i < points.length - 1; ++i)
		{
			var p = points[i];
			var pn = points[i+1];
			if(pn[0] < f)
				continue;
			var r = (pn[0] - p[0]);
			if( Math.abs(r) < 0.00001 )
				return p[1];
			var local_f = (f - p[0]) / r;
			return p[1] * (1.0 - local_f) + pn[1] * local_f;
		}
		return 0;
	}

	CurveEditor.prototype.draw = function( ctx, size, graphcanvas, background_color, line_color, inactive )
	{
		var points = this.points;
		if(!points)
			return;
		this.size = size;
		var w = size[0] - this.margin * 2;
		var h = size[1] - this.margin * 2;

		line_color = line_color || "#666";

		ctx.save();
		ctx.translate(this.margin,this.margin);

		if(background_color)
		{
			ctx.fillStyle = "#111";
			ctx.fillRect(0,0,w,h);
			ctx.fillStyle = "#222";
			ctx.fillRect(w*0.5,0,1,h);
			ctx.strokeStyle = "#333";
			ctx.strokeRect(0,0,w,h);
		}
		ctx.strokeStyle = line_color;
		if(inactive)
			ctx.globalAlpha = 0.5;
		ctx.beginPath();
		for(var i = 0; i < points.length; ++i)
		{
			var p = points[i];
			ctx.lineTo( p[0] * w, (1.0 - p[1]) * h );
		}
		ctx.stroke();
		ctx.globalAlpha = 1;
		if(!inactive)
			for(var i = 0; i < points.length; ++i)
			{
				var p = points[i];
				ctx.fillStyle = this.selected == i ? "#FFF" : (this.nearest == i ? "#DDD" : "#AAA");
				ctx.beginPath();
				ctx.arc( p[0] * w, (1.0 - p[1]) * h, 2, 0, Math.PI * 2 );
				ctx.fill();
			}
		ctx.restore();
	}

	//localpos is mouse in curve editor space
	CurveEditor.prototype.onMouseDown = function( localpos, graphcanvas )
	{
		var points = this.points;
		if(!points)
			return;
		if( localpos[1] < 0 )
			return;

		//this.captureInput(true);
		var w = this.size[0] - this.margin * 2;
		var h = this.size[1] - this.margin * 2;
		var x = localpos[0] - this.margin;
		var y = localpos[1] - this.margin;
		var pos = [x,y];
		var max_dist = 30 / graphcanvas.ds.scale;
		//search closer one
		this.selected = this.getCloserPoint(pos, max_dist);
		//create one
		if(this.selected == -1)
		{
			var point = [x / w, 1 - y / h];
			points.push(point);
			points.sort(function(a,b){ return a[0] - b[0]; });
			this.selected = points.indexOf(point);
			this.must_update = true;
		}
		if(this.selected != -1)
			return true;
	}

	CurveEditor.prototype.onMouseMove = function( localpos, graphcanvas )
	{
		var points = this.points;
		if(!points)
			return;
		var s = this.selected;
		if(s < 0)
			return;
		var x = (localpos[0] - this.margin) / (this.size[0] - this.margin * 2 );
		var y = (localpos[1] - this.margin) / (this.size[1] - this.margin * 2 );
		var curvepos = [(localpos[0] - this.margin),(localpos[1] - this.margin)];
		var max_dist = 30 / graphcanvas.ds.scale;
		this._nearest = this.getCloserPoint(curvepos, max_dist);
		var point = points[s];
		if(point)
		{
			var is_edge_point = s == 0 || s == points.length - 1;
			if( !is_edge_point && (localpos[0] < -10 || localpos[0] > this.size[0] + 10 || localpos[1] < -10 || localpos[1] > this.size[1] + 10) )
			{
				points.splice(s,1);
				this.selected = -1;
				return;
			}
			if( !is_edge_point ) //not edges
				point[0] = Math.clamp(x,0,1);
			else
				point[0] = s == 0 ? 0 : 1;
			point[1] = 1.0 - Math.clamp(y,0,1);
			points.sort(function(a,b){ return a[0] - b[0]; });
			this.selected = points.indexOf(point);
			this.must_update = true;
		}
	}

	CurveEditor.prototype.onMouseUp = function( localpos, graphcanvas )
	{
		this.selected = -1;
		return false;
	}

	CurveEditor.prototype.getCloserPoint = function(pos, max_dist)
	{
		var points = this.points;
		if(!points)
			return -1;
		max_dist = max_dist || 30;
		var w = (this.size[0] - this.margin * 2);
		var h = (this.size[1] - this.margin * 2);
		var num = points.length;
		var p2 = [0,0];
		var min_dist = 1000000;
		var closest = -1;
		var last_valid = -1;
		for(var i = 0; i < num; ++i)
		{
			var p = points[i];
			p2[0] = p[0] * w;
			p2[1] = (1.0 - p[1]) * h;
			if(p2[0] < pos[0])
				last_valid = i;
			var dist = vec2.distance(pos,p2);
			if(dist > min_dist || dist > max_dist)
				continue;
			closest = i;
			min_dist = dist;
		}
		return closest;
	}

	LiteGraph.CurveEditor = CurveEditor;

    //used to create nodes from wrapping functions
    LiteGraph.getParameterNames = function(func) {
        return (func + "")
            .replace(/[/][/].*$/gm, "") // strip single-line comments
            .replace(/\s+/g, "") // strip white space
            .replace(/[/][*][^/*]*[*][/]/g, "") // strip multi-line comments  /**/
            .split("){", 1)[0]
            .replace(/^[^(]*[(]/, "") // extract the parameters
            .replace(/=[^,]+/g, "") // strip any ES6 defaults
            .split(",")
            .filter(Boolean); // split & filter [""]
    };

    Math.clamp = function(v, a, b) {
        return a > v ? a : b < v ? b : v;
    };

    if (typeof window != "undefined" && !window["requestAnimationFrame"]) {
        window.requestAnimationFrame =
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            function(callback) {
                window.setTimeout(callback, 1000 / 60);
            };
    }
})(this);

if (typeof exports != "undefined") {
    exports.LiteGraph = this.LiteGraph;
}

//basic nodes
(function(global) {
    var LiteGraph = global.LiteGraph;

    //Constant
    function Time() {
        this.addOutput("in ms", "number");
        this.addOutput("in sec", "number");
    }

    Time.title = "Time";
    Time.desc = "Time";

    Time.prototype.onExecute = function() {
        this.setOutputData(0, this.graph.globaltime * 1000);
        this.setOutputData(1, this.graph.globaltime);
    };

    LiteGraph.registerNodeType("basic/time", Time);

    //Subgraph: a node that contains a graph
    function Subgraph() {
        var that = this;
        this.size = [140, 80];
        this.properties = { enabled: true };
        this.enabled = true;

        //create inner graph
        this.subgraph = new LiteGraph.LGraph();
        this.subgraph._subgraph_node = this;
        this.subgraph._is_subgraph = true;

        this.subgraph.onTrigger = this.onSubgraphTrigger.bind(this);

		//nodes input node added inside
        this.subgraph.onInputAdded = this.onSubgraphNewInput.bind(this);
        this.subgraph.onInputRenamed = this.onSubgraphRenamedInput.bind(this);
        this.subgraph.onInputTypeChanged = this.onSubgraphTypeChangeInput.bind(this);
        this.subgraph.onInputRemoved = this.onSubgraphRemovedInput.bind(this);

        this.subgraph.onOutputAdded = this.onSubgraphNewOutput.bind(this);
        this.subgraph.onOutputRenamed = this.onSubgraphRenamedOutput.bind(this);
        this.subgraph.onOutputTypeChanged = this.onSubgraphTypeChangeOutput.bind(this);
        this.subgraph.onOutputRemoved = this.onSubgraphRemovedOutput.bind(this);
    }

    Subgraph.title = "Subgraph";
    Subgraph.desc = "Graph inside a node";
    Subgraph.title_color = "#334";

    Subgraph.prototype.onGetInputs = function() {
        return [["enabled", "boolean"]];
    };

	/*
    Subgraph.prototype.onDrawTitle = function(ctx) {
        if (this.flags.collapsed) {
            return;
        }

        ctx.fillStyle = "#555";
        var w = LiteGraph.NODE_TITLE_HEIGHT;
        var x = this.size[0] - w;
        ctx.fillRect(x, -w, w, w);
        ctx.fillStyle = "#333";
        ctx.beginPath();
        ctx.moveTo(x + w * 0.2, -w * 0.6);
        ctx.lineTo(x + w * 0.8, -w * 0.6);
        ctx.lineTo(x + w * 0.5, -w * 0.3);
        ctx.fill();
    };
	*/

    Subgraph.prototype.onDblClick = function(e, pos, graphcanvas) {
        var that = this;
        setTimeout(function() {
            graphcanvas.openSubgraph(that.subgraph);
        }, 10);
    };

	/*
    Subgraph.prototype.onMouseDown = function(e, pos, graphcanvas) {
        if (
            !this.flags.collapsed &&
            pos[0] > this.size[0] - LiteGraph.NODE_TITLE_HEIGHT &&
            pos[1] < 0
        ) {
            var that = this;
            setTimeout(function() {
                graphcanvas.openSubgraph(that.subgraph);
            }, 10);
        }
    };
	*/

    Subgraph.prototype.onAction = function(action, param) {
        this.subgraph.onAction(action, param);
    };

    Subgraph.prototype.onExecute = function() {
        this.enabled = this.getInputOrProperty("enabled");
        if (!this.enabled) {
            return;
        }

        //send inputs to subgraph global inputs
        if (this.inputs) {
            for (var i = 0; i < this.inputs.length; i++) {
                var input = this.inputs[i];
                var value = this.getInputData(i);
                this.subgraph.setInputData(input.name, value);
            }
        }

        //execute
        this.subgraph.runStep();

        //send subgraph global outputs to outputs
        if (this.outputs) {
            for (var i = 0; i < this.outputs.length; i++) {
                var output = this.outputs[i];
                var value = this.subgraph.getOutputData(output.name);
                this.setOutputData(i, value);
            }
        }
    };

    Subgraph.prototype.sendEventToAllNodes = function(eventname, param, mode) {
        if (this.enabled) {
            this.subgraph.sendEventToAllNodes(eventname, param, mode);
        }
    };

	Subgraph.prototype.onDrawBackground = function(ctx, graphcanvas, canvas, pos)
	{
		if(this.flags.collapsed)
			return;

		var y = this.size[1] - LiteGraph.NODE_TITLE_HEIGHT + 0.5;

		//button
		var over = LiteGraph.isInsideRectangle(pos[0],pos[1],this.pos[0],this.pos[1] + y,this.size[0],LiteGraph.NODE_TITLE_HEIGHT);
		ctx.fillStyle = over ? "#555" : "#222";
		ctx.beginPath();
		ctx.roundRect( 0, y, this.size[0]+1, LiteGraph.NODE_TITLE_HEIGHT, 0, 8);
		ctx.fill();

		//button
		ctx.textAlign = "center";
		ctx.font = "24px Arial";
		ctx.fillStyle = over ? "#DDD" : "#999";
		ctx.fillText( "+", this.size[0] * 0.5, y + 24 );
	}

	Subgraph.prototype.onMouseDown = function(e, localpos, graphcanvas)
	{
		var y = this.size[1] - LiteGraph.NODE_TITLE_HEIGHT + 0.5;
		if(localpos[1] > y)
		{
			graphcanvas.showSubgraphPropertiesDialog(this);
		}
	}

	Subgraph.prototype.computeSize = function()
	{
		var num_inputs = this.inputs ? this.inputs.length : 0;
		var num_outputs = this.outputs ? this.outputs.length : 0;
		return [ 200, Math.max(num_inputs,num_outputs) * LiteGraph.NODE_SLOT_HEIGHT + LiteGraph.NODE_TITLE_HEIGHT ];
	}

    //**** INPUTS ***********************************
    Subgraph.prototype.onSubgraphTrigger = function(event, param) {
        var slot = this.findOutputSlot(event);
        if (slot != -1) {
            this.triggerSlot(slot);
        }
    };

    Subgraph.prototype.onSubgraphNewInput = function(name, type) {
        var slot = this.findInputSlot(name);
        if (slot == -1) {
            //add input to the node
            this.addInput(name, type);
        }
    };

    Subgraph.prototype.onSubgraphRenamedInput = function(oldname, name) {
        var slot = this.findInputSlot(oldname);
        if (slot == -1) {
            return;
        }
        var info = this.getInputInfo(slot);
        info.name = name;
    };

    Subgraph.prototype.onSubgraphTypeChangeInput = function(name, type) {
        var slot = this.findInputSlot(name);
        if (slot == -1) {
            return;
        }
        var info = this.getInputInfo(slot);
        info.type = type;
    };

    Subgraph.prototype.onSubgraphRemovedInput = function(name) {
        var slot = this.findInputSlot(name);
        if (slot == -1) {
            return;
        }
        this.removeInput(slot);
    };

    //**** OUTPUTS ***********************************
    Subgraph.prototype.onSubgraphNewOutput = function(name, type) {
        var slot = this.findOutputSlot(name);
        if (slot == -1) {
            this.addOutput(name, type);
        }
    };

    Subgraph.prototype.onSubgraphRenamedOutput = function(oldname, name) {
        var slot = this.findOutputSlot(oldname);
        if (slot == -1) {
            return;
        }
        var info = this.getOutputInfo(slot);
        info.name = name;
    };

    Subgraph.prototype.onSubgraphTypeChangeOutput = function(name, type) {
        var slot = this.findOutputSlot(name);
        if (slot == -1) {
            return;
        }
        var info = this.getOutputInfo(slot);
        info.type = type;
    };

    Subgraph.prototype.onSubgraphRemovedOutput = function(name) {
        var slot = this.findInputSlot(name);
        if (slot == -1) {
            return;
        }
        this.removeOutput(slot);
    };
    // *****************************************************

    Subgraph.prototype.getExtraMenuOptions = function(graphcanvas) {
        var that = this;
        return [
            {
                content: "Open",
                callback: function() {
                    graphcanvas.openSubgraph(that.subgraph);
                }
            }
        ];
    };

    Subgraph.prototype.onResize = function(size) {
        size[1] += 20;
    };

    Subgraph.prototype.serialize = function() {
        var data = LiteGraph.LGraphNode.prototype.serialize.call(this);
        data.subgraph = this.subgraph.serialize();
        return data;
    };
    //no need to define node.configure, the default method detects node.subgraph and passes the object to node.subgraph.configure()

    Subgraph.prototype.clone = function() {
        var node = LiteGraph.createNode(this.type);
        var data = this.serialize();
        delete data["id"];
        delete data["inputs"];
        delete data["outputs"];
        node.configure(data);
        return node;
    };

	Subgraph.prototype.buildFromNodes = function(nodes)
	{
		//clear all?
		//TODO

		//nodes that connect data between parent graph and subgraph
		var subgraph_inputs = [];
		var subgraph_outputs = [];

		//mark inner nodes
		var ids = {};
		var min_x = 0;
		var max_x = 0;
		for(var i = 0; i < nodes.length; ++i)
		{
			var node = nodes[i];
			ids[ node.id ] = node;
			min_x = Math.min( node.pos[0], min_x );
			max_x = Math.max( node.pos[0], min_x );
		}
		
		var last_input_y = 0;
		var last_output_y = 0;

		for(var i = 0; i < nodes.length; ++i)
		{
			var node = nodes[i];
			//check inputs
			if( node.inputs )
				for(var j = 0; j < node.inputs.length; ++j)
				{
					var input = node.inputs[j];
					if( !input || !input.link )
						continue;
					var link = node.graph.links[ input.link ];
					if(!link)
						continue;
					if( ids[ link.origin_id ] )
						continue;
					//this.addInput(input.name,link.type);
					this.subgraph.addInput(input.name,link.type);
					/*
					var input_node = LiteGraph.createNode("graph/input");
					this.subgraph.add( input_node );
					input_node.pos = [min_x - 200, last_input_y ];
					last_input_y += 100;
					*/
				}

			//check outputs
			if( node.outputs )
				for(var j = 0; j < node.outputs.length; ++j)
				{
					var output = node.outputs[j];
					if( !output || !output.links || !output.links.length )
						continue;
					var is_external = false;
					for(var k = 0; k < output.links.length; ++k)
					{
						var link = node.graph.links[ output.links[k] ];
						if(!link)
							continue;
						if( ids[ link.target_id ] )
							continue;
						is_external = true;
						break;
					}
					if(!is_external)
						continue;
					//this.addOutput(output.name,output.type);
					/*
					var output_node = LiteGraph.createNode("graph/output");
					this.subgraph.add( output_node );
					output_node.pos = [max_x + 50, last_output_y ];
					last_output_y += 100;
					*/
				}
		}

		//detect inputs and outputs
			//split every connection in two data_connection nodes
			//keep track of internal connections
			//connect external connections

		//clone nodes inside subgraph and try to reconnect them

		//connect edge subgraph nodes to extarnal connections nodes
	}

    LiteGraph.Subgraph = Subgraph;
    LiteGraph.registerNodeType("graph/subgraph", Subgraph);

    //Input for a subgraph
    function GraphInput() {
        this.addOutput("", "number");

        this.name_in_graph = "";
        this.properties = {
			name: "",
			type: "number",
			value: 0
		}; 

        var that = this;

        this.name_widget = this.addWidget(
            "text",
            "Name",
            this.properties.name,
            function(v) {
                if (!v) {
                    return;
                }
                that.setProperty("name",v);
            }
        );
        this.type_widget = this.addWidget(
            "text",
            "Type",
            this.properties.type,
            function(v) {
				that.setProperty("type",v);
            }
        );

        this.value_widget = this.addWidget(
            "number",
            "Value",
            this.properties.value,
            function(v) {
                that.setProperty("value",v);
            }
        );

        this.widgets_up = true;
        this.size = [180, 90];
    }

    GraphInput.title = "Input";
    GraphInput.desc = "Input of the graph";

	GraphInput.prototype.onConfigure = function()
	{
		this.updateType();
	}

	GraphInput.prototype.updateType = function()
	{
		var type = this.properties.type;
		this.type_widget.value = type;
		if(this.outputs[0].type != type)
		{
			this.outputs[0].type = type;
			this.disconnectOutput(0);
		}
		if(type == "number")
		{
			this.value_widget.type = "number";
			this.value_widget.value = 0;
		}
		else if(type == "boolean")
		{
			this.value_widget.type = "toggle";
			this.value_widget.value = true;
		}
		else if(type == "string")
		{
			this.value_widget.type = "text";
			this.value_widget.value = "";
		}
		else
		{
			this.value_widget.type = null;
			this.value_widget.value = null;
		}
		this.properties.value = this.value_widget.value;
	}

	GraphInput.prototype.onPropertyChanged = function(name,v)
	{
		if( name == "name" )
		{
			if (v == "" || v == this.name_in_graph || v == "enabled") {
				return false;
			}
			if(this.graph)
			{
				if (this.name_in_graph) {
					//already added
					this.graph.renameInput( this.name_in_graph, v );
				} else {
					this.graph.addInput( v, this.properties.type );
				}
			} //what if not?!
			this.name_widget.value = v;
			this.name_in_graph = v;
		}
		else if( name == "type" )
		{
			v = v || "";
			this.updateType(v);
		}
		else if( name == "value" )
		{
		}
	}

    GraphInput.prototype.getTitle = function() {
        if (this.flags.collapsed) {
            return this.properties.name;
        }
        return this.title;
    };

    GraphInput.prototype.onAction = function(action, param) {
        if (this.properties.type == LiteGraph.EVENT) {
            this.triggerSlot(0, param);
        }
    };

    GraphInput.prototype.onExecute = function() {
        var name = this.properties.name;
        //read from global input
        var data = this.graph.inputs[name];
        if (!data) {
            this.setOutputData(0, this.properties.value );
			return;
        }

        this.setOutputData(0, data.value !== undefined ? data.value : this.properties.value );
    };

    GraphInput.prototype.onRemoved = function() {
        if (this.name_in_graph) {
            this.graph.removeInput(this.name_in_graph);
        }
    };

    LiteGraph.GraphInput = GraphInput;
    LiteGraph.registerNodeType("graph/input", GraphInput);

    //Output for a subgraph
    function GraphOutput() {
        this.addInput("", "");

        this.name_in_graph = "";
        this.properties = {};
        var that = this;

        Object.defineProperty(this.properties, "name", {
            get: function() {
                return that.name_in_graph;
            },
            set: function(v) {
                if (v == "" || v == that.name_in_graph) {
                    return;
                }
                if (that.name_in_graph) {
                    //already added
                    that.graph.renameOutput(that.name_in_graph, v);
                } else {
                    that.graph.addOutput(v, that.properties.type);
                }
                that.name_widget.value = v;
                that.name_in_graph = v;
            },
            enumerable: true
        });

        Object.defineProperty(this.properties, "type", {
            get: function() {
                return that.inputs[0].type;
            },
            set: function(v) {
                if (v == "action" || v == "event") {
                    v = LiteGraph.ACTION;
                }
                that.inputs[0].type = v;
                if (that.name_in_graph) {
                    //already added
                    that.graph.changeOutputType(
                        that.name_in_graph,
                        that.inputs[0].type
                    );
                }
                that.type_widget.value = v || "";
            },
            enumerable: true
        });

        this.name_widget = this.addWidget("text","Name",this.properties.name,"name");
        this.type_widget = this.addWidget("text","Type",this.properties.type,"type");
        this.widgets_up = true;
        this.size = [180, 60];
    }

    GraphOutput.title = "Output";
    GraphOutput.desc = "Output of the graph";

    GraphOutput.prototype.onExecute = function() {
        this._value = this.getInputData(0);
        this.graph.setOutputData(this.properties.name, this._value);
    };

    GraphOutput.prototype.onAction = function(action, param) {
        if (this.properties.type == LiteGraph.ACTION) {
            this.graph.trigger(this.properties.name, param);
        }
    };

    GraphOutput.prototype.onRemoved = function() {
        if (this.name_in_graph) {
            this.graph.removeOutput(this.name_in_graph);
        }
    };

    GraphOutput.prototype.getTitle = function() {
        if (this.flags.collapsed) {
            return this.properties.name;
        }
        return this.title;
    };

    LiteGraph.GraphOutput = GraphOutput;
    LiteGraph.registerNodeType("graph/output", GraphOutput);

    //Constant
    function ConstantNumber() {
        this.addOutput("value", "number");
        this.addProperty("value", 1.0);
        this.widget = this.addWidget("number","value",1,"value");
        this.widgets_up = true;
        this.size = [180, 30];
    }

    ConstantNumber.title = "Const Number";
    ConstantNumber.desc = "Constant number";

    ConstantNumber.prototype.onExecute = function() {
        this.setOutputData(0, parseFloat(this.properties["value"]));
    };

    ConstantNumber.prototype.getTitle = function() {
        if (this.flags.collapsed) {
            return this.properties.value;
        }
        return this.title;
    };

	ConstantNumber.prototype.setValue = function(v)
	{
		this.setProperty("value",v);
	}

    ConstantNumber.prototype.onDrawBackground = function(ctx) {
        //show the current value
        this.outputs[0].label = this.properties["value"].toFixed(3);
    };

    LiteGraph.registerNodeType("basic/const", ConstantNumber);

    function ConstantBoolean() {
        this.addOutput("", "boolean");
        this.addProperty("value", true);
        this.widget = this.addWidget("toggle","value",true,"value");
        this.widgets_up = true;
        this.size = [140, 30];
    }

    ConstantBoolean.title = "Const Boolean";
    ConstantBoolean.desc = "Constant boolean";
    ConstantBoolean.prototype.getTitle = ConstantNumber.prototype.getTitle;

    ConstantBoolean.prototype.onExecute = function() {
        this.setOutputData(0, this.properties["value"]);
    };

	ConstantBoolean.prototype.setValue = ConstantNumber.prototype.setValue;

	ConstantBoolean.prototype.onGetInputs = function() {
		return [["toggle", LiteGraph.ACTION]];
	};

	ConstantBoolean.prototype.onAction = function(action)
	{
		this.setValue( !this.properties.value );
	}

    LiteGraph.registerNodeType("basic/boolean", ConstantBoolean);

    function ConstantString() {
        this.addOutput("", "string");
        this.addProperty("value", "");
        this.widget = this.addWidget("text","value","","value");  //link to property value
        this.widgets_up = true;
        this.size = [180, 30];
    }

    ConstantString.title = "Const String";
    ConstantString.desc = "Constant string";

    ConstantString.prototype.getTitle = ConstantNumber.prototype.getTitle;

    ConstantString.prototype.onExecute = function() {
        this.setOutputData(0, this.properties["value"]);
    };

	ConstantString.prototype.setValue = ConstantNumber.prototype.setValue;

	ConstantString.prototype.onDropFile = function(file)
	{
		var that = this;
		var reader = new FileReader();
		reader.onload = function(e)
		{
			that.setProperty("value",e.target.result);
		}
		reader.readAsText(file);
	}

    LiteGraph.registerNodeType("basic/string", ConstantString);

    function ConstantFile() {
        this.addInput("url", "");
        this.addOutput("", "");
        this.addProperty("url", "");
        this.addProperty("type", "text");
        this.widget = this.addWidget("text","url","","url");
        this._data = null;
    }

    ConstantFile.title = "Const File";
    ConstantFile.desc = "Fetches a file from an url";
    ConstantFile["@type"] = { type: "enum", values: ["text","arraybuffer","blob","json"] };

    ConstantFile.prototype.onPropertyChanged = function(name, value) {
        if (name == "url")
		{
			if( value == null || value == "")
				this._data = null;
			else
			{
				this.fetchFile(value);
			}
		}
	}

    ConstantFile.prototype.onExecute = function() {
		var url = this.getInputData(0) || this.properties.url;
		if(url && (url != this._url || this._type != this.properties.type))
			this.fetchFile(url);
        this.setOutputData(0, this._data );
    };

	ConstantFile.prototype.setValue = ConstantNumber.prototype.setValue;

    ConstantFile.prototype.fetchFile = function(url) {
		var that = this;
		if(!url || url.constructor !== String)
		{
			that._data = null;
            that.boxcolor = null;
			return;
		}

		this._url = url;
		this._type = this.properties.type;
        if (url.substr(0, 4) == "http" && LiteGraph.proxy) {
            url = LiteGraph.proxy + url.substr(url.indexOf(":") + 3);
        }
		fetch(url)
		.then(function(response) {
			if(!response.ok)
				 throw new Error("File not found");

			if(that.properties.type == "arraybuffer")
				return response.arrayBuffer();
			else if(that.properties.type == "text")
				return response.text();
			else if(that.properties.type == "json")
				return response.json();
			else if(that.properties.type == "blob")
				return response.blob();
		})
		.then(function(data) {
			that._data = data;
            that.boxcolor = "#AEA";
		})
		.catch(function(error) {
			that._data = null;
            that.boxcolor = "red";
			console.error("error fetching file:",url);
		});
    };

	ConstantFile.prototype.onDropFile = function(file)
	{
		var that = this;
		this._url = file.name;
		this._type = this.properties.type;
		this.properties.url = file.name;
		var reader = new FileReader();
		reader.onload = function(e)
		{
            that.boxcolor = "#AEA";
			var v = e.target.result;
			if( that.properties.type == "json" )
				v = JSON.parse(v);
			that._data = v;
		}
		if(that.properties.type == "arraybuffer")
			reader.readAsArrayBuffer(file);
		else if(that.properties.type == "text" || that.properties.type == "json")
			reader.readAsText(file);
		else if(that.properties.type == "blob")
			return reader.readAsBinaryString(file);
	}

    LiteGraph.registerNodeType("basic/file", ConstantFile);

	//to store json objects
    function ConstantData() {
        this.addOutput("", "");
        this.addProperty("value", "");
        this.widget = this.addWidget("text","json","","value");
        this.widgets_up = true;
        this.size = [140, 30];
        this._value = null;
    }

    ConstantData.title = "Const Data";
    ConstantData.desc = "Constant Data";

    ConstantData.prototype.onPropertyChanged = function(name, value) {
        this.widget.value = value;
        if (value == null || value == "") {
            return;
        }

        try {
            this._value = JSON.parse(value);
            this.boxcolor = "#AEA";
        } catch (err) {
            this.boxcolor = "red";
        }
    };

    ConstantData.prototype.onExecute = function() {
        this.setOutputData(0, this._value);
    };

	ConstantData.prototype.setValue = ConstantNumber.prototype.setValue;

    LiteGraph.registerNodeType("basic/data", ConstantData);

	//to store json objects
    function ConstantArray() {
        this.addInput("", "");
        this.addOutput("", "array");
        this.addOutput("length", "number");
        this.addProperty("value", "");
        this.widget = this.addWidget("text","array","","value");
        this.widgets_up = true;
        this.size = [140, 50];
        this._value = null;
    }

    ConstantArray.title = "Const Array";
    ConstantArray.desc = "Constant Array";

    ConstantArray.prototype.onPropertyChanged = function(name, value) {
        this.widget.value = value;
        if (value == null || value == "") {
            return;
        }

        try {
			if(value[0] != "[")
	            this._value = JSON.parse("[" + value + "]");
			else
	            this._value = JSON.parse(value);
            this.boxcolor = "#AEA";
        } catch (err) {
            this.boxcolor = "red";
        }
    };

    ConstantArray.prototype.onExecute = function() {
        var v = this.getInputData(0);
		if(v && v.length) //clone
		{
			if(!this._value)
				this._value = new Array();
			this._value.length = v.length;
			for(var i = 0; i < v.length; ++i)
				this._value[i] = v[i];
		}
		this.setOutputData(0, this._value);
		this.setOutputData(1, this._value ? ( this._value.length || 0) : 0 );
    };

	ConstantArray.prototype.setValue = ConstantNumber.prototype.setValue;

    LiteGraph.registerNodeType("basic/array", ConstantArray);

    function ArrayElement() {
        this.addInput("array", "array,table,string");
        this.addInput("index", "number");
        this.addOutput("value", "");
		this.addProperty("index",0);
    }

    ArrayElement.title = "Array[i]";
    ArrayElement.desc = "Returns an element from an array";

    ArrayElement.prototype.onExecute = function() {
        var array = this.getInputData(0);
        var index = this.getInputData(1);
		if(index == null)
			index = this.properties.index;
		if(array == null || index == null )
			return;
        this.setOutputData(0, array[Math.floor(Number(index))] );
    };

    LiteGraph.registerNodeType("basic/array[]", ArrayElement);



    function TableElement() {
        this.addInput("table", "table");
        this.addInput("row", "number");
        this.addInput("col", "number");
        this.addOutput("value", "");
		this.addProperty("row",0);
		this.addProperty("column",0);
    }

    TableElement.title = "Table[row][col]";
    TableElement.desc = "Returns an element from a table";

    TableElement.prototype.onExecute = function() {
        var table = this.getInputData(0);
        var row = this.getInputData(1);
        var col = this.getInputData(2);
		if(row == null)
			row = this.properties.row;
		if(col == null)
			col = this.properties.column;
		if(table == null || row == null || col == null)
			return;
		var row = table[Math.floor(Number(row))];
		if(row)
	        this.setOutputData(0, row[Math.floor(Number(col))] );
		else
	        this.setOutputData(0, null );
    };

    LiteGraph.registerNodeType("basic/table[][]", TableElement);

    function ObjectProperty() {
        this.addInput("obj", "");
        this.addOutput("", "");
        this.addProperty("value", "");
        this.widget = this.addWidget("text","prop.","",this.setValue.bind(this) );
        this.widgets_up = true;
        this.size = [140, 30];
        this._value = null;
    }

    ObjectProperty.title = "Object property";
    ObjectProperty.desc = "Outputs the property of an object";

    ObjectProperty.prototype.setValue = function(v) {
        this.properties.value = v;
        this.widget.value = v;
    };

    ObjectProperty.prototype.getTitle = function() {
        if (this.flags.collapsed) {
            return "in." + this.properties.value;
        }
        return this.title;
    };

    ObjectProperty.prototype.onPropertyChanged = function(name, value) {
        this.widget.value = value;
    };

    ObjectProperty.prototype.onExecute = function() {
        var data = this.getInputData(0);
        if (data != null) {
            this.setOutputData(0, data[this.properties.value]);
        }
    };

    LiteGraph.registerNodeType("basic/object_property", ObjectProperty);

    function ObjectKeys() {
        this.addInput("obj", "");
        this.addOutput("keys", "array");
        this.size = [140, 30];
    }

    ObjectKeys.title = "Object keys";
    ObjectKeys.desc = "Outputs an array with the keys of an object";

    ObjectKeys.prototype.onExecute = function() {
        var data = this.getInputData(0);
        if (data != null) {
            this.setOutputData(0, Object.keys(data) );
        }
    };

    LiteGraph.registerNodeType("basic/object_keys", ObjectKeys);

    function MergeObjects() {
        this.addInput("A", "object");
        this.addInput("B", "object");
        this.addOutput("", "object");
		this._result = {};
		var that = this;
		this.addWidget("button","clear","",function(){
			that._result = {};
		});
		this.size = this.computeSize();
    }

    MergeObjects.title = "Merge Objects";
    MergeObjects.desc = "Creates an object copying properties from others";

    MergeObjects.prototype.onExecute = function() {
        var A = this.getInputData(0);
        var B = this.getInputData(1);
		var C = this._result;
		if(A)
			for(var i in A)
				C[i] = A[i];
		if(B)
			for(var i in B)
				C[i] = B[i];
		this.setOutputData(0,C);
    };

    LiteGraph.registerNodeType("basic/merge_objects", MergeObjects );

    //Store as variable
    function Variable() {
        this.size = [60, 30];
        this.addInput("in");
        this.addOutput("out");
		this.properties = { varname: "myname", global: false };
        this.value = null;
    }

    Variable.title = "Variable";
    Variable.desc = "store/read variable value";

    Variable.prototype.onExecute = function() {
		this.value = this.getInputData(0);
		if(this.graph)
			this.graph.vars[ this.properties.varname ] = this.value;
		if(this.properties.global)
			global[this.properties.varname] = this.value;
		this.setOutputData(0, this.value );
    };

    Variable.prototype.getTitle = function() {
        return this.properties.varname;
    };

    LiteGraph.registerNodeType("basic/variable", Variable);

    function length(v) {
        if(v && v.length != null)
			return Number(v.length);
		return 0;
    }

    LiteGraph.wrapFunctionAsNode(
        "basic/length",
        length,
        [""],
        "number"
    );

	function DownloadData() {
        this.size = [60, 30];
        this.addInput("data", 0 );
        this.addInput("download", LiteGraph.ACTION );
		this.properties = { filename: "data.json" };
        this.value = null;
		var that = this;
		this.addWidget("button","Download","", function(v){
			if(!that.value)
				return;
			that.downloadAsFile();
		});
    }

    DownloadData.title = "Download";
    DownloadData.desc = "Download some data";

	DownloadData.prototype.downloadAsFile = function()
	{
		if(this.value == null)
			return;

		var str = null;
		if(this.value.constructor === String)
			str = this.value;
		else
			str = JSON.stringify(this.value);

		var file = new Blob([str]);
		var url = URL.createObjectURL( file );
		var element = document.createElement("a");
		element.setAttribute('href', url);
		element.setAttribute('download', this.properties.filename );
		element.style.display = 'none';
		document.body.appendChild(element);
		element.click();
		document.body.removeChild(element);
		setTimeout( function(){ URL.revokeObjectURL( url ); }, 1000*60 ); //wait one minute to revoke url
	}

    DownloadData.prototype.onAction = function(action, param) {
		var that = this;
		setTimeout( function(){ that.downloadAsFile(); }, 100); //deferred to avoid blocking the renderer with the popup
	}

    DownloadData.prototype.onExecute = function() {
        if (this.inputs[0]) {
            this.value = this.getInputData(0);
        }
    };

    DownloadData.prototype.getTitle = function() {
        if (this.flags.collapsed) {
            return this.properties.filename;
        }
        return this.title;
    };

    LiteGraph.registerNodeType("basic/download", DownloadData);



    //Watch a value in the editor
    function Watch() {
        this.size = [60, 30];
        this.addInput("value", 0, { label: "" });
        this.value = 0;
    }

    Watch.title = "Watch";
    Watch.desc = "Show value of input";

    Watch.prototype.onExecute = function() {
        if (this.inputs[0]) {
            this.value = this.getInputData(0);
        }
    };

    Watch.prototype.getTitle = function() {
        if (this.flags.collapsed) {
            return this.inputs[0].label;
        }
        return this.title;
    };

    Watch.toString = function(o) {
        if (o == null) {
            return "null";
        } else if (o.constructor === Number) {
            return o.toFixed(3);
        } else if (o.constructor === Array) {
            var str = "[";
            for (var i = 0; i < o.length; ++i) {
                str += Watch.toString(o[i]) + (i + 1 != o.length ? "," : "");
            }
            str += "]";
            return str;
        } else {
            return String(o);
        }
    };

    Watch.prototype.onDrawBackground = function(ctx) {
        //show the current value
        this.inputs[0].label = Watch.toString(this.value);
    };

    LiteGraph.registerNodeType("basic/watch", Watch);

    //in case one type doesnt match other type but you want to connect them anyway
    function Cast() {
        this.addInput("in", 0);
        this.addOutput("out", 0);
        this.size = [40, 30];
    }

    Cast.title = "Cast";
    Cast.desc = "Allows to connect different types";

    Cast.prototype.onExecute = function() {
        this.setOutputData(0, this.getInputData(0));
    };

    LiteGraph.registerNodeType("basic/cast", Cast);

    //Show value inside the debug console
    function Console() {
        this.mode = LiteGraph.ON_EVENT;
        this.size = [80, 30];
        this.addProperty("msg", "");
        this.addInput("log", LiteGraph.EVENT);
        this.addInput("msg", 0);
    }

    Console.title = "Console";
    Console.desc = "Show value inside the console";

    Console.prototype.onAction = function(action, param) {
        if (action == "log") {
            console.log(param);
        } else if (action == "warn") {
            console.warn(param);
        } else if (action == "error") {
            console.error(param);
        }
    };

    Console.prototype.onExecute = function() {
        var msg = this.getInputData(1);
        if (msg !== null) {
            this.properties.msg = msg;
        }
        console.log(msg);
    };

    Console.prototype.onGetInputs = function() {
        return [
            ["log", LiteGraph.ACTION],
            ["warn", LiteGraph.ACTION],
            ["error", LiteGraph.ACTION]
        ];
    };

    LiteGraph.registerNodeType("basic/console", Console);

    //Show value inside the debug console
    function Alert() {
        this.mode = LiteGraph.ON_EVENT;
        this.addProperty("msg", "");
        this.addInput("", LiteGraph.EVENT);
        var that = this;
        this.widget = this.addWidget("text", "Text", "", function(v) {
            that.properties.msg = v;
        });
        this.widgets_up = true;
        this.size = [200, 30];
    }

    Alert.title = "Alert";
    Alert.desc = "Show an alert window";
    Alert.color = "#510";

    Alert.prototype.onConfigure = function(o) {
        this.widget.value = o.properties.msg;
    };

    Alert.prototype.onAction = function(action, param) {
        var msg = this.properties.msg;
        setTimeout(function() {
            alert(msg);
        }, 10);
    };

    LiteGraph.registerNodeType("basic/alert", Alert);

    //Execites simple code
    function NodeScript() {
        this.size = [60, 30];
        this.addProperty("onExecute", "return A;");
        this.addInput("A", "");
        this.addInput("B", "");
        this.addOutput("out", "");

        this._func = null;
        this.data = {};
    }

    NodeScript.prototype.onConfigure = function(o) {
        if (o.properties.onExecute && LiteGraph.allow_scripts)
            this.compileCode(o.properties.onExecute);
		else
			console.warn("Script not compiled, LiteGraph.allow_scripts is false");
    };

    NodeScript.title = "Script";
    NodeScript.desc = "executes a code (max 100 characters)";

    NodeScript.widgets_info = {
        onExecute: { type: "code" }
    };

    NodeScript.prototype.onPropertyChanged = function(name, value) {
        if (name == "onExecute" && LiteGraph.allow_scripts)
            this.compileCode(value);
		else
			console.warn("Script not compiled, LiteGraph.allow_scripts is false");
    };

    NodeScript.prototype.compileCode = function(code) {
        this._func = null;
        if (code.length > 256) {
            console.warn("Script too long, max 256 chars");
        } else {
            var code_low = code.toLowerCase();
            var forbidden_words = [
                "script",
                "body",
                "document",
                "eval",
                "nodescript",
                "function"
            ]; //bad security solution
            for (var i = 0; i < forbidden_words.length; ++i) {
                if (code_low.indexOf(forbidden_words[i]) != -1) {
                    console.warn("invalid script");
                    return;
                }
            }
            try {
                this._func = new Function("A", "B", "C", "DATA", "node", code);
            } catch (err) {
                console.error("Error parsing script");
                console.error(err);
            }
        }
    };

    NodeScript.prototype.onExecute = function() {
        if (!this._func) {
            return;
        }

        try {
            var A = this.getInputData(0);
            var B = this.getInputData(1);
            var C = this.getInputData(2);
            this.setOutputData(0, this._func(A, B, C, this.data, this));
        } catch (err) {
            console.error("Error in script");
            console.error(err);
        }
    };

    NodeScript.prototype.onGetOutputs = function() {
        return [["C", ""]];
    };

    LiteGraph.registerNodeType("basic/script", NodeScript);
})(this);

//event related nodes
(function(global) {
    var LiteGraph = global.LiteGraph;

    //Show value inside the debug console
    function LogEvent() {
        this.size = [60, 30];
        this.addInput("event", LiteGraph.ACTION);
    }

    LogEvent.title = "Log Event";
    LogEvent.desc = "Log event in console";

    LogEvent.prototype.onAction = function(action, param) {
        console.log(action, param);
    };

    LiteGraph.registerNodeType("events/log", LogEvent);

    //convert to Event if the value is true
    function TriggerEvent() {
        this.size = [60, 30];
        this.addInput("if", "");
        this.addOutput("true", LiteGraph.EVENT);
        this.addOutput("change", LiteGraph.EVENT);
        this.addOutput("false", LiteGraph.EVENT);
		this.properties = { only_on_change: true };
		this.prev = 0;
    }

    TriggerEvent.title = "TriggerEvent";
    TriggerEvent.desc = "Triggers event if input evaluates to true";

    TriggerEvent.prototype.onExecute = function(action, param) {
		var v = this.getInputData(0);
		var changed = (v != this.prev);
		if(this.prev === 0)
			changed = false;
		var must_resend = (changed && this.properties.only_on_change) || (!changed && !this.properties.only_on_change);
		if(v && must_resend )
	        this.triggerSlot(0, param);
		if(!v && must_resend)
	        this.triggerSlot(2, param);
		if(changed)
	        this.triggerSlot(1, param);
		this.prev = v;
    };

    LiteGraph.registerNodeType("events/trigger", TriggerEvent);

    //Sequencer for events
    function Sequencer() {
        this.addInput("", LiteGraph.ACTION);
        this.addInput("", LiteGraph.ACTION);
        this.addInput("", LiteGraph.ACTION);
        this.addInput("", LiteGraph.ACTION);
        this.addInput("", LiteGraph.ACTION);
        this.addInput("", LiteGraph.ACTION);
        this.addOutput("", LiteGraph.EVENT);
        this.addOutput("", LiteGraph.EVENT);
        this.addOutput("", LiteGraph.EVENT);
        this.addOutput("", LiteGraph.EVENT);
        this.addOutput("", LiteGraph.EVENT);
        this.addOutput("", LiteGraph.EVENT);
        this.size = [120, 30];
        this.flags = { horizontal: true, render_box: false };
    }

    Sequencer.title = "Sequencer";
    Sequencer.desc = "Trigger events when an event arrives";

    Sequencer.prototype.getTitle = function() {
        return "";
    };

    Sequencer.prototype.onAction = function(action, param) {
        if (this.outputs) {
            for (var i = 0; i < this.outputs.length; ++i) {
                this.triggerSlot(i, param);
            }
        }
    };

    LiteGraph.registerNodeType("events/sequencer", Sequencer);

    //Filter events
    function FilterEvent() {
        this.size = [60, 30];
        this.addInput("event", LiteGraph.ACTION);
        this.addOutput("event", LiteGraph.EVENT);
        this.properties = {
            equal_to: "",
            has_property: "",
            property_equal_to: ""
        };
    }

    FilterEvent.title = "Filter Event";
    FilterEvent.desc = "Blocks events that do not match the filter";

    FilterEvent.prototype.onAction = function(action, param) {
        if (param == null) {
            return;
        }

        if (this.properties.equal_to && this.properties.equal_to != param) {
            return;
        }

        if (this.properties.has_property) {
            var prop = param[this.properties.has_property];
            if (prop == null) {
                return;
            }

            if (
                this.properties.property_equal_to &&
                this.properties.property_equal_to != prop
            ) {
                return;
            }
        }

        this.triggerSlot(0, param);
    };

    LiteGraph.registerNodeType("events/filter", FilterEvent);

    //Show value inside the debug console
    function EventCounter() {
        this.addInput("inc", LiteGraph.ACTION);
        this.addInput("dec", LiteGraph.ACTION);
        this.addInput("reset", LiteGraph.ACTION);
        this.addOutput("change", LiteGraph.EVENT);
        this.addOutput("num", "number");
        this.num = 0;
    }

    EventCounter.title = "Counter";
    EventCounter.desc = "Counts events";

    EventCounter.prototype.getTitle = function() {
        if (this.flags.collapsed) {
            return String(this.num);
        }
        return this.title;
    };

    EventCounter.prototype.onAction = function(action, param) {
        var v = this.num;
        if (action == "inc") {
            this.num += 1;
        } else if (action == "dec") {
            this.num -= 1;
        } else if (action == "reset") {
            this.num = 0;
        }
        if (this.num != v) {
            this.trigger("change", this.num);
        }
    };

    EventCounter.prototype.onDrawBackground = function(ctx) {
        if (this.flags.collapsed) {
            return;
        }
        ctx.fillStyle = "#AAA";
        ctx.font = "20px Arial";
        ctx.textAlign = "center";
        ctx.fillText(this.num, this.size[0] * 0.5, this.size[1] * 0.5);
    };

    EventCounter.prototype.onExecute = function() {
        this.setOutputData(1, this.num);
    };

    LiteGraph.registerNodeType("events/counter", EventCounter);

    //Show value inside the debug console
    function DelayEvent() {
        this.size = [60, 30];
        this.addProperty("time_in_ms", 1000);
        this.addInput("event", LiteGraph.ACTION);
        this.addOutput("on_time", LiteGraph.EVENT);

        this._pending = [];
    }

    DelayEvent.title = "Delay";
    DelayEvent.desc = "Delays one event";

    DelayEvent.prototype.onAction = function(action, param) {
        var time = this.properties.time_in_ms;
        if (time <= 0) {
            this.trigger(null, param);
        } else {
            this._pending.push([time, param]);
        }
    };

    DelayEvent.prototype.onExecute = function() {
        var dt = this.graph.elapsed_time * 1000; //in ms

        if (this.isInputConnected(1)) {
            this.properties.time_in_ms = this.getInputData(1);
        }

        for (var i = 0; i < this._pending.length; ++i) {
            var action = this._pending[i];
            action[0] -= dt;
            if (action[0] > 0) {
                continue;
            }

            //remove
            this._pending.splice(i, 1);
            --i;

            //trigger
            this.trigger(null, action[1]);
        }
    };

    DelayEvent.prototype.onGetInputs = function() {
        return [["event", LiteGraph.ACTION], ["time_in_ms", "number"]];
    };

    LiteGraph.registerNodeType("events/delay", DelayEvent);

    //Show value inside the debug console
    function TimerEvent() {
        this.addProperty("interval", 1000);
        this.addProperty("event", "tick");
        this.addOutput("on_tick", LiteGraph.EVENT);
        this.time = 0;
        this.last_interval = 1000;
        this.triggered = false;
    }

    TimerEvent.title = "Timer";
    TimerEvent.desc = "Sends an event every N milliseconds";

    TimerEvent.prototype.onStart = function() {
        this.time = 0;
    };

    TimerEvent.prototype.getTitle = function() {
        return "Timer: " + this.last_interval.toString() + "ms";
    };

    TimerEvent.on_color = "#AAA";
    TimerEvent.off_color = "#222";

    TimerEvent.prototype.onDrawBackground = function() {
        this.boxcolor = this.triggered
            ? TimerEvent.on_color
            : TimerEvent.off_color;
        this.triggered = false;
    };

    TimerEvent.prototype.onExecute = function() {
        var dt = this.graph.elapsed_time * 1000; //in ms

        var trigger = this.time == 0;

        this.time += dt;
        this.last_interval = Math.max(
            1,
            this.getInputOrProperty("interval") | 0
        );

        if (
            !trigger &&
            (this.time < this.last_interval || isNaN(this.last_interval))
        ) {
            if (this.inputs && this.inputs.length > 1 && this.inputs[1]) {
                this.setOutputData(1, false);
            }
            return;
        }

        this.triggered = true;
        this.time = this.time % this.last_interval;
        this.trigger("on_tick", this.properties.event);
        if (this.inputs && this.inputs.length > 1 && this.inputs[1]) {
            this.setOutputData(1, true);
        }
    };

    TimerEvent.prototype.onGetInputs = function() {
        return [["interval", "number"]];
    };

    TimerEvent.prototype.onGetOutputs = function() {
        return [["tick", "boolean"]];
    };

    LiteGraph.registerNodeType("events/timer", TimerEvent);

    function DataStore() {
        this.addInput("data", "");
        this.addInput("assign", LiteGraph.ACTION);
        this.addOutput("data", "");
		this._last_value = null;
		this.properties = { data: null, serialize: true };
		var that = this;
		this.addWidget("button","store","",function(){
			that.properties.data = that._last_value;
		});
    }

    DataStore.title = "Data Store";
    DataStore.desc = "Stores data and only changes when event is received";

	DataStore.prototype.onExecute = function()
	{
		this._last_value = this.getInputData(0);
		this.setOutputData(0, this.properties.data );
	}

    DataStore.prototype.onAction = function(action, param) {
		this.properties.data = this._last_value;
    };

	DataStore.prototype.onSerialize = function(o)
	{
		if(o.data == null)
			return;
		if(this.properties.serialize == false || (o.data.constructor !== String && o.data.constructor !== Number && o.data.constructor !== Boolean && o.data.constructor !== Array && o.data.constructor !== Object ))
			o.data = null;
	}

    LiteGraph.registerNodeType("basic/data_store", DataStore);
})(this);

//widgets
(function(global) {
    var LiteGraph = global.LiteGraph;

    /* Button ****************/

    function WidgetButton() {
        this.addOutput("", LiteGraph.EVENT);
        this.addOutput("", "boolean");
        this.addProperty("text", "click me");
        this.addProperty("font_size", 30);
        this.addProperty("message", "");
        this.size = [164, 84];
        this.clicked = false;
    }

    WidgetButton.title = "Button";
    WidgetButton.desc = "Triggers an event";

    WidgetButton.font = "Arial";
    WidgetButton.prototype.onDrawForeground = function(ctx) {
        if (this.flags.collapsed) {
            return;
        }
        var margin = 10;
        ctx.fillStyle = "black";
        ctx.fillRect(
            margin + 1,
            margin + 1,
            this.size[0] - margin * 2,
            this.size[1] - margin * 2
        );
        ctx.fillStyle = "#AAF";
        ctx.fillRect(
            margin - 1,
            margin - 1,
            this.size[0] - margin * 2,
            this.size[1] - margin * 2
        );
        ctx.fillStyle = this.clicked
            ? "white"
            : this.mouseOver
            ? "#668"
            : "#334";
        ctx.fillRect(
            margin,
            margin,
            this.size[0] - margin * 2,
            this.size[1] - margin * 2
        );

        if (this.properties.text || this.properties.text === 0) {
            var font_size = this.properties.font_size || 30;
            ctx.textAlign = "center";
            ctx.fillStyle = this.clicked ? "black" : "white";
            ctx.font = font_size + "px " + WidgetButton.font;
            ctx.fillText(
                this.properties.text,
                this.size[0] * 0.5,
                this.size[1] * 0.5 + font_size * 0.3
            );
            ctx.textAlign = "left";
        }
    };

    WidgetButton.prototype.onMouseDown = function(e, local_pos) {
        if (
            local_pos[0] > 1 &&
            local_pos[1] > 1 &&
            local_pos[0] < this.size[0] - 2 &&
            local_pos[1] < this.size[1] - 2
        ) {
            this.clicked = true;
            this.triggerSlot(0, this.properties.message);
            return true;
        }
    };

    WidgetButton.prototype.onExecute = function() {
        this.setOutputData(1, this.clicked);
    };

    WidgetButton.prototype.onMouseUp = function(e) {
        this.clicked = false;
    };

    LiteGraph.registerNodeType("widget/button", WidgetButton);

    function WidgetToggle() {
        this.addInput("", "boolean");
        this.addInput("e", LiteGraph.ACTION);
        this.addOutput("v", "boolean");
        this.addOutput("e", LiteGraph.EVENT);
        this.properties = { font: "", value: false };
        this.size = [160, 44];
    }

    WidgetToggle.title = "Toggle";
    WidgetToggle.desc = "Toggles between true or false";

    WidgetToggle.prototype.onDrawForeground = function(ctx) {
        if (this.flags.collapsed) {
            return;
        }

        var size = this.size[1] * 0.5;
        var margin = 0.25;
        var h = this.size[1] * 0.8;
        ctx.font = this.properties.font || (size * 0.8).toFixed(0) + "px Arial";
        var w = ctx.measureText(this.title).width;
        var x = (this.size[0] - (w + size)) * 0.5;

        ctx.fillStyle = "#AAA";
        ctx.fillRect(x, h - size, size, size);

        ctx.fillStyle = this.properties.value ? "#AEF" : "#000";
        ctx.fillRect(
            x + size * margin,
            h - size + size * margin,
            size * (1 - margin * 2),
            size * (1 - margin * 2)
        );

        ctx.textAlign = "left";
        ctx.fillStyle = "#AAA";
        ctx.fillText(this.title, size * 1.2 + x, h * 0.85);
        ctx.textAlign = "left";
    };

    WidgetToggle.prototype.onAction = function(action) {
        this.properties.value = !this.properties.value;
        this.trigger("e", this.properties.value);
    };

    WidgetToggle.prototype.onExecute = function() {
        var v = this.getInputData(0);
        if (v != null) {
            this.properties.value = v;
        }
        this.setOutputData(0, this.properties.value);
    };

    WidgetToggle.prototype.onMouseDown = function(e, local_pos) {
        if (
            local_pos[0] > 1 &&
            local_pos[1] > 1 &&
            local_pos[0] < this.size[0] - 2 &&
            local_pos[1] < this.size[1] - 2
        ) {
            this.properties.value = !this.properties.value;
            this.graph._version++;
            this.trigger("e", this.properties.value);
            return true;
        }
    };

    LiteGraph.registerNodeType("widget/toggle", WidgetToggle);

    /* Number ****************/

    function WidgetNumber() {
        this.addOutput("", "number");
        this.size = [80, 60];
        this.properties = { min: -1000, max: 1000, value: 1, step: 1 };
        this.old_y = -1;
        this._remainder = 0;
        this._precision = 0;
        this.mouse_captured = false;
    }

    WidgetNumber.title = "Number";
    WidgetNumber.desc = "Widget to select number value";

    WidgetNumber.pixels_threshold = 10;
    WidgetNumber.markers_color = "#666";

    WidgetNumber.prototype.onDrawForeground = function(ctx) {
        var x = this.size[0] * 0.5;
        var h = this.size[1];
        if (h > 30) {
            ctx.fillStyle = WidgetNumber.markers_color;
            ctx.beginPath();
            ctx.moveTo(x, h * 0.1);
            ctx.lineTo(x + h * 0.1, h * 0.2);
            ctx.lineTo(x + h * -0.1, h * 0.2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(x, h * 0.9);
            ctx.lineTo(x + h * 0.1, h * 0.8);
            ctx.lineTo(x + h * -0.1, h * 0.8);
            ctx.fill();
            ctx.font = (h * 0.7).toFixed(1) + "px Arial";
        } else {
            ctx.font = (h * 0.8).toFixed(1) + "px Arial";
        }

        ctx.textAlign = "center";
        ctx.font = (h * 0.7).toFixed(1) + "px Arial";
        ctx.fillStyle = "#EEE";
        ctx.fillText(
            this.properties.value.toFixed(this._precision),
            x,
            h * 0.75
        );
    };

    WidgetNumber.prototype.onExecute = function() {
        this.setOutputData(0, this.properties.value);
    };

    WidgetNumber.prototype.onPropertyChanged = function(name, value) {
        var t = (this.properties.step + "").split(".");
        this._precision = t.length > 1 ? t[1].length : 0;
    };

    WidgetNumber.prototype.onMouseDown = function(e, pos) {
        if (pos[1] < 0) {
            return;
        }

        this.old_y = e.canvasY;
        this.captureInput(true);
        this.mouse_captured = true;

        return true;
    };

    WidgetNumber.prototype.onMouseMove = function(e) {
        if (!this.mouse_captured) {
            return;
        }

        var delta = this.old_y - e.canvasY;
        if (e.shiftKey) {
            delta *= 10;
        }
        if (e.metaKey || e.altKey) {
            delta *= 0.1;
        }
        this.old_y = e.canvasY;

        var steps = this._remainder + delta / WidgetNumber.pixels_threshold;
        this._remainder = steps % 1;
        steps = steps | 0;

        var v = Math.clamp(
            this.properties.value + steps * this.properties.step,
            this.properties.min,
            this.properties.max
        );
        this.properties.value = v;
        this.graph._version++;
        this.setDirtyCanvas(true);
    };

    WidgetNumber.prototype.onMouseUp = function(e, pos) {
        if (e.click_time < 200) {
            var steps = pos[1] > this.size[1] * 0.5 ? -1 : 1;
            this.properties.value = Math.clamp(
                this.properties.value + steps * this.properties.step,
                this.properties.min,
                this.properties.max
            );
            this.graph._version++;
            this.setDirtyCanvas(true);
        }

        if (this.mouse_captured) {
            this.mouse_captured = false;
            this.captureInput(false);
        }
    };

    LiteGraph.registerNodeType("widget/number", WidgetNumber);


    /* Combo ****************/

    function WidgetCombo() {
        this.addOutput("", "string");
        this.addOutput("change", LiteGraph.EVENT);
        this.size = [80, 60];
        this.properties = { value: "A", values:"A;B;C" };
        this.old_y = -1;
        this.mouse_captured = false;
		this._values = this.properties.values.split(";");
		var that = this;
        this.widgets_up = true;
		this.widget = this.addWidget("combo","", this.properties.value, function(v){
			that.properties.value = v;
            that.triggerSlot(1, v);
		}, { property: "value", values: this._values } );
    }

    WidgetCombo.title = "Combo";
    WidgetCombo.desc = "Widget to select from a list";

    WidgetCombo.prototype.onExecute = function() {
        this.setOutputData( 0, this.properties.value );
    };

    WidgetCombo.prototype.onPropertyChanged = function(name, value) {
		if(name == "values")
		{
			this._values = value.split(";");
			this.widget.options.values = this._values;
		}
		else if(name == "value")
		{
			this.widget.value = value;
		}
	};

    LiteGraph.registerNodeType("widget/combo", WidgetCombo);


    /* Knob ****************/

    function WidgetKnob() {
        this.addOutput("", "number");
        this.size = [64, 84];
        this.properties = {
            min: 0,
            max: 1,
            value: 0.5,
            color: "#7AF",
            precision: 2
        };
        this.value = -1;
    }

    WidgetKnob.title = "Knob";
    WidgetKnob.desc = "Circular controller";
    WidgetKnob.size = [80, 100];

    WidgetKnob.prototype.onDrawForeground = function(ctx) {
        if (this.flags.collapsed) {
            return;
        }

        if (this.value == -1) {
            this.value =
                (this.properties.value - this.properties.min) /
                (this.properties.max - this.properties.min);
        }

        var center_x = this.size[0] * 0.5;
        var center_y = this.size[1] * 0.5;
        var radius = Math.min(this.size[0], this.size[1]) * 0.5 - 5;
        var w = Math.floor(radius * 0.05);

        ctx.globalAlpha = 1;
        ctx.save();
        ctx.translate(center_x, center_y);
        ctx.rotate(Math.PI * 0.75);

        //bg
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, 0, Math.PI * 1.5);
        ctx.fill();

        //value
        ctx.strokeStyle = "black";
        ctx.fillStyle = this.properties.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(
            0,
            0,
            radius - 4,
            0,
            Math.PI * 1.5 * Math.max(0.01, this.value)
        );
        ctx.closePath();
        ctx.fill();
        //ctx.stroke();
        ctx.lineWidth = 1;
        ctx.globalAlpha = 1;
        ctx.restore();

        //inner
        ctx.fillStyle = "black";
        ctx.beginPath();
        ctx.arc(center_x, center_y, radius * 0.75, 0, Math.PI * 2, true);
        ctx.fill();

        //miniball
        ctx.fillStyle = this.mouseOver ? "white" : this.properties.color;
        ctx.beginPath();
        var angle = this.value * Math.PI * 1.5 + Math.PI * 0.75;
        ctx.arc(
            center_x + Math.cos(angle) * radius * 0.65,
            center_y + Math.sin(angle) * radius * 0.65,
            radius * 0.05,
            0,
            Math.PI * 2,
            true
        );
        ctx.fill();

        //text
        ctx.fillStyle = this.mouseOver ? "white" : "#AAA";
        ctx.font = Math.floor(radius * 0.5) + "px Arial";
        ctx.textAlign = "center";
        ctx.fillText(
            this.properties.value.toFixed(this.properties.precision),
            center_x,
            center_y + radius * 0.15
        );
    };

    WidgetKnob.prototype.onExecute = function() {
        this.setOutputData(0, this.properties.value);
        this.boxcolor = LiteGraph.colorToString([
            this.value,
            this.value,
            this.value
        ]);
    };

    WidgetKnob.prototype.onMouseDown = function(e) {
        this.center = [this.size[0] * 0.5, this.size[1] * 0.5 + 20];
        this.radius = this.size[0] * 0.5;
        if (
            e.canvasY - this.pos[1] < 20 ||
            LiteGraph.distance(
                [e.canvasX, e.canvasY],
                [this.pos[0] + this.center[0], this.pos[1] + this.center[1]]
            ) > this.radius
        ) {
            return false;
        }
        this.oldmouse = [e.canvasX - this.pos[0], e.canvasY - this.pos[1]];
        this.captureInput(true);
        return true;
    };

    WidgetKnob.prototype.onMouseMove = function(e) {
        if (!this.oldmouse) {
            return;
        }

        var m = [e.canvasX - this.pos[0], e.canvasY - this.pos[1]];

        var v = this.value;
        v -= (m[1] - this.oldmouse[1]) * 0.01;
        if (v > 1.0) {
            v = 1.0;
        } else if (v < 0.0) {
            v = 0.0;
        }
        this.value = v;
        this.properties.value =
            this.properties.min +
            (this.properties.max - this.properties.min) * this.value;
        this.oldmouse = m;
        this.setDirtyCanvas(true);
    };

    WidgetKnob.prototype.onMouseUp = function(e) {
        if (this.oldmouse) {
            this.oldmouse = null;
            this.captureInput(false);
        }
    };

    WidgetKnob.prototype.onPropertyChanged = function(name, value) {
        if (name == "min" || name == "max" || name == "value") {
            this.properties[name] = parseFloat(value);
            return true; //block
        }
    };

    LiteGraph.registerNodeType("widget/knob", WidgetKnob);

    //Show value inside the debug console
    function WidgetSliderGUI() {
        this.addOutput("", "number");
        this.properties = {
            value: 0.5,
            min: 0,
            max: 1,
            text: "V"
        };
        var that = this;
        this.size = [140, 40];
        this.slider = this.addWidget(
            "slider",
            "V",
            this.properties.value,
            function(v) {
                that.properties.value = v;
            },
            this.properties
        );
        this.widgets_up = true;
    }

    WidgetSliderGUI.title = "Inner Slider";

    WidgetSliderGUI.prototype.onPropertyChanged = function(name, value) {
        if (name == "value") {
            this.slider.value = value;
        }
    };

    WidgetSliderGUI.prototype.onExecute = function() {
        this.setOutputData(0, this.properties.value);
    };

    LiteGraph.registerNodeType("widget/internal_slider", WidgetSliderGUI);

    //Widget H SLIDER
    function WidgetHSlider() {
        this.size = [160, 26];
        this.addOutput("", "number");
        this.properties = { color: "#7AF", min: 0, max: 1, value: 0.5 };
        this.value = -1;
    }

    WidgetHSlider.title = "H.Slider";
    WidgetHSlider.desc = "Linear slider controller";

    WidgetHSlider.prototype.onDrawForeground = function(ctx) {
        if (this.value == -1) {
            this.value =
                (this.properties.value - this.properties.min) /
                (this.properties.max - this.properties.min);
        }

        //border
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1;
        ctx.fillStyle = "#000";
        ctx.fillRect(2, 2, this.size[0] - 4, this.size[1] - 4);

        ctx.fillStyle = this.properties.color;
        ctx.beginPath();
        ctx.rect(4, 4, (this.size[0] - 8) * this.value, this.size[1] - 8);
        ctx.fill();
    };

    WidgetHSlider.prototype.onExecute = function() {
        this.properties.value =
            this.properties.min +
            (this.properties.max - this.properties.min) * this.value;
        this.setOutputData(0, this.properties.value);
        this.boxcolor = LiteGraph.colorToString([
            this.value,
            this.value,
            this.value
        ]);
    };

    WidgetHSlider.prototype.onMouseDown = function(e) {
        if (e.canvasY - this.pos[1] < 0) {
            return false;
        }

        this.oldmouse = [e.canvasX - this.pos[0], e.canvasY - this.pos[1]];
        this.captureInput(true);
        return true;
    };

    WidgetHSlider.prototype.onMouseMove = function(e) {
        if (!this.oldmouse) {
            return;
        }

        var m = [e.canvasX - this.pos[0], e.canvasY - this.pos[1]];

        var v = this.value;
        var delta = m[0] - this.oldmouse[0];
        v += delta / this.size[0];
        if (v > 1.0) {
            v = 1.0;
        } else if (v < 0.0) {
            v = 0.0;
        }

        this.value = v;

        this.oldmouse = m;
        this.setDirtyCanvas(true);
    };

    WidgetHSlider.prototype.onMouseUp = function(e) {
        this.oldmouse = null;
        this.captureInput(false);
    };

    WidgetHSlider.prototype.onMouseLeave = function(e) {
        //this.oldmouse = null;
    };

    LiteGraph.registerNodeType("widget/hslider", WidgetHSlider);

    function WidgetProgress() {
        this.size = [160, 26];
        this.addInput("", "number");
        this.properties = { min: 0, max: 1, value: 0, color: "#AAF" };
    }

    WidgetProgress.title = "Progress";
    WidgetProgress.desc = "Shows data in linear progress";

    WidgetProgress.prototype.onExecute = function() {
        var v = this.getInputData(0);
        if (v != undefined) {
            this.properties["value"] = v;
        }
    };

    WidgetProgress.prototype.onDrawForeground = function(ctx) {
        //border
        ctx.lineWidth = 1;
        ctx.fillStyle = this.properties.color;
        var v =
            (this.properties.value - this.properties.min) /
            (this.properties.max - this.properties.min);
        v = Math.min(1, v);
        v = Math.max(0, v);
        ctx.fillRect(2, 2, (this.size[0] - 4) * v, this.size[1] - 4);
    };

    LiteGraph.registerNodeType("widget/progress", WidgetProgress);

    function WidgetText() {
        this.addInputs("", 0);
        this.properties = {
            value: "...",
            font: "Arial",
            fontsize: 18,
            color: "#AAA",
            align: "left",
            glowSize: 0,
            decimals: 1
        };
    }

    WidgetText.title = "Text";
    WidgetText.desc = "Shows the input value";
    WidgetText.widgets = [
        { name: "resize", text: "Resize box", type: "button" },
        { name: "led_text", text: "LED", type: "minibutton" },
        { name: "normal_text", text: "Normal", type: "minibutton" }
    ];

    WidgetText.prototype.onDrawForeground = function(ctx) {
        //ctx.fillStyle="#000";
        //ctx.fillRect(0,0,100,60);
        ctx.fillStyle = this.properties["color"];
        var v = this.properties["value"];

        if (this.properties["glowSize"]) {
            ctx.shadowColor = this.properties.color;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            ctx.shadowBlur = this.properties["glowSize"];
        } else {
            ctx.shadowColor = "transparent";
        }

        var fontsize = this.properties["fontsize"];

        ctx.textAlign = this.properties["align"];
        ctx.font = fontsize.toString() + "px " + this.properties["font"];
        this.str =
            typeof v == "number" ? v.toFixed(this.properties["decimals"]) : v;

        if (typeof this.str == "string") {
            var lines = this.str.split("\\n");
            for (var i in lines) {
                ctx.fillText(
                    lines[i],
                    this.properties["align"] == "left" ? 15 : this.size[0] - 15,
                    fontsize * -0.15 + fontsize * (parseInt(i) + 1)
                );
            }
        }

        ctx.shadowColor = "transparent";
        this.last_ctx = ctx;
        ctx.textAlign = "left";
    };

    WidgetText.prototype.onExecute = function() {
        var v = this.getInputData(0);
        if (v != null) {
            this.properties["value"] = v;
        }
        //this.setDirtyCanvas(true);
    };

    WidgetText.prototype.resize = function() {
        if (!this.last_ctx) {
            return;
        }

        var lines = this.str.split("\\n");
        this.last_ctx.font =
            this.properties["fontsize"] + "px " + this.properties["font"];
        var max = 0;
        for (var i in lines) {
            var w = this.last_ctx.measureText(lines[i]).width;
            if (max < w) {
                max = w;
            }
        }
        this.size[0] = max + 20;
        this.size[1] = 4 + lines.length * this.properties["fontsize"];

        this.setDirtyCanvas(true);
    };

    WidgetText.prototype.onPropertyChanged = function(name, value) {
        this.properties[name] = value;
        this.str = typeof value == "number" ? value.toFixed(3) : value;
        //this.resize();
        return true;
    };

    LiteGraph.registerNodeType("widget/text", WidgetText);

    function WidgetPanel() {
        this.size = [200, 100];
        this.properties = {
            borderColor: "#ffffff",
            bgcolorTop: "#f0f0f0",
            bgcolorBottom: "#e0e0e0",
            shadowSize: 2,
            borderRadius: 3
        };
    }

    WidgetPanel.title = "Panel";
    WidgetPanel.desc = "Non interactive panel";
    WidgetPanel.widgets = [{ name: "update", text: "Update", type: "button" }];

    WidgetPanel.prototype.createGradient = function(ctx) {
        if (
            this.properties["bgcolorTop"] == "" ||
            this.properties["bgcolorBottom"] == ""
        ) {
            this.lineargradient = 0;
            return;
        }

        this.lineargradient = ctx.createLinearGradient(0, 0, 0, this.size[1]);
        this.lineargradient.addColorStop(0, this.properties["bgcolorTop"]);
        this.lineargradient.addColorStop(1, this.properties["bgcolorBottom"]);
    };

    WidgetPanel.prototype.onDrawForeground = function(ctx) {
        if (this.flags.collapsed) {
            return;
        }

        if (this.lineargradient == null) {
            this.createGradient(ctx);
        }

        if (!this.lineargradient) {
            return;
        }

        ctx.lineWidth = 1;
        ctx.strokeStyle = this.properties["borderColor"];
        //ctx.fillStyle = "#ebebeb";
        ctx.fillStyle = this.lineargradient;

        if (this.properties["shadowSize"]) {
            ctx.shadowColor = "#000";
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            ctx.shadowBlur = this.properties["shadowSize"];
        } else {
            ctx.shadowColor = "transparent";
        }

        ctx.roundRect(
            0,
            0,
            this.size[0] - 1,
            this.size[1] - 1,
            this.properties["shadowSize"]
        );
        ctx.fill();
        ctx.shadowColor = "transparent";
        ctx.stroke();
    };

    LiteGraph.registerNodeType("widget/panel", WidgetPanel);
})(this);

(function(global) {
    var LiteGraph = global.LiteGraph;

    function GamepadInput() {
        this.addOutput("left_x_axis", "number");
        this.addOutput("left_y_axis", "number");
        this.addOutput("button_pressed", LiteGraph.EVENT);
        this.properties = { gamepad_index: 0, threshold: 0.1 };

        this._left_axis = new Float32Array(2);
        this._right_axis = new Float32Array(2);
        this._triggers = new Float32Array(2);
        this._previous_buttons = new Uint8Array(17);
        this._current_buttons = new Uint8Array(17);
    }

    GamepadInput.title = "Gamepad";
    GamepadInput.desc = "gets the input of the gamepad";

    GamepadInput.CENTER = 0;
    GamepadInput.LEFT = 1;
    GamepadInput.RIGHT = 2;
    GamepadInput.UP = 4;
    GamepadInput.DOWN = 8;

    GamepadInput.zero = new Float32Array(2);
    GamepadInput.buttons = [
        "a",
        "b",
        "x",
        "y",
        "lb",
        "rb",
        "lt",
        "rt",
        "back",
        "start",
        "ls",
        "rs",
        "home"
    ];

    GamepadInput.prototype.onExecute = function() {
        //get gamepad
        var gamepad = this.getGamepad();
        var threshold = this.properties.threshold || 0.0;

        if (gamepad) {
            this._left_axis[0] =
                Math.abs(gamepad.xbox.axes["lx"]) > threshold
                    ? gamepad.xbox.axes["lx"]
                    : 0;
            this._left_axis[1] =
                Math.abs(gamepad.xbox.axes["ly"]) > threshold
                    ? gamepad.xbox.axes["ly"]
                    : 0;
            this._right_axis[0] =
                Math.abs(gamepad.xbox.axes["rx"]) > threshold
                    ? gamepad.xbox.axes["rx"]
                    : 0;
            this._right_axis[1] =
                Math.abs(gamepad.xbox.axes["ry"]) > threshold
                    ? gamepad.xbox.axes["ry"]
                    : 0;
            this._triggers[0] =
                Math.abs(gamepad.xbox.axes["ltrigger"]) > threshold
                    ? gamepad.xbox.axes["ltrigger"]
                    : 0;
            this._triggers[1] =
                Math.abs(gamepad.xbox.axes["rtrigger"]) > threshold
                    ? gamepad.xbox.axes["rtrigger"]
                    : 0;
        }

        if (this.outputs) {
            for (var i = 0; i < this.outputs.length; i++) {
                var output = this.outputs[i];
                if (!output.links || !output.links.length) {
                    continue;
                }
                var v = null;

                if (gamepad) {
                    switch (output.name) {
                        case "left_axis":
                            v = this._left_axis;
                            break;
                        case "right_axis":
                            v = this._right_axis;
                            break;
                        case "left_x_axis":
                            v = this._left_axis[0];
                            break;
                        case "left_y_axis":
                            v = this._left_axis[1];
                            break;
                        case "right_x_axis":
                            v = this._right_axis[0];
                            break;
                        case "right_y_axis":
                            v = this._right_axis[1];
                            break;
                        case "trigger_left":
                            v = this._triggers[0];
                            break;
                        case "trigger_right":
                            v = this._triggers[1];
                            break;
                        case "a_button":
                            v = gamepad.xbox.buttons["a"] ? 1 : 0;
                            break;
                        case "b_button":
                            v = gamepad.xbox.buttons["b"] ? 1 : 0;
                            break;
                        case "x_button":
                            v = gamepad.xbox.buttons["x"] ? 1 : 0;
                            break;
                        case "y_button":
                            v = gamepad.xbox.buttons["y"] ? 1 : 0;
                            break;
                        case "lb_button":
                            v = gamepad.xbox.buttons["lb"] ? 1 : 0;
                            break;
                        case "rb_button":
                            v = gamepad.xbox.buttons["rb"] ? 1 : 0;
                            break;
                        case "ls_button":
                            v = gamepad.xbox.buttons["ls"] ? 1 : 0;
                            break;
                        case "rs_button":
                            v = gamepad.xbox.buttons["rs"] ? 1 : 0;
                            break;
                        case "hat_left":
                            v = gamepad.xbox.hatmap & GamepadInput.LEFT;
                            break;
                        case "hat_right":
                            v = gamepad.xbox.hatmap & GamepadInput.RIGHT;
                            break;
                        case "hat_up":
                            v = gamepad.xbox.hatmap & GamepadInput.UP;
                            break;
                        case "hat_down":
                            v = gamepad.xbox.hatmap & GamepadInput.DOWN;
                            break;
                        case "hat":
                            v = gamepad.xbox.hatmap;
                            break;
                        case "start_button":
                            v = gamepad.xbox.buttons["start"] ? 1 : 0;
                            break;
                        case "back_button":
                            v = gamepad.xbox.buttons["back"] ? 1 : 0;
                            break;
                        case "button_pressed":
                            for (
                                var j = 0;
                                j < this._current_buttons.length;
                                ++j
                            ) {
                                if (
                                    this._current_buttons[j] &&
                                    !this._previous_buttons[j]
                                ) {
                                    this.triggerSlot(
                                        i,
                                        GamepadInput.buttons[j]
                                    );
                                }
                            }
                            break;
                        default:
                            break;
                    }
                } else {
                    //if no gamepad is connected, output 0
                    switch (output.name) {
                        case "button_pressed":
                            break;
                        case "left_axis":
                        case "right_axis":
                            v = GamepadInput.zero;
                            break;
                        default:
                            v = 0;
                    }
                }
                this.setOutputData(i, v);
            }
        }
    };

	GamepadInput.mapping = {a:0,b:1,x:2,y:3,lb:4,rb:5,lt:6,rt:7,back:8,start:9,ls:10,rs:11 };
	GamepadInput.mapping_array = ["a","b","x","y","lb","rb","lt","rt","back","start","ls","rs"];

    GamepadInput.prototype.getGamepad = function() {
        var getGamepads =
            navigator.getGamepads ||
            navigator.webkitGetGamepads ||
            navigator.mozGetGamepads;
        if (!getGamepads) {
            return null;
        }
        var gamepads = getGamepads.call(navigator);
        var gamepad = null;

        this._previous_buttons.set(this._current_buttons);

        //pick the first connected
        for (var i = this.properties.gamepad_index; i < 4; i++) {
            if (!gamepads[i]) {
                continue;
            }
            gamepad = gamepads[i];

            //xbox controller mapping
            var xbox = this.xbox_mapping;
            if (!xbox) {
                xbox = this.xbox_mapping = {
                    axes: [],
                    buttons: {},
                    hat: "",
                    hatmap: GamepadInput.CENTER
                };
            }

            xbox.axes["lx"] = gamepad.axes[0];
            xbox.axes["ly"] = gamepad.axes[1];
            xbox.axes["rx"] = gamepad.axes[2];
            xbox.axes["ry"] = gamepad.axes[3];
            xbox.axes["ltrigger"] = gamepad.buttons[6].value;
            xbox.axes["rtrigger"] = gamepad.buttons[7].value;
            xbox.hat = "";
            xbox.hatmap = GamepadInput.CENTER;

            for (var j = 0; j < gamepad.buttons.length; j++) {
                this._current_buttons[j] = gamepad.buttons[j].pressed;

				if(j < 12)
				{
					xbox.buttons[ GamepadInput.mapping_array[j] ] = gamepad.buttons[j].pressed;
					if(gamepad.buttons[j].was_pressed)
						this.trigger( GamepadInput.mapping_array[j] + "_button_event" );
				}
				else //mapping of XBOX
					switch ( j ) //I use a switch to ensure that a player with another gamepad could play
					{
						case 12:
							if (gamepad.buttons[j].pressed) {
								xbox.hat += "up";
								xbox.hatmap |= GamepadInput.UP;
							}
							break;
						case 13:
							if (gamepad.buttons[j].pressed) {
								xbox.hat += "down";
								xbox.hatmap |= GamepadInput.DOWN;
							}
							break;
						case 14:
							if (gamepad.buttons[j].pressed) {
								xbox.hat += "left";
								xbox.hatmap |= GamepadInput.LEFT;
							}
							break;
						case 15:
							if (gamepad.buttons[j].pressed) {
								xbox.hat += "right";
								xbox.hatmap |= GamepadInput.RIGHT;
							}
							break;
						case 16:
							xbox.buttons["home"] = gamepad.buttons[j].pressed;
							break;
						default:
					}
            }
            gamepad.xbox = xbox;
            return gamepad;
        }
    };

    GamepadInput.prototype.onDrawBackground = function(ctx) {
        if (this.flags.collapsed) {
            return;
        }

        //render gamepad state?
        var la = this._left_axis;
        var ra = this._right_axis;
        ctx.strokeStyle = "#88A";
        ctx.strokeRect(
            (la[0] + 1) * 0.5 * this.size[0] - 4,
            (la[1] + 1) * 0.5 * this.size[1] - 4,
            8,
            8
        );
        ctx.strokeStyle = "#8A8";
        ctx.strokeRect(
            (ra[0] + 1) * 0.5 * this.size[0] - 4,
            (ra[1] + 1) * 0.5 * this.size[1] - 4,
            8,
            8
        );
        var h = this.size[1] / this._current_buttons.length;
        ctx.fillStyle = "#AEB";
        for (var i = 0; i < this._current_buttons.length; ++i) {
            if (this._current_buttons[i]) {
                ctx.fillRect(0, h * i, 6, h);
            }
        }
    };

    GamepadInput.prototype.onGetOutputs = function() {
        return [
            ["left_axis", "vec2"],
            ["right_axis", "vec2"],
            ["left_x_axis", "number"],
            ["left_y_axis", "number"],
            ["right_x_axis", "number"],
            ["right_y_axis", "number"],
            ["trigger_left", "number"],
            ["trigger_right", "number"],
            ["a_button", "number"],
            ["b_button", "number"],
            ["x_button", "number"],
            ["y_button", "number"],
            ["lb_button", "number"],
            ["rb_button", "number"],
            ["ls_button", "number"],
            ["rs_button", "number"],
            ["start_button", "number"],
            ["back_button", "number"],
            ["a_button_event", LiteGraph.EVENT ],
            ["b_button_event", LiteGraph.EVENT ],
            ["x_button_event", LiteGraph.EVENT ],
            ["y_button_event", LiteGraph.EVENT ],
            ["lb_button_event", LiteGraph.EVENT ],
            ["rb_button_event", LiteGraph.EVENT ],
            ["ls_button_event", LiteGraph.EVENT ],
            ["rs_button_event", LiteGraph.EVENT ],
            ["start_button_event", LiteGraph.EVENT ],
            ["back_button_event", LiteGraph.EVENT ],
            ["hat_left", "number"],
            ["hat_right", "number"],
            ["hat_up", "number"],
            ["hat_down", "number"],
            ["hat", "number"],
            ["button_pressed", LiteGraph.EVENT]
        ];
    };

    LiteGraph.registerNodeType("input/gamepad", GamepadInput);
})(this);

(function(global) {
    var LiteGraph = global.LiteGraph;

    //Converter
    function Converter() {
        this.addInput("in", "*");
        this.size = [80, 30];
    }

    Converter.title = "Converter";
    Converter.desc = "type A to type B";

    Converter.prototype.onExecute = function() {
        var v = this.getInputData(0);
        if (v == null) {
            return;
        }

        if (this.outputs) {
            for (var i = 0; i < this.outputs.length; i++) {
                var output = this.outputs[i];
                if (!output.links || !output.links.length) {
                    continue;
                }

                var result = null;
                switch (output.name) {
                    case "number":
                        result = v.length ? v[0] : parseFloat(v);
                        break;
                    case "vec2":
                    case "vec3":
                    case "vec4":
                        var result = null;
                        var count = 1;
                        switch (output.name) {
                            case "vec2":
                                count = 2;
                                break;
                            case "vec3":
                                count = 3;
                                break;
                            case "vec4":
                                count = 4;
                                break;
                        }

                        var result = new Float32Array(count);
                        if (v.length) {
                            for (
                                var j = 0;
                                j < v.length && j < result.length;
                                j++
                            ) {
                                result[j] = v[j];
                            }
                        } else {
                            result[0] = parseFloat(v);
                        }
                        break;
                }
                this.setOutputData(i, result);
            }
        }
    };

    Converter.prototype.onGetOutputs = function() {
        return [
            ["number", "number"],
            ["vec2", "vec2"],
            ["vec3", "vec3"],
            ["vec4", "vec4"]
        ];
    };

    LiteGraph.registerNodeType("math/converter", Converter);

    //Bypass
    function Bypass() {
        this.addInput("in");
        this.addOutput("out");
        this.size = [80, 30];
    }

    Bypass.title = "Bypass";
    Bypass.desc = "removes the type";

    Bypass.prototype.onExecute = function() {
        var v = this.getInputData(0);
        this.setOutputData(0, v);
    };

    LiteGraph.registerNodeType("math/bypass", Bypass);

    function ToNumber() {
        this.addInput("in");
        this.addOutput("out");
    }

    ToNumber.title = "to Number";
    ToNumber.desc = "Cast to number";

    ToNumber.prototype.onExecute = function() {
        var v = this.getInputData(0);
        this.setOutputData(0, Number(v));
    };

    LiteGraph.registerNodeType("math/to_number", ToNumber);

    function MathRange() {
        this.addInput("in", "number", { locked: true });
        this.addOutput("out", "number", { locked: true });
        this.addOutput("clamped", "number", { locked: true });

        this.addProperty("in", 0);
        this.addProperty("in_min", 0);
        this.addProperty("in_max", 1);
        this.addProperty("out_min", 0);
        this.addProperty("out_max", 1);

        this.size = [120, 50];
    }

    MathRange.title = "Range";
    MathRange.desc = "Convert a number from one range to another";

    MathRange.prototype.getTitle = function() {
        if (this.flags.collapsed) {
            return (this._last_v || 0).toFixed(2);
        }
        return this.title;
    };

    MathRange.prototype.onExecute = function() {
        if (this.inputs) {
            for (var i = 0; i < this.inputs.length; i++) {
                var input = this.inputs[i];
                var v = this.getInputData(i);
                if (v === undefined) {
                    continue;
                }
                this.properties[input.name] = v;
            }
        }

        var v = this.properties["in"];
        if (v === undefined || v === null || v.constructor !== Number) {
            v = 0;
        }

        var in_min = this.properties.in_min;
        var in_max = this.properties.in_max;
        var out_min = this.properties.out_min;
        var out_max = this.properties.out_max;
		/*
		if( in_min > in_max )
		{
			in_min = in_max;
			in_max = this.properties.in_min;
		}
		if( out_min > out_max )
		{
			out_min = out_max;
			out_max = this.properties.out_min;
		}
		*/

        this._last_v = ((v - in_min) / (in_max - in_min)) * (out_max - out_min) + out_min;
        this.setOutputData(0, this._last_v);
        this.setOutputData(1, Math.clamp( this._last_v, out_min, out_max ));
    };

    MathRange.prototype.onDrawBackground = function(ctx) {
        //show the current value
        if (this._last_v) {
            this.outputs[0].label = this._last_v.toFixed(3);
        } else {
            this.outputs[0].label = "?";
        }
    };

    MathRange.prototype.onGetInputs = function() {
        return [
            ["in_min", "number"],
            ["in_max", "number"],
            ["out_min", "number"],
            ["out_max", "number"]
        ];
    };

    LiteGraph.registerNodeType("math/range", MathRange);

    function MathRand() {
        this.addOutput("value", "number");
        this.addProperty("min", 0);
        this.addProperty("max", 1);
        this.size = [80, 30];
    }

    MathRand.title = "Rand";
    MathRand.desc = "Random number";

    MathRand.prototype.onExecute = function() {
        if (this.inputs) {
            for (var i = 0; i < this.inputs.length; i++) {
                var input = this.inputs[i];
                var v = this.getInputData(i);
                if (v === undefined) {
                    continue;
                }
                this.properties[input.name] = v;
            }
        }

        var min = this.properties.min;
        var max = this.properties.max;
        this._last_v = Math.random() * (max - min) + min;
        this.setOutputData(0, this._last_v);
    };

    MathRand.prototype.onDrawBackground = function(ctx) {
        //show the current value
        this.outputs[0].label = (this._last_v || 0).toFixed(3);
    };

    MathRand.prototype.onGetInputs = function() {
        return [["min", "number"], ["max", "number"]];
    };

    LiteGraph.registerNodeType("math/rand", MathRand);

    //basic continuous noise
    function MathNoise() {
        this.addInput("in", "number");
        this.addOutput("out", "number");
        this.addProperty("min", 0);
        this.addProperty("max", 1);
        this.addProperty("smooth", true);
        this.addProperty("seed", 0);
        this.addProperty("octaves", 1);
        this.addProperty("persistence", 0.8);
        this.addProperty("speed", 1);
        this.size = [90, 30];
    }

    MathNoise.title = "Noise";
    MathNoise.desc = "Random number with temporal continuity";
    MathNoise.data = null;

    MathNoise.getValue = function(f, smooth) {
        if (!MathNoise.data) {
            MathNoise.data = new Float32Array(1024);
            for (var i = 0; i < MathNoise.data.length; ++i) {
                MathNoise.data[i] = Math.random();
            }
        }
        f = f % 1024;
        if (f < 0) {
            f += 1024;
        }
        var f_min = Math.floor(f);
        var f = f - f_min;
        var r1 = MathNoise.data[f_min];
        var r2 = MathNoise.data[f_min == 1023 ? 0 : f_min + 1];
        if (smooth) {
            f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
        }
        return r1 * (1 - f) + r2 * f;
    };

    MathNoise.prototype.onExecute = function() {
        var f = this.getInputData(0) || 0;
		var iterations = this.properties.octaves || 1;
		var r = 0;
		var amp = 1;
		var seed = this.properties.seed || 0;
		f += seed;
		var speed = this.properties.speed || 1;
		var total_amp = 0;
		for(var i = 0; i < iterations; ++i)
		{
			r += MathNoise.getValue(f * (1+i) * speed, this.properties.smooth) * amp;
			total_amp += amp;
			amp *= this.properties.persistence;
			if(amp < 0.001)
				break;
		}
		r /= total_amp;
        var min = this.properties.min;
        var max = this.properties.max;
        this._last_v = r * (max - min) + min;
        this.setOutputData(0, this._last_v);
    };

    MathNoise.prototype.onDrawBackground = function(ctx) {
        //show the current value
        this.outputs[0].label = (this._last_v || 0).toFixed(3);
    };

    LiteGraph.registerNodeType("math/noise", MathNoise);

    //generates spikes every random time
    function MathSpikes() {
        this.addOutput("out", "number");
        this.addProperty("min_time", 1);
        this.addProperty("max_time", 2);
        this.addProperty("duration", 0.2);
        this.size = [90, 30];
        this._remaining_time = 0;
        this._blink_time = 0;
    }

    MathSpikes.title = "Spikes";
    MathSpikes.desc = "spike every random time";

    MathSpikes.prototype.onExecute = function() {
        var dt = this.graph.elapsed_time; //in secs

        this._remaining_time -= dt;
        this._blink_time -= dt;

        var v = 0;
        if (this._blink_time > 0) {
            var f = this._blink_time / this.properties.duration;
            v = 1 / (Math.pow(f * 8 - 4, 4) + 1);
        }

        if (this._remaining_time < 0) {
            this._remaining_time =
                Math.random() *
                    (this.properties.max_time - this.properties.min_time) +
                this.properties.min_time;
            this._blink_time = this.properties.duration;
            this.boxcolor = "#FFF";
        } else {
            this.boxcolor = "#000";
        }
        this.setOutputData(0, v);
    };

    LiteGraph.registerNodeType("math/spikes", MathSpikes);

    //Math clamp
    function MathClamp() {
        this.addInput("in", "number");
        this.addOutput("out", "number");
        this.size = [80, 30];
        this.addProperty("min", 0);
        this.addProperty("max", 1);
    }

    MathClamp.title = "Clamp";
    MathClamp.desc = "Clamp number between min and max";
    //MathClamp.filter = "shader";

    MathClamp.prototype.onExecute = function() {
        var v = this.getInputData(0);
        if (v == null) {
            return;
        }
        v = Math.max(this.properties.min, v);
        v = Math.min(this.properties.max, v);
        this.setOutputData(0, v);
    };

    MathClamp.prototype.getCode = function(lang) {
        var code = "";
        if (this.isInputConnected(0)) {
            code +=
                "clamp({{0}}," +
                this.properties.min +
                "," +
                this.properties.max +
                ")";
        }
        return code;
    };

    LiteGraph.registerNodeType("math/clamp", MathClamp);

    //Math ABS
    function MathLerp() {
        this.properties = { f: 0.5 };
        this.addInput("A", "number");
        this.addInput("B", "number");

        this.addOutput("out", "number");
    }

    MathLerp.title = "Lerp";
    MathLerp.desc = "Linear Interpolation";

    MathLerp.prototype.onExecute = function() {
        var v1 = this.getInputData(0);
        if (v1 == null) {
            v1 = 0;
        }
        var v2 = this.getInputData(1);
        if (v2 == null) {
            v2 = 0;
        }

        var f = this.properties.f;

        var _f = this.getInputData(2);
        if (_f !== undefined) {
            f = _f;
        }

        this.setOutputData(0, v1 * (1 - f) + v2 * f);
    };

    MathLerp.prototype.onGetInputs = function() {
        return [["f", "number"]];
    };

    LiteGraph.registerNodeType("math/lerp", MathLerp);

    //Math ABS
    function MathAbs() {
        this.addInput("in", "number");
        this.addOutput("out", "number");
        this.size = [80, 30];
    }

    MathAbs.title = "Abs";
    MathAbs.desc = "Absolute";

    MathAbs.prototype.onExecute = function() {
        var v = this.getInputData(0);
        if (v == null) {
            return;
        }
        this.setOutputData(0, Math.abs(v));
    };

    LiteGraph.registerNodeType("math/abs", MathAbs);

    //Math Floor
    function MathFloor() {
        this.addInput("in", "number");
        this.addOutput("out", "number");
        this.size = [80, 30];
    }

    MathFloor.title = "Floor";
    MathFloor.desc = "Floor number to remove fractional part";

    MathFloor.prototype.onExecute = function() {
        var v = this.getInputData(0);
        if (v == null) {
            return;
        }
        this.setOutputData(0, Math.floor(v));
    };

    LiteGraph.registerNodeType("math/floor", MathFloor);

    //Math frac
    function MathFrac() {
        this.addInput("in", "number");
        this.addOutput("out", "number");
        this.size = [80, 30];
    }

    MathFrac.title = "Frac";
    MathFrac.desc = "Returns fractional part";

    MathFrac.prototype.onExecute = function() {
        var v = this.getInputData(0);
        if (v == null) {
            return;
        }
        this.setOutputData(0, v % 1);
    };

    LiteGraph.registerNodeType("math/frac", MathFrac);

    //Math Floor
    function MathSmoothStep() {
        this.addInput("in", "number");
        this.addOutput("out", "number");
        this.size = [80, 30];
        this.properties = { A: 0, B: 1 };
    }

    MathSmoothStep.title = "Smoothstep";
    MathSmoothStep.desc = "Smoothstep";

    MathSmoothStep.prototype.onExecute = function() {
        var v = this.getInputData(0);
        if (v === undefined) {
            return;
        }

        var edge0 = this.properties.A;
        var edge1 = this.properties.B;

        // Scale, bias and saturate x to 0..1 range
        v = Math.clamp((v - edge0) / (edge1 - edge0), 0.0, 1.0);
        // Evaluate polynomial
        v = v * v * (3 - 2 * v);

        this.setOutputData(0, v);
    };

    LiteGraph.registerNodeType("math/smoothstep", MathSmoothStep);

    //Math scale
    function MathScale() {
        this.addInput("in", "number", { label: "" });
        this.addOutput("out", "number", { label: "" });
        this.size = [80, 30];
        this.addProperty("factor", 1);
    }

    MathScale.title = "Scale";
    MathScale.desc = "v * factor";

    MathScale.prototype.onExecute = function() {
        var value = this.getInputData(0);
        if (value != null) {
            this.setOutputData(0, value * this.properties.factor);
        }
    };

    LiteGraph.registerNodeType("math/scale", MathScale);

	//Gate
	function Gate() {
		this.addInput("v","boolean");
		this.addInput("A");
		this.addInput("B");
		this.addOutput("out");
	}

	Gate.title = "Gate";
	Gate.desc = "if v is true, then outputs A, otherwise B";

	Gate.prototype.onExecute = function() {
		var v = this.getInputData(0);
		this.setOutputData(0, this.getInputData( v ? 1 : 2 ));
	};

	LiteGraph.registerNodeType("math/gate", Gate);


    //Math Average
    function MathAverageFilter() {
        this.addInput("in", "number");
        this.addOutput("out", "number");
        this.size = [80, 30];
        this.addProperty("samples", 10);
        this._values = new Float32Array(10);
        this._current = 0;
    }

    MathAverageFilter.title = "Average";
    MathAverageFilter.desc = "Average Filter";

    MathAverageFilter.prototype.onExecute = function() {
        var v = this.getInputData(0);
        if (v == null) {
            v = 0;
        }

        var num_samples = this._values.length;

        this._values[this._current % num_samples] = v;
        this._current += 1;
        if (this._current > num_samples) {
            this._current = 0;
        }

        var avr = 0;
        for (var i = 0; i < num_samples; ++i) {
            avr += this._values[i];
        }

        this.setOutputData(0, avr / num_samples);
    };

    MathAverageFilter.prototype.onPropertyChanged = function(name, value) {
        if (value < 1) {
            value = 1;
        }
        this.properties.samples = Math.round(value);
        var old = this._values;

        this._values = new Float32Array(this.properties.samples);
        if (old.length <= this._values.length) {
            this._values.set(old);
        } else {
            this._values.set(old.subarray(0, this._values.length));
        }
    };

    LiteGraph.registerNodeType("math/average", MathAverageFilter);

    //Math
    function MathTendTo() {
        this.addInput("in", "number");
        this.addOutput("out", "number");
        this.addProperty("factor", 0.1);
        this.size = [80, 30];
        this._value = null;
    }

    MathTendTo.title = "TendTo";
    MathTendTo.desc = "moves the output value always closer to the input";

    MathTendTo.prototype.onExecute = function() {
        var v = this.getInputData(0);
        if (v == null) {
            v = 0;
        }
        var f = this.properties.factor;
        if (this._value == null) {
            this._value = v;
        } else {
            this._value = this._value * (1 - f) + v * f;
        }
        this.setOutputData(0, this._value);
    };

    LiteGraph.registerNodeType("math/tendTo", MathTendTo);

    //Math operation
    function MathOperation() {
        this.addInput("A", "number,array,object");
        this.addInput("B", "number");
        this.addOutput("=", "number");
        this.addProperty("A", 1);
        this.addProperty("B", 1);
        this.addProperty("OP", "+", "enum", { values: MathOperation.values });
		this._func = function(A,B) { return A + B; };
		this._result = []; //only used for arrays
    }

    MathOperation.values = ["+", "-", "*", "/", "%", "^", "max", "min"];

	MathOperation.title = "Operation";
    MathOperation.desc = "Easy math operators";
    MathOperation["@OP"] = {
        type: "enum",
        title: "operation",
        values: MathOperation.values
    };
    MathOperation.size = [100, 60];

    MathOperation.prototype.getTitle = function() {
		if(this.properties.OP == "max" || this.properties.OP == "min")
			return this.properties.OP + "(A,B)";
        return "A " + this.properties.OP + " B";
    };

    MathOperation.prototype.setValue = function(v) {
        if (typeof v == "string") {
            v = parseFloat(v);
        }
        this.properties["value"] = v;
    };

    MathOperation.prototype.onPropertyChanged = function(name, value)
	{
		if (name != "OP")
			return;
        switch (this.properties.OP) {
            case "+": this._func = function(A,B) { return A + B; }; break;
            case "-": this._func = function(A,B) { return A - B; }; break;
            case "x":
            case "X":
            case "*": this._func = function(A,B) { return A * B; }; break;
            case "/": this._func = function(A,B) { return A / B; }; break;
            case "%": this._func = function(A,B) { return A % B; }; break;
            case "^": this._func = function(A,B) { return Math.pow(A, B); }; break;
            case "max": this._func = function(A,B) { return Math.max(A, B); }; break;
            case "min": this._func = function(A,B) { return Math.min(A, B); }; break;
			default: 
				console.warn("Unknown operation: " + this.properties.OP);
				this._func = function(A) { return A; };
				break;
        }
	}

    MathOperation.prototype.onExecute = function() {
        var A = this.getInputData(0);
        var B = this.getInputData(1);
        if ( A != null ) {
			if( A.constructor === Number )
	            this.properties["A"] = A;
        } else {
            A = this.properties["A"];
        }

        if (B != null) {
            this.properties["B"] = B;
        } else {
            B = this.properties["B"];
        }

		var result;
		if(A.constructor === Number)
		{
	        result = 0;
			result = this._func(A,B);
		}
		else if(A.constructor === Array)
		{
			result = this._result;
			result.length = A.length;
			for(var i = 0; i < A.length; ++i)
				result[i] = this._func(A[i],B);
		}
		else
		{
			result = {};
			for(var i in A)
				result[i] = this._func(A[i],B);
		}
	    this.setOutputData(0, result);
    };

    MathOperation.prototype.onDrawBackground = function(ctx) {
        if (this.flags.collapsed) {
            return;
        }

        ctx.font = "40px Arial";
        ctx.fillStyle = "#666";
        ctx.textAlign = "center";
        ctx.fillText(
            this.properties.OP,
            this.size[0] * 0.5,
            (this.size[1] + LiteGraph.NODE_TITLE_HEIGHT) * 0.5
        );
        ctx.textAlign = "left";
    };

    LiteGraph.registerNodeType("math/operation", MathOperation);

    LiteGraph.registerSearchboxExtra("math/operation", "MAX", {
        properties: {OP:"max"},
        title: "MAX()"
    });

    LiteGraph.registerSearchboxExtra("math/operation", "MIN", {
        properties: {OP:"min"},
        title: "MIN()"
    });


    //Math compare
    function MathCompare() {
        this.addInput("A", "number");
        this.addInput("B", "number");
        this.addOutput("A==B", "boolean");
        this.addOutput("A!=B", "boolean");
        this.addProperty("A", 0);
        this.addProperty("B", 0);
    }

    MathCompare.title = "Compare";
    MathCompare.desc = "compares between two values";

    MathCompare.prototype.onExecute = function() {
        var A = this.getInputData(0);
        var B = this.getInputData(1);
        if (A !== undefined) {
            this.properties["A"] = A;
        } else {
            A = this.properties["A"];
        }

        if (B !== undefined) {
            this.properties["B"] = B;
        } else {
            B = this.properties["B"];
        }

        for (var i = 0, l = this.outputs.length; i < l; ++i) {
            var output = this.outputs[i];
            if (!output.links || !output.links.length) {
                continue;
            }
            var value;
            switch (output.name) {
                case "A==B":
                    value = A == B;
                    break;
                case "A!=B":
                    value = A != B;
                    break;
                case "A>B":
                    value = A > B;
                    break;
                case "A<B":
                    value = A < B;
                    break;
                case "A<=B":
                    value = A <= B;
                    break;
                case "A>=B":
                    value = A >= B;
                    break;
            }
            this.setOutputData(i, value);
        }
    };

    MathCompare.prototype.onGetOutputs = function() {
        return [
            ["A==B", "boolean"],
            ["A!=B", "boolean"],
            ["A>B", "boolean"],
            ["A<B", "boolean"],
            ["A>=B", "boolean"],
            ["A<=B", "boolean"]
        ];
    };

    LiteGraph.registerNodeType("math/compare", MathCompare);

    LiteGraph.registerSearchboxExtra("math/compare", "==", {
        outputs: [["A==B", "boolean"]],
        title: "A==B"
    });
    LiteGraph.registerSearchboxExtra("math/compare", "!=", {
        outputs: [["A!=B", "boolean"]],
        title: "A!=B"
    });
    LiteGraph.registerSearchboxExtra("math/compare", ">", {
        outputs: [["A>B", "boolean"]],
        title: "A>B"
    });
    LiteGraph.registerSearchboxExtra("math/compare", "<", {
        outputs: [["A<B", "boolean"]],
        title: "A<B"
    });
    LiteGraph.registerSearchboxExtra("math/compare", ">=", {
        outputs: [["A>=B", "boolean"]],
        title: "A>=B"
    });
    LiteGraph.registerSearchboxExtra("math/compare", "<=", {
        outputs: [["A<=B", "boolean"]],
        title: "A<=B"
    });

    function MathCondition() {
        this.addInput("A", "number");
        this.addInput("B", "number");
        this.addOutput("true", "boolean");
        this.addOutput("false", "boolean");
        this.addProperty("A", 1);
        this.addProperty("B", 1);
        this.addProperty("OP", ">", "enum", { values: MathCondition.values });

        this.size = [80, 60];
    }

    MathCondition.values = [">", "<", "==", "!=", "<=", ">=", "||", "&&" ];
    MathCondition["@OP"] = {
        type: "enum",
        title: "operation",
        values: MathCondition.values
    };

    MathCondition.title = "Condition";
    MathCondition.desc = "evaluates condition between A and B";

    MathCondition.prototype.getTitle = function() {
        return "A " + this.properties.OP + " B";
    };

    MathCondition.prototype.onExecute = function() {
        var A = this.getInputData(0);
        if (A === undefined) {
            A = this.properties.A;
        } else {
            this.properties.A = A;
        }

        var B = this.getInputData(1);
        if (B === undefined) {
            B = this.properties.B;
        } else {
            this.properties.B = B;
        }

        var result = true;
        switch (this.properties.OP) {
            case ">":
                result = A > B;
                break;
            case "<":
                result = A < B;
                break;
            case "==":
                result = A == B;
                break;
            case "!=":
                result = A != B;
                break;
            case "<=":
                result = A <= B;
                break;
            case ">=":
                result = A >= B;
                break;
            case "||":
                result = A || B;
                break;
            case "&&":
                result = A && B;
                break;
        }

        this.setOutputData(0, result);
        this.setOutputData(1, !result);
    };

    LiteGraph.registerNodeType("math/condition", MathCondition);

    function MathAccumulate() {
        this.addInput("inc", "number");
        this.addOutput("total", "number");
        this.addProperty("increment", 1);
        this.addProperty("value", 0);
    }

    MathAccumulate.title = "Accumulate";
    MathAccumulate.desc = "Increments a value every time";

    MathAccumulate.prototype.onExecute = function() {
        if (this.properties.value === null) {
            this.properties.value = 0;
        }

        var inc = this.getInputData(0);
        if (inc !== null) {
            this.properties.value += inc;
        } else {
            this.properties.value += this.properties.increment;
        }
        this.setOutputData(0, this.properties.value);
    };

    LiteGraph.registerNodeType("math/accumulate", MathAccumulate);

    //Math Trigonometry
    function MathTrigonometry() {
        this.addInput("v", "number");
        this.addOutput("sin", "number");

        this.addProperty("amplitude", 1);
        this.addProperty("offset", 0);
        this.bgImageUrl = "nodes/imgs/icon-sin.png";
    }

    MathTrigonometry.title = "Trigonometry";
    MathTrigonometry.desc = "Sin Cos Tan";
    //MathTrigonometry.filter = "shader";

    MathTrigonometry.prototype.onExecute = function() {
        var v = this.getInputData(0);
        if (v == null) {
            v = 0;
        }
        var amplitude = this.properties["amplitude"];
        var slot = this.findInputSlot("amplitude");
        if (slot != -1) {
            amplitude = this.getInputData(slot);
        }
        var offset = this.properties["offset"];
        slot = this.findInputSlot("offset");
        if (slot != -1) {
            offset = this.getInputData(slot);
        }

        for (var i = 0, l = this.outputs.length; i < l; ++i) {
            var output = this.outputs[i];
            var value;
            switch (output.name) {
                case "sin":
                    value = Math.sin(v);
                    break;
                case "cos":
                    value = Math.cos(v);
                    break;
                case "tan":
                    value = Math.tan(v);
                    break;
                case "asin":
                    value = Math.asin(v);
                    break;
                case "acos":
                    value = Math.acos(v);
                    break;
                case "atan":
                    value = Math.atan(v);
                    break;
            }
            this.setOutputData(i, amplitude * value + offset);
        }
    };

    MathTrigonometry.prototype.onGetInputs = function() {
        return [["v", "number"], ["amplitude", "number"], ["offset", "number"]];
    };

    MathTrigonometry.prototype.onGetOutputs = function() {
        return [
            ["sin", "number"],
            ["cos", "number"],
            ["tan", "number"],
            ["asin", "number"],
            ["acos", "number"],
            ["atan", "number"]
        ];
    };

    LiteGraph.registerNodeType("math/trigonometry", MathTrigonometry);

    LiteGraph.registerSearchboxExtra("math/trigonometry", "SIN()", {
        outputs: [["sin", "number"]],
        title: "SIN()"
    });
    LiteGraph.registerSearchboxExtra("math/trigonometry", "COS()", {
        outputs: [["cos", "number"]],
        title: "COS()"
    });
    LiteGraph.registerSearchboxExtra("math/trigonometry", "TAN()", {
        outputs: [["tan", "number"]],
        title: "TAN()"
    });

    //math library for safe math operations without eval
    function MathFormula() {
        this.addInput("x", "number");
        this.addInput("y", "number");
        this.addOutput("", "number");
        this.properties = { x: 1.0, y: 1.0, formula: "x+y" };
        this.code_widget = this.addWidget(
            "text",
            "F(x,y)",
            this.properties.formula,
            function(v, canvas, node) {
                node.properties.formula = v;
            }
        );
        this.addWidget("toggle", "allow", LiteGraph.allow_scripts, function(v) {
            LiteGraph.allow_scripts = v;
        });
        this._func = null;
    }

    MathFormula.title = "Formula";
    MathFormula.desc = "Compute formula";
    MathFormula.size = [160, 100];

    MathAverageFilter.prototype.onPropertyChanged = function(name, value) {
        if (name == "formula") {
            this.code_widget.value = value;
        }
    };

    MathFormula.prototype.onExecute = function() {
        if (!LiteGraph.allow_scripts) {
            return;
        }

        var x = this.getInputData(0);
        var y = this.getInputData(1);
        if (x != null) {
            this.properties["x"] = x;
        } else {
            x = this.properties["x"];
        }

        if (y != null) {
            this.properties["y"] = y;
        } else {
            y = this.properties["y"];
        }

        var f = this.properties["formula"];

        var value;
        try {
            if (!this._func || this._func_code != this.properties.formula) {
                this._func = new Function(
                    "x",
                    "y",
                    "TIME",
                    "return " + this.properties.formula
                );
                this._func_code = this.properties.formula;
            }
            value = this._func(x, y, this.graph.globaltime);
            this.boxcolor = null;
        } catch (err) {
            this.boxcolor = "red";
        }
        this.setOutputData(0, value);
    };

    MathFormula.prototype.getTitle = function() {
        return this._func_code || "Formula";
    };

    MathFormula.prototype.onDrawBackground = function() {
        var f = this.properties["formula"];
        if (this.outputs && this.outputs.length) {
            this.outputs[0].label = f;
        }
    };

    LiteGraph.registerNodeType("math/formula", MathFormula);

    function Math3DVec2ToXY() {
        this.addInput("vec2", "vec2");
        this.addOutput("x", "number");
        this.addOutput("y", "number");
    }

    Math3DVec2ToXY.title = "Vec2->XY";
    Math3DVec2ToXY.desc = "vector 2 to components";

    Math3DVec2ToXY.prototype.onExecute = function() {
        var v = this.getInputData(0);
        if (v == null) {
            return;
        }

        this.setOutputData(0, v[0]);
        this.setOutputData(1, v[1]);
    };

    LiteGraph.registerNodeType("math3d/vec2-to-xy", Math3DVec2ToXY);

    function Math3DXYToVec2() {
        this.addInputs([["x", "number"], ["y", "number"]]);
        this.addOutput("vec2", "vec2");
        this.properties = { x: 0, y: 0 };
        this._data = new Float32Array(2);
    }

    Math3DXYToVec2.title = "XY->Vec2";
    Math3DXYToVec2.desc = "components to vector2";

    Math3DXYToVec2.prototype.onExecute = function() {
        var x = this.getInputData(0);
        if (x == null) {
            x = this.properties.x;
        }
        var y = this.getInputData(1);
        if (y == null) {
            y = this.properties.y;
        }

        var data = this._data;
        data[0] = x;
        data[1] = y;

        this.setOutputData(0, data);
    };

    LiteGraph.registerNodeType("math3d/xy-to-vec2", Math3DXYToVec2);

    function Math3DVec3ToXYZ() {
        this.addInput("vec3", "vec3");
        this.addOutput("x", "number");
        this.addOutput("y", "number");
        this.addOutput("z", "number");
    }

    Math3DVec3ToXYZ.title = "Vec3->XYZ";
    Math3DVec3ToXYZ.desc = "vector 3 to components";

    Math3DVec3ToXYZ.prototype.onExecute = function() {
        var v = this.getInputData(0);
        if (v == null) {
            return;
        }

        this.setOutputData(0, v[0]);
        this.setOutputData(1, v[1]);
        this.setOutputData(2, v[2]);
    };

    LiteGraph.registerNodeType("math3d/vec3-to-xyz", Math3DVec3ToXYZ);

    function Math3DXYZToVec3() {
        this.addInputs([["x", "number"], ["y", "number"], ["z", "number"]]);
        this.addOutput("vec3", "vec3");
        this.properties = { x: 0, y: 0, z: 0 };
        this._data = new Float32Array(3);
    }

    Math3DXYZToVec3.title = "XYZ->Vec3";
    Math3DXYZToVec3.desc = "components to vector3";

    Math3DXYZToVec3.prototype.onExecute = function() {
        var x = this.getInputData(0);
        if (x == null) {
            x = this.properties.x;
        }
        var y = this.getInputData(1);
        if (y == null) {
            y = this.properties.y;
        }
        var z = this.getInputData(2);
        if (z == null) {
            z = this.properties.z;
        }

        var data = this._data;
        data[0] = x;
        data[1] = y;
        data[2] = z;

        this.setOutputData(0, data);
    };

    LiteGraph.registerNodeType("math3d/xyz-to-vec3", Math3DXYZToVec3);

    function Math3DVec4ToXYZW() {
        this.addInput("vec4", "vec4");
        this.addOutput("x", "number");
        this.addOutput("y", "number");
        this.addOutput("z", "number");
        this.addOutput("w", "number");
    }

    Math3DVec4ToXYZW.title = "Vec4->XYZW";
    Math3DVec4ToXYZW.desc = "vector 4 to components";

    Math3DVec4ToXYZW.prototype.onExecute = function() {
        var v = this.getInputData(0);
        if (v == null) {
            return;
        }

        this.setOutputData(0, v[0]);
        this.setOutputData(1, v[1]);
        this.setOutputData(2, v[2]);
        this.setOutputData(3, v[3]);
    };

    LiteGraph.registerNodeType("math3d/vec4-to-xyzw", Math3DVec4ToXYZW);

    function Math3DXYZWToVec4() {
        this.addInputs([
            ["x", "number"],
            ["y", "number"],
            ["z", "number"],
            ["w", "number"]
        ]);
        this.addOutput("vec4", "vec4");
        this.properties = { x: 0, y: 0, z: 0, w: 0 };
        this._data = new Float32Array(4);
    }

    Math3DXYZWToVec4.title = "XYZW->Vec4";
    Math3DXYZWToVec4.desc = "components to vector4";

    Math3DXYZWToVec4.prototype.onExecute = function() {
        var x = this.getInputData(0);
        if (x == null) {
            x = this.properties.x;
        }
        var y = this.getInputData(1);
        if (y == null) {
            y = this.properties.y;
        }
        var z = this.getInputData(2);
        if (z == null) {
            z = this.properties.z;
        }
        var w = this.getInputData(3);
        if (w == null) {
            w = this.properties.w;
        }

        var data = this._data;
        data[0] = x;
        data[1] = y;
        data[2] = z;
        data[3] = w;

        this.setOutputData(0, data);
    };

    LiteGraph.registerNodeType("math3d/xyzw-to-vec4", Math3DXYZWToVec4);

})(this);

(function(global) {
    var LiteGraph = global.LiteGraph;


	function Math3DMat4()
	{
        this.addInput("T", "vec3");
        this.addInput("R", "vec3");
        this.addInput("S", "vec3");
        this.addOutput("mat4", "mat4");
		this.properties = {
			"T":[0,0,0],
			"R":[0,0,0],
			"S":[1,1,1],
			R_in_degrees: true
		};
		this._result = mat4.create();
		this._must_update = true;
	}

	Math3DMat4.title = "mat4";
	Math3DMat4.temp_quat = new Float32Array([0,0,0,1]);
	Math3DMat4.temp_mat4 = new Float32Array(16);
	Math3DMat4.temp_vec3 = new Float32Array(3);

	Math3DMat4.prototype.onPropertyChanged = function(name, value)
	{
		this._must_update = true;
	}

	Math3DMat4.prototype.onExecute = function()
	{
		var M = this._result;
		var Q = Math3DMat4.temp_quat;
		var temp_mat4 = Math3DMat4.temp_mat4;
		var temp_vec3 = Math3DMat4.temp_vec3;

		var T = this.getInputData(0);
		var R = this.getInputData(1);
		var S = this.getInputData(2);

		if( this._must_update || T || R || S )
		{
			T = T || this.properties.T;
			R = R || this.properties.R;
			S = S || this.properties.S;
			mat4.identity( M );
			mat4.translate( M, M, T );
			if(this.properties.R_in_degrees)
			{
				temp_vec3.set( R );
				vec3.scale(temp_vec3,temp_vec3,DEG2RAD);
				quat.fromEuler( Q, temp_vec3 );
			}
			else
				quat.fromEuler( Q, R );
			mat4.fromQuat( temp_mat4, Q );
			mat4.multiply( M, M, temp_mat4 );
			mat4.scale( M, M, S );
		}

		this.setOutputData(0, M);		
	}

    LiteGraph.registerNodeType("math3d/mat4", Math3DMat4);

    //Math 3D operation
    function Math3DOperation() {
        this.addInput("A", "number,vec3");
        this.addInput("B", "number,vec3");
        this.addOutput("=", "number,vec3");
        this.addProperty("OP", "+", "enum", { values: Math3DOperation.values });
		this._result = vec3.create();
    }

    Math3DOperation.values = ["+", "-", "*", "/", "%", "^", "max", "min","dot","cross"];

    LiteGraph.registerSearchboxExtra("math3d/operation", "CROSS()", {
        properties: {"OP":"cross"},
        title: "CROSS()"
    });

    LiteGraph.registerSearchboxExtra("math3d/operation", "DOT()", {
        properties: {"OP":"dot"},
        title: "DOT()"
    });

	Math3DOperation.title = "Operation";
    Math3DOperation.desc = "Easy math 3D operators";
    Math3DOperation["@OP"] = {
        type: "enum",
        title: "operation",
        values: Math3DOperation.values
    };
    Math3DOperation.size = [100, 60];

    Math3DOperation.prototype.getTitle = function() {
		if(this.properties.OP == "max" || this.properties.OP == "min" )
			return this.properties.OP + "(A,B)";
        return "A " + this.properties.OP + " B";
    };

    Math3DOperation.prototype.onExecute = function() {
        var A = this.getInputData(0);
        var B = this.getInputData(1);
		if(A == null || B == null)
			return;
		if(A.constructor === Number)
			A = [A,A,A];
		if(B.constructor === Number)
			B = [B,B,B];

        var result = this._result;
        switch (this.properties.OP) {
            case "+":
                result = vec3.add(result,A,B);
                break;
            case "-":
                result = vec3.sub(result,A,B);
                break;
            case "x":
            case "X":
            case "*":
                result = vec3.mul(result,A,B);
                break;
            case "/":
                result = vec3.div(result,A,B);
                break;
            case "%":
                result[0] = A[0]%B[0];
                result[1] = A[1]%B[1];
                result[2] = A[2]%B[2];
                break;
            case "^":
                result[0] = Math.pow(A[0],B[0]);
                result[1] = Math.pow(A[1],B[1]);
                result[2] = Math.pow(A[2],B[2]);
                break;
            case "max":
                result[0] = Math.max(A[0],B[0]);
                result[1] = Math.max(A[1],B[1]);
                result[2] = Math.max(A[2],B[2]);
                break;
            case "min":
                result[0] = Math.min(A[0],B[0]);
                result[1] = Math.min(A[1],B[1]);
                result[2] = Math.min(A[2],B[2]);
            case "dot":
                result = vec3.dot(A,B);
                break;
            case "cross":
                vec3.cross(result,A,B);
                break;
            default:
                console.warn("Unknown operation: " + this.properties.OP);
        }
        this.setOutputData(0, result);
    };

    Math3DOperation.prototype.onDrawBackground = function(ctx) {
        if (this.flags.collapsed) {
            return;
        }

        ctx.font = "40px Arial";
        ctx.fillStyle = "#666";
        ctx.textAlign = "center";
        ctx.fillText(
            this.properties.OP,
            this.size[0] * 0.5,
            (this.size[1] + LiteGraph.NODE_TITLE_HEIGHT) * 0.5
        );
        ctx.textAlign = "left";
    };

    LiteGraph.registerNodeType("math3d/operation", Math3DOperation);

    function Math3DVec3Scale() {
        this.addInput("in", "vec3");
        this.addInput("f", "number");
        this.addOutput("out", "vec3");
        this.properties = { f: 1 };
        this._data = new Float32Array(3);
    }

    Math3DVec3Scale.title = "vec3_scale";
    Math3DVec3Scale.desc = "scales the components of a vec3";

    Math3DVec3Scale.prototype.onExecute = function() {
        var v = this.getInputData(0);
        if (v == null) {
            return;
        }
        var f = this.getInputData(1);
        if (f == null) {
            f = this.properties.f;
        }

        var data = this._data;
        data[0] = v[0] * f;
        data[1] = v[1] * f;
        data[2] = v[2] * f;
        this.setOutputData(0, data);
    };

    LiteGraph.registerNodeType("math3d/vec3-scale", Math3DVec3Scale);

    function Math3DVec3Length() {
        this.addInput("in", "vec3");
        this.addOutput("out", "number");
    }

    Math3DVec3Length.title = "vec3_length";
    Math3DVec3Length.desc = "returns the module of a vector";

    Math3DVec3Length.prototype.onExecute = function() {
        var v = this.getInputData(0);
        if (v == null) {
            return;
        }
        var dist = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
        this.setOutputData(0, dist);
    };

    LiteGraph.registerNodeType("math3d/vec3-length", Math3DVec3Length);

    function Math3DVec3Normalize() {
        this.addInput("in", "vec3");
        this.addOutput("out", "vec3");
        this._data = new Float32Array(3);
    }

    Math3DVec3Normalize.title = "vec3_normalize";
    Math3DVec3Normalize.desc = "returns the vector normalized";

    Math3DVec3Normalize.prototype.onExecute = function() {
        var v = this.getInputData(0);
        if (v == null) {
            return;
        }
        var dist = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
        var data = this._data;
        data[0] = v[0] / dist;
        data[1] = v[1] / dist;
        data[2] = v[2] / dist;

        this.setOutputData(0, data);
    };

    LiteGraph.registerNodeType("math3d/vec3-normalize", Math3DVec3Normalize);

    function Math3DVec3Lerp() {
        this.addInput("A", "vec3");
        this.addInput("B", "vec3");
        this.addInput("f", "vec3");
        this.addOutput("out", "vec3");
        this.properties = { f: 0.5 };
        this._data = new Float32Array(3);
    }

    Math3DVec3Lerp.title = "vec3_lerp";
    Math3DVec3Lerp.desc = "returns the interpolated vector";

    Math3DVec3Lerp.prototype.onExecute = function() {
        var A = this.getInputData(0);
        if (A == null) {
            return;
        }
        var B = this.getInputData(1);
        if (B == null) {
            return;
        }
        var f = this.getInputOrProperty("f");

        var data = this._data;
        data[0] = A[0] * (1 - f) + B[0] * f;
        data[1] = A[1] * (1 - f) + B[1] * f;
        data[2] = A[2] * (1 - f) + B[2] * f;

        this.setOutputData(0, data);
    };

    LiteGraph.registerNodeType("math3d/vec3-lerp", Math3DVec3Lerp);

    function Math3DVec3Dot() {
        this.addInput("A", "vec3");
        this.addInput("B", "vec3");
        this.addOutput("out", "number");
    }

    Math3DVec3Dot.title = "vec3_dot";
    Math3DVec3Dot.desc = "returns the dot product";

    Math3DVec3Dot.prototype.onExecute = function() {
        var A = this.getInputData(0);
        if (A == null) {
            return;
        }
        var B = this.getInputData(1);
        if (B == null) {
            return;
        }

        var dot = A[0] * B[0] + A[1] * B[1] + A[2] * B[2];
        this.setOutputData(0, dot);
    };

    LiteGraph.registerNodeType("math3d/vec3-dot", Math3DVec3Dot);

    //if glMatrix is installed...
    if (global.glMatrix) {
        function Math3DQuaternion() {
            this.addOutput("quat", "quat");
            this.properties = { x: 0, y: 0, z: 0, w: 1, normalize: false };
            this._value = quat.create();
        }

        Math3DQuaternion.title = "Quaternion";
        Math3DQuaternion.desc = "quaternion";

        Math3DQuaternion.prototype.onExecute = function() {
            this._value[0] = this.getInputOrProperty("x");
            this._value[1] = this.getInputOrProperty("y");
            this._value[2] = this.getInputOrProperty("z");
            this._value[3] = this.getInputOrProperty("w");
            if (this.properties.normalize) {
                quat.normalize(this._value, this._value);
            }
            this.setOutputData(0, this._value);
        };

        Math3DQuaternion.prototype.onGetInputs = function() {
            return [
                ["x", "number"],
                ["y", "number"],
                ["z", "number"],
                ["w", "number"]
            ];
        };

        LiteGraph.registerNodeType("math3d/quaternion", Math3DQuaternion);

        function Math3DRotation() {
            this.addInputs([["degrees", "number"], ["axis", "vec3"]]);
            this.addOutput("quat", "quat");
            this.properties = { angle: 90.0, axis: vec3.fromValues(0, 1, 0) };

            this._value = quat.create();
        }

        Math3DRotation.title = "Rotation";
        Math3DRotation.desc = "quaternion rotation";

        Math3DRotation.prototype.onExecute = function() {
            var angle = this.getInputData(0);
            if (angle == null) {
                angle = this.properties.angle;
            }
            var axis = this.getInputData(1);
            if (axis == null) {
                axis = this.properties.axis;
            }

            var R = quat.setAxisAngle(this._value, axis, angle * 0.0174532925);
            this.setOutputData(0, R);
        };

        LiteGraph.registerNodeType("math3d/rotation", Math3DRotation);


        function MathEulerToQuat() {
            this.addInput("euler", "vec3");
            this.addOutput("quat", "quat");
            this.properties = { euler:[0,0,0], use_yaw_pitch_roll: false };
			this._degs = vec3.create();
            this._value = quat.create();
        }

        MathEulerToQuat.title = "Euler->Quat";
        MathEulerToQuat.desc = "Converts euler angles (in degrees) to quaternion";

        MathEulerToQuat.prototype.onExecute = function() {
            var euler = this.getInputData(0);
            if (euler == null) {
                euler = this.properties.euler;
            }
			vec3.scale( this._degs, euler, DEG2RAD );
			if(this.properties.use_yaw_pitch_roll)
				this._degs = [this._degs[2],this._degs[0],this._degs[1]];
            var R = quat.fromEuler(this._value, this._degs);
            this.setOutputData(0, R);
        };

        LiteGraph.registerNodeType("math3d/euler_to_quat", MathEulerToQuat);

        function MathQuatToEuler() {
            this.addInput(["quat", "quat"]);
            this.addOutput("euler", "vec3");
			this._value = vec3.create();
        }

        MathQuatToEuler.title = "Euler->Quat";
        MathQuatToEuler.desc = "Converts rotX,rotY,rotZ in degrees to quat";

        MathQuatToEuler.prototype.onExecute = function() {
            var q = this.getInputData(0);
			if(!q)
				return;
            var R = quat.toEuler(this._value, q);
			vec3.scale( this._value, this._value, DEG2RAD );
            this.setOutputData(0, this._value);
        };

        LiteGraph.registerNodeType("math3d/quat_to_euler", MathQuatToEuler);


        //Math3D rotate vec3
        function Math3DRotateVec3() {
            this.addInputs([["vec3", "vec3"], ["quat", "quat"]]);
            this.addOutput("result", "vec3");
            this.properties = { vec: [0, 0, 1] };
        }

        Math3DRotateVec3.title = "Rot. Vec3";
        Math3DRotateVec3.desc = "rotate a point";

        Math3DRotateVec3.prototype.onExecute = function() {
            var vec = this.getInputData(0);
            if (vec == null) {
                vec = this.properties.vec;
            }
            var quat = this.getInputData(1);
            if (quat == null) {
                this.setOutputData(vec);
            } else {
                this.setOutputData(
                    0,
                    vec3.transformQuat(vec3.create(), vec, quat)
                );
            }
        };

        LiteGraph.registerNodeType("math3d/rotate_vec3", Math3DRotateVec3);

        function Math3DMultQuat() {
            this.addInputs([["A", "quat"], ["B", "quat"]]);
            this.addOutput("A*B", "quat");

            this._value = quat.create();
        }

        Math3DMultQuat.title = "Mult. Quat";
        Math3DMultQuat.desc = "rotate quaternion";

        Math3DMultQuat.prototype.onExecute = function() {
            var A = this.getInputData(0);
            if (A == null) {
                return;
            }
            var B = this.getInputData(1);
            if (B == null) {
                return;
            }

            var R = quat.multiply(this._value, A, B);
            this.setOutputData(0, R);
        };

        LiteGraph.registerNodeType("math3d/mult-quat", Math3DMultQuat);

        function Math3DQuatSlerp() {
            this.addInputs([
                ["A", "quat"],
                ["B", "quat"],
                ["factor", "number"]
            ]);
            this.addOutput("slerp", "quat");
            this.addProperty("factor", 0.5);

            this._value = quat.create();
        }

        Math3DQuatSlerp.title = "Quat Slerp";
        Math3DQuatSlerp.desc = "quaternion spherical interpolation";

        Math3DQuatSlerp.prototype.onExecute = function() {
            var A = this.getInputData(0);
            if (A == null) {
                return;
            }
            var B = this.getInputData(1);
            if (B == null) {
                return;
            }
            var factor = this.properties.factor;
            if (this.getInputData(2) != null) {
                factor = this.getInputData(2);
            }

            var R = quat.slerp(this._value, A, B, factor);
            this.setOutputData(0, R);
        };

        LiteGraph.registerNodeType("math3d/quat-slerp", Math3DQuatSlerp);


        //Math3D rotate vec3
        function Math3DRemapRange() {
            this.addInput("vec3", "vec3");
            this.addOutput("remap", "vec3");
			this.addOutput("clamped", "vec3");
            this.properties = { clamp: true, range_min: [-1, -1, 0], range_max: [1, 1, 0], target_min: [-1,-1,0], target_max:[1,1,0] };
			this._value = vec3.create();
			this._clamped = vec3.create();
        }

        Math3DRemapRange.title = "Remap Range";
        Math3DRemapRange.desc = "remap a 3D range";

        Math3DRemapRange.prototype.onExecute = function() {
            var vec = this.getInputData(0);
			if(vec)
				this._value.set(vec);
			var range_min = this.properties.range_min;
			var range_max = this.properties.range_max;
			var target_min = this.properties.target_min;
			var target_max = this.properties.target_max;

			//swap to avoid errors
			/*
			if(range_min > range_max)
			{
				range_min = range_max;
				range_max = this.properties.range_min;
			}

			if(target_min > target_max)
			{
				target_min = target_max;
				target_max = this.properties.target_min;
			}
			*/

			for(var i = 0; i < 3; ++i)
			{
				var r = range_max[i] - range_min[i];
				this._clamped[i] = Math.clamp( this._value[i], range_min[i], range_max[i] );
				if(r == 0)
				{
					this._value[i] = (target_min[i] + target_max[i]) * 0.5;
					continue;
				}

				var n = (this._value[i] - range_min[i]) / r;
				if(this.properties.clamp)
					n = Math.clamp(n,0,1);
				var t = target_max[i] - target_min[i];
				this._value[i] = target_min[i] + n * t;
			}

			this.setOutputData(0,this._value);
			this.setOutputData(1,this._clamped);
        };

        LiteGraph.registerNodeType("math3d/remap_range", Math3DRemapRange);



    } //glMatrix
	else
		console.warn("No glmatrix found, some Math3D nodes may not work");

})(this);

//basic nodes
(function(global) {
    var LiteGraph = global.LiteGraph;

    function toString(a) {
        return String(a);
    }

    LiteGraph.wrapFunctionAsNode("string/toString", toString, [""], "String");

    function compare(a, b) {
        return a == b;
    }

    LiteGraph.wrapFunctionAsNode(
        "string/compare",
        compare,
        ["string", "string"],
        "boolean"
    );

    function concatenate(a, b) {
        if (a === undefined) {
            return b;
        }
        if (b === undefined) {
            return a;
        }
        return a + b;
    }

    LiteGraph.wrapFunctionAsNode(
        "string/concatenate",
        concatenate,
        ["string", "string"],
        "string"
    );

    function contains(a, b) {
        if (a === undefined || b === undefined) {
            return false;
        }
        return a.indexOf(b) != -1;
    }

    LiteGraph.wrapFunctionAsNode(
        "string/contains",
        contains,
        ["string", "string"],
        "boolean"
    );

    function toUpperCase(a) {
        if (a != null && a.constructor === String) {
            return a.toUpperCase();
        }
        return a;
    }

    LiteGraph.wrapFunctionAsNode(
        "string/toUpperCase",
        toUpperCase,
        ["string"],
        "string"
    );

    function split(str, separator) {
		if(separator == null)
			separator = this.properties.separator;
        if (str == null )
	        return [];
		if( str.constructor === String )
			return str.split(separator || " ");
		else if( str.constructor === Array )
		{
			var r = [];
			for(var i = 0; i < str.length; ++i)
				r[i] = str[i].split(separator || " ");
			return r;
		}
        return null;
    }

    LiteGraph.wrapFunctionAsNode(
        "string/split",
        split,
        ["string,array", "string"],
        "array",
		{ separator: "," }
    );

    function toFixed(a) {
        if (a != null && a.constructor === Number) {
            return a.toFixed(this.properties.precision);
        }
        return a;
    }

    LiteGraph.wrapFunctionAsNode(
        "string/toFixed",
        toFixed,
        ["number"],
        "string",
        { precision: 0 }
    );


    function StringToTable() {
        this.addInput("", "string");
        this.addOutput("table", "table");
        this.addOutput("rows", "number");
        this.addProperty("value", "");
        this.addProperty("separator", ",");
		this._table = null;
    }

    StringToTable.title = "toTable";
    StringToTable.desc = "Splits a string to table";

    StringToTable.prototype.onExecute = function() {
        var input = this.getInputData(0);
		if(!input)
			return;
		var separator = this.properties.separator || ",";
		if(input != this._str || separator != this._last_separator )
		{
			this._last_separator = separator;
			this._str = input;
			this._table = input.split("\n").map(function(a){ return a.trim().split(separator)});
		}
        this.setOutputData(0, this._table );
        this.setOutputData(1, this._table ? this._table.length : 0 );
    };

    LiteGraph.registerNodeType("string/toTable", StringToTable);

})(this);

(function(global) {
    var LiteGraph = global.LiteGraph;

    function Selector() {
        this.addInput("sel", "number");
        this.addInput("A");
        this.addInput("B");
        this.addInput("C");
        this.addInput("D");
        this.addOutput("out");

        this.selected = 0;
    }

    Selector.title = "Selector";
    Selector.desc = "selects an output";

    Selector.prototype.onDrawBackground = function(ctx) {
        if (this.flags.collapsed) {
            return;
        }
        ctx.fillStyle = "#AFB";
        var y = (this.selected + 1) * LiteGraph.NODE_SLOT_HEIGHT + 6;
        ctx.beginPath();
        ctx.moveTo(50, y);
        ctx.lineTo(50, y + LiteGraph.NODE_SLOT_HEIGHT);
        ctx.lineTo(34, y + LiteGraph.NODE_SLOT_HEIGHT * 0.5);
        ctx.fill();
    };

    Selector.prototype.onExecute = function() {
        var sel = this.getInputData(0);
        if (sel == null || sel.constructor !== Number)
            sel = 0;
        this.selected = sel = Math.round(sel) % (this.inputs.length - 1);
        var v = this.getInputData(sel + 1);
        if (v !== undefined) {
            this.setOutputData(0, v);
        }
    };

    Selector.prototype.onGetInputs = function() {
        return [["E", 0], ["F", 0], ["G", 0], ["H", 0]];
    };

    LiteGraph.registerNodeType("logic/selector", Selector);

    function Sequence() {
        this.properties = {
            sequence: "A,B,C"
        };
        this.addInput("index", "number");
        this.addInput("seq");
        this.addOutput("out");

        this.index = 0;
        this.values = this.properties.sequence.split(",");
    }

    Sequence.title = "Sequence";
    Sequence.desc = "select one element from a sequence from a string";

    Sequence.prototype.onPropertyChanged = function(name, value) {
        if (name == "sequence") {
            this.values = value.split(",");
        }
    };

    Sequence.prototype.onExecute = function() {
        var seq = this.getInputData(1);
        if (seq && seq != this.current_sequence) {
            this.values = seq.split(",");
            this.current_sequence = seq;
        }
        var index = this.getInputData(0);
        if (index == null) {
            index = 0;
        }
        this.index = index = Math.round(index) % this.values.length;

        this.setOutputData(0, this.values[index]);
    };

    LiteGraph.registerNodeType("logic/sequence", Sequence);
})(this);

(function(global) {
    var LiteGraph = global.LiteGraph;

    function GraphicsPlot() {
        this.addInput("A", "Number");
        this.addInput("B", "Number");
        this.addInput("C", "Number");
        this.addInput("D", "Number");

        this.values = [[], [], [], []];
        this.properties = { scale: 2 };
    }

    GraphicsPlot.title = "Plot";
    GraphicsPlot.desc = "Plots data over time";
    GraphicsPlot.colors = ["#FFF", "#F99", "#9F9", "#99F"];

    GraphicsPlot.prototype.onExecute = function(ctx) {
        if (this.flags.collapsed) {
            return;
        }

        var size = this.size;

        for (var i = 0; i < 4; ++i) {
            var v = this.getInputData(i);
            if (v == null) {
                continue;
            }
            var values = this.values[i];
            values.push(v);
            if (values.length > size[0]) {
                values.shift();
            }
        }
    };

    GraphicsPlot.prototype.onDrawBackground = function(ctx) {
        if (this.flags.collapsed) {
            return;
        }

        var size = this.size;

        var scale = (0.5 * size[1]) / this.properties.scale;
        var colors = GraphicsPlot.colors;
        var offset = size[1] * 0.5;

        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, size[0], size[1]);
        ctx.strokeStyle = "#555";
        ctx.beginPath();
        ctx.moveTo(0, offset);
        ctx.lineTo(size[0], offset);
        ctx.stroke();

        if (this.inputs) {
            for (var i = 0; i < 4; ++i) {
                var values = this.values[i];
                if (!this.inputs[i] || !this.inputs[i].link) {
                    continue;
                }
                ctx.strokeStyle = colors[i];
                ctx.beginPath();
                var v = values[0] * scale * -1 + offset;
                ctx.moveTo(0, Math.clamp(v, 0, size[1]));
                for (var j = 1; j < values.length && j < size[0]; ++j) {
                    var v = values[j] * scale * -1 + offset;
                    ctx.lineTo(j, Math.clamp(v, 0, size[1]));
                }
                ctx.stroke();
            }
        }
    };

    LiteGraph.registerNodeType("graphics/plot", GraphicsPlot);

    function GraphicsImage() {
        this.addOutput("frame", "image");
        this.properties = { url: "" };
    }

    GraphicsImage.title = "Image";
    GraphicsImage.desc = "Image loader";
    GraphicsImage.widgets = [{ name: "load", text: "Load", type: "button" }];

    GraphicsImage.supported_extensions = ["jpg", "jpeg", "png", "gif"];

    GraphicsImage.prototype.onAdded = function() {
        if (this.properties["url"] != "" && this.img == null) {
            this.loadImage(this.properties["url"]);
        }
    };

    GraphicsImage.prototype.onDrawBackground = function(ctx) {
        if (this.flags.collapsed) {
            return;
        }
        if (this.img && this.size[0] > 5 && this.size[1] > 5 && this.img.width) {
            ctx.drawImage(this.img, 0, 0, this.size[0], this.size[1]);
        }
    };

    GraphicsImage.prototype.onExecute = function() {
        if (!this.img) {
            this.boxcolor = "#000";
        }
        if (this.img && this.img.width) {
            this.setOutputData(0, this.img);
        } else {
            this.setOutputData(0, null);
        }
        if (this.img && this.img.dirty) {
            this.img.dirty = false;
        }
    };

    GraphicsImage.prototype.onPropertyChanged = function(name, value) {
        this.properties[name] = value;
        if (name == "url" && value != "") {
            this.loadImage(value);
        }

        return true;
    };

    GraphicsImage.prototype.loadImage = function(url, callback) {
        if (url == "") {
            this.img = null;
            return;
        }

        this.img = document.createElement("img");

        if (url.substr(0, 4) == "http" && LiteGraph.proxy) {
            url = LiteGraph.proxy + url.substr(url.indexOf(":") + 3);
        }

        this.img.src = url;
        this.boxcolor = "#F95";
        var that = this;
        this.img.onload = function() {
            if (callback) {
                callback(this);
            }
            console.log( "Image loaded, size: " + that.img.width + "x" + that.img.height );
            this.dirty = true;
            that.boxcolor = "#9F9";
            that.setDirtyCanvas(true);
        };
        this.img.onerror = function() {
			console.log("error loading the image:" + url);
		}
    };

    GraphicsImage.prototype.onWidget = function(e, widget) {
        if (widget.name == "load") {
            this.loadImage(this.properties["url"]);
        }
    };

    GraphicsImage.prototype.onDropFile = function(file) {
        var that = this;
        if (this._url) {
            URL.revokeObjectURL(this._url);
        }
        this._url = URL.createObjectURL(file);
        this.properties.url = this._url;
        this.loadImage(this._url, function(img) {
            that.size[1] = (img.height / img.width) * that.size[0];
        });
    };

    LiteGraph.registerNodeType("graphics/image", GraphicsImage);

    function ColorPalette() {
        this.addInput("f", "number");
        this.addOutput("Color", "color");
        this.properties = {
            colorA: "#444444",
            colorB: "#44AAFF",
            colorC: "#44FFAA",
            colorD: "#FFFFFF"
        };
    }

    ColorPalette.title = "Palette";
    ColorPalette.desc = "Generates a color";

    ColorPalette.prototype.onExecute = function() {
        var c = [];

        if (this.properties.colorA != null) {
            c.push(hex2num(this.properties.colorA));
        }
        if (this.properties.colorB != null) {
            c.push(hex2num(this.properties.colorB));
        }
        if (this.properties.colorC != null) {
            c.push(hex2num(this.properties.colorC));
        }
        if (this.properties.colorD != null) {
            c.push(hex2num(this.properties.colorD));
        }

        var f = this.getInputData(0);
        if (f == null) {
            f = 0.5;
        }
        if (f > 1.0) {
            f = 1.0;
        } else if (f < 0.0) {
            f = 0.0;
        }

        if (c.length == 0) {
            return;
        }

        var result = [0, 0, 0];
        if (f == 0) {
            result = c[0];
        } else if (f == 1) {
            result = c[c.length - 1];
        } else {
            var pos = (c.length - 1) * f;
            var c1 = c[Math.floor(pos)];
            var c2 = c[Math.floor(pos) + 1];
            var t = pos - Math.floor(pos);
            result[0] = c1[0] * (1 - t) + c2[0] * t;
            result[1] = c1[1] * (1 - t) + c2[1] * t;
            result[2] = c1[2] * (1 - t) + c2[2] * t;
        }

        /*
	c[0] = 1.0 - Math.abs( Math.sin( 0.1 * reModular.getTime() * Math.PI) );
	c[1] = Math.abs( Math.sin( 0.07 * reModular.getTime() * Math.PI) );
	c[2] = Math.abs( Math.sin( 0.01 * reModular.getTime() * Math.PI) );
	*/

        for (var i in result) {
            result[i] /= 255;
        }

        this.boxcolor = colorToString(result);
        this.setOutputData(0, result);
    };

    LiteGraph.registerNodeType("color/palette", ColorPalette);

    function ImageFrame() {
        this.addInput("", "image,canvas");
        this.size = [200, 200];
    }

    ImageFrame.title = "Frame";
    ImageFrame.desc = "Frame viewerew";
    ImageFrame.widgets = [
        { name: "resize", text: "Resize box", type: "button" },
        { name: "view", text: "View Image", type: "button" }
    ];

    ImageFrame.prototype.onDrawBackground = function(ctx) {
        if (this.frame && !this.flags.collapsed) {
            ctx.drawImage(this.frame, 0, 0, this.size[0], this.size[1]);
        }
    };

    ImageFrame.prototype.onExecute = function() {
        this.frame = this.getInputData(0);
        this.setDirtyCanvas(true);
    };

    ImageFrame.prototype.onWidget = function(e, widget) {
        if (widget.name == "resize" && this.frame) {
            var width = this.frame.width;
            var height = this.frame.height;

            if (!width && this.frame.videoWidth != null) {
                width = this.frame.videoWidth;
                height = this.frame.videoHeight;
            }

            if (width && height) {
                this.size = [width, height];
            }
            this.setDirtyCanvas(true, true);
        } else if (widget.name == "view") {
            this.show();
        }
    };

    ImageFrame.prototype.show = function() {
        //var str = this.canvas.toDataURL("image/png");
        if (showElement && this.frame) {
            showElement(this.frame);
        }
    };

    LiteGraph.registerNodeType("graphics/frame", ImageFrame);

    function ImageFade() {
        this.addInputs([
            ["img1", "image"],
            ["img2", "image"],
            ["fade", "number"]
        ]);
        this.addOutput("", "image");
        this.properties = { fade: 0.5, width: 512, height: 512 };
    }

    ImageFade.title = "Image fade";
    ImageFade.desc = "Fades between images";
    ImageFade.widgets = [
        { name: "resizeA", text: "Resize to A", type: "button" },
        { name: "resizeB", text: "Resize to B", type: "button" }
    ];

    ImageFade.prototype.onAdded = function() {
        this.createCanvas();
        var ctx = this.canvas.getContext("2d");
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, this.properties["width"], this.properties["height"]);
    };

    ImageFade.prototype.createCanvas = function() {
        this.canvas = document.createElement("canvas");
        this.canvas.width = this.properties["width"];
        this.canvas.height = this.properties["height"];
    };

    ImageFade.prototype.onExecute = function() {
        var ctx = this.canvas.getContext("2d");
        this.canvas.width = this.canvas.width;

        var A = this.getInputData(0);
        if (A != null) {
            ctx.drawImage(A, 0, 0, this.canvas.width, this.canvas.height);
        }

        var fade = this.getInputData(2);
        if (fade == null) {
            fade = this.properties["fade"];
        } else {
            this.properties["fade"] = fade;
        }

        ctx.globalAlpha = fade;
        var B = this.getInputData(1);
        if (B != null) {
            ctx.drawImage(B, 0, 0, this.canvas.width, this.canvas.height);
        }
        ctx.globalAlpha = 1.0;

        this.setOutputData(0, this.canvas);
        this.setDirtyCanvas(true);
    };

    LiteGraph.registerNodeType("graphics/imagefade", ImageFade);

    function ImageCrop() {
        this.addInput("", "image");
        this.addOutput("", "image");
        this.properties = { width: 256, height: 256, x: 0, y: 0, scale: 1.0 };
        this.size = [50, 20];
    }

    ImageCrop.title = "Crop";
    ImageCrop.desc = "Crop Image";

    ImageCrop.prototype.onAdded = function() {
        this.createCanvas();
    };

    ImageCrop.prototype.createCanvas = function() {
        this.canvas = document.createElement("canvas");
        this.canvas.width = this.properties["width"];
        this.canvas.height = this.properties["height"];
    };

    ImageCrop.prototype.onExecute = function() {
        var input = this.getInputData(0);
        if (!input) {
            return;
        }

        if (input.width) {
            var ctx = this.canvas.getContext("2d");

            ctx.drawImage(
                input,
                -this.properties["x"],
                -this.properties["y"],
                input.width * this.properties["scale"],
                input.height * this.properties["scale"]
            );
            this.setOutputData(0, this.canvas);
        } else {
            this.setOutputData(0, null);
        }
    };

    ImageCrop.prototype.onDrawBackground = function(ctx) {
        if (this.flags.collapsed) {
            return;
        }
        if (this.canvas) {
            ctx.drawImage(
                this.canvas,
                0,
                0,
                this.canvas.width,
                this.canvas.height,
                0,
                0,
                this.size[0],
                this.size[1]
            );
        }
    };

    ImageCrop.prototype.onPropertyChanged = function(name, value) {
        this.properties[name] = value;

        if (name == "scale") {
            this.properties[name] = parseFloat(value);
            if (this.properties[name] == 0) {
                console.error("Error in scale");
                this.properties[name] = 1.0;
            }
        } else {
            this.properties[name] = parseInt(value);
        }

        this.createCanvas();

        return true;
    };

    LiteGraph.registerNodeType("graphics/cropImage", ImageCrop);

    //CANVAS stuff

    function CanvasNode() {
        this.addInput("clear", LiteGraph.ACTION);
        this.addOutput("", "canvas");
        this.properties = { width: 512, height: 512, autoclear: true };

        this.canvas = document.createElement("canvas");
        this.ctx = this.canvas.getContext("2d");
    }

    CanvasNode.title = "Canvas";
    CanvasNode.desc = "Canvas to render stuff";

    CanvasNode.prototype.onExecute = function() {
        var canvas = this.canvas;
        var w = this.properties.width | 0;
        var h = this.properties.height | 0;
        if (canvas.width != w) {
            canvas.width = w;
        }
        if (canvas.height != h) {
            canvas.height = h;
        }

        if (this.properties.autoclear) {
            this.ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        this.setOutputData(0, canvas);
    };

    CanvasNode.prototype.onAction = function(action, param) {
        if (action == "clear") {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    };

    LiteGraph.registerNodeType("graphics/canvas", CanvasNode);

    function DrawImageNode() {
        this.addInput("canvas", "canvas");
        this.addInput("img", "image,canvas");
        this.addInput("x", "number");
        this.addInput("y", "number");
        this.properties = { x: 0, y: 0, opacity: 1 };
    }

    DrawImageNode.title = "DrawImage";
    DrawImageNode.desc = "Draws image into a canvas";

    DrawImageNode.prototype.onExecute = function() {
        var canvas = this.getInputData(0);
        if (!canvas) {
            return;
        }

        var img = this.getInputOrProperty("img");
        if (!img) {
            return;
        }

        var x = this.getInputOrProperty("x");
        var y = this.getInputOrProperty("y");
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, x, y);
    };

    LiteGraph.registerNodeType("graphics/drawImage", DrawImageNode);

    function DrawRectangleNode() {
        this.addInput("canvas", "canvas");
        this.addInput("x", "number");
        this.addInput("y", "number");
        this.addInput("w", "number");
        this.addInput("h", "number");
        this.properties = {
            x: 0,
            y: 0,
            w: 10,
            h: 10,
            color: "white",
            opacity: 1
        };
    }

    DrawRectangleNode.title = "DrawRectangle";
    DrawRectangleNode.desc = "Draws rectangle in canvas";

    DrawRectangleNode.prototype.onExecute = function() {
        var canvas = this.getInputData(0);
        if (!canvas) {
            return;
        }

        var x = this.getInputOrProperty("x");
        var y = this.getInputOrProperty("y");
        var w = this.getInputOrProperty("w");
        var h = this.getInputOrProperty("h");
        var ctx = canvas.getContext("2d");
        ctx.fillRect(x, y, w, h);
    };

    LiteGraph.registerNodeType("graphics/drawRectangle", DrawRectangleNode);

    function ImageVideo() {
        this.addInput("t", "number");
        this.addOutputs([["frame", "image"], ["t", "number"], ["d", "number"]]);
        this.properties = { url: "", use_proxy: true };
    }

    ImageVideo.title = "Video";
    ImageVideo.desc = "Video playback";
    ImageVideo.widgets = [
        { name: "play", text: "PLAY", type: "minibutton" },
        { name: "stop", text: "STOP", type: "minibutton" },
        { name: "demo", text: "Demo video", type: "button" },
        { name: "mute", text: "Mute video", type: "button" }
    ];

    ImageVideo.prototype.onExecute = function() {
        if (!this.properties.url) {
            return;
        }

        if (this.properties.url != this._video_url) {
            this.loadVideo(this.properties.url);
        }

        if (!this._video || this._video.width == 0) {
            return;
        }

        var t = this.getInputData(0);
        if (t && t >= 0 && t <= 1.0) {
            this._video.currentTime = t * this._video.duration;
            this._video.pause();
        }

        this._video.dirty = true;
        this.setOutputData(0, this._video);
        this.setOutputData(1, this._video.currentTime);
        this.setOutputData(2, this._video.duration);
        this.setDirtyCanvas(true);
    };

    ImageVideo.prototype.onStart = function() {
        this.play();
    };

    ImageVideo.prototype.onStop = function() {
        this.stop();
    };

    ImageVideo.prototype.loadVideo = function(url) {
        this._video_url = url;

		var pos = url.substr(0,10).indexOf(":");
		var protocol = "";
		if(pos != -1)
			protocol = url.substr(0,pos);

		var host = "";
		if(protocol)
		{
			host = url.substr(0,url.indexOf("/",protocol.length + 3));
			host = host.substr(protocol.length+3);
		}

        if (
            this.properties.use_proxy &&
            protocol &&
            LiteGraph.proxy &&
			host != location.host
        ) {
            url = LiteGraph.proxy + url.substr(url.indexOf(":") + 3);
        }

        this._video = document.createElement("video");
        this._video.src = url;
        this._video.type = "type=video/mp4";

        this._video.muted = true;
        this._video.autoplay = true;

        var that = this;
        this._video.addEventListener("loadedmetadata", function(e) {
            //onload
            console.log("Duration: " + this.duration + " seconds");
            console.log("Size: " + this.videoWidth + "," + this.videoHeight);
            that.setDirtyCanvas(true);
            this.width = this.videoWidth;
            this.height = this.videoHeight;
        });
        this._video.addEventListener("progress", function(e) {
            //onload
            console.log("video loading...");
        });
        this._video.addEventListener("error", function(e) {
            console.error("Error loading video: " + this.src);
            if (this.error) {
                switch (this.error.code) {
                    case this.error.MEDIA_ERR_ABORTED:
                        console.error("You stopped the video.");
                        break;
                    case this.error.MEDIA_ERR_NETWORK:
                        console.error("Network error - please try again later.");
                        break;
                    case this.error.MEDIA_ERR_DECODE:
                        console.error("Video is broken..");
                        break;
                    case this.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                        console.error("Sorry, your browser can't play this video.");
                        break;
                }
            }
        });

        this._video.addEventListener("ended", function(e) {
            console.log("Video Ended.");
            this.play(); //loop
        });

        //document.body.appendChild(this.video);
    };

    ImageVideo.prototype.onPropertyChanged = function(name, value) {
        this.properties[name] = value;
        if (name == "url" && value != "") {
            this.loadVideo(value);
        }

        return true;
    };

    ImageVideo.prototype.play = function() {
        if (this._video && this._video.videoWidth ) { //is loaded
            this._video.play();
        }
    };

    ImageVideo.prototype.playPause = function() {
        if (!this._video) {
            return;
        }
        if (this._video.paused) {
            this.play();
        } else {
            this.pause();
        }
    };

    ImageVideo.prototype.stop = function() {
        if (!this._video) {
            return;
        }
        this._video.pause();
        this._video.currentTime = 0;
    };

    ImageVideo.prototype.pause = function() {
        if (!this._video) {
            return;
        }
        console.log("Video paused");
        this._video.pause();
    };

    ImageVideo.prototype.onWidget = function(e, widget) {
        /*
	if(widget.name == "demo")
	{
		this.loadVideo();
	}
	else if(widget.name == "play")
	{
		if(this._video)
			this.playPause();
	}
	if(widget.name == "stop")
	{
		this.stop();
	}
	else if(widget.name == "mute")
	{
		if(this._video)
			this._video.muted = !this._video.muted;
	}
	*/
    };

    LiteGraph.registerNodeType("graphics/video", ImageVideo);

    // Texture Webcam *****************************************
    function ImageWebcam() {
        this.addOutput("Webcam", "image");
        this.properties = { facingMode: "user" };
        this.boxcolor = "black";
        this.frame = 0;
    }

    ImageWebcam.title = "Webcam";
    ImageWebcam.desc = "Webcam image";
    ImageWebcam.is_webcam_open = false;

    ImageWebcam.prototype.openStream = function() {
        if (!navigator.getUserMedia) {
            //console.log('getUserMedia() is not supported in your browser, use chrome and enable WebRTC from about://flags');
            return;
        }

        this._waiting_confirmation = true;

        // Not showing vendor prefixes.
        var constraints = {
            audio: false,
            video: { facingMode: this.properties.facingMode }
        };
        navigator.mediaDevices
            .getUserMedia(constraints)
            .then(this.streamReady.bind(this))
            .catch(onFailSoHard);

        var that = this;
        function onFailSoHard(e) {
            console.log("Webcam rejected", e);
            that._webcam_stream = false;
            ImageWebcam.is_webcam_open = false;
            that.boxcolor = "red";
            that.trigger("stream_error");
        }
    };

    ImageWebcam.prototype.closeStream = function() {
        if (this._webcam_stream) {
            var tracks = this._webcam_stream.getTracks();
            if (tracks.length) {
                for (var i = 0; i < tracks.length; ++i) {
                    tracks[i].stop();
                }
            }
            ImageWebcam.is_webcam_open = false;
            this._webcam_stream = null;
            this._video = null;
            this.boxcolor = "black";
            this.trigger("stream_closed");
        }
    };

    ImageWebcam.prototype.onPropertyChanged = function(name, value) {
        if (name == "facingMode") {
            this.properties.facingMode = value;
            this.closeStream();
            this.openStream();
        }
    };

    ImageWebcam.prototype.onRemoved = function() {
        this.closeStream();
    };

    ImageWebcam.prototype.streamReady = function(localMediaStream) {
        this._webcam_stream = localMediaStream;
        //this._waiting_confirmation = false;
        this.boxcolor = "green";

        var video = this._video;
        if (!video) {
            video = document.createElement("video");
            video.autoplay = true;
            video.srcObject = localMediaStream;
            this._video = video;
            //document.body.appendChild( video ); //debug
            //when video info is loaded (size and so)
            video.onloadedmetadata = function(e) {
                // Ready to go. Do some stuff.
                console.log(e);
                ImageWebcam.is_webcam_open = true;
            };
        }

        this.trigger("stream_ready", video);
    };

    ImageWebcam.prototype.onExecute = function() {
        if (this._webcam_stream == null && !this._waiting_confirmation) {
            this.openStream();
        }

        if (!this._video || !this._video.videoWidth) {
            return;
        }

        this._video.frame = ++this.frame;
        this._video.width = this._video.videoWidth;
        this._video.height = this._video.videoHeight;
        this.setOutputData(0, this._video);
        for (var i = 1; i < this.outputs.length; ++i) {
            if (!this.outputs[i]) {
                continue;
            }
            switch (this.outputs[i].name) {
                case "width":
                    this.setOutputData(i, this._video.videoWidth);
                    break;
                case "height":
                    this.setOutputData(i, this._video.videoHeight);
                    break;
            }
        }
    };

    ImageWebcam.prototype.getExtraMenuOptions = function(graphcanvas) {
        var that = this;
        var txt = !that.properties.show ? "Show Frame" : "Hide Frame";
        return [
            {
                content: txt,
                callback: function() {
                    that.properties.show = !that.properties.show;
                }
            }
        ];
    };

    ImageWebcam.prototype.onDrawBackground = function(ctx) {
        if (
            this.flags.collapsed ||
            this.size[1] <= 20 ||
            !this.properties.show
        ) {
            return;
        }

        if (!this._video) {
            return;
        }

        //render to graph canvas
        ctx.save();
        ctx.drawImage(this._video, 0, 0, this.size[0], this.size[1]);
        ctx.restore();
    };

    ImageWebcam.prototype.onGetOutputs = function() {
        return [
            ["width", "number"],
            ["height", "number"],
            ["stream_ready", LiteGraph.EVENT],
            ["stream_closed", LiteGraph.EVENT],
            ["stream_error", LiteGraph.EVENT]
        ];
    };

    LiteGraph.registerNodeType("graphics/webcam", ImageWebcam);
})(this);

(function(global) {
    var LiteGraph = global.LiteGraph;
	var LGraphCanvas = global.LGraphCanvas;

    //Works with Litegl.js to create WebGL nodes
    global.LGraphTexture = null;

    if (typeof GL == "undefined")
		return;

	LGraphCanvas.link_type_colors["Texture"] = "#987";

	function LGraphTexture() {
		this.addOutput("tex", "Texture");
		this.addOutput("name", "string");
		this.properties = { name: "", filter: true };
		this.size = [
			LGraphTexture.image_preview_size,
			LGraphTexture.image_preview_size
		];
	}

	global.LGraphTexture = LGraphTexture;

	LGraphTexture.title = "Texture";
	LGraphTexture.desc = "Texture";
	LGraphTexture.widgets_info = {
		name: { widget: "texture" },
		filter: { widget: "checkbox" }
	};

	//REPLACE THIS TO INTEGRATE WITH YOUR FRAMEWORK
	LGraphTexture.loadTextureCallback = null; //function in charge of loading textures when not present in the container
	LGraphTexture.image_preview_size = 256;

	//flags to choose output texture type
	LGraphTexture.PASS_THROUGH = 1; //do not apply FX
	LGraphTexture.COPY = 2; //create new texture with the same properties as the origin texture
	LGraphTexture.LOW = 3; //create new texture with low precision (byte)
	LGraphTexture.HIGH = 4; //create new texture with high precision (half-float)
	LGraphTexture.REUSE = 5; //reuse input texture
	LGraphTexture.DEFAULT = 2;

	LGraphTexture.MODE_VALUES = {
		"pass through": LGraphTexture.PASS_THROUGH,
		copy: LGraphTexture.COPY,
		low: LGraphTexture.LOW,
		high: LGraphTexture.HIGH,
		reuse: LGraphTexture.REUSE,
		default: LGraphTexture.DEFAULT
	};

	//returns the container where all the loaded textures are stored (overwrite if you have a Resources Manager)
	LGraphTexture.getTexturesContainer = function() {
		return gl.textures;
	};

	//process the loading of a texture (overwrite it if you have a Resources Manager)
	LGraphTexture.loadTexture = function(name, options) {
		options = options || {};
		var url = name;
		if (url.substr(0, 7) == "http://") {
			if (LiteGraph.proxy) {
				//proxy external files
				url = LiteGraph.proxy + url.substr(7);
			}
		}

		var container = LGraphTexture.getTexturesContainer();
		var tex = (container[name] = GL.Texture.fromURL(url, options));
		return tex;
	};

	LGraphTexture.getTexture = function(name) {
		var container = this.getTexturesContainer();

		if (!container) {
			throw "Cannot load texture, container of textures not found";
		}

		var tex = container[name];
		if (!tex && name && name[0] != ":") {
			return this.loadTexture(name);
		}

		return tex;
	};

	//used to compute the appropiate output texture
	LGraphTexture.getTargetTexture = function(origin, target, mode) {
		if (!origin) {
			throw "LGraphTexture.getTargetTexture expects a reference texture";
		}

		var tex_type = null;

		switch (mode) {
			case LGraphTexture.LOW:
				tex_type = gl.UNSIGNED_BYTE;
				break;
			case LGraphTexture.HIGH:
				tex_type = gl.HIGH_PRECISION_FORMAT;
				break;
			case LGraphTexture.REUSE:
				return origin;
				break;
			case LGraphTexture.COPY:
			default:
				tex_type = origin ? origin.type : gl.UNSIGNED_BYTE;
				break;
		}

		if (
			!target ||
			target.width != origin.width ||
			target.height != origin.height ||
			target.type != tex_type
		) {
			target = new GL.Texture(origin.width, origin.height, {
				type: tex_type,
				format: gl.RGBA,
				filter: gl.LINEAR
			});
		}

		return target;
	};

	LGraphTexture.getTextureType = function(precision, ref_texture) {
		var type = ref_texture ? ref_texture.type : gl.UNSIGNED_BYTE;
		switch (precision) {
			case LGraphTexture.HIGH:
				type = gl.HIGH_PRECISION_FORMAT;
				break;
			case LGraphTexture.LOW:
				type = gl.UNSIGNED_BYTE;
				break;
			//no default
		}
		return type;
	};

	LGraphTexture.getWhiteTexture = function() {
		if (this._white_texture) {
			return this._white_texture;
		}
		var texture = (this._white_texture = GL.Texture.fromMemory(
			1,
			1,
			[255, 255, 255, 255],
			{ format: gl.RGBA, wrap: gl.REPEAT, filter: gl.NEAREST }
		));
		return texture;
	};

	LGraphTexture.getNoiseTexture = function() {
		if (this._noise_texture) {
			return this._noise_texture;
		}

		var noise = new Uint8Array(512 * 512 * 4);
		for (var i = 0; i < 512 * 512 * 4; ++i) {
			noise[i] = Math.random() * 255;
		}

		var texture = GL.Texture.fromMemory(512, 512, noise, {
			format: gl.RGBA,
			wrap: gl.REPEAT,
			filter: gl.NEAREST
		});
		this._noise_texture = texture;
		return texture;
	};

	LGraphTexture.prototype.onDropFile = function(data, filename, file) {
		if (!data) {
			this._drop_texture = null;
			this.properties.name = "";
		} else {
			var texture = null;
			if (typeof data == "string") {
				texture = GL.Texture.fromURL(data);
			} else if (filename.toLowerCase().indexOf(".dds") != -1) {
				texture = GL.Texture.fromDDSInMemory(data);
			} else {
				var blob = new Blob([file]);
				var url = URL.createObjectURL(blob);
				texture = GL.Texture.fromURL(url);
			}

			this._drop_texture = texture;
			this.properties.name = filename;
		}
	};

	LGraphTexture.prototype.getExtraMenuOptions = function(graphcanvas) {
		var that = this;
		if (!this._drop_texture) {
			return;
		}
		return [
			{
				content: "Clear",
				callback: function() {
					that._drop_texture = null;
					that.properties.name = "";
				}
			}
		];
	};

	LGraphTexture.prototype.onExecute = function() {
		var tex = null;
		if (this.isOutputConnected(1)) {
			tex = this.getInputData(0);
		}

		if (!tex && this._drop_texture) {
			tex = this._drop_texture;
		}

		if (!tex && this.properties.name) {
			tex = LGraphTexture.getTexture(this.properties.name);
		}

		if (!tex) {
			this.setOutputData( 0, null );
			this.setOutputData( 1, "" );
			return;
		}

		this._last_tex = tex;

		if (this.properties.filter === false) {
			tex.setParameter(gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		} else {
			tex.setParameter(gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		}

		this.setOutputData( 0, tex );
		this.setOutputData( 1, tex.fullpath || tex.filename );

		for (var i = 2; i < this.outputs.length; i++) {
			var output = this.outputs[i];
			if (!output) {
				continue;
			}
			var v = null;
			if (output.name == "width") {
				v = tex.width;
			} else if (output.name == "height") {
				v = tex.height;
			} else if (output.name == "aspect") {
				v = tex.width / tex.height;
			}
			this.setOutputData(i, v);
		}
	};

	LGraphTexture.prototype.onResourceRenamed = function(
		old_name,
		new_name
	) {
		if (this.properties.name == old_name) {
			this.properties.name = new_name;
		}
	};

	LGraphTexture.prototype.onDrawBackground = function(ctx) {
		if (this.flags.collapsed || this.size[1] <= 20) {
			return;
		}

		if (this._drop_texture && ctx.webgl) {
			ctx.drawImage(
				this._drop_texture,
				0,
				0,
				this.size[0],
				this.size[1]
			);
			//this._drop_texture.renderQuad(this.pos[0],this.pos[1],this.size[0],this.size[1]);
			return;
		}

		//Different texture? then get it from the GPU
		if (this._last_preview_tex != this._last_tex) {
			if (ctx.webgl) {
				this._canvas = this._last_tex;
			} else {
				var tex_canvas = LGraphTexture.generateLowResTexturePreview(
					this._last_tex
				);
				if (!tex_canvas) {
					return;
				}

				this._last_preview_tex = this._last_tex;
				this._canvas = cloneCanvas(tex_canvas);
			}
		}

		if (!this._canvas) {
			return;
		}

		//render to graph canvas
		ctx.save();
		if (!ctx.webgl) {
			//reverse image
			ctx.translate(0, this.size[1]);
			ctx.scale(1, -1);
		}
		ctx.drawImage(this._canvas, 0, 0, this.size[0], this.size[1]);
		ctx.restore();
	};

	//very slow, used at your own risk
	LGraphTexture.generateLowResTexturePreview = function(tex) {
		if (!tex) {
			return null;
		}

		var size = LGraphTexture.image_preview_size;
		var temp_tex = tex;

		if (tex.format == gl.DEPTH_COMPONENT) {
			return null;
		} //cannot generate from depth

		//Generate low-level version in the GPU to speed up
		if (tex.width > size || tex.height > size) {
			temp_tex = this._preview_temp_tex;
			if (!this._preview_temp_tex) {
				temp_tex = new GL.Texture(size, size, {
					minFilter: gl.NEAREST
				});
				this._preview_temp_tex = temp_tex;
			}

			//copy
			tex.copyTo(temp_tex);
			tex = temp_tex;
		}

		//create intermediate canvas with lowquality version
		var tex_canvas = this._preview_canvas;
		if (!tex_canvas) {
			tex_canvas = createCanvas(size, size);
			this._preview_canvas = tex_canvas;
		}

		if (temp_tex) {
			temp_tex.toCanvas(tex_canvas);
		}
		return tex_canvas;
	};

	LGraphTexture.prototype.getResources = function(res) {
		if(this.properties.name)
			res[this.properties.name] = GL.Texture;
		return res;
	};

	LGraphTexture.prototype.onGetInputs = function() {
		return [["in", "Texture"]];
	};

	LGraphTexture.prototype.onGetOutputs = function() {
		return [
			["width", "number"],
			["height", "number"],
			["aspect", "number"]
		];
	};

	//used to replace shader code
	LGraphTexture.replaceCode = function( code, context )
	{
		return code.replace(/\{\{[a-zA-Z0-9_]*\}\}/g, function(v){
			v = v.replace( /[\{\}]/g, "" );
			return context[v] || "";
		});
	}

	LiteGraph.registerNodeType("texture/texture", LGraphTexture);

	//**************************
	function LGraphTexturePreview() {
		this.addInput("Texture", "Texture");
		this.properties = { flipY: false };
		this.size = [
			LGraphTexture.image_preview_size,
			LGraphTexture.image_preview_size
		];
	}

	LGraphTexturePreview.title = "Preview";
	LGraphTexturePreview.desc = "Show a texture in the graph canvas";
	LGraphTexturePreview.allow_preview = false;

	LGraphTexturePreview.prototype.onDrawBackground = function(ctx) {
		if (this.flags.collapsed) {
			return;
		}

		if (!ctx.webgl && !LGraphTexturePreview.allow_preview) {
			return;
		} //not working well

		var tex = this.getInputData(0);
		if (!tex) {
			return;
		}

		var tex_canvas = null;

		if (!tex.handle && ctx.webgl) {
			tex_canvas = tex;
		} else {
			tex_canvas = LGraphTexture.generateLowResTexturePreview(tex);
		}

		//render to graph canvas
		ctx.save();
		if (this.properties.flipY) {
			ctx.translate(0, this.size[1]);
			ctx.scale(1, -1);
		}
		ctx.drawImage(tex_canvas, 0, 0, this.size[0], this.size[1]);
		ctx.restore();
	};

	LiteGraph.registerNodeType("texture/preview", LGraphTexturePreview);

	//**************************************

	function LGraphTextureSave() {
		this.addInput("Texture", "Texture");
		this.addOutput("tex", "Texture");
		this.addOutput("name", "string");
		this.properties = { name: "", generate_mipmaps: false };
	}

	LGraphTextureSave.title = "Save";
	LGraphTextureSave.desc = "Save a texture in the repository";

	LGraphTextureSave.prototype.getPreviewTexture = function()
	{
		return this._texture;
	}

	LGraphTextureSave.prototype.onExecute = function() {
		var tex = this.getInputData(0);
		if (!tex) {
			return;
		}

		if (this.properties.generate_mipmaps) {
			tex.bind(0);
			tex.setParameter( gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR );
			gl.generateMipmap(tex.texture_type);
			tex.unbind(0);
		}

		if (this.properties.name) {
			//for cases where we want to perform something when storing it
			if (LGraphTexture.storeTexture) {
				LGraphTexture.storeTexture(this.properties.name, tex);
			} else {
				var container = LGraphTexture.getTexturesContainer();
				container[this.properties.name] = tex;
			}
		}

		this._texture = tex;
		this.setOutputData(0, tex);
		this.setOutputData(1, this.properties.name);
	};

	LiteGraph.registerNodeType("texture/save", LGraphTextureSave);

	//****************************************************

	function LGraphTextureOperation() {
		this.addInput("Texture", "Texture");
		this.addInput("TextureB", "Texture");
		this.addInput("value", "number");
		this.addOutput("Texture", "Texture");
		this.help = "<p>pixelcode must be vec3, uvcode must be vec2, is optional</p>\
		<p><strong>uv:</strong> tex. coords</p><p><strong>color:</strong> texture <strong>colorB:</strong> textureB</p><p><strong>time:</strong> scene time <strong>value:</strong> input value</p><p>For multiline you must type: result = ...</p>";

		this.properties = {
			value: 1,
			pixelcode: "color + colorB * value",
			uvcode: "",
			precision: LGraphTexture.DEFAULT
		};

		this.has_error = false;
	}

	LGraphTextureOperation.widgets_info = {
		uvcode: { widget: "code" },
		pixelcode: { widget: "code" },
		precision: { widget: "combo", values: LGraphTexture.MODE_VALUES }
	};

	LGraphTextureOperation.title = "Operation";
	LGraphTextureOperation.desc = "Texture shader operation";

	LGraphTextureOperation.presets = {};

	LGraphTextureOperation.prototype.getExtraMenuOptions = function(
		graphcanvas
	) {
		var that = this;
		var txt = !that.properties.show ? "Show Texture" : "Hide Texture";
		return [
			{
				content: txt,
				callback: function() {
					that.properties.show = !that.properties.show;
				}
			}
		];
	};

	LGraphTextureOperation.prototype.onPropertyChanged = function()
	{
		this.has_error = false;
	}

	LGraphTextureOperation.prototype.onDrawBackground = function(ctx) {
		if (
			this.flags.collapsed ||
			this.size[1] <= 20 ||
			!this.properties.show
		) {
			return;
		}

		if (!this._tex) {
			return;
		}

		//only works if using a webgl renderer
		if (this._tex.gl != ctx) {
			return;
		}

		//render to graph canvas
		ctx.save();
		ctx.drawImage(this._tex, 0, 0, this.size[0], this.size[1]);
		ctx.restore();
	};

	LGraphTextureOperation.prototype.onExecute = function() {
		var tex = this.getInputData(0);

		if (!this.isOutputConnected(0)) {
			return;
		} //saves work

		if (this.properties.precision === LGraphTexture.PASS_THROUGH) {
			this.setOutputData(0, tex);
			return;
		}

		var texB = this.getInputData(1);

		if (!this.properties.uvcode && !this.properties.pixelcode) {
			return;
		}

		var width = 512;
		var height = 512;
		if (tex) {
			width = tex.width;
			height = tex.height;
		} else if (texB) {
			width = texB.width;
			height = texB.height;
		}

		if(!texB)
			texB = GL.Texture.getWhiteTexture();

		var type = LGraphTexture.getTextureType( this.properties.precision, tex );

		if (!tex && !this._tex) {
			this._tex = new GL.Texture(width, height, { type: type, format: gl.RGBA, filter: gl.LINEAR });
		} else {
			this._tex = LGraphTexture.getTargetTexture( tex || this._tex, this._tex, this.properties.precision );
		}

		var uvcode = "";
		if (this.properties.uvcode) {
			uvcode = "uv = " + this.properties.uvcode;
			if (this.properties.uvcode.indexOf(";") != -1) {
				//there are line breaks, means multiline code
				uvcode = this.properties.uvcode;
			}
		}

		var pixelcode = "";
		if (this.properties.pixelcode) {
			pixelcode = "result = " + this.properties.pixelcode;
			if (this.properties.pixelcode.indexOf(";") != -1) {
				//there are line breaks, means multiline code
				pixelcode = this.properties.pixelcode;
			}
		}

		var shader = this._shader;

		if ( !this.has_error && (!shader || this._shader_code != uvcode + "|" + pixelcode) ) {

			var final_pixel_code = LGraphTexture.replaceCode( LGraphTextureOperation.pixel_shader, { UV_CODE:uvcode, PIXEL_CODE:pixelcode });

			try {
				shader = new GL.Shader( Shader.SCREEN_VERTEX_SHADER, final_pixel_code );
				this.boxcolor = "#00FF00";
			} catch (err) {
				//console.log("Error compiling shader: ", err, final_pixel_code );
				GL.Shader.dumpErrorToConsole(err,Shader.SCREEN_VERTEX_SHADER, final_pixel_code);
				this.boxcolor = "#FF0000";
				this.has_error = true;
				return;
			}
			this._shader = shader;
			this._shader_code = uvcode + "|" + pixelcode;
		}

		if(!this._shader)
			return;

		var value = this.getInputData(2);
		if (value != null) {
			this.properties.value = value;
		} else {
			value = parseFloat(this.properties.value);
		}

		var time = this.graph.getTime();

		this._tex.drawTo(function() {
			gl.disable(gl.DEPTH_TEST);
			gl.disable(gl.CULL_FACE);
			gl.disable(gl.BLEND);
			if (tex) {
				tex.bind(0);
			}
			if (texB) {
				texB.bind(1);
			}
			var mesh = Mesh.getScreenQuad();
			shader
				.uniforms({
					u_texture: 0,
					u_textureB: 1,
					value: value,
					texSize: [width, height,1/width,1/height],
					time: time
				})
				.draw(mesh);
		});

		this.setOutputData(0, this._tex);
	};

	LGraphTextureOperation.pixel_shader =
		"precision highp float;\n\
		\n\
		uniform sampler2D u_texture;\n\
		uniform sampler2D u_textureB;\n\
		varying vec2 v_coord;\n\
		uniform vec4 texSize;\n\
		uniform float time;\n\
		uniform float value;\n\
		\n\
		void main() {\n\
			vec2 uv = v_coord;\n\
			{{UV_CODE}};\n\
			vec4 color4 = texture2D(u_texture, uv);\n\
			vec3 color = color4.rgb;\n\
			vec4 color4B = texture2D(u_textureB, uv);\n\
			vec3 colorB = color4B.rgb;\n\
			vec3 result = color;\n\
			float alpha = 1.0;\n\
			{{PIXEL_CODE}};\n\
			gl_FragColor = vec4(result, alpha);\n\
		}\n\
		";

	LGraphTextureOperation.registerPreset = function ( name, code )
	{
		LGraphTextureOperation.presets[name] = code;
	}

	LGraphTextureOperation.registerPreset("","");
	LGraphTextureOperation.registerPreset("bypass","color");
	LGraphTextureOperation.registerPreset("add","color + colorB * value");
	LGraphTextureOperation.registerPreset("substract","(color - colorB) * value");
	LGraphTextureOperation.registerPreset("mate","mix( color, colorB, color4B.a * value)");
	LGraphTextureOperation.registerPreset("invert","vec3(1.0) - color");
	LGraphTextureOperation.registerPreset("multiply","color * colorB * value");
	LGraphTextureOperation.registerPreset("divide","(color / colorB) / value");
	LGraphTextureOperation.registerPreset("difference","abs(color - colorB) * value");
	LGraphTextureOperation.registerPreset("max","max(color, colorB) * value");
	LGraphTextureOperation.registerPreset("min","min(color, colorB) * value");
	LGraphTextureOperation.registerPreset("displace","texture2D(u_texture, uv + (colorB.xy - vec2(0.5)) * value).xyz");
	LGraphTextureOperation.registerPreset("grayscale","vec3(color.x + color.y + color.z) * value / 3.0");
	LGraphTextureOperation.registerPreset("saturation","mix( vec3(color.x + color.y + color.z) / 3.0, color, value )");
	LGraphTextureOperation.registerPreset("normalmap","\n\
		float z0 = texture2D(u_texture, uv + vec2(-texSize.z, -texSize.w) ).x;\n\
		float z1 = texture2D(u_texture, uv + vec2(0.0, -texSize.w) ).x;\n\
		float z2 = texture2D(u_texture, uv + vec2(texSize.z, -texSize.w) ).x;\n\
		float z3 = texture2D(u_texture, uv + vec2(-texSize.z, 0.0) ).x;\n\
		float z4 = color.x;\n\
		float z5 = texture2D(u_texture, uv + vec2(texSize.z, 0.0) ).x;\n\
		float z6 = texture2D(u_texture, uv + vec2(-texSize.z, texSize.w) ).x;\n\
		float z7 = texture2D(u_texture, uv + vec2(0.0, texSize.w) ).x;\n\
		float z8 = texture2D(u_texture, uv + vec2(texSize.z, texSize.w) ).x;\n\
		vec3 normal = vec3( z2 + 2.0*z4 + z7 - z0 - 2.0*z3 - z5, z5 + 2.0*z6 + z7 -z0 - 2.0*z1 - z2, 1.0 );\n\
		normal.xy *= value;\n\
		result.xyz = normalize(normal) * 0.5 + vec3(0.5);\n\
	");
	LGraphTextureOperation.registerPreset("threshold","vec3(color.x > colorB.x * value ? 1.0 : 0.0,color.y > colorB.y * value ? 1.0 : 0.0,color.z > colorB.z * value ? 1.0 : 0.0)");

	//webglstudio stuff...
	LGraphTextureOperation.prototype.onInspect = function(widgets)
	{
		var that = this;
		widgets.addCombo("Presets","",{ values: Object.keys(LGraphTextureOperation.presets), callback: function(v){
			var code = LGraphTextureOperation.presets[v];
			if(!code)
				return;
			that.setProperty("pixelcode",code);
			that.title = v;
			widgets.refresh();
		}});
	}

	LiteGraph.registerNodeType("texture/operation", LGraphTextureOperation);

	//****************************************************

	function LGraphTextureShader() {
		this.addOutput("out", "Texture");
		this.properties = {
			code: "",
			u_value: 1,
			u_color: [1,1,1,1],
			width: 512,
			height: 512,
			precision: LGraphTexture.DEFAULT
		};

		this.properties.code = LGraphTextureShader.pixel_shader;
		this._uniforms = { u_value: 1, u_color: vec4.create(), in_texture: 0, texSize: vec4.create(), time: 0 };
	}

	LGraphTextureShader.title = "Shader";
	LGraphTextureShader.desc = "Texture shader";
	LGraphTextureShader.widgets_info = {
		code: { type: "code", lang: "glsl" },
		precision: { widget: "combo", values: LGraphTexture.MODE_VALUES }
	};

	LGraphTextureShader.prototype.onPropertyChanged = function(
		name,
		value
	) {
		if (name != "code") {
			return;
		}

		var shader = this.getShader();
		if (!shader) {
			return;
		}

		//update connections
		var uniforms = shader.uniformInfo;

		//remove deprecated slots
		if (this.inputs) {
			var already = {};
			for (var i = 0; i < this.inputs.length; ++i) {
				var info = this.getInputInfo(i);
				if (!info) {
					continue;
				}

				if (uniforms[info.name] && !already[info.name]) {
					already[info.name] = true;
					continue;
				}
				this.removeInput(i);
				i--;
			}
		}

		//update existing ones
		for (var i in uniforms) {
			var info = shader.uniformInfo[i];
			if (info.loc === null) {
				continue;
			} //is an attribute, not a uniform
			if (i == "time") {
				//default one
				continue;
			}

			var type = "number";
			if (this._shader.samplers[i]) {
				type = "texture";
			} else {
				switch (info.size) {
					case 1:
						type = "number";
						break;
					case 2:
						type = "vec2";
						break;
					case 3:
						type = "vec3";
						break;
					case 4:
						type = "vec4";
						break;
					case 9:
						type = "mat3";
						break;
					case 16:
						type = "mat4";
						break;
					default:
						continue;
				}
			}

			var slot = this.findInputSlot(i);
			if (slot == -1) {
				this.addInput(i, type);
				continue;
			}

			var input_info = this.getInputInfo(slot);
			if (!input_info) {
				this.addInput(i, type);
			} else {
				if (input_info.type == type) {
					continue;
				}
				this.removeInput(slot, type);
				this.addInput(i, type);
			}
		}
	};

	LGraphTextureShader.prototype.getShader = function() {
		//replug
		if (this._shader && this._shader_code == this.properties.code) {
			return this._shader;
		}

		this._shader_code = this.properties.code;
		this._shader = new GL.Shader( Shader.SCREEN_VERTEX_SHADER, this.properties.code );
		if (!this._shader) {
			this.boxcolor = "red";
			return null;
		} else {
			this.boxcolor = "green";
		}
		return this._shader;
	};

	LGraphTextureShader.prototype.onExecute = function() {
		if (!this.isOutputConnected(0)) {
			return;
		} //saves work

		var shader = this.getShader();
		if (!shader) {
			return;
		}

		var tex_slot = 0;
		var in_tex = null;

		//set uniforms
		if(this.inputs)
		for (var i = 0; i < this.inputs.length; ++i) {
			var info = this.getInputInfo(i);
			var data = this.getInputData(i);
			if (data == null) {
				continue;
			}

			if (data.constructor === GL.Texture) {
				data.bind(tex_slot);
				if (!in_tex) {
					in_tex = data;
				}
				data = tex_slot;
				tex_slot++;
			}
			shader.setUniform(info.name, data); //data is tex_slot
		}

		var uniforms = this._uniforms;
		var type = LGraphTexture.getTextureType( this.properties.precision, in_tex );

		//render to texture
		var w = this.properties.width | 0;
		var h = this.properties.height | 0;
		if (w == 0) {
			w = in_tex ? in_tex.width : gl.canvas.width;
		}
		if (h == 0) {
			h = in_tex ? in_tex.height : gl.canvas.height;
		}
		uniforms.texSize[0] = w;
		uniforms.texSize[1] = h;
		uniforms.texSize[2] = 1/w;
		uniforms.texSize[3] = 1/h;
		uniforms.time = this.graph.getTime();
		uniforms.u_value = this.properties.u_value;
		uniforms.u_color.set( this.properties.u_color );

		if ( !this._tex || this._tex.type != type ||  this._tex.width != w || this._tex.height != h ) {
			this._tex = new GL.Texture(w, h, {  type: type, format: gl.RGBA, filter: gl.LINEAR });
		}
		var tex = this._tex;
		tex.drawTo(function() {
			shader.uniforms(uniforms).draw(GL.Mesh.getScreenQuad());
		});

		this.setOutputData(0, this._tex);
	};

	LGraphTextureShader.pixel_shader =
"precision highp float;\n\
\n\
varying vec2 v_coord;\n\
uniform float time; //time in seconds\n\
uniform vec4 texSize; //tex resolution\n\
uniform float u_value;\n\
uniform vec4 u_color;\n\n\
void main() {\n\
	vec2 uv = v_coord;\n\
	vec3 color = vec3(0.0);\n\
	//your code here\n\
	color.xy=uv;\n\n\
	gl_FragColor = vec4(color, 1.0);\n\
}\n\
";

	LiteGraph.registerNodeType("texture/shader", LGraphTextureShader);

	// Texture Scale Offset

	function LGraphTextureScaleOffset() {
		this.addInput("in", "Texture");
		this.addInput("scale", "vec2");
		this.addInput("offset", "vec2");
		this.addOutput("out", "Texture");
		this.properties = {
			offset: vec2.fromValues(0, 0),
			scale: vec2.fromValues(1, 1),
			precision: LGraphTexture.DEFAULT
		};
	}

	LGraphTextureScaleOffset.widgets_info = {
		precision: { widget: "combo", values: LGraphTexture.MODE_VALUES }
	};

	LGraphTextureScaleOffset.title = "Scale/Offset";
	LGraphTextureScaleOffset.desc = "Applies an scaling and offseting";

	LGraphTextureScaleOffset.prototype.onExecute = function() {
		var tex = this.getInputData(0);

		if (!this.isOutputConnected(0) || !tex) {
			return;
		} //saves work

		if (this.properties.precision === LGraphTexture.PASS_THROUGH) {
			this.setOutputData(0, tex);
			return;
		}

		var width = tex.width;
		var height = tex.height;
		var type =  this.precision === LGraphTexture.LOW ? gl.UNSIGNED_BYTE : gl.HIGH_PRECISION_FORMAT;
		if (this.precision === LGraphTexture.DEFAULT) {
			type = tex.type;
		}

		if (
			!this._tex ||
			this._tex.width != width ||
			this._tex.height != height ||
			this._tex.type != type
		) {
			this._tex = new GL.Texture(width, height, {
				type: type,
				format: gl.RGBA,
				filter: gl.LINEAR
			});
		}

		var shader = this._shader;

		if (!shader) {
			shader = new GL.Shader(
				GL.Shader.SCREEN_VERTEX_SHADER,
				LGraphTextureScaleOffset.pixel_shader
			);
		}

		var scale = this.getInputData(1);
		if (scale) {
			this.properties.scale[0] = scale[0];
			this.properties.scale[1] = scale[1];
		} else {
			scale = this.properties.scale;
		}

		var offset = this.getInputData(2);
		if (offset) {
			this.properties.offset[0] = offset[0];
			this.properties.offset[1] = offset[1];
		} else {
			offset = this.properties.offset;
		}

		this._tex.drawTo(function() {
			gl.disable(gl.DEPTH_TEST);
			gl.disable(gl.CULL_FACE);
			gl.disable(gl.BLEND);
			tex.bind(0);
			var mesh = Mesh.getScreenQuad();
			shader
				.uniforms({
					u_texture: 0,
					u_scale: scale,
					u_offset: offset
				})
				.draw(mesh);
		});

		this.setOutputData(0, this._tex);
	};

	LGraphTextureScaleOffset.pixel_shader =
		"precision highp float;\n\
		\n\
		uniform sampler2D u_texture;\n\
		uniform sampler2D u_textureB;\n\
		varying vec2 v_coord;\n\
		uniform vec2 u_scale;\n\
		uniform vec2 u_offset;\n\
		\n\
		void main() {\n\
			vec2 uv = v_coord;\n\
			uv = uv / u_scale - u_offset;\n\
			gl_FragColor = texture2D(u_texture, uv);\n\
		}\n\
		";

	LiteGraph.registerNodeType(
		"texture/scaleOffset",
		LGraphTextureScaleOffset
	);

	// Warp (distort a texture) *************************

	function LGraphTextureWarp() {
		this.addInput("in", "Texture");
		this.addInput("warp", "Texture");
		this.addInput("factor", "number");
		this.addOutput("out", "Texture");
		this.properties = {
			factor: 0.01,
			scale: [1,1],
			offset: [0,0],
			precision: LGraphTexture.DEFAULT
		};

		this._uniforms = { 
			u_texture: 0, 
			u_textureB: 1, 
			u_factor: 1, 
			u_scale: vec2.create(),
			u_offset: vec2.create()
		};
	}

	LGraphTextureWarp.widgets_info = {
		precision: { widget: "combo", values: LGraphTexture.MODE_VALUES }
	};

	LGraphTextureWarp.title = "Warp";
	LGraphTextureWarp.desc = "Texture warp operation";

	LGraphTextureWarp.prototype.onExecute = function() {
		var tex = this.getInputData(0);

		if (!this.isOutputConnected(0)) {
			return;
		} //saves work

		if (this.properties.precision === LGraphTexture.PASS_THROUGH) {
			this.setOutputData(0, tex);
			return;
		}

		var texB = this.getInputData(1);

		var width = 512;
		var height = 512;
		var type = gl.UNSIGNED_BYTE;
		if (tex) {
			width = tex.width;
			height = tex.height;
			type = tex.type;
		} else if (texB) {
			width = texB.width;
			height = texB.height;
			type = texB.type;
		}

		if (!tex && !this._tex) {
			this._tex = new GL.Texture(width, height, {
				type:
					this.precision === LGraphTexture.LOW
						? gl.UNSIGNED_BYTE
						: gl.HIGH_PRECISION_FORMAT,
				format: gl.RGBA,
				filter: gl.LINEAR
			});
		} else {
			this._tex = LGraphTexture.getTargetTexture(
				tex || this._tex,
				this._tex,
				this.properties.precision
			);
		}

		var shader = this._shader;

		if (!shader) {
			shader = new GL.Shader(
				GL.Shader.SCREEN_VERTEX_SHADER,
				LGraphTextureWarp.pixel_shader
			);
		}

		var factor = this.getInputData(2);
		if (factor != null) {
			this.properties.factor = factor;
		} else {
			factor = parseFloat(this.properties.factor);
		}
		var uniforms = this._uniforms;
		uniforms.u_factor = factor;
		uniforms.u_scale.set( this.properties.scale );
		uniforms.u_offset.set( this.properties.offset );

		this._tex.drawTo(function() {
			gl.disable(gl.DEPTH_TEST);
			gl.disable(gl.CULL_FACE);
			gl.disable(gl.BLEND);
			if (tex) {
				tex.bind(0);
			}
			if (texB) {
				texB.bind(1);
			}
			var mesh = Mesh.getScreenQuad();
			shader
				.uniforms( uniforms )
				.draw(mesh);
		});

		this.setOutputData(0, this._tex);
	};

	LGraphTextureWarp.pixel_shader =
		"precision highp float;\n\
		\n\
		uniform sampler2D u_texture;\n\
		uniform sampler2D u_textureB;\n\
		varying vec2 v_coord;\n\
		uniform float u_factor;\n\
		uniform vec2 u_scale;\n\
		uniform vec2 u_offset;\n\
		\n\
		void main() {\n\
			vec2 uv = v_coord;\n\
			uv += ( texture2D(u_textureB, uv).rg - vec2(0.5)) * u_factor * u_scale + u_offset;\n\
			gl_FragColor = texture2D(u_texture, uv);\n\
		}\n\
		";

	LiteGraph.registerNodeType("texture/warp", LGraphTextureWarp);

	//****************************************************

	// Texture to Viewport *****************************************
	function LGraphTextureToViewport() {
		this.addInput("Texture", "Texture");
		this.properties = {
			additive: false,
			antialiasing: false,
			filter: true,
			disable_alpha: false,
			gamma: 1.0,
			viewport: [0,0,1,1]
		};
		this.size[0] = 130;
	}

	LGraphTextureToViewport.title = "to Viewport";
	LGraphTextureToViewport.desc = "Texture to viewport";

	LGraphTextureToViewport._prev_viewport = new Float32Array(4);

	LGraphTextureToViewport.prototype.onDrawBackground = function( ctx )
	{
		if ( this.flags.collapsed || this.size[1] <= 40 )
			return;

		var tex = this.getInputData(0);
		if (!tex) {
			return;
		}

		ctx.drawImage( ctx == gl ? tex : gl.canvas, 10,30, this.size[0] -20, this.size[1] -40);
	}

	LGraphTextureToViewport.prototype.onExecute = function() {
		var tex = this.getInputData(0);
		if (!tex) {
			return;
		}

		if (this.properties.disable_alpha) {
			gl.disable(gl.BLEND);
		} else {
			gl.enable(gl.BLEND);
			if (this.properties.additive) {
				gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
			} else {
				gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
			}
		}

		gl.disable(gl.DEPTH_TEST);
		var gamma = this.properties.gamma || 1.0;
		if (this.isInputConnected(1)) {
			gamma = this.getInputData(1);
		}

		tex.setParameter(
			gl.TEXTURE_MAG_FILTER,
			this.properties.filter ? gl.LINEAR : gl.NEAREST
		);

		var old_viewport = LGraphTextureToViewport._prev_viewport;
		old_viewport.set( gl.viewport_data );
		var new_view = this.properties.viewport;
		gl.viewport( old_viewport[0] + old_viewport[2] * new_view[0], old_viewport[1] + old_viewport[3] * new_view[1], old_viewport[2] * new_view[2], old_viewport[3] * new_view[3] );
		var viewport = gl.getViewport(); //gl.getParameter(gl.VIEWPORT);

		if (this.properties.antialiasing) {
			if (!LGraphTextureToViewport._shader) {
				LGraphTextureToViewport._shader = new GL.Shader(
					GL.Shader.SCREEN_VERTEX_SHADER,
					LGraphTextureToViewport.aa_pixel_shader
				);
			}

			var mesh = Mesh.getScreenQuad();
			tex.bind(0);
			LGraphTextureToViewport._shader
				.uniforms({
					u_texture: 0,
					uViewportSize: [tex.width, tex.height],
					u_igamma: 1 / gamma,
					inverseVP: [1 / tex.width, 1 / tex.height]
				})
				.draw(mesh);
		} else {
			if (gamma != 1.0) {
				if (!LGraphTextureToViewport._gamma_shader) {
					LGraphTextureToViewport._gamma_shader = new GL.Shader(
						Shader.SCREEN_VERTEX_SHADER,
						LGraphTextureToViewport.gamma_pixel_shader
					);
				}
				tex.toViewport(LGraphTextureToViewport._gamma_shader, {
					u_texture: 0,
					u_igamma: 1 / gamma
				});
			} else {
				tex.toViewport();
			}
		}

		gl.viewport( old_viewport[0], old_viewport[1], old_viewport[2], old_viewport[3] );
	};

	LGraphTextureToViewport.prototype.onGetInputs = function() {
		return [["gamma", "number"]];
	};

	LGraphTextureToViewport.aa_pixel_shader =
		"precision highp float;\n\
		precision highp float;\n\
		varying vec2 v_coord;\n\
		uniform sampler2D u_texture;\n\
		uniform vec2 uViewportSize;\n\
		uniform vec2 inverseVP;\n\
		uniform float u_igamma;\n\
		#define FXAA_REDUCE_MIN   (1.0/ 128.0)\n\
		#define FXAA_REDUCE_MUL   (1.0 / 8.0)\n\
		#define FXAA_SPAN_MAX     8.0\n\
		\n\
		/* from mitsuhiko/webgl-meincraft based on the code on geeks3d.com */\n\
		vec4 applyFXAA(sampler2D tex, vec2 fragCoord)\n\
		{\n\
			vec4 color = vec4(0.0);\n\
			/*vec2 inverseVP = vec2(1.0 / uViewportSize.x, 1.0 / uViewportSize.y);*/\n\
			vec3 rgbNW = texture2D(tex, (fragCoord + vec2(-1.0, -1.0)) * inverseVP).xyz;\n\
			vec3 rgbNE = texture2D(tex, (fragCoord + vec2(1.0, -1.0)) * inverseVP).xyz;\n\
			vec3 rgbSW = texture2D(tex, (fragCoord + vec2(-1.0, 1.0)) * inverseVP).xyz;\n\
			vec3 rgbSE = texture2D(tex, (fragCoord + vec2(1.0, 1.0)) * inverseVP).xyz;\n\
			vec3 rgbM  = texture2D(tex, fragCoord  * inverseVP).xyz;\n\
			vec3 luma = vec3(0.299, 0.587, 0.114);\n\
			float lumaNW = dot(rgbNW, luma);\n\
			float lumaNE = dot(rgbNE, luma);\n\
			float lumaSW = dot(rgbSW, luma);\n\
			float lumaSE = dot(rgbSE, luma);\n\
			float lumaM  = dot(rgbM,  luma);\n\
			float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));\n\
			float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));\n\
			\n\
			vec2 dir;\n\
			dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));\n\
			dir.y =  ((lumaNW + lumaSW) - (lumaNE + lumaSE));\n\
			\n\
			float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * (0.25 * FXAA_REDUCE_MUL), FXAA_REDUCE_MIN);\n\
			\n\
			float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);\n\
			dir = min(vec2(FXAA_SPAN_MAX, FXAA_SPAN_MAX), max(vec2(-FXAA_SPAN_MAX, -FXAA_SPAN_MAX), dir * rcpDirMin)) * inverseVP;\n\
			\n\
			vec3 rgbA = 0.5 * (texture2D(tex, fragCoord * inverseVP + dir * (1.0 / 3.0 - 0.5)).xyz + \n\
				texture2D(tex, fragCoord * inverseVP + dir * (2.0 / 3.0 - 0.5)).xyz);\n\
			vec3 rgbB = rgbA * 0.5 + 0.25 * (texture2D(tex, fragCoord * inverseVP + dir * -0.5).xyz + \n\
				texture2D(tex, fragCoord * inverseVP + dir * 0.5).xyz);\n\
			\n\
			//return vec4(rgbA,1.0);\n\
			float lumaB = dot(rgbB, luma);\n\
			if ((lumaB < lumaMin) || (lumaB > lumaMax))\n\
				color = vec4(rgbA, 1.0);\n\
			else\n\
				color = vec4(rgbB, 1.0);\n\
			if(u_igamma != 1.0)\n\
				color.xyz = pow( color.xyz, vec3(u_igamma) );\n\
			return color;\n\
		}\n\
		\n\
		void main() {\n\
		   gl_FragColor = applyFXAA( u_texture, v_coord * uViewportSize) ;\n\
		}\n\
		";

	LGraphTextureToViewport.gamma_pixel_shader =
		"precision highp float;\n\
		precision highp float;\n\
		varying vec2 v_coord;\n\
		uniform sampler2D u_texture;\n\
		uniform float u_igamma;\n\
		void main() {\n\
			vec4 color = texture2D( u_texture, v_coord);\n\
			color.xyz = pow(color.xyz, vec3(u_igamma) );\n\
		   gl_FragColor = color;\n\
		}\n\
		";

	LiteGraph.registerNodeType(
		"texture/toviewport",
		LGraphTextureToViewport
	);

	// Texture Copy *****************************************
	function LGraphTextureCopy() {
		this.addInput("Texture", "Texture");
		this.addOutput("", "Texture");
		this.properties = {
			size: 0,
			generate_mipmaps: false,
			precision: LGraphTexture.DEFAULT
		};
	}

	LGraphTextureCopy.title = "Copy";
	LGraphTextureCopy.desc = "Copy Texture";
	LGraphTextureCopy.widgets_info = {
		size: {
			widget: "combo",
			values: [0, 32, 64, 128, 256, 512, 1024, 2048]
		},
		precision: { widget: "combo", values: LGraphTexture.MODE_VALUES }
	};

	LGraphTextureCopy.prototype.onExecute = function() {
		var tex = this.getInputData(0);
		if (!tex && !this._temp_texture) {
			return;
		}

		if (!this.isOutputConnected(0)) {
			return;
		} //saves work

		//copy the texture
		if (tex) {
			var width = tex.width;
			var height = tex.height;

			if (this.properties.size != 0) {
				width = this.properties.size;
				height = this.properties.size;
			}

			var temp = this._temp_texture;

			var type = tex.type;
			if (this.properties.precision === LGraphTexture.LOW) {
				type = gl.UNSIGNED_BYTE;
			} else if (this.properties.precision === LGraphTexture.HIGH) {
				type = gl.HIGH_PRECISION_FORMAT;
			}

			if (
				!temp ||
				temp.width != width ||
				temp.height != height ||
				temp.type != type
			) {
				var minFilter = gl.LINEAR;
				if (
					this.properties.generate_mipmaps &&
					isPowerOfTwo(width) &&
					isPowerOfTwo(height)
				) {
					minFilter = gl.LINEAR_MIPMAP_LINEAR;
				}
				this._temp_texture = new GL.Texture(width, height, {
					type: type,
					format: gl.RGBA,
					minFilter: minFilter,
					magFilter: gl.LINEAR
				});
			}
			tex.copyTo(this._temp_texture);

			if (this.properties.generate_mipmaps) {
				this._temp_texture.bind(0);
				gl.generateMipmap(this._temp_texture.texture_type);
				this._temp_texture.unbind(0);
			}
		}

		this.setOutputData(0, this._temp_texture);
	};

	LiteGraph.registerNodeType("texture/copy", LGraphTextureCopy);

	// Texture Downsample *****************************************
	function LGraphTextureDownsample() {
		this.addInput("Texture", "Texture");
		this.addOutput("", "Texture");
		this.properties = {
			iterations: 1,
			generate_mipmaps: false,
			precision: LGraphTexture.DEFAULT
		};
	}

	LGraphTextureDownsample.title = "Downsample";
	LGraphTextureDownsample.desc = "Downsample Texture";
	LGraphTextureDownsample.widgets_info = {
		iterations: { type: "number", step: 1, precision: 0, min: 0 },
		precision: { widget: "combo", values: LGraphTexture.MODE_VALUES }
	};

	LGraphTextureDownsample.prototype.onExecute = function() {
		var tex = this.getInputData(0);
		if (!tex && !this._temp_texture) {
			return;
		}

		if (!this.isOutputConnected(0)) {
			return;
		} //saves work

		//we do not allow any texture different than texture 2D
		if (!tex || tex.texture_type !== GL.TEXTURE_2D) {
			return;
		}

		if (this.properties.iterations < 1) {
			this.setOutputData(0, tex);
			return;
		}

		var shader = LGraphTextureDownsample._shader;
		if (!shader) {
			LGraphTextureDownsample._shader = shader = new GL.Shader(
				GL.Shader.SCREEN_VERTEX_SHADER,
				LGraphTextureDownsample.pixel_shader
			);
		}

		var width = tex.width | 0;
		var height = tex.height | 0;
		var type = tex.type;
		if (this.properties.precision === LGraphTexture.LOW) {
			type = gl.UNSIGNED_BYTE;
		} else if (this.properties.precision === LGraphTexture.HIGH) {
			type = gl.HIGH_PRECISION_FORMAT;
		}
		var iterations = this.properties.iterations || 1;

		var origin = tex;
		var target = null;

		var temp = [];
		var options = {
			type: type,
			format: tex.format
		};

		var offset = vec2.create();
		var uniforms = {
			u_offset: offset
		};

		if (this._texture) {
			GL.Texture.releaseTemporary(this._texture);
		}

		for (var i = 0; i < iterations; ++i) {
			offset[0] = 1 / width;
			offset[1] = 1 / height;
			width = width >> 1 || 0;
			height = height >> 1 || 0;
			target = GL.Texture.getTemporary(width, height, options);
			temp.push(target);
			origin.setParameter(GL.TEXTURE_MAG_FILTER, GL.NEAREST);
			origin.copyTo(target, shader, uniforms);
			if (width == 1 && height == 1) {
				break;
			} //nothing else to do
			origin = target;
		}

		//keep the last texture used
		this._texture = temp.pop();

		//free the rest
		for (var i = 0; i < temp.length; ++i) {
			GL.Texture.releaseTemporary(temp[i]);
		}

		if (this.properties.generate_mipmaps) {
			this._texture.bind(0);
			gl.generateMipmap(this._texture.texture_type);
			this._texture.unbind(0);
		}

		this.setOutputData(0, this._texture);
	};

	LGraphTextureDownsample.pixel_shader =
		"precision highp float;\n\
		precision highp float;\n\
		uniform sampler2D u_texture;\n\
		uniform vec2 u_offset;\n\
		varying vec2 v_coord;\n\
		\n\
		void main() {\n\
			vec4 color = texture2D(u_texture, v_coord );\n\
			color += texture2D(u_texture, v_coord + vec2( u_offset.x, 0.0 ) );\n\
			color += texture2D(u_texture, v_coord + vec2( 0.0, u_offset.y ) );\n\
			color += texture2D(u_texture, v_coord + vec2( u_offset.x, u_offset.y ) );\n\
		   gl_FragColor = color * 0.25;\n\
		}\n\
		";

	LiteGraph.registerNodeType(
		"texture/downsample",
		LGraphTextureDownsample
	);



	function LGraphTextureResize() {
		this.addInput("Texture", "Texture");
		this.addOutput("", "Texture");
		this.properties = {
			size: [512,512],
			generate_mipmaps: false,
			precision: LGraphTexture.DEFAULT
		};
	}

	LGraphTextureResize.title = "Resize";
	LGraphTextureResize.desc = "Resize Texture";
	LGraphTextureResize.widgets_info = {
		iterations: { type: "number", step: 1, precision: 0, min: 0 },
		precision: { widget: "combo", values: LGraphTexture.MODE_VALUES }
	};

	LGraphTextureResize.prototype.onExecute = function() {
		var tex = this.getInputData(0);
		if (!tex && !this._temp_texture) {
			return;
		}

		if (!this.isOutputConnected(0)) {
			return;
		} //saves work

		//we do not allow any texture different than texture 2D
		if (!tex || tex.texture_type !== GL.TEXTURE_2D) {
			return;
		}

		var width = this.properties.size[0] | 0;
		var height = this.properties.size[1] | 0;
		if(width == 0)
			width = tex.width;
		if(height == 0)
			height = tex.height;
		var type = tex.type;
		if (this.properties.precision === LGraphTexture.LOW) {
			type = gl.UNSIGNED_BYTE;
		} else if (this.properties.precision === LGraphTexture.HIGH) {
			type = gl.HIGH_PRECISION_FORMAT;
		}

		if( !this._texture || this._texture.width != width || this._texture.height != height || this._texture.type != type )
			this._texture = new GL.Texture( width, height, { type: type } );

		tex.copyTo( this._texture );

		if (this.properties.generate_mipmaps) {
			this._texture.bind(0);
			gl.generateMipmap(this._texture.texture_type);
			this._texture.unbind(0);
		}

		this.setOutputData(0, this._texture);
	};

	LiteGraph.registerNodeType( "texture/resize", LGraphTextureResize );

	// Texture Average  *****************************************
	function LGraphTextureAverage() {
		this.addInput("Texture", "Texture");
		this.addOutput("tex", "Texture");
		this.addOutput("avg", "vec4");
		this.addOutput("lum", "number");
		this.properties = {
			use_previous_frame: true, //to avoid stalls 
			high_quality: false //to use as much pixels as possible
		};

		this._uniforms = {
			u_texture: 0,
			u_mipmap_offset: 0
		};
		this._luminance = new Float32Array(4);
	}

	LGraphTextureAverage.title = "Average";
	LGraphTextureAverage.desc =
		"Compute a partial average (32 random samples) of a texture and stores it as a 1x1 pixel texture.\n If high_quality is true, then it generates the mipmaps first and reads from the lower one.";

	LGraphTextureAverage.prototype.onExecute = function() {
		if (!this.properties.use_previous_frame) {
			this.updateAverage();
		}

		var v = this._luminance;
		this.setOutputData(0, this._temp_texture);
		this.setOutputData(1, v);
		this.setOutputData(2, (v[0] + v[1] + v[2]) / 3);
	};

	//executed before rendering the frame
	LGraphTextureAverage.prototype.onPreRenderExecute = function() {
		this.updateAverage();
	};

	LGraphTextureAverage.prototype.updateAverage = function() {
		var tex = this.getInputData(0);
		if (!tex) {
			return;
		}

		if (
			!this.isOutputConnected(0) &&
			!this.isOutputConnected(1) &&
			!this.isOutputConnected(2)
		) {
			return;
		} //saves work

		if (!LGraphTextureAverage._shader) {
			LGraphTextureAverage._shader = new GL.Shader(
				GL.Shader.SCREEN_VERTEX_SHADER,
				LGraphTextureAverage.pixel_shader
			);
			//creates 256 random numbers and stores them in two mat4
			var samples = new Float32Array(16);
			for (var i = 0; i < samples.length; ++i) {
				samples[i] = Math.random(); //poorly distributed samples
			}
			//upload only once
			LGraphTextureAverage._shader.uniforms({
				u_samples_a: samples.subarray(0, 16),
				u_samples_b: samples.subarray(16, 32)
			});
		}

		var temp = this._temp_texture;
		var type = gl.UNSIGNED_BYTE;
		if (tex.type != type) {
			//force floats, half floats cannot be read with gl.readPixels
			type = gl.FLOAT;
		}

		if (!temp || temp.type != type) {
			this._temp_texture = new GL.Texture(1, 1, {
				type: type,
				format: gl.RGBA,
				filter: gl.NEAREST
			});
		}

		this._uniforms.u_mipmap_offset = 0;

		if(this.properties.high_quality)
		{
			if( !this._temp_pot2_texture || this._temp_pot2_texture.type != type )
				this._temp_pot2_texture = new GL.Texture(512, 512, {
					type: type,
					format: gl.RGBA,
					minFilter: gl.LINEAR_MIPMAP_LINEAR,
					magFilter: gl.LINEAR
				});

			tex.copyTo( this._temp_pot2_texture );
			tex = this._temp_pot2_texture;
			tex.bind(0);
			gl.generateMipmap(GL.TEXTURE_2D);
			this._uniforms.u_mipmap_offset = 9;
		}

		var shader = LGraphTextureAverage._shader;
		var uniforms = this._uniforms;
		uniforms.u_mipmap_offset = this.properties.mipmap_offset;
		gl.disable(gl.DEPTH_TEST);
		gl.disable(gl.BLEND);
		this._temp_texture.drawTo(function() {
			tex.toViewport(shader, uniforms);
		});

		if (this.isOutputConnected(1) || this.isOutputConnected(2)) {
			var pixel = this._temp_texture.getPixels();
			if (pixel) {
				var v = this._luminance;
				var type = this._temp_texture.type;
				v.set(pixel);
				if (type == gl.UNSIGNED_BYTE) {
					vec4.scale(v, v, 1 / 255);
				} else if (
					type == GL.HALF_FLOAT ||
					type == GL.HALF_FLOAT_OES
				) {
					//no half floats possible, hard to read back unless copyed to a FLOAT texture, so temp_texture is always forced to FLOAT
				}
			}
		}
	};

	LGraphTextureAverage.pixel_shader =
		"precision highp float;\n\
		precision highp float;\n\
		uniform mat4 u_samples_a;\n\
		uniform mat4 u_samples_b;\n\
		uniform sampler2D u_texture;\n\
		uniform float u_mipmap_offset;\n\
		varying vec2 v_coord;\n\
		\n\
		void main() {\n\
			vec4 color = vec4(0.0);\n\
			//random average\n\
			for(int i = 0; i < 4; ++i)\n\
				for(int j = 0; j < 4; ++j)\n\
				{\n\
					color += texture2D(u_texture, vec2( u_samples_a[i][j], u_samples_b[i][j] ), u_mipmap_offset );\n\
					color += texture2D(u_texture, vec2( 1.0 - u_samples_a[i][j], 1.0 - u_samples_b[i][j] ), u_mipmap_offset );\n\
				}\n\
		   gl_FragColor = color * 0.03125;\n\
		}\n\
		";

	LiteGraph.registerNodeType("texture/average", LGraphTextureAverage);



	// Computes operation between pixels (max, min)  *****************************************
	function LGraphTextureMinMax() {
		this.addInput("Texture", "Texture");
		this.addOutput("min_t", "Texture");
		this.addOutput("max_t", "Texture");
		this.addOutput("min", "vec4");
		this.addOutput("max", "vec4");
		this.properties = {
			mode: "max",
			use_previous_frame: true //to avoid stalls 
		};

		this._uniforms = {
			u_texture: 0
		};

		this._max = new Float32Array(4);
		this._min = new Float32Array(4);

		this._textures_chain = [];
	}

	LGraphTextureMinMax.widgets_info = {
		mode: { widget: "combo", values: ["min","max","avg"] }
	};

	LGraphTextureMinMax.title = "MinMax";
	LGraphTextureMinMax.desc = "Compute the scene min max";

	LGraphTextureMinMax.prototype.onExecute = function() {
		if (!this.properties.use_previous_frame) {
			this.update();
		}

		this.setOutputData(0, this._temp_texture);
		this.setOutputData(1, this._luminance);
	};

	//executed before rendering the frame
	LGraphTextureMinMax.prototype.onPreRenderExecute = function() {
		this.update();
	};

	LGraphTextureMinMax.prototype.update = function() {
		var tex = this.getInputData(0);
		if (!tex) {
			return;
		}

		if ( !this.isOutputConnected(0) && !this.isOutputConnected(1) ) {
			return;
		} //saves work

		if (!LGraphTextureMinMax._shader) {
			LGraphTextureMinMax._shader = new GL.Shader( GL.Shader.SCREEN_VERTEX_SHADER, LGraphTextureMinMax.pixel_shader );
		}

		var temp = this._temp_texture;
		var type = gl.UNSIGNED_BYTE;
		if (tex.type != type) {
			//force floats, half floats cannot be read with gl.readPixels
			type = gl.FLOAT;
		}

		var size = 512;

		if( !this._textures_chain.length || this._textures_chain[0].type != type )
		{
			var index = 0;
			while(i)
			{
				this._textures_chain[i] = new GL.Texture( size, size, {
					type: type,
					format: gl.RGBA,
					filter: gl.NEAREST
				});
				size = size >> 2;
				i++;
				if(size == 1)
					break;
			}
		}

		tex.copyTo( this._textures_chain[0] );
		var prev = this._textures_chain[0];
		for(var i = 1; i <= this._textures_chain.length; ++i)
		{
			var tex = this._textures_chain[i];

			prev = tex;				
		}

		var shader = LGraphTextureMinMax._shader;
		var uniforms = this._uniforms;
		uniforms.u_mipmap_offset = this.properties.mipmap_offset;
		gl.disable(gl.DEPTH_TEST);
		gl.disable(gl.BLEND);
		this._temp_texture.drawTo(function() {
			tex.toViewport(shader, uniforms);
		});
	};

	LGraphTextureMinMax.pixel_shader =
		"precision highp float;\n\
		precision highp float;\n\
		uniform mat4 u_samples_a;\n\
		uniform mat4 u_samples_b;\n\
		uniform sampler2D u_texture;\n\
		uniform float u_mipmap_offset;\n\
		varying vec2 v_coord;\n\
		\n\
		void main() {\n\
			vec4 color = vec4(0.0);\n\
			//random average\n\
			for(int i = 0; i < 4; ++i)\n\
				for(int j = 0; j < 4; ++j)\n\
				{\n\
					color += texture2D(u_texture, vec2( u_samples_a[i][j], u_samples_b[i][j] ), u_mipmap_offset );\n\
					color += texture2D(u_texture, vec2( 1.0 - u_samples_a[i][j], 1.0 - u_samples_b[i][j] ), u_mipmap_offset );\n\
				}\n\
		   gl_FragColor = color * 0.03125;\n\
		}\n\
		";

	//LiteGraph.registerNodeType("texture/clustered_operation", LGraphTextureClusteredOperation);


	function LGraphTextureTemporalSmooth() {
		this.addInput("in", "Texture");
		this.addInput("factor", "Number");
		this.addOutput("out", "Texture");
		this.properties = { factor: 0.5 };
		this._uniforms = {
			u_texture: 0,
			u_textureB: 1,
			u_factor: this.properties.factor
		};
	}

	LGraphTextureTemporalSmooth.title = "Smooth";
	LGraphTextureTemporalSmooth.desc = "Smooth texture over time";

	LGraphTextureTemporalSmooth.prototype.onExecute = function() {
		var tex = this.getInputData(0);
		if (!tex || !this.isOutputConnected(0)) {
			return;
		}

		if (!LGraphTextureTemporalSmooth._shader) {
			LGraphTextureTemporalSmooth._shader = new GL.Shader(
				GL.Shader.SCREEN_VERTEX_SHADER,
				LGraphTextureTemporalSmooth.pixel_shader
			);
		}

		var temp = this._temp_texture;
		if (
			!temp ||
			temp.type != tex.type ||
			temp.width != tex.width ||
			temp.height != tex.height
		) {
			var options = {
				type: tex.type,
				format: gl.RGBA,
				filter: gl.NEAREST
			};
			this._temp_texture = new GL.Texture(tex.width, tex.height, options );
			this._temp_texture2 = new GL.Texture(tex.width, tex.height, options );
			tex.copyTo(this._temp_texture2);
		}

		var tempA = this._temp_texture;
		var tempB = this._temp_texture2;

		var shader = LGraphTextureTemporalSmooth._shader;
		var uniforms = this._uniforms;
		uniforms.u_factor = 1.0 - this.getInputOrProperty("factor");

		gl.disable(gl.BLEND);
		gl.disable(gl.DEPTH_TEST);
		tempA.drawTo(function() {
			tempB.bind(1);
			tex.toViewport(shader, uniforms);
		});

		this.setOutputData(0, tempA);

		//swap
		this._temp_texture = tempB;
		this._temp_texture2 = tempA;
	};

	LGraphTextureTemporalSmooth.pixel_shader =
		"precision highp float;\n\
		precision highp float;\n\
		uniform sampler2D u_texture;\n\
		uniform sampler2D u_textureB;\n\
		uniform float u_factor;\n\
		varying vec2 v_coord;\n\
		\n\
		void main() {\n\
			gl_FragColor = mix( texture2D( u_texture, v_coord ), texture2D( u_textureB, v_coord ), u_factor );\n\
		}\n\
		";

	LiteGraph.registerNodeType( "texture/temporal_smooth", LGraphTextureTemporalSmooth );


	function LGraphTextureLinearAvgSmooth() {
		this.addInput("in", "Texture");
		this.addOutput("avg", "Texture");
		this.addOutput("array", "Texture");
		this.properties = { samples: 64, frames_interval: 1 };
		this._uniforms = {
			u_texture: 0,
			u_textureB: 1,
			u_samples: this.properties.samples,
			u_isamples: 1/this.properties.samples
		};
		this.frame = 0;
	}

	LGraphTextureLinearAvgSmooth.title = "Lineal Avg Smooth";
	LGraphTextureLinearAvgSmooth.desc = "Smooth texture linearly over time";

	LGraphTextureLinearAvgSmooth["@samples"] = { type: "number", min: 1, max: 64, step: 1, precision: 1 };

	LGraphTextureLinearAvgSmooth.prototype.getPreviewTexture = function()
	{
		return this._temp_texture2;
	}

	LGraphTextureLinearAvgSmooth.prototype.onExecute = function() {

		var tex = this.getInputData(0);
		if (!tex || !this.isOutputConnected(0)) {
			return;
		}

		if (!LGraphTextureLinearAvgSmooth._shader) {
			LGraphTextureLinearAvgSmooth._shader_copy = new GL.Shader( GL.Shader.SCREEN_VERTEX_SHADER, LGraphTextureLinearAvgSmooth.pixel_shader_copy );
			LGraphTextureLinearAvgSmooth._shader_avg = new GL.Shader( GL.Shader.SCREEN_VERTEX_SHADER, LGraphTextureLinearAvgSmooth.pixel_shader_avg );
		}

		var samples = Math.clamp(this.properties.samples,0,64);
		var frame = this.frame;
		var interval = this.properties.frames_interval;

		if( interval == 0 || frame % interval == 0 )
		{
			var temp = this._temp_texture;
			if ( !temp || temp.type != tex.type || temp.width != samples ) {
				var options = {
					type: tex.type,
					format: gl.RGBA,
					filter: gl.NEAREST
				};
				this._temp_texture = new GL.Texture( samples, 1, options );
				this._temp_texture2 = new GL.Texture( samples, 1, options );
				this._temp_texture_out = new GL.Texture( 1, 1, options );
			}

			var tempA = this._temp_texture;
			var tempB = this._temp_texture2;

			var shader_copy = LGraphTextureLinearAvgSmooth._shader_copy;
			var shader_avg = LGraphTextureLinearAvgSmooth._shader_avg;
			var uniforms = this._uniforms;
			uniforms.u_samples = samples;
			uniforms.u_isamples = 1.0 / samples;

			gl.disable(gl.BLEND);
			gl.disable(gl.DEPTH_TEST);
			tempA.drawTo(function() {
				tempB.bind(1);
				tex.toViewport( shader_copy, uniforms );
			});

			this._temp_texture_out.drawTo(function() {
				tempA.toViewport( shader_avg, uniforms );
			});

			this.setOutputData( 0, this._temp_texture_out );

			//swap
			this._temp_texture = tempB;
			this._temp_texture2 = tempA;
		}
		else
			this.setOutputData(0, this._temp_texture_out);
		this.setOutputData(1, this._temp_texture2);
		this.frame++;
	};

	LGraphTextureLinearAvgSmooth.pixel_shader_copy =
		"precision highp float;\n\
		precision highp float;\n\
		uniform sampler2D u_texture;\n\
		uniform sampler2D u_textureB;\n\
		uniform float u_isamples;\n\
		varying vec2 v_coord;\n\
		\n\
		void main() {\n\
			if( v_coord.x <= u_isamples )\n\
				gl_FragColor = texture2D( u_texture, vec2(0.5) );\n\
			else\n\
				gl_FragColor = texture2D( u_textureB, v_coord - vec2(u_isamples,0.0) );\n\
		}\n\
		";

	LGraphTextureLinearAvgSmooth.pixel_shader_avg =
		"precision highp float;\n\
		precision highp float;\n\
		uniform sampler2D u_texture;\n\
		uniform int u_samples;\n\
		uniform float u_isamples;\n\
		varying vec2 v_coord;\n\
		\n\
		void main() {\n\
			vec4 color = vec4(0.0);\n\
			for(int i = 0; i < 64; ++i)\n\
			{\n\
				color += texture2D( u_texture, vec2( float(i)*u_isamples,0.0) );\n\
				if(i == (u_samples - 1))\n\
					break;\n\
			}\n\
			gl_FragColor = color * u_isamples;\n\
		}\n\
		";


	LiteGraph.registerNodeType( "texture/linear_avg_smooth", LGraphTextureLinearAvgSmooth );

	// Image To Texture *****************************************
	function LGraphImageToTexture() {
		this.addInput("Image", "image");
		this.addOutput("", "Texture");
		this.properties = {};
	}

	LGraphImageToTexture.title = "Image to Texture";
	LGraphImageToTexture.desc = "Uploads an image to the GPU";
	//LGraphImageToTexture.widgets_info = { size: { widget:"combo", values:[0,32,64,128,256,512,1024,2048]} };

	LGraphImageToTexture.prototype.onExecute = function() {
		var img = this.getInputData(0);
		if (!img) {
			return;
		}

		var width = img.videoWidth || img.width;
		var height = img.videoHeight || img.height;

		//this is in case we are using a webgl canvas already, no need to reupload it
		if (img.gltexture) {
			this.setOutputData(0, img.gltexture);
			return;
		}

		var temp = this._temp_texture;
		if (!temp || temp.width != width || temp.height != height) {
			this._temp_texture = new GL.Texture(width, height, {
				format: gl.RGBA,
				filter: gl.LINEAR
			});
		}

		try {
			this._temp_texture.uploadImage(img);
		} catch (err) {
			console.error(
				"image comes from an unsafe location, cannot be uploaded to webgl: " +
					err
			);
			return;
		}

		this.setOutputData(0, this._temp_texture);
	};

	LiteGraph.registerNodeType(
		"texture/imageToTexture",
		LGraphImageToTexture
	);

	// Texture LUT *****************************************
	function LGraphTextureLUT() {
		this.addInput("Texture", "Texture");
		this.addInput("LUT", "Texture");
		this.addInput("Intensity", "number");
		this.addOutput("", "Texture");
		this.properties = { enabled: true, intensity: 1, precision: LGraphTexture.DEFAULT, texture: null };

		if (!LGraphTextureLUT._shader) {
			LGraphTextureLUT._shader = new GL.Shader( Shader.SCREEN_VERTEX_SHADER, LGraphTextureLUT.pixel_shader );
		}
	}

	LGraphTextureLUT.widgets_info = {
		texture: { widget: "texture" },
		precision: { widget: "combo", values: LGraphTexture.MODE_VALUES }
	};

	LGraphTextureLUT.title = "LUT";
	LGraphTextureLUT.desc = "Apply LUT to Texture";

	LGraphTextureLUT.prototype.onExecute = function() {
		if (!this.isOutputConnected(0)) {
			return;
		} //saves work

		var tex = this.getInputData(0);

		if (this.properties.precision === LGraphTexture.PASS_THROUGH || this.properties.enabled === false) {
			this.setOutputData(0, tex);
			return;
		}

		if (!tex) {
			return;
		}

		var lut_tex = this.getInputData(1);

		if (!lut_tex) {
			lut_tex = LGraphTexture.getTexture(this.properties.texture);
		}

		if (!lut_tex) {
			this.setOutputData(0, tex);
			return;
		}

		lut_tex.bind(0);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(
			gl.TEXTURE_2D,
			gl.TEXTURE_WRAP_S,
			gl.CLAMP_TO_EDGE
		);
		gl.texParameteri(
			gl.TEXTURE_2D,
			gl.TEXTURE_WRAP_T,
			gl.CLAMP_TO_EDGE
		);
		gl.bindTexture(gl.TEXTURE_2D, null);

		var intensity = this.properties.intensity;
		if (this.isInputConnected(2)) {
			this.properties.intensity = intensity = this.getInputData(2);
		}

		this._tex = LGraphTexture.getTargetTexture(
			tex,
			this._tex,
			this.properties.precision
		);

		//var mesh = Mesh.getScreenQuad();

		this._tex.drawTo(function() {
			lut_tex.bind(1);
			tex.toViewport(LGraphTextureLUT._shader, {
				u_texture: 0,
				u_textureB: 1,
				u_amount: intensity
			});
		});

		this.setOutputData(0, this._tex);
	};

	LGraphTextureLUT.pixel_shader =
		"precision highp float;\n\
		precision highp float;\n\
		varying vec2 v_coord;\n\
		uniform sampler2D u_texture;\n\
		uniform sampler2D u_textureB;\n\
		uniform float u_amount;\n\
		\n\
		void main() {\n\
			 lowp vec4 textureColor = clamp( texture2D(u_texture, v_coord), vec4(0.0), vec4(1.0) );\n\
			 mediump float blueColor = textureColor.b * 63.0;\n\
			 mediump vec2 quad1;\n\
			 quad1.y = floor(floor(blueColor) / 8.0);\n\
			 quad1.x = floor(blueColor) - (quad1.y * 8.0);\n\
			 mediump vec2 quad2;\n\
			 quad2.y = floor(ceil(blueColor) / 8.0);\n\
			 quad2.x = ceil(blueColor) - (quad2.y * 8.0);\n\
			 highp vec2 texPos1;\n\
			 texPos1.x = (quad1.x * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * textureColor.r);\n\
			 texPos1.y = 1.0 - ((quad1.y * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * textureColor.g));\n\
			 highp vec2 texPos2;\n\
			 texPos2.x = (quad2.x * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * textureColor.r);\n\
			 texPos2.y = 1.0 - ((quad2.y * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * textureColor.g));\n\
			 lowp vec4 newColor1 = texture2D(u_textureB, texPos1);\n\
			 lowp vec4 newColor2 = texture2D(u_textureB, texPos2);\n\
			 lowp vec4 newColor = mix(newColor1, newColor2, fract(blueColor));\n\
			 gl_FragColor = vec4( mix( textureColor.rgb, newColor.rgb, u_amount), textureColor.w);\n\
		}\n\
		";

	LiteGraph.registerNodeType("texture/LUT", LGraphTextureLUT);


	// Texture LUT *****************************************
	function LGraphTextureEncode() {
		this.addInput("Texture", "Texture");
		this.addInput("Atlas", "Texture");
		this.addOutput("", "Texture");
		this.properties = { enabled: true, num_row_symbols: 4, symbol_size: 16, brightness: 1, colorize: false, filter: false, invert: false, precision: LGraphTexture.DEFAULT, generate_mipmaps: false, texture: null };

		if (!LGraphTextureEncode._shader) {
			LGraphTextureEncode._shader = new GL.Shader( Shader.SCREEN_VERTEX_SHADER, LGraphTextureEncode.pixel_shader );
		}

		this._uniforms = {
				u_texture: 0,
				u_textureB: 1,
				u_row_simbols: 4,
				u_simbol_size: 16,
				u_res: vec2.create()
		};
	}

	LGraphTextureEncode.widgets_info = {
		texture: { widget: "texture" },
		precision: { widget: "combo", values: LGraphTexture.MODE_VALUES }
	};

	LGraphTextureEncode.title = "Encode";
	LGraphTextureEncode.desc = "Apply a texture atlas to encode a texture";

	LGraphTextureEncode.prototype.onExecute = function() {
		if (!this.isOutputConnected(0)) {
			return;
		} //saves work

		var tex = this.getInputData(0);

		if (this.properties.precision === LGraphTexture.PASS_THROUGH || this.properties.enabled === false) {
			this.setOutputData(0, tex);
			return;
		}

		if (!tex) {
			return;
		}

		var symbols_tex = this.getInputData(1);

		if (!symbols_tex) {
			symbols_tex = LGraphTexture.getTexture(this.properties.texture);
		}

		if (!symbols_tex) {
			this.setOutputData(0, tex);
			return;
		}

		symbols_tex.bind(0);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this.properties.filter ? gl.LINEAR : gl.NEAREST );
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.properties.filter ? gl.LINEAR : gl.NEAREST );
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE );
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE );
		gl.bindTexture(gl.TEXTURE_2D, null);

		var uniforms = this._uniforms;
		uniforms.u_row_simbols = Math.floor(this.properties.num_row_symbols);
		uniforms.u_symbol_size = this.properties.symbol_size;
		uniforms.u_brightness = this.properties.brightness;
		uniforms.u_invert = this.properties.invert ? 1 : 0;
		uniforms.u_colorize = this.properties.colorize ? 1 : 0;

		this._tex = LGraphTexture.getTargetTexture( tex, this._tex, this.properties.precision );
		uniforms.u_res[0] = this._tex.width;
		uniforms.u_res[1] = this._tex.height;
		this._tex.bind(0);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST );
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST );

		this._tex.drawTo(function() {
			symbols_tex.bind(1);
			tex.toViewport(LGraphTextureEncode._shader, uniforms);
		});

		if (this.properties.generate_mipmaps) {
			this._tex.bind(0);
			gl.generateMipmap(this._tex.texture_type);
			this._tex.unbind(0);
		}

		this.setOutputData(0, this._tex);
	};

	LGraphTextureEncode.pixel_shader =
		"precision highp float;\n\
		precision highp float;\n\
		varying vec2 v_coord;\n\
		uniform sampler2D u_texture;\n\
		uniform sampler2D u_textureB;\n\
		uniform float u_row_simbols;\n\
		uniform float u_symbol_size;\n\
		uniform float u_brightness;\n\
		uniform float u_invert;\n\
		uniform float u_colorize;\n\
		uniform vec2 u_res;\n\
		\n\
		void main() {\n\
			vec2 total_symbols = u_res / u_symbol_size;\n\
			vec2 uv = floor(v_coord * total_symbols) / total_symbols; //pixelate \n\
			vec2 local_uv = mod(v_coord * u_res, u_symbol_size) / u_symbol_size;\n\
			lowp vec4 textureColor = texture2D(u_texture, uv );\n\
			float lum = clamp(u_brightness * (textureColor.x + textureColor.y + textureColor.z)/3.0,0.0,1.0);\n\
			if( u_invert == 1.0 ) lum = 1.0 - lum;\n\
			float index = floor( lum * (u_row_simbols * u_row_simbols - 1.0));\n\
			float col = mod( index, u_row_simbols );\n\
			float row = u_row_simbols - floor( index / u_row_simbols ) - 1.0;\n\
			vec2 simbol_uv = ( vec2( col, row ) + local_uv ) / u_row_simbols;\n\
			vec4 color = texture2D( u_textureB, simbol_uv );\n\
			if(u_colorize == 1.0)\n\
				color *= textureColor;\n\
			gl_FragColor = color;\n\
		}\n\
		";

	LiteGraph.registerNodeType("texture/encode", LGraphTextureEncode);

	// Texture Channels *****************************************
	function LGraphTextureChannels() {
		this.addInput("Texture", "Texture");

		this.addOutput("R", "Texture");
		this.addOutput("G", "Texture");
		this.addOutput("B", "Texture");
		this.addOutput("A", "Texture");

		//this.properties = { use_single_channel: true };
		if (!LGraphTextureChannels._shader) {
			LGraphTextureChannels._shader = new GL.Shader(
				Shader.SCREEN_VERTEX_SHADER,
				LGraphTextureChannels.pixel_shader
			);
		}
	}

	LGraphTextureChannels.title = "Texture to Channels";
	LGraphTextureChannels.desc = "Split texture channels";

	LGraphTextureChannels.prototype.onExecute = function() {
		var texA = this.getInputData(0);
		if (!texA) {
			return;
		}

		if (!this._channels) {
			this._channels = Array(4);
		}

		//var format = this.properties.use_single_channel ? gl.LUMINANCE : gl.RGBA; //not supported by WebGL1
		var format = gl.RGB;
		var connections = 0;
		for (var i = 0; i < 4; i++) {
			if (this.isOutputConnected(i)) {
				if (
					!this._channels[i] ||
					this._channels[i].width != texA.width ||
					this._channels[i].height != texA.height ||
					this._channels[i].type != texA.type ||
					this._channels[i].format != format
				) {
					this._channels[i] = new GL.Texture(
						texA.width,
						texA.height,
						{
							type: texA.type,
							format: format,
							filter: gl.LINEAR
						}
					);
				}
				connections++;
			} else {
				this._channels[i] = null;
			}
		}

		if (!connections) {
			return;
		}

		gl.disable(gl.BLEND);
		gl.disable(gl.DEPTH_TEST);

		var mesh = Mesh.getScreenQuad();
		var shader = LGraphTextureChannels._shader;
		var masks = [
			[1, 0, 0, 0],
			[0, 1, 0, 0],
			[0, 0, 1, 0],
			[0, 0, 0, 1]
		];

		for (var i = 0; i < 4; i++) {
			if (!this._channels[i]) {
				continue;
			}

			this._channels[i].drawTo(function() {
				texA.bind(0);
				shader
					.uniforms({ u_texture: 0, u_mask: masks[i] })
					.draw(mesh);
			});
			this.setOutputData(i, this._channels[i]);
		}
	};

	LGraphTextureChannels.pixel_shader =
		"precision highp float;\n\
		precision highp float;\n\
		varying vec2 v_coord;\n\
		uniform sampler2D u_texture;\n\
		uniform vec4 u_mask;\n\
		\n\
		void main() {\n\
		   gl_FragColor = vec4( vec3( length( texture2D(u_texture, v_coord) * u_mask )), 1.0 );\n\
		}\n\
		";

	LiteGraph.registerNodeType(
		"texture/textureChannels",
		LGraphTextureChannels
	);

	// Texture Channels to Texture *****************************************
	function LGraphChannelsTexture() {
		this.addInput("R", "Texture");
		this.addInput("G", "Texture");
		this.addInput("B", "Texture");
		this.addInput("A", "Texture");

		this.addOutput("Texture", "Texture");

		this.properties = {
			precision: LGraphTexture.DEFAULT,
			R: 1,
			G: 1,
			B: 1,
			A: 1
		};
		this._color = vec4.create();
		this._uniforms = {
			u_textureR: 0,
			u_textureG: 1,
			u_textureB: 2,
			u_textureA: 3,
			u_color: this._color
		};
	}

	LGraphChannelsTexture.title = "Channels to Texture";
	LGraphChannelsTexture.desc = "Split texture channels";
	LGraphChannelsTexture.widgets_info = {
		precision: { widget: "combo", values: LGraphTexture.MODE_VALUES }
	};

	LGraphChannelsTexture.prototype.onExecute = function() {
		var white = LGraphTexture.getWhiteTexture();
		var texR = this.getInputData(0) || white;
		var texG = this.getInputData(1) || white;
		var texB = this.getInputData(2) || white;
		var texA = this.getInputData(3) || white;

		gl.disable(gl.BLEND);
		gl.disable(gl.DEPTH_TEST);

		var mesh = Mesh.getScreenQuad();
		if (!LGraphChannelsTexture._shader) {
			LGraphChannelsTexture._shader = new GL.Shader(
				Shader.SCREEN_VERTEX_SHADER,
				LGraphChannelsTexture.pixel_shader
			);
		}
		var shader = LGraphChannelsTexture._shader;

		var w = Math.max(texR.width, texG.width, texB.width, texA.width);
		var h = Math.max(
			texR.height,
			texG.height,
			texB.height,
			texA.height
		);
		var type =
			this.properties.precision == LGraphTexture.HIGH
				? LGraphTexture.HIGH_PRECISION_FORMAT
				: gl.UNSIGNED_BYTE;

		if (
			!this._texture ||
			this._texture.width != w ||
			this._texture.height != h ||
			this._texture.type != type
		) {
			this._texture = new GL.Texture(w, h, {
				type: type,
				format: gl.RGBA,
				filter: gl.LINEAR
			});
		}

		var color = this._color;
		color[0] = this.properties.R;
		color[1] = this.properties.G;
		color[2] = this.properties.B;
		color[3] = this.properties.A;
		var uniforms = this._uniforms;

		this._texture.drawTo(function() {
			texR.bind(0);
			texG.bind(1);
			texB.bind(2);
			texA.bind(3);
			shader.uniforms(uniforms).draw(mesh);
		});
		this.setOutputData(0, this._texture);
	};

	LGraphChannelsTexture.pixel_shader =
		"precision highp float;\n\
		precision highp float;\n\
		varying vec2 v_coord;\n\
		uniform sampler2D u_textureR;\n\
		uniform sampler2D u_textureG;\n\
		uniform sampler2D u_textureB;\n\
		uniform sampler2D u_textureA;\n\
		uniform vec4 u_color;\n\
		\n\
		void main() {\n\
		   gl_FragColor = u_color * vec4( \
					texture2D(u_textureR, v_coord).r,\
					texture2D(u_textureG, v_coord).r,\
					texture2D(u_textureB, v_coord).r,\
					texture2D(u_textureA, v_coord).r);\n\
		}\n\
		";

	LiteGraph.registerNodeType(
		"texture/channelsTexture",
		LGraphChannelsTexture
	);

	// Texture Color *****************************************
	function LGraphTextureColor() {
		this.addOutput("Texture", "Texture");

		this._tex_color = vec4.create();
		this.properties = {
			color: vec4.create(),
			precision: LGraphTexture.DEFAULT
		};
	}

	LGraphTextureColor.title = "Color";
	LGraphTextureColor.desc =
		"Generates a 1x1 texture with a constant color";

	LGraphTextureColor.widgets_info = {
		precision: { widget: "combo", values: LGraphTexture.MODE_VALUES }
	};

	LGraphTextureColor.prototype.onDrawBackground = function(ctx) {
		var c = this.properties.color;
		ctx.fillStyle =
			"rgb(" +
			Math.floor(Math.clamp(c[0], 0, 1) * 255) +
			"," +
			Math.floor(Math.clamp(c[1], 0, 1) * 255) +
			"," +
			Math.floor(Math.clamp(c[2], 0, 1) * 255) +
			")";
		if (this.flags.collapsed) {
			this.boxcolor = ctx.fillStyle;
		} else {
			ctx.fillRect(0, 0, this.size[0], this.size[1]);
		}
	};

	LGraphTextureColor.prototype.onExecute = function() {
		var type =
			this.properties.precision == LGraphTexture.HIGH
				? LGraphTexture.HIGH_PRECISION_FORMAT
				: gl.UNSIGNED_BYTE;

		if (!this._tex || this._tex.type != type) {
			this._tex = new GL.Texture(1, 1, {
				format: gl.RGBA,
				type: type,
				minFilter: gl.NEAREST
			});
		}
		var color = this.properties.color;

		if (this.inputs) {
			for (var i = 0; i < this.inputs.length; i++) {
				var input = this.inputs[i];
				var v = this.getInputData(i);
				if (v === undefined) {
					continue;
				}
				switch (input.name) {
					case "RGB":
					case "RGBA":
						color.set(v);
						break;
					case "R":
						color[0] = v;
						break;
					case "G":
						color[1] = v;
						break;
					case "B":
						color[2] = v;
						break;
					case "A":
						color[3] = v;
						break;
				}
			}
		}

		if (vec4.sqrDist(this._tex_color, color) > 0.001) {
			this._tex_color.set(color);
			this._tex.fill(color);
		}
		this.setOutputData(0, this._tex);
	};

	LGraphTextureColor.prototype.onGetInputs = function() {
		return [
			["RGB", "vec3"],
			["RGBA", "vec4"],
			["R", "number"],
			["G", "number"],
			["B", "number"],
			["A", "number"]
		];
	};

	LiteGraph.registerNodeType("texture/color", LGraphTextureColor);

	// Texture Channels to Texture *****************************************
	function LGraphTextureGradient() {
		this.addInput("A", "color");
		this.addInput("B", "color");
		this.addOutput("Texture", "Texture");

		this.properties = {
			angle: 0,
			scale: 1,
			A: [0, 0, 0],
			B: [1, 1, 1],
			texture_size: 32
		};
		if (!LGraphTextureGradient._shader) {
			LGraphTextureGradient._shader = new GL.Shader(
				Shader.SCREEN_VERTEX_SHADER,
				LGraphTextureGradient.pixel_shader
			);
		}

		this._uniforms = {
			u_angle: 0,
			u_colorA: vec3.create(),
			u_colorB: vec3.create()
		};
	}

	LGraphTextureGradient.title = "Gradient";
	LGraphTextureGradient.desc = "Generates a gradient";
	LGraphTextureGradient["@A"] = { type: "color" };
	LGraphTextureGradient["@B"] = { type: "color" };
	LGraphTextureGradient["@texture_size"] = {
		type: "enum",
		values: [32, 64, 128, 256, 512]
	};

	LGraphTextureGradient.prototype.onExecute = function() {
		gl.disable(gl.BLEND);
		gl.disable(gl.DEPTH_TEST);

		var mesh = GL.Mesh.getScreenQuad();
		var shader = LGraphTextureGradient._shader;

		var A = this.getInputData(0);
		if (!A) {
			A = this.properties.A;
		}
		var B = this.getInputData(1);
		if (!B) {
			B = this.properties.B;
		}

		//angle and scale
		for (var i = 2; i < this.inputs.length; i++) {
			var input = this.inputs[i];
			var v = this.getInputData(i);
			if (v === undefined) {
				continue;
			}
			this.properties[input.name] = v;
		}

		var uniforms = this._uniforms;
		this._uniforms.u_angle = this.properties.angle * DEG2RAD;
		this._uniforms.u_scale = this.properties.scale;
		vec3.copy(uniforms.u_colorA, A);
		vec3.copy(uniforms.u_colorB, B);

		var size = parseInt(this.properties.texture_size);
		if (!this._tex || this._tex.width != size) {
			this._tex = new GL.Texture(size, size, {
				format: gl.RGB,
				filter: gl.LINEAR
			});
		}

		this._tex.drawTo(function() {
			shader.uniforms(uniforms).draw(mesh);
		});
		this.setOutputData(0, this._tex);
	};

	LGraphTextureGradient.prototype.onGetInputs = function() {
		return [["angle", "number"], ["scale", "number"]];
	};

	LGraphTextureGradient.pixel_shader =
		"precision highp float;\n\
		precision highp float;\n\
		varying vec2 v_coord;\n\
		uniform float u_angle;\n\
		uniform float u_scale;\n\
		uniform vec3 u_colorA;\n\
		uniform vec3 u_colorB;\n\
		\n\
		vec2 rotate(vec2 v, float angle)\n\
		{\n\
			vec2 result;\n\
			float _cos = cos(angle);\n\
			float _sin = sin(angle);\n\
			result.x = v.x * _cos - v.y * _sin;\n\
			result.y = v.x * _sin + v.y * _cos;\n\
			return result;\n\
		}\n\
		void main() {\n\
			float f = (rotate(u_scale * (v_coord - vec2(0.5)), u_angle) + vec2(0.5)).x;\n\
			vec3 color = mix(u_colorA,u_colorB,clamp(f,0.0,1.0));\n\
		   gl_FragColor = vec4(color,1.0);\n\
		}\n\
		";

	LiteGraph.registerNodeType("texture/gradient", LGraphTextureGradient);

	// Texture Mix *****************************************
	function LGraphTextureMix() {
		this.addInput("A", "Texture");
		this.addInput("B", "Texture");
		this.addInput("Mixer", "Texture");

		this.addOutput("Texture", "Texture");
		this.properties = { factor: 0.5, size_from_biggest: true, invert: false, precision: LGraphTexture.DEFAULT };
		this._uniforms = {
			u_textureA: 0,
			u_textureB: 1,
			u_textureMix: 2,
			u_mix: vec4.create()
		};
	}

	LGraphTextureMix.title = "Mix";
	LGraphTextureMix.desc = "Generates a texture mixing two textures";

	LGraphTextureMix.widgets_info = {
		precision: { widget: "combo", values: LGraphTexture.MODE_VALUES }
	};

	LGraphTextureMix.prototype.onExecute = function() {
		var texA = this.getInputData(0);

		if (!this.isOutputConnected(0)) {
			return;
		} //saves work

		if (this.properties.precision === LGraphTexture.PASS_THROUGH) {
			this.setOutputData(0, texA);
			return;
		}

		var texB = this.getInputData(1);
		if (!texA || !texB) {
			return;
		}

		var texMix = this.getInputData(2);

		var factor = this.getInputData(3);

		this._tex = LGraphTexture.getTargetTexture(
			this.properties.size_from_biggest && texB.width > texA.width ? texB : texA,
			this._tex,
			this.properties.precision
		);

		gl.disable(gl.BLEND);
		gl.disable(gl.DEPTH_TEST);

		var mesh = Mesh.getScreenQuad();
		var shader = null;
		var uniforms = this._uniforms;
		if (texMix) {
			shader = LGraphTextureMix._shader_tex;
			if (!shader) {
				shader = LGraphTextureMix._shader_tex = new GL.Shader(
					Shader.SCREEN_VERTEX_SHADER,
					LGraphTextureMix.pixel_shader,
					{ MIX_TEX: "" }
				);
			}
		} else {
			shader = LGraphTextureMix._shader_factor;
			if (!shader) {
				shader = LGraphTextureMix._shader_factor = new GL.Shader(
					Shader.SCREEN_VERTEX_SHADER,
					LGraphTextureMix.pixel_shader
				);
			}
			var f = factor == null ? this.properties.factor : factor;
			uniforms.u_mix.set([f, f, f, f]);
		}

		var invert = this.properties.invert;

		this._tex.drawTo(function() {
			texA.bind( invert ? 1 : 0 );
			texB.bind( invert ? 0 : 1 );
			if (texMix) {
				texMix.bind(2);
			}
			shader.uniforms(uniforms).draw(mesh);
		});

		this.setOutputData(0, this._tex);
	};

	LGraphTextureMix.prototype.onGetInputs = function() {
		return [["factor", "number"]];
	};

	LGraphTextureMix.pixel_shader =
		"precision highp float;\n\
		precision highp float;\n\
		varying vec2 v_coord;\n\
		uniform sampler2D u_textureA;\n\
		uniform sampler2D u_textureB;\n\
		#ifdef MIX_TEX\n\
			uniform sampler2D u_textureMix;\n\
		#else\n\
			uniform vec4 u_mix;\n\
		#endif\n\
		\n\
		void main() {\n\
			#ifdef MIX_TEX\n\
			   vec4 f = texture2D(u_textureMix, v_coord);\n\
			#else\n\
			   vec4 f = u_mix;\n\
			#endif\n\
		   gl_FragColor = mix( texture2D(u_textureA, v_coord), texture2D(u_textureB, v_coord), f );\n\
		}\n\
		";

	LiteGraph.registerNodeType("texture/mix", LGraphTextureMix);

	// Texture Edges detection *****************************************
	function LGraphTextureEdges() {
		this.addInput("Tex.", "Texture");

		this.addOutput("Edges", "Texture");
		this.properties = {
			invert: true,
			threshold: false,
			factor: 1,
			precision: LGraphTexture.DEFAULT
		};

		if (!LGraphTextureEdges._shader) {
			LGraphTextureEdges._shader = new GL.Shader(
				Shader.SCREEN_VERTEX_SHADER,
				LGraphTextureEdges.pixel_shader
			);
		}
	}

	LGraphTextureEdges.title = "Edges";
	LGraphTextureEdges.desc = "Detects edges";

	LGraphTextureEdges.widgets_info = {
		precision: { widget: "combo", values: LGraphTexture.MODE_VALUES }
	};

	LGraphTextureEdges.prototype.onExecute = function() {
		if (!this.isOutputConnected(0)) {
			return;
		} //saves work

		var tex = this.getInputData(0);

		if (this.properties.precision === LGraphTexture.PASS_THROUGH) {
			this.setOutputData(0, tex);
			return;
		}

		if (!tex) {
			return;
		}

		this._tex = LGraphTexture.getTargetTexture(
			tex,
			this._tex,
			this.properties.precision
		);

		gl.disable(gl.BLEND);
		gl.disable(gl.DEPTH_TEST);

		var mesh = Mesh.getScreenQuad();
		var shader = LGraphTextureEdges._shader;
		var invert = this.properties.invert;
		var factor = this.properties.factor;
		var threshold = this.properties.threshold ? 1 : 0;

		this._tex.drawTo(function() {
			tex.bind(0);
			shader
				.uniforms({
					u_texture: 0,
					u_isize: [1 / tex.width, 1 / tex.height],
					u_factor: factor,
					u_threshold: threshold,
					u_invert: invert ? 1 : 0
				})
				.draw(mesh);
		});

		this.setOutputData(0, this._tex);
	};

	LGraphTextureEdges.pixel_shader =
		"precision highp float;\n\
		precision highp float;\n\
		varying vec2 v_coord;\n\
		uniform sampler2D u_texture;\n\
		uniform vec2 u_isize;\n\
		uniform int u_invert;\n\
		uniform float u_factor;\n\
		uniform float u_threshold;\n\
		\n\
		void main() {\n\
			vec4 center = texture2D(u_texture, v_coord);\n\
			vec4 up = texture2D(u_texture, v_coord + u_isize * vec2(0.0,1.0) );\n\
			vec4 down = texture2D(u_texture, v_coord + u_isize * vec2(0.0,-1.0) );\n\
			vec4 left = texture2D(u_texture, v_coord + u_isize * vec2(1.0,0.0) );\n\
			vec4 right = texture2D(u_texture, v_coord + u_isize * vec2(-1.0,0.0) );\n\
			vec4 diff = abs(center - up) + abs(center - down) + abs(center - left) + abs(center - right);\n\
			diff *= u_factor;\n\
			if(u_invert == 1)\n\
				diff.xyz = vec3(1.0) - diff.xyz;\n\
			if( u_threshold == 0.0 )\n\
				gl_FragColor = vec4( diff.xyz, center.a );\n\
			else\n\
				gl_FragColor = vec4( diff.x > 0.5 ? 1.0 : 0.0, diff.y > 0.5 ? 1.0 : 0.0, diff.z > 0.5 ? 1.0 : 0.0, center.a );\n\
		}\n\
		";

	LiteGraph.registerNodeType("texture/edges", LGraphTextureEdges);

	// Texture Depth *****************************************
	function LGraphTextureDepthRange() {
		this.addInput("Texture", "Texture");
		this.addInput("Distance", "number");
		this.addInput("Range", "number");
		this.addOutput("Texture", "Texture");
		this.properties = {
			distance: 100,
			range: 50,
			only_depth: false,
			high_precision: false
		};
		this._uniforms = {
			u_texture: 0,
			u_distance: 100,
			u_range: 50,
			u_camera_planes: null
		};
	}

	LGraphTextureDepthRange.title = "Depth Range";
	LGraphTextureDepthRange.desc = "Generates a texture with a depth range";

	LGraphTextureDepthRange.prototype.onExecute = function() {
		if (!this.isOutputConnected(0)) {
			return;
		} //saves work

		var tex = this.getInputData(0);
		if (!tex) {
			return;
		}

		var precision = gl.UNSIGNED_BYTE;
		if (this.properties.high_precision) {
			precision = gl.half_float_ext ? gl.HALF_FLOAT_OES : gl.FLOAT;
		}

		if (
			!this._temp_texture ||
			this._temp_texture.type != precision ||
			this._temp_texture.width != tex.width ||
			this._temp_texture.height != tex.height
		) {
			this._temp_texture = new GL.Texture(tex.width, tex.height, {
				type: precision,
				format: gl.RGBA,
				filter: gl.LINEAR
			});
		}

		var uniforms = this._uniforms;

		//iterations
		var distance = this.properties.distance;
		if (this.isInputConnected(1)) {
			distance = this.getInputData(1);
			this.properties.distance = distance;
		}

		var range = this.properties.range;
		if (this.isInputConnected(2)) {
			range = this.getInputData(2);
			this.properties.range = range;
		}

		uniforms.u_distance = distance;
		uniforms.u_range = range;

		gl.disable(gl.BLEND);
		gl.disable(gl.DEPTH_TEST);
		var mesh = Mesh.getScreenQuad();
		if (!LGraphTextureDepthRange._shader) {
			LGraphTextureDepthRange._shader = new GL.Shader(
				Shader.SCREEN_VERTEX_SHADER,
				LGraphTextureDepthRange.pixel_shader
			);
			LGraphTextureDepthRange._shader_onlydepth = new GL.Shader(
				Shader.SCREEN_VERTEX_SHADER,
				LGraphTextureDepthRange.pixel_shader,
				{ ONLY_DEPTH: "" }
			);
		}
		var shader = this.properties.only_depth
			? LGraphTextureDepthRange._shader_onlydepth
			: LGraphTextureDepthRange._shader;

		//NEAR AND FAR PLANES
		var planes = null;
		if (tex.near_far_planes) {
			planes = tex.near_far_planes;
		} else if (window.LS && LS.Renderer._main_camera) {
			planes = LS.Renderer._main_camera._uniforms.u_camera_planes;
		} else {
			planes = [0.1, 1000];
		} //hardcoded
		uniforms.u_camera_planes = planes;

		this._temp_texture.drawTo(function() {
			tex.bind(0);
			shader.uniforms(uniforms).draw(mesh);
		});

		this._temp_texture.near_far_planes = planes;
		this.setOutputData(0, this._temp_texture);
	};

	LGraphTextureDepthRange.pixel_shader =
		"precision highp float;\n\
		precision highp float;\n\
		varying vec2 v_coord;\n\
		uniform sampler2D u_texture;\n\
		uniform vec2 u_camera_planes;\n\
		uniform float u_distance;\n\
		uniform float u_range;\n\
		\n\
		float LinearDepth()\n\
		{\n\
			float zNear = u_camera_planes.x;\n\
			float zFar = u_camera_planes.y;\n\
			float depth = texture2D(u_texture, v_coord).x;\n\
			depth = depth * 2.0 - 1.0;\n\
			return zNear * (depth + 1.0) / (zFar + zNear - depth * (zFar - zNear));\n\
		}\n\
		\n\
		void main() {\n\
			float depth = LinearDepth();\n\
			#ifdef ONLY_DEPTH\n\
			   gl_FragColor = vec4(depth);\n\
			#else\n\
				float diff = abs(depth * u_camera_planes.y - u_distance);\n\
				float dof = 1.0;\n\
				if(diff <= u_range)\n\
					dof = diff / u_range;\n\
			   gl_FragColor = vec4(dof);\n\
			#endif\n\
		}\n\
		";

	LiteGraph.registerNodeType( "texture/depth_range", LGraphTextureDepthRange );


	// Texture Depth *****************************************
	function LGraphTextureLinearDepth() {
		this.addInput("Texture", "Texture");
		this.addOutput("Texture", "Texture");
		this.properties = {
			precision: LGraphTexture.DEFAULT,
			invert: false
		};
		this._uniforms = {
			u_texture: 0,
			u_camera_planes: null, //filled later
			u_ires: vec2.create()
		};
	}

	LGraphTextureLinearDepth.widgets_info = {
		precision: { widget: "combo", values: LGraphTexture.MODE_VALUES }
	};

	LGraphTextureLinearDepth.title = "Linear Depth";
	LGraphTextureLinearDepth.desc = "Creates a color texture with linear depth";

	LGraphTextureLinearDepth.prototype.onExecute = function() {
		if (!this.isOutputConnected(0)) {
			return;
		} //saves work

		var tex = this.getInputData(0);
		if (!tex || (tex.format != gl.DEPTH_COMPONENT && tex.format != gl.DEPTH_STENCIL) ) {
			return;
		}

		var precision = this.properties.precision == LGraphTexture.HIGH ? gl.HIGH_PRECISION_FORMAT : gl.UNSIGNED_BYTE;

		if ( !this._temp_texture || this._temp_texture.type != precision || this._temp_texture.width != tex.width || this._temp_texture.height != tex.height ) {
			this._temp_texture = new GL.Texture(tex.width, tex.height, {
				type: precision,
				format: gl.RGB,
				filter: gl.LINEAR
			});
		}

		var uniforms = this._uniforms;
		uniforms.u_invert = this.properties.invert ? 1 : 0;

		gl.disable(gl.BLEND);
		gl.disable(gl.DEPTH_TEST);
		var mesh = Mesh.getScreenQuad();
		if(!LGraphTextureLinearDepth._shader)
			LGraphTextureLinearDepth._shader = new GL.Shader( GL.Shader.SCREEN_VERTEX_SHADER, LGraphTextureLinearDepth.pixel_shader);
		var shader = LGraphTextureLinearDepth._shader;

		//NEAR AND FAR PLANES
		var planes = null;
		if (tex.near_far_planes) {
			planes = tex.near_far_planes;
		} else if (window.LS && LS.Renderer._main_camera) {
			planes = LS.Renderer._main_camera._uniforms.u_camera_planes;
		} else {
			planes = [0.1, 1000];
		} //hardcoded
		uniforms.u_camera_planes = planes;
		//uniforms.u_ires.set([1/tex.width, 1/tex.height]);
		uniforms.u_ires.set([0,0]);

		this._temp_texture.drawTo(function() {
			tex.bind(0);
			shader.uniforms(uniforms).draw(mesh);
		});

		this._temp_texture.near_far_planes = planes;
		this.setOutputData(0, this._temp_texture);
	};

	LGraphTextureLinearDepth.pixel_shader =
		"precision highp float;\n\
		precision highp float;\n\
		varying vec2 v_coord;\n\
		uniform sampler2D u_texture;\n\
		uniform vec2 u_camera_planes;\n\
		uniform int u_invert;\n\
		uniform vec2 u_ires;\n\
		\n\
		void main() {\n\
			float zNear = u_camera_planes.x;\n\
			float zFar = u_camera_planes.y;\n\
			float depth = texture2D(u_texture, v_coord + u_ires*0.5).x * 2.0 - 1.0;\n\
			float f = zNear * (depth + 1.0) / (zFar + zNear - depth * (zFar - zNear));\n\
			if( u_invert == 1 )\n\
				f = 1.0 - f;\n\
			gl_FragColor = vec4(vec3(f),1.0);\n\
		}\n\
		";

	LiteGraph.registerNodeType( "texture/linear_depth", LGraphTextureLinearDepth );

	// Texture Blur *****************************************
	function LGraphTextureBlur() {
		this.addInput("Texture", "Texture");
		this.addInput("Iterations", "number");
		this.addInput("Intensity", "number");
		this.addOutput("Blurred", "Texture");
		this.properties = {
			intensity: 1,
			iterations: 1,
			preserve_aspect: false,
			scale: [1, 1],
			precision: LGraphTexture.DEFAULT
		};
	}

	LGraphTextureBlur.title = "Blur";
	LGraphTextureBlur.desc = "Blur a texture";

	LGraphTextureBlur.widgets_info = {
		precision: { widget: "combo", values: LGraphTexture.MODE_VALUES }
	};

	LGraphTextureBlur.max_iterations = 20;

	LGraphTextureBlur.prototype.onExecute = function() {
		var tex = this.getInputData(0);
		if (!tex) {
			return;
		}

		if (!this.isOutputConnected(0)) {
			return;
		} //saves work

		var temp = this._final_texture;

		if (
			!temp ||
			temp.width != tex.width ||
			temp.height != tex.height ||
			temp.type != tex.type
		) {
			//we need two textures to do the blurring
			//this._temp_texture = new GL.Texture( tex.width, tex.height, { type: tex.type, format: gl.RGBA, filter: gl.LINEAR });
			temp = this._final_texture = new GL.Texture(
				tex.width,
				tex.height,
				{ type: tex.type, format: gl.RGBA, filter: gl.LINEAR }
			);
		}

		//iterations
		var iterations = this.properties.iterations;
		if (this.isInputConnected(1)) {
			iterations = this.getInputData(1);
			this.properties.iterations = iterations;
		}
		iterations = Math.min(
			Math.floor(iterations),
			LGraphTextureBlur.max_iterations
		);
		if (iterations == 0) {
			//skip blurring
			this.setOutputData(0, tex);
			return;
		}

		var intensity = this.properties.intensity;
		if (this.isInputConnected(2)) {
			intensity = this.getInputData(2);
			this.properties.intensity = intensity;
		}

		//blur sometimes needs an aspect correction
		var aspect = LiteGraph.camera_aspect;
		if (!aspect && window.gl !== undefined) {
			aspect = gl.canvas.height / gl.canvas.width;
		}
		if (!aspect) {
			aspect = 1;
		}
		aspect = this.properties.preserve_aspect ? aspect : 1;

		var scale = this.properties.scale || [1, 1];
		tex.applyBlur(aspect * scale[0], scale[1], intensity, temp);
		for (var i = 1; i < iterations; ++i) {
			temp.applyBlur(
				aspect * scale[0] * (i + 1),
				scale[1] * (i + 1),
				intensity
			);
		}

		this.setOutputData(0, temp);
	};

	/*
LGraphTextureBlur.pixel_shader = "precision highp float;\n\
		precision highp float;\n\
		varying vec2 v_coord;\n\
		uniform sampler2D u_texture;\n\
		uniform vec2 u_offset;\n\
		uniform float u_intensity;\n\
		void main() {\n\
		   vec4 sum = vec4(0.0);\n\
		   vec4 center = texture2D(u_texture, v_coord);\n\
		   sum += texture2D(u_texture, v_coord + u_offset * -4.0) * 0.05/0.98;\n\
		   sum += texture2D(u_texture, v_coord + u_offset * -3.0) * 0.09/0.98;\n\
		   sum += texture2D(u_texture, v_coord + u_offset * -2.0) * 0.12/0.98;\n\
		   sum += texture2D(u_texture, v_coord + u_offset * -1.0) * 0.15/0.98;\n\
		   sum += center * 0.16/0.98;\n\
		   sum += texture2D(u_texture, v_coord + u_offset * 4.0) * 0.05/0.98;\n\
		   sum += texture2D(u_texture, v_coord + u_offset * 3.0) * 0.09/0.98;\n\
		   sum += texture2D(u_texture, v_coord + u_offset * 2.0) * 0.12/0.98;\n\
		   sum += texture2D(u_texture, v_coord + u_offset * 1.0) * 0.15/0.98;\n\
		   gl_FragColor = u_intensity * sum;\n\
		}\n\
		";
*/

	LiteGraph.registerNodeType("texture/blur", LGraphTextureBlur);

	// Texture Glow *****************************************
	//based in https://catlikecoding.com/unity/tutorials/advanced-rendering/bloom/
	function LGraphTextureGlow() {
		this.addInput("in", "Texture");
		this.addInput("dirt", "Texture");
		this.addOutput("out", "Texture");
		this.addOutput("glow", "Texture");
		this.properties = {
			enabled: true,
			intensity: 1,
			persistence: 0.99,
			iterations: 16,
			threshold: 0,
			scale: 1,
			dirt_factor: 0.5,
			precision: LGraphTexture.DEFAULT
		};
		this._textures = [];
		this._uniforms = {
			u_intensity: 1,
			u_texture: 0,
			u_glow_texture: 1,
			u_threshold: 0,
			u_texel_size: vec2.create()
		};
	}

	LGraphTextureGlow.title = "Glow";
	LGraphTextureGlow.desc = "Filters a texture giving it a glow effect";
	LGraphTextureGlow.weights = new Float32Array([0.5, 0.4, 0.3, 0.2]);

	LGraphTextureGlow.widgets_info = {
		iterations: {
			type: "number",
			min: 0,
			max: 16,
			step: 1,
			precision: 0
		},
		threshold: {
			type: "number",
			min: 0,
			max: 10,
			step: 0.01,
			precision: 2
		},
		precision: { widget: "combo", values: LGraphTexture.MODE_VALUES }
	};

	LGraphTextureGlow.prototype.onGetInputs = function() {
		return [
			["enabled", "boolean"],
			["threshold", "number"],
			["intensity", "number"],
			["persistence", "number"],
			["iterations", "number"],
			["dirt_factor", "number"]
		];
	};

	LGraphTextureGlow.prototype.onGetOutputs = function() {
		return [["average", "Texture"]];
	};

	LGraphTextureGlow.prototype.onExecute = function() {
		var tex = this.getInputData(0);
		if (!tex) {
			return;
		}

		if (!this.isAnyOutputConnected()) {
			return;
		} //saves work

		if (
			this.properties.precision === LGraphTexture.PASS_THROUGH ||
			this.getInputOrProperty("enabled") === false
		) {
			this.setOutputData(0, tex);
			return;
		}

		var width = tex.width;
		var height = tex.height;

		var texture_info = {
			format: tex.format,
			type: tex.type,
			minFilter: GL.LINEAR,
			magFilter: GL.LINEAR,
			wrap: gl.CLAMP_TO_EDGE
		};
		var type = LGraphTexture.getTextureType(
			this.properties.precision,
			tex
		);

		var uniforms = this._uniforms;
		var textures = this._textures;

		//cut
		var shader = LGraphTextureGlow._cut_shader;
		if (!shader) {
			shader = LGraphTextureGlow._cut_shader = new GL.Shader(
				GL.Shader.SCREEN_VERTEX_SHADER,
				LGraphTextureGlow.cut_pixel_shader
			);
		}

		gl.disable(gl.DEPTH_TEST);
		gl.disable(gl.BLEND);

		uniforms.u_threshold = this.getInputOrProperty("threshold");
		var currentDestination = (textures[0] = GL.Texture.getTemporary(
			width,
			height,
			texture_info
		));
		tex.blit(currentDestination, shader.uniforms(uniforms));
		var currentSource = currentDestination;

		var iterations = this.getInputOrProperty("iterations");
		iterations = Math.clamp(iterations, 1, 16) | 0;
		var texel_size = uniforms.u_texel_size;
		var intensity = this.getInputOrProperty("intensity");

		uniforms.u_intensity = 1;
		uniforms.u_delta = this.properties.scale; //1

		//downscale/upscale shader
		var shader = LGraphTextureGlow._shader;
		if (!shader) {
			shader = LGraphTextureGlow._shader = new GL.Shader(
				GL.Shader.SCREEN_VERTEX_SHADER,
				LGraphTextureGlow.scale_pixel_shader
			);
		}

		var i = 1;
		//downscale
		for (; i < iterations; i++) {
			width = width >> 1;
			if ((height | 0) > 1) {
				height = height >> 1;
			}
			if (width < 2) {
				break;
			}
			currentDestination = textures[i] = GL.Texture.getTemporary(
				width,
				height,
				texture_info
			);
			texel_size[0] = 1 / currentSource.width;
			texel_size[1] = 1 / currentSource.height;
			currentSource.blit(
				currentDestination,
				shader.uniforms(uniforms)
			);
			currentSource = currentDestination;
		}

		//average
		if (this.isOutputConnected(2)) {
			var average_texture = this._average_texture;
			if (
				!average_texture ||
				average_texture.type != tex.type ||
				average_texture.format != tex.format
			) {
				average_texture = this._average_texture = new GL.Texture(
					1,
					1,
					{
						type: tex.type,
						format: tex.format,
						filter: gl.LINEAR
					}
				);
			}
			texel_size[0] = 1 / currentSource.width;
			texel_size[1] = 1 / currentSource.height;
			uniforms.u_intensity = intensity;
			uniforms.u_delta = 1;
			currentSource.blit(average_texture, shader.uniforms(uniforms));
			this.setOutputData(2, average_texture);
		}

		//upscale and blend
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE, gl.ONE);
		uniforms.u_intensity = this.getInputOrProperty("persistence");
		uniforms.u_delta = 0.5;

		for (
			i -= 2;
			i >= 0;
			i-- // i-=2 =>  -1 to point to last element in array, -1 to go to texture above
		) {
			currentDestination = textures[i];
			textures[i] = null;
			texel_size[0] = 1 / currentSource.width;
			texel_size[1] = 1 / currentSource.height;
			currentSource.blit(
				currentDestination,
				shader.uniforms(uniforms)
			);
			GL.Texture.releaseTemporary(currentSource);
			currentSource = currentDestination;
		}
		gl.disable(gl.BLEND);

		//glow
		if (this.isOutputConnected(1)) {
			var glow_texture = this._glow_texture;
			if (
				!glow_texture ||
				glow_texture.width != tex.width ||
				glow_texture.height != tex.height ||
				glow_texture.type != type ||
				glow_texture.format != tex.format
			) {
				glow_texture = this._glow_texture = new GL.Texture(
					tex.width,
					tex.height,
					{ type: type, format: tex.format, filter: gl.LINEAR }
				);
			}
			currentSource.blit(glow_texture);
			this.setOutputData(1, glow_texture);
		}

		//final composition
		if (this.isOutputConnected(0)) {
			var final_texture = this._final_texture;
			if (
				!final_texture ||
				final_texture.width != tex.width ||
				final_texture.height != tex.height ||
				final_texture.type != type ||
				final_texture.format != tex.format
			) {
				final_texture = this._final_texture = new GL.Texture(
					tex.width,
					tex.height,
					{ type: type, format: tex.format, filter: gl.LINEAR }
				);
			}

			var dirt_texture = this.getInputData(1);
			var dirt_factor = this.getInputOrProperty("dirt_factor");

			uniforms.u_intensity = intensity;

			shader = dirt_texture
				? LGraphTextureGlow._dirt_final_shader
				: LGraphTextureGlow._final_shader;
			if (!shader) {
				if (dirt_texture) {
					shader = LGraphTextureGlow._dirt_final_shader = new GL.Shader(
						GL.Shader.SCREEN_VERTEX_SHADER,
						LGraphTextureGlow.final_pixel_shader,
						{ USE_DIRT: "" }
					);
				} else {
					shader = LGraphTextureGlow._final_shader = new GL.Shader(
						GL.Shader.SCREEN_VERTEX_SHADER,
						LGraphTextureGlow.final_pixel_shader
					);
				}
			}

			final_texture.drawTo(function() {
				tex.bind(0);
				currentSource.bind(1);
				if (dirt_texture) {
					shader.setUniform("u_dirt_factor", dirt_factor);
					shader.setUniform(
						"u_dirt_texture",
						dirt_texture.bind(2)
					);
				}
				shader.toViewport(uniforms);
			});
			this.setOutputData(0, final_texture);
		}

		GL.Texture.releaseTemporary(currentSource);
	};

	LGraphTextureGlow.cut_pixel_shader =
		"precision highp float;\n\
	varying vec2 v_coord;\n\
	uniform sampler2D u_texture;\n\
	uniform float u_threshold;\n\
	void main() {\n\
		gl_FragColor = max( texture2D( u_texture, v_coord ) - vec4( u_threshold ), vec4(0.0) );\n\
	}";

	LGraphTextureGlow.scale_pixel_shader =
		"precision highp float;\n\
	varying vec2 v_coord;\n\
	uniform sampler2D u_texture;\n\
	uniform vec2 u_texel_size;\n\
	uniform float u_delta;\n\
	uniform float u_intensity;\n\
	\n\
	vec4 sampleBox(vec2 uv) {\n\
		vec4 o = u_texel_size.xyxy * vec2(-u_delta, u_delta).xxyy;\n\
		vec4 s = texture2D( u_texture, uv + o.xy ) + texture2D( u_texture, uv + o.zy) + texture2D( u_texture, uv + o.xw) + texture2D( u_texture, uv + o.zw);\n\
		return s * 0.25;\n\
	}\n\
	void main() {\n\
		gl_FragColor = u_intensity * sampleBox( v_coord );\n\
	}";

	LGraphTextureGlow.final_pixel_shader =
		"precision highp float;\n\
	varying vec2 v_coord;\n\
	uniform sampler2D u_texture;\n\
	uniform sampler2D u_glow_texture;\n\
	#ifdef USE_DIRT\n\
		uniform sampler2D u_dirt_texture;\n\
	#endif\n\
	uniform vec2 u_texel_size;\n\
	uniform float u_delta;\n\
	uniform float u_intensity;\n\
	uniform float u_dirt_factor;\n\
	\n\
	vec4 sampleBox(vec2 uv) {\n\
		vec4 o = u_texel_size.xyxy * vec2(-u_delta, u_delta).xxyy;\n\
		vec4 s = texture2D( u_glow_texture, uv + o.xy ) + texture2D( u_glow_texture, uv + o.zy) + texture2D( u_glow_texture, uv + o.xw) + texture2D( u_glow_texture, uv + o.zw);\n\
		return s * 0.25;\n\
	}\n\
	void main() {\n\
		vec4 glow = sampleBox( v_coord );\n\
		#ifdef USE_DIRT\n\
			glow = mix( glow, glow * texture2D( u_dirt_texture, v_coord ), u_dirt_factor );\n\
		#endif\n\
		gl_FragColor = texture2D( u_texture, v_coord ) + u_intensity * glow;\n\
	}";

	LiteGraph.registerNodeType("texture/glow", LGraphTextureGlow);

	// Texture Filter *****************************************
	function LGraphTextureKuwaharaFilter() {
		this.addInput("Texture", "Texture");
		this.addOutput("Filtered", "Texture");
		this.properties = { intensity: 1, radius: 5 };
	}

	LGraphTextureKuwaharaFilter.title = "Kuwahara Filter";
	LGraphTextureKuwaharaFilter.desc =
		"Filters a texture giving an artistic oil canvas painting";

	LGraphTextureKuwaharaFilter.max_radius = 10;
	LGraphTextureKuwaharaFilter._shaders = [];

	LGraphTextureKuwaharaFilter.prototype.onExecute = function() {
		var tex = this.getInputData(0);
		if (!tex) {
			return;
		}

		if (!this.isOutputConnected(0)) {
			return;
		} //saves work

		var temp = this._temp_texture;

		if (
			!temp ||
			temp.width != tex.width ||
			temp.height != tex.height ||
			temp.type != tex.type
		) {
			this._temp_texture = new GL.Texture(tex.width, tex.height, {
				type: tex.type,
				format: gl.RGBA,
				filter: gl.LINEAR
			});
		}

		//iterations
		var radius = this.properties.radius;
		radius = Math.min(
			Math.floor(radius),
			LGraphTextureKuwaharaFilter.max_radius
		);
		if (radius == 0) {
			//skip blurring
			this.setOutputData(0, tex);
			return;
		}

		var intensity = this.properties.intensity;

		//blur sometimes needs an aspect correction
		var aspect = LiteGraph.camera_aspect;
		if (!aspect && window.gl !== undefined) {
			aspect = gl.canvas.height / gl.canvas.width;
		}
		if (!aspect) {
			aspect = 1;
		}
		aspect = this.properties.preserve_aspect ? aspect : 1;

		if (!LGraphTextureKuwaharaFilter._shaders[radius]) {
			LGraphTextureKuwaharaFilter._shaders[radius] = new GL.Shader(
				Shader.SCREEN_VERTEX_SHADER,
				LGraphTextureKuwaharaFilter.pixel_shader,
				{ RADIUS: radius.toFixed(0) }
			);
		}

		var shader = LGraphTextureKuwaharaFilter._shaders[radius];
		var mesh = GL.Mesh.getScreenQuad();
		tex.bind(0);

		this._temp_texture.drawTo(function() {
			shader
				.uniforms({
					u_texture: 0,
					u_intensity: intensity,
					u_resolution: [tex.width, tex.height],
					u_iResolution: [1 / tex.width, 1 / tex.height]
				})
				.draw(mesh);
		});

		this.setOutputData(0, this._temp_texture);
	};

	//from https://www.shadertoy.com/view/MsXSz4
	LGraphTextureKuwaharaFilter.pixel_shader =
		"\n\
precision highp float;\n\
varying vec2 v_coord;\n\
uniform sampler2D u_texture;\n\
uniform float u_intensity;\n\
uniform vec2 u_resolution;\n\
uniform vec2 u_iResolution;\n\
#ifndef RADIUS\n\
	#define RADIUS 7\n\
#endif\n\
void main() {\n\
\n\
	const int radius = RADIUS;\n\
	vec2 fragCoord = v_coord;\n\
	vec2 src_size = u_iResolution;\n\
	vec2 uv = v_coord;\n\
	float n = float((radius + 1) * (radius + 1));\n\
	int i;\n\
	int j;\n\
	vec3 m0 = vec3(0.0); vec3 m1 = vec3(0.0); vec3 m2 = vec3(0.0); vec3 m3 = vec3(0.0);\n\
	vec3 s0 = vec3(0.0); vec3 s1 = vec3(0.0); vec3 s2 = vec3(0.0); vec3 s3 = vec3(0.0);\n\
	vec3 c;\n\
	\n\
	for (int j = -radius; j <= 0; ++j)  {\n\
		for (int i = -radius; i <= 0; ++i)  {\n\
			c = texture2D(u_texture, uv + vec2(i,j) * src_size).rgb;\n\
			m0 += c;\n\
			s0 += c * c;\n\
		}\n\
	}\n\
	\n\
	for (int j = -radius; j <= 0; ++j)  {\n\
		for (int i = 0; i <= radius; ++i)  {\n\
			c = texture2D(u_texture, uv + vec2(i,j) * src_size).rgb;\n\
			m1 += c;\n\
			s1 += c * c;\n\
		}\n\
	}\n\
	\n\
	for (int j = 0; j <= radius; ++j)  {\n\
		for (int i = 0; i <= radius; ++i)  {\n\
			c = texture2D(u_texture, uv + vec2(i,j) * src_size).rgb;\n\
			m2 += c;\n\
			s2 += c * c;\n\
		}\n\
	}\n\
	\n\
	for (int j = 0; j <= radius; ++j)  {\n\
		for (int i = -radius; i <= 0; ++i)  {\n\
			c = texture2D(u_texture, uv + vec2(i,j) * src_size).rgb;\n\
			m3 += c;\n\
			s3 += c * c;\n\
		}\n\
	}\n\
	\n\
	float min_sigma2 = 1e+2;\n\
	m0 /= n;\n\
	s0 = abs(s0 / n - m0 * m0);\n\
	\n\
	float sigma2 = s0.r + s0.g + s0.b;\n\
	if (sigma2 < min_sigma2) {\n\
		min_sigma2 = sigma2;\n\
		gl_FragColor = vec4(m0, 1.0);\n\
	}\n\
	\n\
	m1 /= n;\n\
	s1 = abs(s1 / n - m1 * m1);\n\
	\n\
	sigma2 = s1.r + s1.g + s1.b;\n\
	if (sigma2 < min_sigma2) {\n\
		min_sigma2 = sigma2;\n\
		gl_FragColor = vec4(m1, 1.0);\n\
	}\n\
	\n\
	m2 /= n;\n\
	s2 = abs(s2 / n - m2 * m2);\n\
	\n\
	sigma2 = s2.r + s2.g + s2.b;\n\
	if (sigma2 < min_sigma2) {\n\
		min_sigma2 = sigma2;\n\
		gl_FragColor = vec4(m2, 1.0);\n\
	}\n\
	\n\
	m3 /= n;\n\
	s3 = abs(s3 / n - m3 * m3);\n\
	\n\
	sigma2 = s3.r + s3.g + s3.b;\n\
	if (sigma2 < min_sigma2) {\n\
		min_sigma2 = sigma2;\n\
		gl_FragColor = vec4(m3, 1.0);\n\
	}\n\
}\n\
";

	LiteGraph.registerNodeType(
		"texture/kuwahara",
		LGraphTextureKuwaharaFilter
	);

	// Texture  *****************************************
	function LGraphTextureXDoGFilter() {
		this.addInput("Texture", "Texture");
		this.addOutput("Filtered", "Texture");
		this.properties = {
			sigma: 1.4,
			k: 1.6,
			p: 21.7,
			epsilon: 79,
			phi: 0.017
		};
	}

	LGraphTextureXDoGFilter.title = "XDoG Filter";
	LGraphTextureXDoGFilter.desc =
		"Filters a texture giving an artistic ink style";

	LGraphTextureXDoGFilter.max_radius = 10;
	LGraphTextureXDoGFilter._shaders = [];

	LGraphTextureXDoGFilter.prototype.onExecute = function() {
		var tex = this.getInputData(0);
		if (!tex) {
			return;
		}

		if (!this.isOutputConnected(0)) {
			return;
		} //saves work

		var temp = this._temp_texture;
		if (
			!temp ||
			temp.width != tex.width ||
			temp.height != tex.height ||
			temp.type != tex.type
		) {
			this._temp_texture = new GL.Texture(tex.width, tex.height, {
				type: tex.type,
				format: gl.RGBA,
				filter: gl.LINEAR
			});
		}

		if (!LGraphTextureXDoGFilter._xdog_shader) {
			LGraphTextureXDoGFilter._xdog_shader = new GL.Shader(
				Shader.SCREEN_VERTEX_SHADER,
				LGraphTextureXDoGFilter.xdog_pixel_shader
			);
		}
		var shader = LGraphTextureXDoGFilter._xdog_shader;
		var mesh = GL.Mesh.getScreenQuad();

		var sigma = this.properties.sigma;
		var k = this.properties.k;
		var p = this.properties.p;
		var epsilon = this.properties.epsilon;
		var phi = this.properties.phi;
		tex.bind(0);
		this._temp_texture.drawTo(function() {
			shader
				.uniforms({
					src: 0,
					sigma: sigma,
					k: k,
					p: p,
					epsilon: epsilon,
					phi: phi,
					cvsWidth: tex.width,
					cvsHeight: tex.height
				})
				.draw(mesh);
		});

		this.setOutputData(0, this._temp_texture);
	};

	//from https://github.com/RaymondMcGuire/GPU-Based-Image-Processing-Tools/blob/master/lib_webgl/scripts/main.js
	LGraphTextureXDoGFilter.xdog_pixel_shader =
		"\n\
precision highp float;\n\
uniform sampler2D src;\n\n\
uniform float cvsHeight;\n\
uniform float cvsWidth;\n\n\
uniform float sigma;\n\
uniform float k;\n\
uniform float p;\n\
uniform float epsilon;\n\
uniform float phi;\n\
varying vec2 v_coord;\n\n\
float cosh(float val)\n\
{\n\
	float tmp = exp(val);\n\
	float cosH = (tmp + 1.0 / tmp) / 2.0;\n\
	return cosH;\n\
}\n\n\
float tanh(float val)\n\
{\n\
	float tmp = exp(val);\n\
	float tanH = (tmp - 1.0 / tmp) / (tmp + 1.0 / tmp);\n\
	return tanH;\n\
}\n\n\
float sinh(float val)\n\
{\n\
	float tmp = exp(val);\n\
	float sinH = (tmp - 1.0 / tmp) / 2.0;\n\
	return sinH;\n\
}\n\n\
void main(void){\n\
	vec3 destColor = vec3(0.0);\n\
	float tFrag = 1.0 / cvsHeight;\n\
	float sFrag = 1.0 / cvsWidth;\n\
	vec2 Frag = vec2(sFrag,tFrag);\n\
	vec2 uv = gl_FragCoord.st;\n\
	float twoSigmaESquared = 2.0 * sigma * sigma;\n\
	float twoSigmaRSquared = twoSigmaESquared * k * k;\n\
	int halfWidth = int(ceil( 1.0 * sigma * k ));\n\n\
	const int MAX_NUM_ITERATION = 99999;\n\
	vec2 sum = vec2(0.0);\n\
	vec2 norm = vec2(0.0);\n\n\
	for(int cnt=0;cnt<MAX_NUM_ITERATION;cnt++){\n\
		if(cnt > (2*halfWidth+1)*(2*halfWidth+1)){break;}\n\
		int i = int(cnt / (2*halfWidth+1)) - halfWidth;\n\
		int j = cnt - halfWidth - int(cnt / (2*halfWidth+1)) * (2*halfWidth+1);\n\n\
		float d = length(vec2(i,j));\n\
		vec2 kernel = vec2( exp( -d * d / twoSigmaESquared ), \n\
							exp( -d * d / twoSigmaRSquared ));\n\n\
		vec2 L = texture2D(src, (uv + vec2(i,j)) * Frag).xx;\n\n\
		norm += kernel;\n\
		sum += kernel * L;\n\
	}\n\n\
	sum /= norm;\n\n\
	float H = 100.0 * ((1.0 + p) * sum.x - p * sum.y);\n\
	float edge = ( H > epsilon )? 1.0 : 1.0 + tanh( phi * (H - epsilon));\n\
	destColor = vec3(edge);\n\
	gl_FragColor = vec4(destColor, 1.0);\n\
}";

	LiteGraph.registerNodeType("texture/xDoG", LGraphTextureXDoGFilter);

	// Texture Webcam *****************************************
	function LGraphTextureWebcam() {
		this.addOutput("Webcam", "Texture");
		this.properties = { texture_name: "", facingMode: "user" };
		this.boxcolor = "black";
		this.version = 0;
	}

	LGraphTextureWebcam.title = "Webcam";
	LGraphTextureWebcam.desc = "Webcam texture";

	LGraphTextureWebcam.is_webcam_open = false;

	LGraphTextureWebcam.prototype.openStream = function() {
		if (!navigator.getUserMedia) {
			//console.log('getUserMedia() is not supported in your browser, use chrome and enable WebRTC from about://flags');
			return;
		}

		this._waiting_confirmation = true;

		// Not showing vendor prefixes.
		var constraints = {
			audio: false,
			video: { facingMode: this.properties.facingMode }
		};
		navigator.mediaDevices
			.getUserMedia(constraints)
			.then(this.streamReady.bind(this))
			.catch(onFailSoHard);

		var that = this;
		function onFailSoHard(e) {
			LGraphTextureWebcam.is_webcam_open = false;
			console.log("Webcam rejected", e);
			that._webcam_stream = false;
			that.boxcolor = "red";
			that.trigger("stream_error");
		}
	};

	LGraphTextureWebcam.prototype.closeStream = function() {
		if (this._webcam_stream) {
			var tracks = this._webcam_stream.getTracks();
			if (tracks.length) {
				for (var i = 0; i < tracks.length; ++i) {
					tracks[i].stop();
				}
			}
			LGraphTextureWebcam.is_webcam_open = false;
			this._webcam_stream = null;
			this._video = null;
			this.boxcolor = "black";
			this.trigger("stream_closed");
		}
	};

	LGraphTextureWebcam.prototype.streamReady = function(localMediaStream) {
		this._webcam_stream = localMediaStream;
		//this._waiting_confirmation = false;
		this.boxcolor = "green";
		var video = this._video;
		if (!video) {
			video = document.createElement("video");
			video.autoplay = true;
			video.srcObject = localMediaStream;
			this._video = video;
			//document.body.appendChild( video ); //debug
			//when video info is loaded (size and so)
			video.onloadedmetadata = function(e) {
				// Ready to go. Do some stuff.
				LGraphTextureWebcam.is_webcam_open = true;
				console.log(e);
			};
		}
		this.trigger("stream_ready", video);
	};

	LGraphTextureWebcam.prototype.onPropertyChanged = function(
		name,
		value
	) {
		if (name == "facingMode") {
			this.properties.facingMode = value;
			this.closeStream();
			this.openStream();
		}
	};

	LGraphTextureWebcam.prototype.onRemoved = function() {
		if (!this._webcam_stream) {
			return;
		}

		var tracks = this._webcam_stream.getTracks();
		if (tracks.length) {
			for (var i = 0; i < tracks.length; ++i) {
				tracks[i].stop();
			}
		}

		this._webcam_stream = null;
		this._video = null;
	};

	LGraphTextureWebcam.prototype.onDrawBackground = function(ctx) {
		if (this.flags.collapsed || this.size[1] <= 20) {
			return;
		}

		if (!this._video) {
			return;
		}

		//render to graph canvas
		ctx.save();
		if (!ctx.webgl) {
			//reverse image
			ctx.drawImage(this._video, 0, 0, this.size[0], this.size[1]);
		} else {
			if (this._video_texture) {
				ctx.drawImage(
					this._video_texture,
					0,
					0,
					this.size[0],
					this.size[1]
				);
			}
		}
		ctx.restore();
	};

	LGraphTextureWebcam.prototype.onExecute = function() {
		if (this._webcam_stream == null && !this._waiting_confirmation) {
			this.openStream();
		}

		if (!this._video || !this._video.videoWidth) {
			return;
		}

		var width = this._video.videoWidth;
		var height = this._video.videoHeight;

		var temp = this._video_texture;
		if (!temp || temp.width != width || temp.height != height) {
			this._video_texture = new GL.Texture(width, height, {
				format: gl.RGB,
				filter: gl.LINEAR
			});
		}

		this._video_texture.uploadImage(this._video);
		this._video_texture.version = ++this.version;

		if (this.properties.texture_name) {
			var container = LGraphTexture.getTexturesContainer();
			container[this.properties.texture_name] = this._video_texture;
		}

		this.setOutputData(0, this._video_texture);
		for (var i = 1; i < this.outputs.length; ++i) {
			if (!this.outputs[i]) {
				continue;
			}
			switch (this.outputs[i].name) {
				case "width":
					this.setOutputData(i, this._video.videoWidth);
					break;
				case "height":
					this.setOutputData(i, this._video.videoHeight);
					break;
			}
		}
	};

	LGraphTextureWebcam.prototype.onGetOutputs = function() {
		return [
			["width", "number"],
			["height", "number"],
			["stream_ready", LiteGraph.EVENT],
			["stream_closed", LiteGraph.EVENT],
			["stream_error", LiteGraph.EVENT]
		];
	};

	LiteGraph.registerNodeType("texture/webcam", LGraphTextureWebcam);

	//from https://github.com/spite/Wagner
	function LGraphLensFX() {
		this.addInput("in", "Texture");
		this.addInput("f", "number");
		this.addOutput("out", "Texture");
		this.properties = {
			enabled: true,
			factor: 1,
			precision: LGraphTexture.LOW
		};

		this._uniforms = { u_texture: 0, u_factor: 1 };
	}

	LGraphLensFX.title = "Lens FX";
	LGraphLensFX.desc = "distortion and chromatic aberration";

	LGraphLensFX.widgets_info = {
		precision: { widget: "combo", values: LGraphTexture.MODE_VALUES }
	};

	LGraphLensFX.prototype.onGetInputs = function() {
		return [["enabled", "boolean"]];
	};

	LGraphLensFX.prototype.onExecute = function() {
		var tex = this.getInputData(0);
		if (!tex) {
			return;
		}

		if (!this.isOutputConnected(0)) {
			return;
		} //saves work

		if (
			this.properties.precision === LGraphTexture.PASS_THROUGH ||
			this.getInputOrProperty("enabled") === false
		) {
			this.setOutputData(0, tex);
			return;
		}

		var temp = this._temp_texture;
		if (
			!temp ||
			temp.width != tex.width ||
			temp.height != tex.height ||
			temp.type != tex.type
		) {
			temp = this._temp_texture = new GL.Texture(
				tex.width,
				tex.height,
				{ type: tex.type, format: gl.RGBA, filter: gl.LINEAR }
			);
		}

		var shader = LGraphLensFX._shader;
		if (!shader) {
			shader = LGraphLensFX._shader = new GL.Shader(
				GL.Shader.SCREEN_VERTEX_SHADER,
				LGraphLensFX.pixel_shader
			);
		}

		var factor = this.getInputData(1);
		if (factor == null) {
			factor = this.properties.factor;
		}

		var uniforms = this._uniforms;
		uniforms.u_factor = factor;

		//apply shader
		gl.disable(gl.DEPTH_TEST);
		temp.drawTo(function() {
			tex.bind(0);
			shader.uniforms(uniforms).draw(GL.Mesh.getScreenQuad());
		});

		this.setOutputData(0, temp);
	};

	LGraphLensFX.pixel_shader =
		"precision highp float;\n\
		varying vec2 v_coord;\n\
		uniform sampler2D u_texture;\n\
		uniform float u_factor;\n\
		vec2 barrelDistortion(vec2 coord, float amt) {\n\
			vec2 cc = coord - 0.5;\n\
			float dist = dot(cc, cc);\n\
			return coord + cc * dist * amt;\n\
		}\n\
		\n\
		float sat( float t )\n\
		{\n\
			return clamp( t, 0.0, 1.0 );\n\
		}\n\
		\n\
		float linterp( float t ) {\n\
			return sat( 1.0 - abs( 2.0*t - 1.0 ) );\n\
		}\n\
		\n\
		float remap( float t, float a, float b ) {\n\
			return sat( (t - a) / (b - a) );\n\
		}\n\
		\n\
		vec4 spectrum_offset( float t ) {\n\
			vec4 ret;\n\
			float lo = step(t,0.5);\n\
			float hi = 1.0-lo;\n\
			float w = linterp( remap( t, 1.0/6.0, 5.0/6.0 ) );\n\
			ret = vec4(lo,1.0,hi, 1.) * vec4(1.0-w, w, 1.0-w, 1.);\n\
		\n\
			return pow( ret, vec4(1.0/2.2) );\n\
		}\n\
		\n\
		const float max_distort = 2.2;\n\
		const int num_iter = 12;\n\
		const float reci_num_iter_f = 1.0 / float(num_iter);\n\
		\n\
		void main()\n\
		{	\n\
			vec2 uv=v_coord;\n\
			vec4 sumcol = vec4(0.0);\n\
			vec4 sumw = vec4(0.0);	\n\
			for ( int i=0; i<num_iter;++i )\n\
			{\n\
				float t = float(i) * reci_num_iter_f;\n\
				vec4 w = spectrum_offset( t );\n\
				sumw += w;\n\
				sumcol += w * texture2D( u_texture, barrelDistortion(uv, .6 * max_distort*t * u_factor ) );\n\
			}\n\
			gl_FragColor = sumcol / sumw;\n\
		}";

	LiteGraph.registerNodeType("texture/lensfx", LGraphLensFX);


	function LGraphTextureFromData() {
		this.addInput("in", "");
		this.properties = { precision: LGraphTexture.LOW, width: 0, height: 0, channels: 1 };
		this.addOutput("out", "Texture");
	}

	LGraphTextureFromData.title = "Data->Tex";
	LGraphTextureFromData.desc = "Generates or applies a curve to a texture";
	LGraphTextureFromData.widgets_info = {
		precision: { widget: "combo", values: LGraphTexture.MODE_VALUES }
	};

	LGraphTextureFromData.prototype.onExecute = function() {
		if (!this.isOutputConnected(0)) {
			return;
		} //saves work

		var data = this.getInputData(0);
		if(!data)
			return;

		var channels = this.properties.channels;
		var w = this.properties.width;
		var h = this.properties.height;
		if(!w || !h)
		{
			w = Math.floor(data.length / channels);
			h = 1;
		}
		var format = gl.RGBA;
		if( channels == 3 )
			format = gl.RGB;
		else if( channels == 1 )
			format = gl.LUMINANCE;

		var temp = this._temp_texture;
		var type = LGraphTexture.getTextureType( this.properties.precision );
		if ( !temp || temp.width != w || temp.height != h || temp.type != type ) {
			temp = this._temp_texture = new GL.Texture( w, h, { type: type, format: format, filter: gl.LINEAR } );
		}

		temp.uploadData( data );
		this.setOutputData(0, temp);
	}

	LiteGraph.registerNodeType("texture/fromdata", LGraphTextureFromData);

	//applies a curve (or generates one)
	function LGraphTextureCurve() {
		this.addInput("in", "Texture");
		this.addOutput("out", "Texture");
		this.properties = { precision: LGraphTexture.LOW, split_channels: false };
		this._values = new Uint8Array(256*4);
		this._values.fill(255);
		this._curve_texture = null;
		this._uniforms = { u_texture: 0, u_curve: 1, u_range: 1.0 };
		this._must_update = true;
		this._points = {
			RGB: [[0,0],[1,1]],
			R: [[0,0],[1,1]],
			G: [[0,0],[1,1]],
			B: [[0,0],[1,1]]
		};
		this.curve_editor = null;
		this.addWidget("toggle","Split Channels",false,"split_channels");
		this.addWidget("combo","Channel","RGB",{ values:["RGB","R","G","B"]});
		this.curve_offset = 68;
		this.size = [ 240, 160 ];
	}

	LGraphTextureCurve.title = "Curve";
	LGraphTextureCurve.desc = "Generates or applies a curve to a texture";
	LGraphTextureCurve.widgets_info = {
		precision: { widget: "combo", values: LGraphTexture.MODE_VALUES }
	};

	LGraphTextureCurve.prototype.onExecute = function() {
		if (!this.isOutputConnected(0)) {
			return;
		} //saves work

		var tex = this.getInputData(0);

		var temp = this._temp_texture;
		if(!tex) //generate one texture, nothing else
		{
			if(this._must_update || !this._curve_texture )
				this.updateCurve();
			this.setOutputData(0, this._curve_texture);
			return;
		}

		var type = LGraphTexture.getTextureType( this.properties.precision, tex );
		
		//apply curve to input texture
		if ( !temp || temp.type != type || temp.width != tex.width || temp.height != tex.height || temp.format != tex.format)
			temp = this._temp_texture = new GL.Texture( tex.width, tex.height, { type: type, format: tex.format, filter: gl.LINEAR } );

		var shader = LGraphTextureCurve._shader;
		if (!shader) {
			shader = LGraphTextureCurve._shader = new GL.Shader( GL.Shader.SCREEN_VERTEX_SHADER, LGraphTextureCurve.pixel_shader );
		}

		if(this._must_update || !this._curve_texture )
			this.updateCurve();

		var uniforms = this._uniforms;
		var curve_texture = this._curve_texture;

		//apply shader
		temp.drawTo(function() {
			gl.disable(gl.DEPTH_TEST);
			tex.bind(0);
			curve_texture.bind(1);
			shader.uniforms(uniforms).draw(GL.Mesh.getScreenQuad());
		});

		this.setOutputData(0, temp);
	}

	LGraphTextureCurve.prototype.sampleCurve = function(f,points)
	{
		var points = points || this._points.RGB;
		if(!points)
			return;
		for(var i = 0; i < points.length - 1; ++i)
		{
			var p = points[i];
			var pn = points[i+1];
			if(pn[0] < f)
				continue;
			var r = (pn[0] - p[0]);
			if( Math.abs(r) < 0.00001 )
				return p[1];
			var local_f = (f - p[0]) / r;
			return p[1] * (1.0 - local_f) + pn[1] * local_f;
		}
		return 0;
	}

	LGraphTextureCurve.prototype.updateCurve = function()
	{
		var values = this._values;
		var num = values.length / 4;
		var split = this.properties.split_channels;
		for(var i = 0; i < num; ++i)
		{
			if(split)
			{
				values[i*4] = Math.clamp( this.sampleCurve(i/num,this._points.R)*255,0,255);
				values[i*4+1] = Math.clamp( this.sampleCurve(i/num,this._points.G)*255,0,255);
				values[i*4+2] = Math.clamp( this.sampleCurve(i/num,this._points.B)*255,0,255);
			}
			else
			{
				var v = this.sampleCurve(i/num);//sample curve
				values[i*4] = values[i*4+1] = values[i*4+2] = Math.clamp(v*255,0,255);
			}
			values[i*4+3] = 255; //alpha fixed
		}
		if(!this._curve_texture)
			this._curve_texture = new GL.Texture(256,1,{ format: gl.RGBA, magFilter: gl.LINEAR, wrap: gl.CLAMP_TO_EDGE });
		this._curve_texture.uploadData(values,null,true);
	}

	LGraphTextureCurve.prototype.onSerialize = function(o)
	{
		var curves = {};
		for(var i in this._points)
			curves[i] = this._points[i].concat();
		o.curves = curves;
	}

	LGraphTextureCurve.prototype.onConfigure = function(o)
	{
		this._points = o.curves;
		if(this.curve_editor)
			curve_editor.points = this._points;
		this._must_update = true;
	}

	LGraphTextureCurve.prototype.onMouseDown = function(e, localpos, graphcanvas)
	{
		if(this.curve_editor)
		{
			var r = this.curve_editor.onMouseDown([localpos[0],localpos[1]-this.curve_offset], graphcanvas);
			if(r)
				this.captureInput(true);
			return r;
		}
	}

	LGraphTextureCurve.prototype.onMouseMove = function(e, localpos, graphcanvas)
	{
		if(this.curve_editor)
			return this.curve_editor.onMouseMove([localpos[0],localpos[1]-this.curve_offset], graphcanvas);
	}

	LGraphTextureCurve.prototype.onMouseUp = function(e, localpos, graphcanvas)
	{
		if(this.curve_editor)
			return this.curve_editor.onMouseUp([localpos[0],localpos[1]-this.curve_offset], graphcanvas);
		this.captureInput(false);
	}

	LGraphTextureCurve.channel_line_colors = { "RGB":"#666","R":"#F33","G":"#3F3","B":"#33F" };

	LGraphTextureCurve.prototype.onDrawBackground = function(ctx, graphcanvas)
	{
		if(this.flags.collapsed)
			return;

		if(!this.curve_editor)
			this.curve_editor = new LiteGraph.CurveEditor(this._points.R);
		ctx.save();
		ctx.translate(0,this.curve_offset);
		var channel = this.widgets[1].value;

		if(this.properties.split_channels)
		{
			if(channel == "RGB")
			{
				this.widgets[1].value = channel = "R";
				this.widgets[1].disabled = false;
			}
			this.curve_editor.points = this._points.R;
			this.curve_editor.draw( ctx, [this.size[0],this.size[1] - this.curve_offset], graphcanvas, "#111", LGraphTextureCurve.channel_line_colors.R, true );
			ctx.globalCompositeOperation = "lighten";
			this.curve_editor.points = this._points.G;
			this.curve_editor.draw( ctx, [this.size[0],this.size[1] - this.curve_offset], graphcanvas, null, LGraphTextureCurve.channel_line_colors.G, true );
			this.curve_editor.points = this._points.B;
			this.curve_editor.draw( ctx, [this.size[0],this.size[1] - this.curve_offset], graphcanvas, null, LGraphTextureCurve.channel_line_colors.B, true );
			ctx.globalCompositeOperation = "source-over";
		}
		else
		{
			this.widgets[1].value = channel = "RGB";
			this.widgets[1].disabled = true;
		}

		this.curve_editor.points = this._points[channel];
		this.curve_editor.draw( ctx, [this.size[0],this.size[1] - this.curve_offset], graphcanvas, this.properties.split_channels ? null : "#111", LGraphTextureCurve.channel_line_colors[channel]  );
		ctx.restore();
	}

	LGraphTextureCurve.pixel_shader =
		"precision highp float;\n\
		varying vec2 v_coord;\n\
		uniform sampler2D u_texture;\n\
		uniform sampler2D u_curve;\n\
		uniform float u_range;\n\
		\n\
		void main() {\n\
			vec4 color = texture2D( u_texture, v_coord ) * u_range;\n\
			color.x = texture2D( u_curve, vec2( color.x, 0.5 ) ).x;\n\
			color.y = texture2D( u_curve, vec2( color.y, 0.5 ) ).y;\n\
			color.z = texture2D( u_curve, vec2( color.z, 0.5 ) ).z;\n\
			//color.w = texture2D( u_curve, vec2( color.w, 0.5 ) ).w;\n\
			gl_FragColor = color;\n\
		}";

	LiteGraph.registerNodeType("texture/curve", LGraphTextureCurve);

	//simple exposition, but plan to expand it to support different gamma curves
	function LGraphExposition() {
		this.addInput("in", "Texture");
		this.addInput("exp", "number");
		this.addOutput("out", "Texture");
		this.properties = { exposition: 1, precision: LGraphTexture.LOW };
		this._uniforms = { u_texture: 0, u_exposition: 1 };
	}

	LGraphExposition.title = "Exposition";
	LGraphExposition.desc = "Controls texture exposition";

	LGraphExposition.widgets_info = {
		exposition: { widget: "slider", min: 0, max: 3 },
		precision: { widget: "combo", values: LGraphTexture.MODE_VALUES }
	};

	LGraphExposition.prototype.onExecute = function() {
		var tex = this.getInputData(0);
		if (!tex) {
			return;
		}

		if (!this.isOutputConnected(0)) {
			return;
		} //saves work

		var temp = this._temp_texture;
		if (
			!temp ||
			temp.width != tex.width ||
			temp.height != tex.height ||
			temp.type != tex.type
		) {
			temp = this._temp_texture = new GL.Texture(
				tex.width,
				tex.height,
				{ type: tex.type, format: gl.RGBA, filter: gl.LINEAR }
			);
		}

		var shader = LGraphExposition._shader;
		if (!shader) {
			shader = LGraphExposition._shader = new GL.Shader(
				GL.Shader.SCREEN_VERTEX_SHADER,
				LGraphExposition.pixel_shader
			);
		}

		var exp = this.properties.exposition;
		var exp_input = this.getInputData(1);
		if (exp_input != null) {
			exp = this.properties.exposition = exp_input;
		}
		var uniforms = this._uniforms;

		//apply shader
		temp.drawTo(function() {
			gl.disable(gl.DEPTH_TEST);
			tex.bind(0);
			shader.uniforms(uniforms).draw(GL.Mesh.getScreenQuad());
		});

		this.setOutputData(0, temp);
	};

	LGraphExposition.pixel_shader =
		"precision highp float;\n\
		varying vec2 v_coord;\n\
		uniform sampler2D u_texture;\n\
		uniform float u_exposition;\n\
		\n\
		void main() {\n\
			vec4 color = texture2D( u_texture, v_coord );\n\
			gl_FragColor = vec4( color.xyz * u_exposition, color.a );\n\
		}";

	LiteGraph.registerNodeType("texture/exposition", LGraphExposition);

	function LGraphToneMapping() {
		this.addInput("in", "Texture");
		this.addInput("avg", "number,Texture");
		this.addOutput("out", "Texture");
		this.properties = {
			enabled: true,
			scale: 1,
			gamma: 1,
			average_lum: 1,
			lum_white: 1,
			precision: LGraphTexture.LOW
		};

		this._uniforms = {
			u_texture: 0,
			u_lumwhite2: 1,
			u_igamma: 1,
			u_scale: 1,
			u_average_lum: 1
		};
	}

	LGraphToneMapping.title = "Tone Mapping";
	LGraphToneMapping.desc =
		"Applies Tone Mapping to convert from high to low";

	LGraphToneMapping.widgets_info = {
		precision: { widget: "combo", values: LGraphTexture.MODE_VALUES }
	};

	LGraphToneMapping.prototype.onGetInputs = function() {
		return [["enabled", "boolean"]];
	};

	LGraphToneMapping.prototype.onExecute = function() {
		var tex = this.getInputData(0);
		if (!tex) {
			return;
		}

		if (!this.isOutputConnected(0)) {
			return;
		} //saves work

		if (
			this.properties.precision === LGraphTexture.PASS_THROUGH ||
			this.getInputOrProperty("enabled") === false
		) {
			this.setOutputData(0, tex);
			return;
		}

		var temp = this._temp_texture;

		if (
			!temp ||
			temp.width != tex.width ||
			temp.height != tex.height ||
			temp.type != tex.type
		) {
			temp = this._temp_texture = new GL.Texture(
				tex.width,
				tex.height,
				{ type: tex.type, format: gl.RGBA, filter: gl.LINEAR }
			);
		}

		var avg = this.getInputData(1);
		if (avg == null) {
			avg = this.properties.average_lum;
		}

		var uniforms = this._uniforms;
		var shader = null;

		if (avg.constructor === Number) {
			this.properties.average_lum = avg;
			uniforms.u_average_lum = this.properties.average_lum;
			shader = LGraphToneMapping._shader;
			if (!shader) {
				shader = LGraphToneMapping._shader = new GL.Shader(
					GL.Shader.SCREEN_VERTEX_SHADER,
					LGraphToneMapping.pixel_shader
				);
			}
		} else if (avg.constructor === GL.Texture) {
			uniforms.u_average_texture = avg.bind(1);
			shader = LGraphToneMapping._shader_texture;
			if (!shader) {
				shader = LGraphToneMapping._shader_texture = new GL.Shader(
					GL.Shader.SCREEN_VERTEX_SHADER,
					LGraphToneMapping.pixel_shader,
					{ AVG_TEXTURE: "" }
				);
			}
		}

		uniforms.u_lumwhite2 =
			this.properties.lum_white * this.properties.lum_white;
		uniforms.u_scale = this.properties.scale;
		uniforms.u_igamma = 1 / this.properties.gamma;

		//apply shader
		gl.disable(gl.DEPTH_TEST);
		temp.drawTo(function() {
			tex.bind(0);
			shader.uniforms(uniforms).draw(GL.Mesh.getScreenQuad());
		});

		this.setOutputData(0, this._temp_texture);
	};

	LGraphToneMapping.pixel_shader =
		"precision highp float;\n\
		varying vec2 v_coord;\n\
		uniform sampler2D u_texture;\n\
		uniform float u_scale;\n\
		#ifdef AVG_TEXTURE\n\
			uniform sampler2D u_average_texture;\n\
		#else\n\
			uniform float u_average_lum;\n\
		#endif\n\
		uniform float u_lumwhite2;\n\
		uniform float u_igamma;\n\
		vec3 RGB2xyY (vec3 rgb)\n\
		{\n\
			 const mat3 RGB2XYZ = mat3(0.4124, 0.3576, 0.1805,\n\
									   0.2126, 0.7152, 0.0722,\n\
									   0.0193, 0.1192, 0.9505);\n\
			vec3 XYZ = RGB2XYZ * rgb;\n\
			\n\
			float f = (XYZ.x + XYZ.y + XYZ.z);\n\
			return vec3(XYZ.x / f,\n\
						XYZ.y / f,\n\
						XYZ.y);\n\
		}\n\
		\n\
		void main() {\n\
			vec4 color = texture2D( u_texture, v_coord );\n\
			vec3 rgb = color.xyz;\n\
			float average_lum = 0.0;\n\
			#ifdef AVG_TEXTURE\n\
				vec3 pixel = texture2D(u_average_texture,vec2(0.5)).xyz;\n\
				average_lum = (pixel.x + pixel.y + pixel.z) / 3.0;\n\
			#else\n\
				average_lum = u_average_lum;\n\
			#endif\n\
			//Ld - this part of the code is the same for both versions\n\
			float lum = dot(rgb, vec3(0.2126, 0.7152, 0.0722));\n\
			float L = (u_scale / average_lum) * lum;\n\
			float Ld = (L * (1.0 + L / u_lumwhite2)) / (1.0 + L);\n\
			//first\n\
			//vec3 xyY = RGB2xyY(rgb);\n\
			//xyY.z *= Ld;\n\
			//rgb = xyYtoRGB(xyY);\n\
			//second\n\
			rgb = (rgb / lum) * Ld;\n\
			rgb = max(rgb,vec3(0.001));\n\
			rgb = pow( rgb, vec3( u_igamma ) );\n\
			gl_FragColor = vec4( rgb, color.a );\n\
		}";

	LiteGraph.registerNodeType("texture/tonemapping", LGraphToneMapping);

	function LGraphTexturePerlin() {
		this.addOutput("out", "Texture");
		this.properties = {
			width: 512,
			height: 512,
			seed: 0,
			persistence: 0.1,
			octaves: 8,
			scale: 1,
			offset: [0, 0],
			amplitude: 1,
			precision: LGraphTexture.DEFAULT
		};
		this._key = 0;
		this._texture = null;
		this._uniforms = {
			u_persistence: 0.1,
			u_seed: 0,
			u_offset: vec2.create(),
			u_scale: 1,
			u_viewport: vec2.create()
		};
	}

	LGraphTexturePerlin.title = "Perlin";
	LGraphTexturePerlin.desc = "Generates a perlin noise texture";

	LGraphTexturePerlin.widgets_info = {
		precision: { widget: "combo", values: LGraphTexture.MODE_VALUES },
		width: { type: "Number", precision: 0, step: 1 },
		height: { type: "Number", precision: 0, step: 1 },
		octaves: { type: "Number", precision: 0, step: 1, min: 1, max: 50 }
	};

	LGraphTexturePerlin.prototype.onGetInputs = function() {
		return [
			["seed", "Number"],
			["persistence", "Number"],
			["octaves", "Number"],
			["scale", "Number"],
			["amplitude", "Number"],
			["offset", "vec2"]
		];
	};

	LGraphTexturePerlin.prototype.onExecute = function() {
		if (!this.isOutputConnected(0)) {
			return;
		} //saves work

		var w = this.properties.width | 0;
		var h = this.properties.height | 0;
		if (w == 0) {
			w = gl.viewport_data[2];
		} //0 means default
		if (h == 0) {
			h = gl.viewport_data[3];
		} //0 means default
		var type = LGraphTexture.getTextureType(this.properties.precision);

		var temp = this._texture;
		if (
			!temp ||
			temp.width != w ||
			temp.height != h ||
			temp.type != type
		) {
			temp = this._texture = new GL.Texture(w, h, {
				type: type,
				format: gl.RGB,
				filter: gl.LINEAR
			});
		}

		var persistence = this.getInputOrProperty("persistence");
		var octaves = this.getInputOrProperty("octaves");
		var offset = this.getInputOrProperty("offset");
		var scale = this.getInputOrProperty("scale");
		var amplitude = this.getInputOrProperty("amplitude");
		var seed = this.getInputOrProperty("seed");

		//reusing old texture
		var key =
			"" +
			w +
			h +
			type +
			persistence +
			octaves +
			scale +
			seed +
			offset[0] +
			offset[1] +
			amplitude;
		if (key == this._key) {
			this.setOutputData(0, temp);
			return;
		}
		this._key = key;

		//gather uniforms
		var uniforms = this._uniforms;
		uniforms.u_persistence = persistence;
		uniforms.u_octaves = octaves;
		uniforms.u_offset.set(offset);
		uniforms.u_scale = scale;
		uniforms.u_amplitude = amplitude;
		uniforms.u_seed = seed * 128;
		uniforms.u_viewport[0] = w;
		uniforms.u_viewport[1] = h;

		//render
		var shader = LGraphTexturePerlin._shader;
		if (!shader) {
			shader = LGraphTexturePerlin._shader = new GL.Shader(
				GL.Shader.SCREEN_VERTEX_SHADER,
				LGraphTexturePerlin.pixel_shader
			);
		}

		gl.disable(gl.BLEND);
		gl.disable(gl.DEPTH_TEST);

		temp.drawTo(function() {
			shader.uniforms(uniforms).draw(GL.Mesh.getScreenQuad());
		});

		this.setOutputData(0, temp);
	};

	LGraphTexturePerlin.pixel_shader =
		"precision highp float;\n\
		varying vec2 v_coord;\n\
		uniform vec2 u_offset;\n\
		uniform float u_scale;\n\
		uniform float u_persistence;\n\
		uniform int u_octaves;\n\
		uniform float u_amplitude;\n\
		uniform vec2 u_viewport;\n\
		uniform float u_seed;\n\
		#define M_PI 3.14159265358979323846\n\
		\n\
		float rand(vec2 c){	return fract(sin(dot(c.xy ,vec2( 12.9898 + u_seed,78.233 + u_seed))) * 43758.5453); }\n\
		\n\
		float noise(vec2 p, float freq ){\n\
			float unit = u_viewport.x/freq;\n\
			vec2 ij = floor(p/unit);\n\
			vec2 xy = mod(p,unit)/unit;\n\
			//xy = 3.*xy*xy-2.*xy*xy*xy;\n\
			xy = .5*(1.-cos(M_PI*xy));\n\
			float a = rand((ij+vec2(0.,0.)));\n\
			float b = rand((ij+vec2(1.,0.)));\n\
			float c = rand((ij+vec2(0.,1.)));\n\
			float d = rand((ij+vec2(1.,1.)));\n\
			float x1 = mix(a, b, xy.x);\n\
			float x2 = mix(c, d, xy.x);\n\
			return mix(x1, x2, xy.y);\n\
		}\n\
		\n\
		float pNoise(vec2 p, int res){\n\
			float persistance = u_persistence;\n\
			float n = 0.;\n\
			float normK = 0.;\n\
			float f = 4.;\n\
			float amp = 1.0;\n\
			int iCount = 0;\n\
			for (int i = 0; i<50; i++){\n\
				n+=amp*noise(p, f);\n\
				f*=2.;\n\
				normK+=amp;\n\
				amp*=persistance;\n\
				if (iCount >= res)\n\
					break;\n\
				iCount++;\n\
			}\n\
			float nf = n/normK;\n\
			return nf*nf*nf*nf;\n\
		}\n\
		void main() {\n\
			vec2 uv = v_coord * u_scale * u_viewport + u_offset * u_scale;\n\
			vec4 color = vec4( pNoise( uv, u_octaves ) * u_amplitude );\n\
			gl_FragColor = color;\n\
		}";

	LiteGraph.registerNodeType("texture/perlin", LGraphTexturePerlin);

	function LGraphTextureCanvas2D() {
		this.addInput("v");
		this.addOutput("out", "Texture");
		this.properties = {
			code: LGraphTextureCanvas2D.default_code,
			width: 512,
			height: 512,
			clear: true,
			precision: LGraphTexture.DEFAULT,
			use_html_canvas: false
		};
		this._func = null;
		this._temp_texture = null;
		this.compileCode();
	}

	LGraphTextureCanvas2D.title = "Canvas2D";
	LGraphTextureCanvas2D.desc = "Executes Canvas2D code inside a texture or the viewport.";
	LGraphTextureCanvas2D.help = "Set width and height to 0 to match viewport size.";

	LGraphTextureCanvas2D.default_code = "//vars: canvas,ctx,time\nctx.fillStyle='red';\nctx.fillRect(0,0,50,50);\n";

	LGraphTextureCanvas2D.widgets_info = {
		precision: { widget: "combo", values: LGraphTexture.MODE_VALUES },
		code: { type: "code" },
		width: { type: "Number", precision: 0, step: 1 },
		height: { type: "Number", precision: 0, step: 1 }
	};

	LGraphTextureCanvas2D.prototype.onPropertyChanged = function( name, value ) {
		if (name == "code" )
			this.compileCode( value );
	}
	
	LGraphTextureCanvas2D.prototype.compileCode = function( code ) {
		this._func = null;
		if( !LiteGraph.allow_scripts )
			return;

		try {
			this._func = new Function( "canvas", "ctx", "time", "script","v", code );
			this.boxcolor = "#00FF00";
		} catch (err) {
			this.boxcolor = "#FF0000";
			console.error("Error parsing script");
			console.error(err);
		}
	};

	LGraphTextureCanvas2D.prototype.onExecute = function() {
		var func = this._func;
		if (!func || !this.isOutputConnected(0)) {
			return;
		}
		this.executeDraw( func );
	}

	LGraphTextureCanvas2D.prototype.executeDraw = function( func_context ) {

		var width = this.properties.width || gl.canvas.width;
		var height = this.properties.height || gl.canvas.height;
		var temp = this._temp_texture;
		var type = LGraphTexture.getTextureType( this.properties.precision );
		if (!temp || temp.width != width || temp.height != height || temp.type != type ) {
			temp = this._temp_texture = new GL.Texture(width, height, {
				format: gl.RGBA,
				filter: gl.LINEAR,
				type: type
			});
		}

		var v = this.getInputData(0);

		var properties = this.properties;
		var that = this;
		var time = this.graph.getTime();
		var ctx = gl;
		var canvas = gl.canvas;
		if( this.properties.use_html_canvas || !global.enableWebGLCanvas )
		{
			if(!this._canvas)
			{
				canvas = this._canvas = createCanvas(width.height);
				ctx = this._ctx = canvas.getContext("2d");
			}
			else
			{
				canvas = this._canvas;
				ctx = this._ctx;
			}
			canvas.width = width;
			canvas.height = height;
		}

		if(ctx == gl) //using Canvas2DtoWebGL
			temp.drawTo(function() {
				gl.start2D();
				if(properties.clear)
				{
					gl.clearColor(0,0,0,0);
					gl.clear( gl.COLOR_BUFFER_BIT );
				}

				try {
					if (func_context.draw) {
						func_context.draw.call(that, canvas, ctx, time, func_context, v);
					} else {
						func_context.call(that, canvas, ctx, time, func_context,v);
					}
					that.boxcolor = "#00FF00";
				} catch (err) {
					that.boxcolor = "#FF0000";
					console.error("Error executing script");
					console.error(err);
				}
				gl.finish2D();
			});
		else //rendering to offscren canvas and uploading to texture
		{
			if(properties.clear)
				ctx.clearRect(0,0,canvas.width,canvas.height);

			try {
				if (func_context.draw) {
					func_context.draw.call(this, canvas, ctx, time, func_context, v);
				} else {
					func_context.call(this, canvas, ctx, time, func_context,v);
				}
				this.boxcolor = "#00FF00";
			} catch (err) {
				this.boxcolor = "#FF0000";
				console.error("Error executing script");
				console.error(err);
			}
			temp.uploadImage( canvas );
		}

		this.setOutputData(0, temp);
	};

	LiteGraph.registerNodeType("texture/canvas2D", LGraphTextureCanvas2D);

	// To do chroma keying *****************

	function LGraphTextureMatte() {
		this.addInput("in", "Texture");

		this.addOutput("out", "Texture");
		this.properties = {
			key_color: vec3.fromValues(0, 1, 0),
			threshold: 0.8,
			slope: 0.2,
			precision: LGraphTexture.DEFAULT
		};
	}

	LGraphTextureMatte.title = "Matte";
	LGraphTextureMatte.desc = "Extracts background";

	LGraphTextureMatte.widgets_info = {
		key_color: { widget: "color" },
		precision: { widget: "combo", values: LGraphTexture.MODE_VALUES }
	};

	LGraphTextureMatte.prototype.onExecute = function() {
		if (!this.isOutputConnected(0)) {
			return;
		} //saves work

		var tex = this.getInputData(0);

		if (this.properties.precision === LGraphTexture.PASS_THROUGH) {
			this.setOutputData(0, tex);
			return;
		}

		if (!tex) {
			return;
		}

		this._tex = LGraphTexture.getTargetTexture(
			tex,
			this._tex,
			this.properties.precision
		);

		gl.disable(gl.BLEND);
		gl.disable(gl.DEPTH_TEST);

		if (!this._uniforms) {
			this._uniforms = {
				u_texture: 0,
				u_key_color: this.properties.key_color,
				u_threshold: 1,
				u_slope: 1
			};
		}
		var uniforms = this._uniforms;

		var mesh = Mesh.getScreenQuad();
		var shader = LGraphTextureMatte._shader;
		if (!shader) {
			shader = LGraphTextureMatte._shader = new GL.Shader(
				GL.Shader.SCREEN_VERTEX_SHADER,
				LGraphTextureMatte.pixel_shader
			);
		}

		uniforms.u_key_color = this.properties.key_color;
		uniforms.u_threshold = this.properties.threshold;
		uniforms.u_slope = this.properties.slope;

		this._tex.drawTo(function() {
			tex.bind(0);
			shader.uniforms(uniforms).draw(mesh);
		});

		this.setOutputData(0, this._tex);
	};

	LGraphTextureMatte.pixel_shader =
		"precision highp float;\n\
		varying vec2 v_coord;\n\
		uniform sampler2D u_texture;\n\
		uniform vec3 u_key_color;\n\
		uniform float u_threshold;\n\
		uniform float u_slope;\n\
		\n\
		void main() {\n\
			vec3 color = texture2D( u_texture, v_coord ).xyz;\n\
			float diff = length( normalize(color) - normalize(u_key_color) );\n\
			float edge = u_threshold * (1.0 - u_slope);\n\
			float alpha = smoothstep( edge, u_threshold, diff);\n\
			gl_FragColor = vec4( color, alpha );\n\
		}";

	LiteGraph.registerNodeType("texture/matte", LGraphTextureMatte);

	//***********************************
	function LGraphCubemapToTexture2D() {
		this.addInput("in", "texture");
		this.addInput("yaw", "number");
		this.addOutput("out", "texture");
		this.properties = { yaw: 0 };
	}

	LGraphCubemapToTexture2D.title = "CubemapToTexture2D";
	LGraphCubemapToTexture2D.desc = "Transforms a CUBEMAP texture into a TEXTURE2D in Polar Representation";

	LGraphCubemapToTexture2D.prototype.onExecute = function() {
		if (!this.isOutputConnected(0))
			return;

		var tex = this.getInputData(0);
		if ( !tex || tex.texture_type != GL.TEXTURE_CUBE_MAP )
			return;
		if( this._last_tex && ( this._last_tex.height != tex.height || this._last_tex.type != tex.type ))
			this._last_tex = null;
		var yaw = this.getInputOrProperty("yaw");
		this._last_tex = GL.Texture.cubemapToTexture2D( tex, tex.height, this._last_tex, true, yaw );
		this.setOutputData( 0, this._last_tex );
	};

	LiteGraph.registerNodeType( "texture/cubemapToTexture2D", LGraphCubemapToTexture2D );
})(this);

(function(global) {
    var LiteGraph = global.LiteGraph;

	var view_matrix = new Float32Array(16);
	var projection_matrix = new Float32Array(16);
	var viewprojection_matrix = new Float32Array(16);
	var model_matrix = new Float32Array(16);
	var global_uniforms = {
		u_view: view_matrix,
		u_projection: projection_matrix,
		u_viewprojection: viewprojection_matrix,
		u_model: model_matrix 
	};

	LiteGraph.LGraphRender = {
		onRequestCameraMatrices: null //overwrite with your 3D engine specifics, it will receive (view_matrix, projection_matrix,viewprojection_matrix) and must be filled
	};

	function generateGeometryId() {
		return (Math.random() * 100000)|0;
	}

	function LGraphPoints3D() {

		this.addInput("obj", "");
		this.addInput("radius", "number");

		this.addOutput("out", "geometry");
		this.addOutput("points", "[vec3]");
		this.properties = {
			radius: 1,
			num_points: 4096,
			generate_normals: true,
			regular: false,
			mode: LGraphPoints3D.SPHERE,
			force_update: false
		};

		this.points = new Float32Array( this.properties.num_points * 3 );
		this.normals = new Float32Array( this.properties.num_points * 3 );
		this.must_update = true;
		this.version = 0;

		var that = this;
		this.addWidget("button","update",null, function(){ that.must_update = true; });

		this.geometry = {
			vertices: null,
			_id: generateGeometryId()
		}

		this._old_obj = null;
		this._last_radius = null;
	}

	global.LGraphPoints3D = LGraphPoints3D;

	LGraphPoints3D.RECTANGLE = 1;
	LGraphPoints3D.CIRCLE = 2;

	LGraphPoints3D.CUBE = 10;
	LGraphPoints3D.SPHERE = 11;
	LGraphPoints3D.HEMISPHERE = 12;
	LGraphPoints3D.INSIDE_SPHERE = 13;

	LGraphPoints3D.OBJECT = 20;
	LGraphPoints3D.OBJECT_UNIFORMLY = 21;
	LGraphPoints3D.OBJECT_INSIDE = 22;

	LGraphPoints3D.MODE_VALUES = { "rectangle":LGraphPoints3D.RECTANGLE, "circle":LGraphPoints3D.CIRCLE, "cube":LGraphPoints3D.CUBE, "sphere":LGraphPoints3D.SPHERE, "hemisphere":LGraphPoints3D.HEMISPHERE, "inside_sphere":LGraphPoints3D.INSIDE_SPHERE, "object":LGraphPoints3D.OBJECT, "object_uniformly":LGraphPoints3D.OBJECT_UNIFORMLY, "object_inside":LGraphPoints3D.OBJECT_INSIDE };

	LGraphPoints3D.widgets_info = {
		mode: { widget: "combo", values: LGraphPoints3D.MODE_VALUES }
	};

	LGraphPoints3D.title = "list of points";
	LGraphPoints3D.desc = "returns an array of points";

	LGraphPoints3D.prototype.onPropertyChanged = function(name,value)
	{
		this.must_update = true;
	}

	LGraphPoints3D.prototype.onExecute = function() {

		var obj = this.getInputData(0);
		if( obj != this._old_obj || (obj && obj._version != this._old_obj_version) )
		{
			this._old_obj = obj;
			this.must_update = true;
		}

		var radius = this.getInputData(1);
		if(radius == null)
			radius = this.properties.radius;
		if( this._last_radius != radius )
		{
			this._last_radius = radius;
			this.must_update = true;
		}

		if(this.must_update || this.properties.force_update )
		{
			this.must_update = false;
			this.updatePoints();
		}

		this.geometry.vertices = this.points;
		this.geometry.normals = this.normals;
		this.geometry._version = this.version;

		this.setOutputData( 0, this.geometry );
	}

	LGraphPoints3D.prototype.updatePoints = function() {
		var num_points = this.properties.num_points|0;
		if(num_points < 1)
			num_points = 1;

		if(!this.points || this.points.length != num_points * 3)
			this.points = new Float32Array( num_points * 3 );

		if(this.properties.generate_normals)
		{
			if (!this.normals || this.normals.length != this.points.length)
				this.normals = new Float32Array( this.points.length );
		}
		else
			this.normals = null;

		var radius = this._last_radius || this.properties.radius;
		var mode = this.properties.mode;

		var obj = this.getInputData(0);
		this._old_obj_version = obj ? obj._version : null;

		this.points = LGraphPoints3D.generatePoints( radius, num_points, mode, this.points, this.normals, this.properties.regular, obj );

		this.version++;
	}

	//global
	LGraphPoints3D.generatePoints = function( radius, num_points, mode, points, normals, regular, obj )
	{
		var size = num_points * 3;
		if(!points || points.length != size)
			points = new Float32Array( size );
		var temp = new Float32Array(3);
		var UP = new Float32Array([0,1,0]);

		if(regular)
		{
			if( mode == LGraphPoints3D.RECTANGLE)
			{
				var side = Math.floor(Math.sqrt(num_points));
				for(var i = 0; i < side; ++i)
				for(var j = 0; j < side; ++j)
				{
					var pos = i*3 + j*3*side;
					points[pos] = ((i/side) - 0.5) * radius * 2;
					points[pos+1] = 0;
					points[pos+2] = ((j/side) - 0.5) * radius * 2;
				}
				points = new Float32Array( points.subarray(0,side*side*3) );
				if(normals)
				{
					for(var i = 0; i < normals.length; i+=3)
						normals.set(UP, i);
				}
			}
			else if( mode == LGraphPoints3D.SPHERE)
			{
				var side = Math.floor(Math.sqrt(num_points));
				for(var i = 0; i < side; ++i)
				for(var j = 0; j < side; ++j)
				{
					var pos = i*3 + j*3*side;
					polarToCartesian( temp, (i/side) * 2 * Math.PI, ((j/side) - 0.5) * 2 * Math.PI, radius );
					points[pos] = temp[0];
					points[pos+1] = temp[1];
					points[pos+2] = temp[2];
				}
				points = new Float32Array( points.subarray(0,side*side*3) );
				if(normals)
					LGraphPoints3D.generateSphericalNormals( points, normals );
			}
			else if( mode == LGraphPoints3D.CIRCLE)
			{
				for(var i = 0; i < size; i+=3)
				{
					var angle = 2 * Math.PI * (i/size);
					points[i] = Math.cos( angle ) * radius;
					points[i+1] = 0;
					points[i+2] = Math.sin( angle ) * radius;
				}
				if(normals)
				{
					for(var i = 0; i < normals.length; i+=3)
						normals.set(UP, i);
				}
			}
		}
		else //non regular
		{
			if( mode == LGraphPoints3D.RECTANGLE)
			{
				for(var i = 0; i < size; i+=3)
				{
					points[i] = (Math.random() - 0.5) * radius * 2;
					points[i+1] = 0;
					points[i+2] = (Math.random() - 0.5) * radius * 2;
				}
				if(normals)
				{
					for(var i = 0; i < normals.length; i+=3)
						normals.set(UP, i);
				}
			}
			else if( mode == LGraphPoints3D.CUBE)
			{
				for(var i = 0; i < size; i+=3)
				{
					points[i] = (Math.random() - 0.5) * radius * 2;
					points[i+1] = (Math.random() - 0.5) * radius * 2;
					points[i+2] = (Math.random() - 0.5) * radius * 2;
				}
				if(normals)
				{
					for(var i = 0; i < normals.length; i+=3)
						normals.set(UP, i);
				}
			}
			else if( mode == LGraphPoints3D.SPHERE)
			{
				LGraphPoints3D.generateSphere( points, size, radius );
				if(normals)
					LGraphPoints3D.generateSphericalNormals( points, normals );
			}
			else if( mode == LGraphPoints3D.HEMISPHERE)
			{
				LGraphPoints3D.generateHemisphere( points, size, radius );
				if(normals)
					LGraphPoints3D.generateSphericalNormals( points, normals );
			}
			else if( mode == LGraphPoints3D.CIRCLE)
			{
				LGraphPoints3D.generateInsideCircle( points, size, radius );
				if(normals)
					LGraphPoints3D.generateSphericalNormals( points, normals );
			}
			else if( mode == LGraphPoints3D.INSIDE_SPHERE)
			{
				LGraphPoints3D.generateInsideSphere( points, size, radius );
				if(normals)
					LGraphPoints3D.generateSphericalNormals( points, normals );
			}
			else if( mode == LGraphPoints3D.OBJECT)
			{
				LGraphPoints3D.generateFromObject( points, normals, size, obj, false );
			}
			else if( mode == LGraphPoints3D.OBJECT_UNIFORMLY)
			{
				LGraphPoints3D.generateFromObject( points, normals, size, obj, true );
			}
			else if( mode == LGraphPoints3D.OBJECT_INSIDE)
			{
				LGraphPoints3D.generateFromInsideObject( points, size, obj );
				//if(normals)
				//	LGraphPoints3D.generateSphericalNormals( points, normals );
			}
			else
				console.warn("wrong mode in LGraphPoints3D");
		}

		return points;
	}

	LGraphPoints3D.generateSphericalNormals = function(points, normals)
	{
		var temp = new Float32Array(3);
		for(var i = 0; i < normals.length; i+=3)
		{
			temp[0] = points[i];
			temp[1] = points[i+1];
			temp[2] = points[i+2];
			vec3.normalize(temp,temp);
			normals.set(temp,i);
		}
	}

	LGraphPoints3D.generateSphere = function (points, size, radius)
	{
		for(var i = 0; i < size; i+=3)
		{
			var r1 = Math.random();
			var r2 = Math.random();
			var x = 2 * Math.cos( 2 * Math.PI * r1 ) * Math.sqrt( r2 * (1-r2) );
			var y = 1 - 2 * r2;
			var z = 2 * Math.sin( 2 * Math.PI * r1 ) * Math.sqrt( r2 * (1-r2) );
			points[i] = x * radius;
			points[i+1] = y * radius;
			points[i+2] = z * radius;
		}			
	}

	LGraphPoints3D.generateHemisphere = function (points, size, radius)
	{
		for(var i = 0; i < size; i+=3)
		{
			var r1 = Math.random();
			var r2 = Math.random();
			var x = Math.cos( 2 * Math.PI * r1 ) * Math.sqrt(1 - r2*r2 );
			var y = r2;
			var z = Math.sin( 2 * Math.PI * r1 ) * Math.sqrt(1 - r2*r2 );
			points[i] = x * radius;
			points[i+1] = y * radius;
			points[i+2] = z * radius;
		}
	}

	LGraphPoints3D.generateInsideCircle = function (points, size, radius)
	{
		for(var i = 0; i < size; i+=3)
		{
			var r1 = Math.random();
			var r2 = Math.random();
			var x = Math.cos( 2 * Math.PI * r1 ) * Math.sqrt(1 - r2*r2 );
			var y = r2;
			var z = Math.sin( 2 * Math.PI * r1 ) * Math.sqrt(1 - r2*r2 );
			points[i] = x * radius;
			points[i+1] = 0;
			points[i+2] = z * radius;
		}
	}

	LGraphPoints3D.generateInsideSphere = function (points, size, radius)
	{
		for(var i = 0; i < size; i+=3)
		{
			var u = Math.random();
			var v = Math.random();
			var theta = u * 2.0 * Math.PI;
			var phi = Math.acos(2.0 * v - 1.0);
			var r = Math.cbrt(Math.random()) * radius;
			var sinTheta = Math.sin(theta);
			var cosTheta = Math.cos(theta);
			var sinPhi = Math.sin(phi);
			var cosPhi = Math.cos(phi);
			points[i] = r * sinPhi * cosTheta;
			points[i+1] = r * sinPhi * sinTheta;
			points[i+2] = r * cosPhi;
		}	
	}

	function findRandomTriangle( areas, f )
	{
		var l = areas.length;
		var imin = 0;
		var imid = 0;
		var imax = l;

		if(l == 0)
			return -1;
		if(l == 1)
			return 0;
		//dichotimic search
		while (imax >= imin)
		{
			imid = ((imax + imin)*0.5)|0;
			var t = areas[ imid ];
			if( t == f )
				return imid; 
			if( imin == (imax - 1) )
				return imin;
			if (t < f)
				imin = imid;
			else         
				imax = imid;
		}
		return imid;		
	}

	LGraphPoints3D.generateFromObject = function( points, normals, size, obj, evenly )
	{
		if(!obj)
			return;

		var vertices = null;
		var mesh_normals = null;
		var indices = null;
		var areas = null;
		if( obj.constructor === GL.Mesh )
		{
			vertices = obj.vertexBuffers.vertices.data;
			mesh_normals = obj.vertexBuffers.normals ? obj.vertexBuffers.normals.data : null;
			indices = obj.indexBuffers.indices ? obj.indexBuffers.indices.data : null;
			if(!indices)
				indices = obj.indexBuffers.triangles ? obj.indexBuffers.triangles.data : null;
		}
		if(!vertices)
			return null;
		var num_triangles = indices ? indices.length / 3 : vertices.length / (3*3);
		var total_area = 0; //sum of areas of all triangles

		if(evenly)
		{
			areas = new Float32Array(num_triangles); //accum
			for(var i = 0; i < num_triangles; ++i)
			{
				if(indices)
				{
					a = indices[i*3]*3;
					b = indices[i*3+1]*3;
					c = indices[i*3+2]*3;
				}
				else
				{
					a = i*9;
					b = i*9+3;
					c = i*9+6;
				}
				var P1 = vertices.subarray(a,a+3);
				var P2 = vertices.subarray(b,b+3);
				var P3 = vertices.subarray(c,c+3);
				var aL = vec3.distance( P1, P2 );
				var bL = vec3.distance( P2, P3 );
				var cL = vec3.distance( P3, P1 );
				var s = (aL + bL+ cL) / 2;
				total_area += Math.sqrt(s * (s - aL) * (s - bL) * (s - cL));
				areas[i] = total_area;
			}			
			for(var i = 0; i < num_triangles; ++i) //normalize
				areas[i] /= total_area;
		}

		for(var i = 0; i < size; i+=3)
		{
			var r = Math.random();
			var index = evenly ? findRandomTriangle( areas, r ) : Math.floor(r * num_triangles );
			//get random triangle
			var a = 0;
			var b = 0;
			var c = 0;
			if(indices)
			{
				a = indices[index*3]*3;
				b = indices[index*3+1]*3;
				c = indices[index*3+2]*3;
			}
			else
			{
				a = index*9;
				b = index*9+3;
				c = index*9+6;
			}
			var s = Math.random();
			var t = Math.random();
			var sqrt_s = Math.sqrt(s);
			var af = 1 - sqrt_s;
			var bf = sqrt_s * ( 1 - t);
			var cf = t * sqrt_s;
			points[i] = af * vertices[a] + bf*vertices[b] + cf*vertices[c];
			points[i+1] = af * vertices[a+1] + bf*vertices[b+1] + cf*vertices[c+1];
			points[i+2] = af * vertices[a+2] + bf*vertices[b+2] + cf*vertices[c+2];
			if(normals && mesh_normals)
			{
				normals[i] = af * mesh_normals[a] + bf*mesh_normals[b] + cf*mesh_normals[c];
				normals[i+1] = af * mesh_normals[a+1] + bf*mesh_normals[b+1] + cf*mesh_normals[c+1];
				normals[i+2] = af * mesh_normals[a+2] + bf*mesh_normals[b+2] + cf*mesh_normals[c+2];
				var N = normals.subarray(i,i+3);
				vec3.normalize(N,N);
			}
		}
	}

	LGraphPoints3D.generateFromInsideObject = function( points, size, mesh )
	{
		if(!mesh || mesh.constructor !== GL.Mesh)
			return;

		var aabb = mesh.getBoundingBox();
		if(!mesh.octree)
			mesh.octree = new GL.Octree( mesh );
		var octree = mesh.octree;
		var origin = vec3.create();
		var direction = vec3.fromValues(1,0,0);
		var temp = vec3.create();
		var i = 0;
		var tries = 0;
		while(i < size && tries < points.length * 10) //limit to avoid problems
		{
			tries += 1
			var r = vec3.random(temp); //random point inside the aabb
			r[0] = (r[0] * 2 - 1) * aabb[3] + aabb[0];
			r[1] = (r[1] * 2 - 1) * aabb[4] + aabb[1];
			r[2] = (r[2] * 2 - 1) * aabb[5] + aabb[2];
			origin.set(r);
			var hit = octree.testRay( origin, direction, 0, 10000, true, GL.Octree.ALL );
			if(!hit || hit.length % 2 == 0) //not inside
				continue;
			points.set( r, i );
			i+=3;
		}
	}

	LiteGraph.registerNodeType( "geometry/points3D", LGraphPoints3D );



	function LGraphPointsToInstances() {
		this.addInput("points", "geometry");
		this.addOutput("instances", "[mat4]");
		this.properties = {
			mode: 1,
			autoupdate: true
		};

		this.must_update = true;
		this.matrices = [];
		this.first_time = true;
	}

	LGraphPointsToInstances.NORMAL = 0;
	LGraphPointsToInstances.VERTICAL = 1;
	LGraphPointsToInstances.SPHERICAL = 2;
	LGraphPointsToInstances.RANDOM = 3;
	LGraphPointsToInstances.RANDOM_VERTICAL = 4;

	LGraphPointsToInstances.modes = {"normal":0,"vertical":1,"spherical":2,"random":3,"random_vertical":4};
	LGraphPointsToInstances.widgets_info = {
		mode: { widget: "combo", values: LGraphPointsToInstances.modes }
	};

	LGraphPointsToInstances.title = "points to inst";

	LGraphPointsToInstances.prototype.onExecute = function()
	{
		var geo = this.getInputData(0);
		if( !geo )
		{
			this.setOutputData(0,null);
			return;
		}

		if( !this.isOutputConnected(0) )
			return;

		var has_changed = (geo._version != this._version || geo._id != this._geometry_id);

		if( has_changed && this.properties.autoupdate || this.first_time )
		{
			this.first_time = false;
			this.updateInstances( geo );
		}

		this.setOutputData( 0, this.matrices );
	}

	LGraphPointsToInstances.prototype.updateInstances = function( geometry )
	{
		var vertices = geometry.vertices;
		if(!vertices)
			return null;
		var normals = geometry.normals;

		var matrices = this.matrices;
		var num_points = vertices.length / 3;
		if( matrices.length != num_points)
			matrices.length = num_points;
		var identity = mat4.create();
		var temp = vec3.create();
		var zero = vec3.create();
		var UP = vec3.fromValues(0,1,0);
		var FRONT = vec3.fromValues(0,0,-1);
		var RIGHT = vec3.fromValues(1,0,0);
		var R = quat.create();

		var front = vec3.create();
		var right = vec3.create();
		var top = vec3.create();

		for(var i = 0; i < vertices.length; i += 3)
		{
			var index = i/3;
			var m = matrices[index];
			if(!m)
				m = matrices[index] = mat4.create();
			m.set( identity );
			var point = vertices.subarray(i,i+3);

			switch(this.properties.mode)
			{
				case LGraphPointsToInstances.NORMAL: 
					mat4.setTranslation( m, point );
					if(normals)
					{
						var normal = normals.subarray(i,i+3);
						top.set( normal );
						vec3.normalize( top, top );
						vec3.cross( right, FRONT, top );
						vec3.normalize( right, right );
						vec3.cross( front, right, top );
						vec3.normalize( front, front );
						m.set(right,0);
						m.set(top,4);
						m.set(front,8);
						mat4.setTranslation( m, point );
					}
					break;
				case LGraphPointsToInstances.VERTICAL: 
					mat4.setTranslation( m, point );
					break;
				case LGraphPointsToInstances.SPHERICAL: 
					front.set( point );
					vec3.normalize( front, front );
					vec3.cross( right, UP, front );
					vec3.normalize( right, right );
					vec3.cross( top, front, right );
					vec3.normalize( top, top );
					m.set(right,0);
					m.set(top,4);
					m.set(front,8);
					mat4.setTranslation( m, point );
					break;
				case LGraphPointsToInstances.RANDOM:
					temp[0] = Math.random()*2 - 1;
					temp[1] = Math.random()*2 - 1;
					temp[2] = Math.random()*2 - 1;
					vec3.normalize( temp, temp );
					quat.setAxisAngle( R, temp, Math.random() * 2 * Math.PI );
					mat4.fromQuat(m, R);
					mat4.setTranslation( m, point );
					break;
				case LGraphPointsToInstances.RANDOM_VERTICAL:
					quat.setAxisAngle( R, UP, Math.random() * 2 * Math.PI );
					mat4.fromQuat(m, R);
					mat4.setTranslation( m, point );
					break;
			}
		}

		this._version = geometry._version;
		this._geometry_id = geometry._id;
	}

	LiteGraph.registerNodeType( "geometry/points_to_instances", LGraphPointsToInstances );


	function LGraphGeometryTransform() {
		this.addInput("in", "geometry,[mat4]");
		this.addInput("mat4", "mat4");
		this.addOutput("out", "geometry");
		this.properties = {};

		this.geometry = {
			type: "triangles",
			vertices: null,
			_id: generateGeometryId(),
			_version: 0
		};

		this._last_geometry_id = -1;
		this._last_version = -1;
		this._last_key = "";

		this.must_update = true;
	}

	LGraphGeometryTransform.title = "Transform";

	LGraphGeometryTransform.prototype.onExecute = function() {

		var input = this.getInputData(0);
		var model = this.getInputData(1);

		if(!input)
			return;

		//array of matrices
		if(input.constructor === Array)
		{
			if(input.length == 0)
				return;
			this.outputs[0].type = "[mat4]";
			if( !this.isOutputConnected(0) )
				return;

			if(!model)
			{
				this.setOutputData(0,input);
				return;
			}

			if(!this._output)
				this._output = new Array();
			if(this._output.length != input.length)
				this._output.length = input.length;
			for(var i = 0; i < input.length; ++i)
			{
				var m = this._output[i];
				if(!m)
					m = this._output[i] = mat4.create();
				mat4.multiply(m,input[i],model);
			}
			this.setOutputData(0,this._output);
			return;
		}

		//geometry
		if(!input.vertices || !input.vertices.length)
			return;
		var geo = input;
		this.outputs[0].type = "geometry";
		if( !this.isOutputConnected(0) )
			return;
		if(!model)
		{
			this.setOutputData(0,geo);
			return;
		}

		var key = typedArrayToArray(model).join(",");

		if( this.must_update || geo._id != this._last_geometry_id || geo._version != this._last_version || key != this._last_key )
		{
			this.updateGeometry(geo, model);
			this._last_key = key;
			this._last_version = geo._version;
			this._last_geometry_id = geo._id;
			this.must_update = false;
		}

		this.setOutputData(0,this.geometry);
	}

	LGraphGeometryTransform.prototype.updateGeometry = function(geometry, model) {
		var old_vertices = geometry.vertices;
		var vertices = this.geometry.vertices;
		if( !vertices || vertices.length != old_vertices.length )
			vertices = this.geometry.vertices = new Float32Array( old_vertices.length );
		var temp = vec3.create();

		for(var i = 0, l = vertices.length; i < l; i+=3)
		{
			temp[0] = old_vertices[i]; temp[1] = old_vertices[i+1]; temp[2] = old_vertices[i+2]; 
			mat4.multiplyVec3( temp, model, temp );
			vertices[i] = temp[0]; vertices[i+1] = temp[1]; vertices[i+2] = temp[2];
		}

		if(geometry.normals)
		{
			if( !this.geometry.normals || this.geometry.normals.length != geometry.normals.length )
				this.geometry.normals = new Float32Array( geometry.normals.length );
			var normals = this.geometry.normals;
			var normal_model = mat4.invert(mat4.create(), model);
			if(normal_model)
				mat4.transpose(normal_model, normal_model);
			var old_normals = geometry.normals;
			for(var i = 0, l = normals.length; i < l; i+=3)
			{
				temp[0] = old_normals[i]; temp[1] = old_normals[i+1]; temp[2] = old_normals[i+2]; 
				mat4.multiplyVec3( temp, normal_model, temp );
				normals[i] = temp[0]; normals[i+1] = temp[1]; normals[i+2] = temp[2];
			}
		}

		this.geometry.type = geometry.type;
		this.geometry._version++;
	}

	LiteGraph.registerNodeType( "geometry/transform", LGraphGeometryTransform );


	function LGraphGeometryPolygon() {
		this.addInput("sides", "number");
		this.addInput("radius", "number");
		this.addOutput("out", "geometry");
		this.properties = { sides: 6, radius: 1, uvs: false }

		this.geometry = {
			type: "line_loop",
			vertices: null,
			_id: generateGeometryId()
		};
		this.geometry_id = -1;
		this.version = -1;
		this.must_update = true;

		this.last_info = { sides: -1, radius: -1 };
	}

	LGraphGeometryPolygon.title = "Polygon";

	LGraphGeometryPolygon.prototype.onExecute = function() {

		if( !this.isOutputConnected(0) )
			return;

		var sides = this.getInputOrProperty("sides");
		var radius = this.getInputOrProperty("radius");
		sides = Math.max(3,sides)|0;

		//update
		if( this.last_info.sides != sides || this.last_info.radius != radius )
			this.updateGeometry(sides, radius);

		this.setOutputData(0,this.geometry);
	}

	LGraphGeometryPolygon.prototype.updateGeometry = function(sides, radius) {
		var num = 3*sides;
		var vertices = this.geometry.vertices;
		if( !vertices || vertices.length != num )
			vertices = this.geometry.vertices = new Float32Array( 3*sides );
		var delta = (Math.PI * 2) / sides;
		var gen_uvs = this.properties.uvs;
		if(gen_uvs)
		{
			uvs = this.geometry.coords = new Float32Array( 3*sides );
		}


		for(var i = 0; i < sides; ++i)
		{
			var angle = delta * -i;
			var x = Math.cos( angle ) * radius;
			var y = 0;
			var z = Math.sin( angle ) * radius;
			vertices[i*3] = x;
			vertices[i*3+1] = y;
			vertices[i*3+2] = z;

			if(gen_uvs)
			{
				

			}
		}
		this.geometry._id = ++this.geometry_id;
		this.geometry._version = ++this.version;
		this.last_info.sides = sides;
		this.last_info.radius = radius;
	}

	LiteGraph.registerNodeType( "geometry/polygon", LGraphGeometryPolygon );


	function LGraphGeometryExtrude() {

		this.addInput("", "geometry");
		this.addOutput("", "geometry");
		this.properties = { top_cap: true, bottom_cap: true, offset: [0,100,0] };
		this.version = -1;

		this._last_geo_version = -1;
		this._must_update = true;
	}

	LGraphGeometryExtrude.title = "extrude";

	LGraphGeometryExtrude.prototype.onPropertyChanged = function(name, value)
	{
		this._must_update = true;
	}

	LGraphGeometryExtrude.prototype.onExecute = function()
	{
		var geo = this.getInputData(0);
		if( !geo || !this.isOutputConnected(0) )
			return;

		if(geo.version != this._last_geo_version || this._must_update)
		{
			this._geo = this.extrudeGeometry( geo, this._geo );
			if(this._geo)
				this._geo.version = this.version++;
			this._must_update = false;
		}

		this.setOutputData(0, this._geo);
	}

	LGraphGeometryExtrude.prototype.extrudeGeometry = function( geo )
	{
		//for every pair of vertices
		var vertices = geo.vertices;
		var num_points = vertices.length / 3;

		var tempA = vec3.create();
		var tempB = vec3.create();
		var tempC = vec3.create();
		var tempD = vec3.create();
		var offset = new Float32Array( this.properties.offset );

		if(geo.type == "line_loop")
		{
			var new_vertices = new Float32Array( num_points * 6 * 3 ); //every points become 6 ( caps not included )
			var npos = 0;
			for(var i = 0, l = vertices.length; i < l; i += 3)
			{
				tempA[0] = vertices[i]; tempA[1] = vertices[i+1]; tempA[2] = vertices[i+2];

				if( i+3 < l ) //loop
				{
					tempB[0] = vertices[i+3]; tempB[1] = vertices[i+4]; tempB[2] = vertices[i+5];
				}
				else
				{
					tempB[0] = vertices[0]; tempB[1] = vertices[1]; tempB[2] = vertices[2];
				}

				vec3.add( tempC, tempA, offset );
				vec3.add( tempD, tempB, offset );

				new_vertices.set( tempA, npos ); npos += 3;
				new_vertices.set( tempB, npos ); npos += 3;
				new_vertices.set( tempC, npos ); npos += 3;

				new_vertices.set( tempB, npos ); npos += 3;
				new_vertices.set( tempD, npos ); npos += 3;
				new_vertices.set( tempC, npos ); npos += 3;
			}
		}

		var out_geo = {
			_id: generateGeometryId(),
			type: "triangles",
			vertices: new_vertices
		};

		return out_geo;
	}

	LiteGraph.registerNodeType( "geometry/extrude", LGraphGeometryExtrude );


	function LGraphGeometryEval() {
		this.addInput("in", "geometry");
		this.addOutput("out", "geometry");

		this.properties = {
			code: "V[1] += 0.01 * Math.sin(I + T*0.001);",
			execute_every_frame: false
		};

		this.geometry = null;
		this.geometry_id = -1;
		this.version = -1;
		this.must_update = true;

		this.vertices = null;
		this.func = null;
	}

	LGraphGeometryEval.title = "geoeval";
	LGraphGeometryEval.desc = "eval code";

	LGraphGeometryEval.widgets_info = {
		code: { widget: "code" }
	};

	LGraphGeometryEval.prototype.onConfigure = function(o)
	{
		this.compileCode();
	}

	LGraphGeometryEval.prototype.compileCode = function()
	{
		if(!this.properties.code)
			return;

		try
		{
			this.func = new Function("V","I","T", this.properties.code); 
			this.boxcolor = "#AFA";
			this.must_update = true;
		}
		catch (err)
		{
			this.boxcolor = "red";
		}
	}

	LGraphGeometryEval.prototype.onPropertyChanged = function(name, value)
	{
		if(name == "code")
		{
			this.properties.code = value;
			this.compileCode();
		}
	}

	LGraphGeometryEval.prototype.onExecute = function() {
		var geometry = this.getInputData(0);
		if(!geometry)
			return;

		if(!this.func)
		{
			this.setOutputData(0,geometry);
			return;
		}

		if( this.geometry_id != geometry._id || this.version != geometry._version || this.must_update || this.properties.execute_every_frame )
		{
			this.must_update = false;
			this.geometry_id = geometry._id;
			if(this.properties.execute_every_frame)
				this.version++;
			else
				this.version = geometry._version;
			var func = this.func;
			var T = getTime();

			//clone
			if(!this.geometry)
				this.geometry = {};
			for(var i in geometry)
			{
				if(geometry[i] == null)
					continue;
				if( geometry[i].constructor == Float32Array )
					this.geometry[i] = new Float32Array( geometry[i] );
				else
					this.geometry[i] = geometry[i];
			}
			this.geometry._id = geometry._id;
			if(this.properties.execute_every_frame)
				this.geometry._version = this.version;
			else
				this.geometry._version = geometry._version + 1;

			var V = vec3.create();
			var vertices = this.vertices;
			if(!vertices || this.vertices.length != geometry.vertices.length)
				vertices = this.vertices = new Float32Array( geometry.vertices );
			else
				vertices.set( geometry.vertices );
			for(var i = 0; i < vertices.length; i+=3)
			{
				V[0] = vertices[i];
				V[1] = vertices[i+1];
				V[2] = vertices[i+2];
				func(V,i/3,T);
				vertices[i] = V[0];
				vertices[i+1] = V[1];
				vertices[i+2] = V[2];
			}
			this.geometry.vertices = vertices;
		}

		this.setOutputData(0,this.geometry);
	}

	LiteGraph.registerNodeType( "geometry/eval", LGraphGeometryEval );

/*
function LGraphGeometryDisplace() {
		this.addInput("in", "geometry");
		this.addInput("img", "image");
		this.addOutput("out", "geometry");

		this.properties = {
			grid_size: 1
		};

		this.geometry = null;
		this.geometry_id = -1;
		this.version = -1;
		this.must_update = true;

		this.vertices = null;
	}

	LGraphGeometryDisplace.title = "displace";
	LGraphGeometryDisplace.desc = "displace points";

	LGraphGeometryDisplace.prototype.onExecute = function() {
		var geometry = this.getInputData(0);
		var image = this.getInputData(1);
		if(!geometry)
			return;

		if(!image)
		{
			this.setOutputData(0,geometry);
			return;
		}

		if( this.geometry_id != geometry._id || this.version != geometry._version || this.must_update )
		{
			this.must_update = false;
			this.geometry_id = geometry._id;
			this.version = geometry._version;

			//copy
			this.geometry = {};
			for(var i in geometry)
				this.geometry[i] = geometry[i];
			this.geometry._id = geometry._id;
			this.geometry._version = geometry._version + 1;

			var grid_size = this.properties.grid_size;
			if(grid_size != 0)
			{
				var vertices = this.vertices;
				if(!vertices || this.vertices.length != this.geometry.vertices.length)
					vertices = this.vertices = new Float32Array( this.geometry.vertices );
				for(var i = 0; i < vertices.length; i+=3)
				{
					vertices[i] = Math.round(vertices[i]/grid_size) * grid_size;
					vertices[i+1] = Math.round(vertices[i+1]/grid_size) * grid_size;
					vertices[i+2] = Math.round(vertices[i+2]/grid_size) * grid_size;
				}
				this.geometry.vertices = vertices;
			}
		}

		this.setOutputData(0,this.geometry);
	}

	LiteGraph.registerNodeType( "geometry/displace", LGraphGeometryDisplace );
*/

	function LGraphConnectPoints() {
		this.addInput("in", "geometry");
		this.addOutput("out", "geometry");

		this.properties = {
			min_dist: 0.4,
			max_dist: 0.5,
			max_connections: 0,
			probability: 1
		};

		this.geometry_id = -1;
		this.version = -1;
		this.my_version = 1;
		this.must_update = true;
	}

	LGraphConnectPoints.title = "connect points";
	LGraphConnectPoints.desc = "adds indices between near points";

	LGraphConnectPoints.prototype.onPropertyChanged = function(name,value)
	{
		this.must_update = true;
	}

	LGraphConnectPoints.prototype.onExecute = function() {
		var geometry = this.getInputData(0);
		if(!geometry)
			return;

		if( this.geometry_id != geometry._id || this.version != geometry._version || this.must_update )
		{
			this.must_update = false;
			this.geometry_id = geometry._id;
			this.version = geometry._version;

			//copy
			this.geometry = {};
			for(var i in geometry)
				this.geometry[i] = geometry[i];
			this.geometry._id = generateGeometryId();
			this.geometry._version = this.my_version++;

			var vertices = geometry.vertices;
			var l = vertices.length;
			var min_dist = this.properties.min_dist;
			var max_dist = this.properties.max_dist;
			var probability = this.properties.probability;
			var max_connections = this.properties.max_connections;
			var indices = [];
			
			for(var i = 0; i < l; i+=3)
			{
				var x = vertices[i];
				var y = vertices[i+1];
				var z = vertices[i+2];
				var connections = 0;
				for(var j = i+3; j < l; j+=3)
				{
					var x2 = vertices[j];
					var y2 = vertices[j+1];
					var z2 = vertices[j+2];
					var dist = Math.sqrt( (x-x2)*(x-x2) + (y-y2)*(y-y2) + (z-z2)*(z-z2));
					if(dist > max_dist || dist < min_dist || (probability < 1 && probability < Math.random()) )
						continue;
					indices.push(i/3,j/3);
					connections += 1;
					if(max_connections && connections > max_connections)
						break;
				}
			}
			this.geometry.indices = this.indices = new Uint32Array(indices);
		}

		if(this.indices && this.indices.length)
		{
			this.geometry.indices = this.indices;
			this.setOutputData( 0, this.geometry );
		}
		else
			this.setOutputData( 0, null );
	}

	LiteGraph.registerNodeType( "geometry/connectPoints", LGraphConnectPoints );

    //Works with Litegl.js to create WebGL nodes
    if (typeof GL == "undefined") //LiteGL RELATED **********************************************
		return;

	function LGraphToGeometry() {
		this.addInput("mesh", "mesh");
		this.addOutput("out", "geometry");

		this.geometry = {};
		this.last_mesh = null;
	}

	LGraphToGeometry.title = "to geometry";
	LGraphToGeometry.desc = "converts a mesh to geometry";

	LGraphToGeometry.prototype.onExecute = function() {
		var mesh = this.getInputData(0);
		if(!mesh)
			return;

		if(mesh != this.last_mesh)
		{
			this.last_mesh = mesh;
			for(i in mesh.vertexBuffers)
			{
				var buffer = mesh.vertexBuffers[i];
				this.geometry[i] = buffer.data
			}
			if(mesh.indexBuffers["triangles"])
				this.geometry.indices = mesh.indexBuffers["triangles"].data;

			this.geometry._id = generateGeometryId();
			this.geometry._version = 0;
		}

		this.setOutputData(0,this.geometry);
		if(this.geometry)
			this.setOutputData(1,this.geometry.vertices);
	}

	LiteGraph.registerNodeType( "geometry/toGeometry", LGraphToGeometry );

	function LGraphGeometryToMesh() {
		this.addInput("in", "geometry");
		this.addOutput("mesh", "mesh");
		this.properties = {};
		this.version = -1;
		this.mesh = null;
	}

	LGraphGeometryToMesh.title = "Geo to Mesh";

	LGraphGeometryToMesh.prototype.updateMesh = function(geometry)
	{
		if(!this.mesh)
			this.mesh = new GL.Mesh();

		for(var i in geometry)
		{
			if(i[0] == "_")
				continue;

			var buffer_data = geometry[i];

			var info = GL.Mesh.common_buffers[i];
			if(!info && i != "indices") //unknown buffer
				continue;
			var spacing = info ? info.spacing : 3;
			var mesh_buffer = this.mesh.vertexBuffers[i];

			if(!mesh_buffer || mesh_buffer.data.length != buffer_data.length)
			{
				mesh_buffer = new GL.Buffer( i == "indices" ? GL.ELEMENT_ARRAY_BUFFER : GL.ARRAY_BUFFER, buffer_data, spacing, GL.DYNAMIC_DRAW );
			}
			else
			{
				mesh_buffer.data.set( buffer_data );
				mesh_buffer.upload(GL.DYNAMIC_DRAW);
			}

			this.mesh.addBuffer( i, mesh_buffer );
		}

		if(this.mesh.vertexBuffers.normals &&this.mesh.vertexBuffers.normals.data.length != this.mesh.vertexBuffers.vertices.data.length )
		{
			var n = new Float32Array([0,1,0]);
			var normals = new Float32Array( this.mesh.vertexBuffers.vertices.data.length );
			for(var i = 0; i < normals.length; i+= 3)
				normals.set( n, i );
			mesh_buffer = new GL.Buffer( GL.ARRAY_BUFFER, normals, 3 );
			this.mesh.addBuffer( "normals", mesh_buffer );
		}

		this.mesh.updateBoundingBox();
		this.geometry_id = this.mesh.id = geometry._id;
		this.version = this.mesh.version = geometry._version;
		return this.mesh;
	}

	LGraphGeometryToMesh.prototype.onExecute = function() {

		var geometry = this.getInputData(0);
		if(!geometry)
			return;
		if( this.version != geometry._version || this.geometry_id != geometry._id )
			this.updateMesh( geometry );
		this.setOutputData(0, this.mesh);
	}

	LiteGraph.registerNodeType( "geometry/toMesh", LGraphGeometryToMesh );

	function LGraphRenderMesh() {
		this.addInput("mesh", "mesh");
		this.addInput("mat4", "mat4");
		this.addInput("tex", "texture");

		this.properties = {
			enabled: true,
			primitive: GL.TRIANGLES,
			additive: false,
			color: [1,1,1],
			opacity: 1
		};

		this.color = vec4.create([1,1,1,1]);
		this.model_matrix = mat4.create();
		this.uniforms = {
			u_color: this.color,
			u_model: this.model_matrix
		};
	}

	LGraphRenderMesh.title = "Render Mesh";
	LGraphRenderMesh.desc = "renders a mesh flat";

	LGraphRenderMesh.PRIMITIVE_VALUES = { "points":GL.POINTS, "lines":GL.LINES, "line_loop":GL.LINE_LOOP,"line_strip":GL.LINE_STRIP, "triangles":GL.TRIANGLES, "triangle_fan":GL.TRIANGLE_FAN, "triangle_strip":GL.TRIANGLE_STRIP };

	LGraphRenderMesh.widgets_info = {
		primitive: { widget: "combo", values: LGraphRenderMesh.PRIMITIVE_VALUES },
		color: { widget: "color" }
	};

	LGraphRenderMesh.prototype.onExecute = function() {

		if(!this.properties.enabled)
			return;

		var mesh = this.getInputData(0);
		if(!mesh)
			return;

		if(!LiteGraph.LGraphRender.onRequestCameraMatrices)
		{
			console.warn("cannot render geometry, LiteGraph.onRequestCameraMatrices is null, remember to fill this with a callback(view_matrix, projection_matrix,viewprojection_matrix) to use 3D rendering from the graph");
			return;
		}

		LiteGraph.LGraphRender.onRequestCameraMatrices( view_matrix, projection_matrix,viewprojection_matrix );
		var shader = null;
		var texture = this.getInputData(2);
		if(texture)
		{
			shader = gl.shaders["textured"];
			if(!shader)
				shader = gl.shaders["textured"] = new GL.Shader( LGraphRenderPoints.vertex_shader_code, LGraphRenderPoints.fragment_shader_code, { USE_TEXTURE:"" });
		}
		else
		{
			shader = gl.shaders["flat"];
			if(!shader)
				shader = gl.shaders["flat"] = new GL.Shader( LGraphRenderPoints.vertex_shader_code, LGraphRenderPoints.fragment_shader_code );
		}

		this.color.set( this.properties.color );
		this.color[3] = this.properties.opacity;

		var model_matrix = this.model_matrix;
		var m = this.getInputData(1);
		if(m)
			model_matrix.set(m);
		else
			mat4.identity( model_matrix );

		this.uniforms.u_point_size = 1;
		var primitive = this.properties.primitive;

		shader.uniforms( global_uniforms );
		shader.uniforms( this.uniforms );

		if(this.properties.opacity >= 1)
			gl.disable( gl.BLEND );
		else
			gl.enable( gl.BLEND );
		gl.enable( gl.DEPTH_TEST );
		if( this.properties.additive )
		{
			gl.blendFunc( gl.SRC_ALPHA, gl.ONE );
			gl.depthMask( false );
		}
		else
			gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );

		var indices = "indices";
		if( mesh.indexBuffers.triangles )
			indices = "triangles";
		shader.draw( mesh, primitive, indices );
		gl.disable( gl.BLEND );
		gl.depthMask( true );
	}

	LiteGraph.registerNodeType( "geometry/render_mesh", LGraphRenderMesh );

	//**************************


	function LGraphGeometryPrimitive() {
		this.addInput("size", "number");
		this.addOutput("out", "mesh");
		this.properties = { type: 1, size: 1, subdivisions: 32 };

		this.version = (Math.random() * 100000)|0;
		this.last_info = { type: -1, size: -1, subdivisions: -1 };
	}

	LGraphGeometryPrimitive.title = "Primitive";

	LGraphGeometryPrimitive.VALID = { "CUBE":1, "PLANE":2, "CYLINDER":3, "SPHERE":4, "CIRCLE":5, "HEMISPHERE":6, "ICOSAHEDRON":7, "CONE":8, "QUAD":9 };
	LGraphGeometryPrimitive.widgets_info = {
		type: { widget: "combo", values: LGraphGeometryPrimitive.VALID }
	};

	LGraphGeometryPrimitive.prototype.onExecute = function() {

		if( !this.isOutputConnected(0) )
			return;

		var size = this.getInputOrProperty("size");

		//update
		if( this.last_info.type != this.properties.type || this.last_info.size != size || this.last_info.subdivisions != this.properties.subdivisions )
			this.updateMesh( this.properties.type, size, this.properties.subdivisions );

		this.setOutputData(0,this._mesh);
	}

	LGraphGeometryPrimitive.prototype.updateMesh = function(type, size, subdivisions)
	{
		subdivisions = Math.max(0,subdivisions)|0;

		switch (type)
		{
			case 1: //CUBE: 
				this._mesh = GL.Mesh.cube({size: size, normals:true,coords:true});
				break;
			case 2: //PLANE:
				this._mesh = GL.Mesh.plane({size: size, xz: true, detail: subdivisions, normals:true,coords:true});
				break;
			case 3: //CYLINDER:
				this._mesh = GL.Mesh.cylinder({size: size, subdivisions: subdivisions, normals:true,coords:true});
				break;
			case 4: //SPHERE:
				this._mesh = GL.Mesh.sphere({size: size, "long": subdivisions, lat: subdivisions, normals:true,coords:true});
				break;
			case 5: //CIRCLE:
				this._mesh = GL.Mesh.circle({size: size, slices: subdivisions, normals:true, coords:true});
				break;
			case 6: //HEMISPHERE:
				this._mesh = GL.Mesh.sphere({size: size, "long": subdivisions, lat: subdivisions, normals:true, coords:true, hemi: true});
				break;
			case 7: //ICOSAHEDRON:
				this._mesh = GL.Mesh.icosahedron({size: size, subdivisions:subdivisions });
				break;
			case 8: //CONE:
				this._mesh = GL.Mesh.cone({radius: size, height: size, subdivisions:subdivisions });
				break;
			case 9: //QUAD:
				this._mesh = GL.Mesh.plane({size: size, xz: false, detail: subdivisions, normals:true, coords:true });
				break;
		}

		this.last_info.type = type;
		this.last_info.size = size;
		this.last_info.subdivisions = subdivisions;
		this._mesh.version = this.version++;
	}

	LiteGraph.registerNodeType( "geometry/mesh_primitive", LGraphGeometryPrimitive );


	function LGraphRenderPoints() {
		this.addInput("in", "geometry");
		this.addInput("mat4", "mat4");
		this.addInput("tex", "texture");
		this.properties = {
			enabled: true,
			point_size: 0.1,
			fixed_size: false,
			additive: true,
			color: [1,1,1],
			opacity: 1
		};

		this.color = vec4.create([1,1,1,1]);

		this.uniforms = {
			u_point_size: 1,
			u_perspective: 1,
			u_point_perspective: 1,
			u_color: this.color
		};

		this.geometry_id = -1;
		this.version = -1;
		this.mesh = null;
	}

	LGraphRenderPoints.title = "renderPoints";
	LGraphRenderPoints.desc = "render points with a texture";

	LGraphRenderPoints.widgets_info = {
		color: { widget: "color" }
	};

	LGraphRenderPoints.prototype.updateMesh = function(geometry)
	{
		var buffer = this.buffer;
		if(!this.buffer || !this.buffer.data || this.buffer.data.length != geometry.vertices.length)
			this.buffer = new GL.Buffer( GL.ARRAY_BUFFER, geometry.vertices,3,GL.DYNAMIC_DRAW);
		else
		{
			this.buffer.data.set( geometry.vertices );
			this.buffer.upload(GL.DYNAMIC_DRAW);
		}

		if(!this.mesh)
			this.mesh = new GL.Mesh();

		this.mesh.addBuffer("vertices",this.buffer);
		this.geometry_id = this.mesh.id = geometry._id;
		this.version = this.mesh.version = geometry._version;
	}

	LGraphRenderPoints.prototype.onExecute = function() {

		if(!this.properties.enabled)
			return;

		var geometry = this.getInputData(0);
		if(!geometry)
			return;
		if(this.version != geometry._version || this.geometry_id != geometry._id )
			this.updateMesh( geometry );

		if(!LiteGraph.LGraphRender.onRequestCameraMatrices)
		{
			console.warn("cannot render geometry, LiteGraph.onRequestCameraMatrices is null, remember to fill this with a callback(view_matrix, projection_matrix,viewprojection_matrix) to use 3D rendering from the graph");
			return;
		}

		LiteGraph.LGraphRender.onRequestCameraMatrices( view_matrix, projection_matrix,viewprojection_matrix );
		var shader = null;

		var texture = this.getInputData(2);
		
		if(texture)
		{
			shader = gl.shaders["textured_points"];
			if(!shader)
				shader = gl.shaders["textured_points"] = new GL.Shader( LGraphRenderPoints.vertex_shader_code, LGraphRenderPoints.fragment_shader_code, { USE_TEXTURED_POINTS:"" });
		}
		else
		{
			shader = gl.shaders["points"];
			if(!shader)
				shader = gl.shaders["points"] = new GL.Shader( LGraphRenderPoints.vertex_shader_code, LGraphRenderPoints.fragment_shader_code, { USE_POINTS: "" });
		}

		this.color.set( this.properties.color );
		this.color[3] = this.properties.opacity;

		var m = this.getInputData(1);
		if(m)
			model_matrix.set(m);
		else
			mat4.identity( model_matrix );

		this.uniforms.u_point_size = this.properties.point_size;
		this.uniforms.u_point_perspective = this.properties.fixed_size ? 0 : 1;
		this.uniforms.u_perspective = gl.viewport_data[3] * projection_matrix[5];

		shader.uniforms( global_uniforms );
		shader.uniforms( this.uniforms );

		if(this.properties.opacity >= 1)
			gl.disable( gl.BLEND );
		else
			gl.enable( gl.BLEND );

		gl.enable( gl.DEPTH_TEST );
		if( this.properties.additive )
		{
			gl.blendFunc( gl.SRC_ALPHA, gl.ONE );
			gl.depthMask( false );
		}
		else
			gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );

		shader.draw( this.mesh, GL.POINTS );

		gl.disable( gl.BLEND );
		gl.depthMask( true );
	}

	LiteGraph.registerNodeType( "geometry/render_points", LGraphRenderPoints );

	LGraphRenderPoints.vertex_shader_code = '\
		precision mediump float;\n\
		attribute vec3 a_vertex;\n\
		varying vec3 v_vertex;\n\
		attribute vec3 a_normal;\n\
		varying vec3 v_normal;\n\
		#ifdef USE_COLOR\n\
			attribute vec4 a_color;\n\
			varying vec4 v_color;\n\
		#endif\n\
		attribute vec2 a_coord;\n\
		varying vec2 v_coord;\n\
		#ifdef USE_SIZE\n\
			attribute float a_extra;\n\
		#endif\n\
		#ifdef USE_INSTANCING\n\
			attribute mat4 u_model;\n\
		#else\n\
			uniform mat4 u_model;\n\
		#endif\n\
		uniform mat4 u_viewprojection;\n\
		uniform float u_point_size;\n\
		uniform float u_perspective;\n\
		uniform float u_point_perspective;\n\
		float computePointSize(float radius, float w)\n\
		{\n\
			if(radius < 0.0)\n\
				return -radius;\n\
			return u_perspective * radius / w;\n\
		}\n\
		void main() {\n\
			v_coord = a_coord;\n\
			#ifdef USE_COLOR\n\
				v_color = a_color;\n\
			#endif\n\
			v_vertex = ( u_model * vec4( a_vertex, 1.0 )).xyz;\n\
			v_normal = ( u_model * vec4( a_normal, 0.0 )).xyz;\n\
			gl_Position = u_viewprojection * vec4(v_vertex,1.0);\n\
			gl_PointSize = u_point_size;\n\
			#ifdef USE_SIZE\n\
				gl_PointSize = a_extra;\n\
			#endif\n\
			if(u_point_perspective != 0.0)\n\
				gl_PointSize = computePointSize( gl_PointSize, gl_Position.w );\n\
		}\
	';

	LGraphRenderPoints.fragment_shader_code = '\
		precision mediump float;\n\
		uniform vec4 u_color;\n\
		#ifdef USE_COLOR\n\
			varying vec4 v_color;\n\
		#endif\n\
		varying vec2 v_coord;\n\
		uniform sampler2D u_texture;\n\
		void main() {\n\
			vec4 color = u_color;\n\
			#ifdef USE_TEXTURED_POINTS\n\
				color *= texture2D(u_texture, gl_PointCoord.xy);\n\
			#else\n\
				#ifdef USE_TEXTURE\n\
				  color *= texture2D(u_texture, v_coord);\n\
				  if(color.a < 0.1)\n\
					discard;\n\
				#endif\n\
				#ifdef USE_POINTS\n\
					float dist = length( gl_PointCoord.xy - vec2(0.5) );\n\
					if( dist > 0.45 )\n\
						discard;\n\
				#endif\n\
			#endif\n\
			#ifdef USE_COLOR\n\
				color *= v_color;\n\
			#endif\n\
			gl_FragColor = color;\n\
		}\
	';

	//based on https://inconvergent.net/2019/depth-of-field/
	/*
	function LGraphRenderGeometryDOF() {
		this.addInput("in", "geometry");
		this.addInput("mat4", "mat4");
		this.addInput("tex", "texture");
		this.properties = {
			enabled: true,
			lines: true,
			point_size: 0.1,
			fixed_size: false,
			additive: true,
			color: [1,1,1],
			opacity: 1
		};

		this.color = vec4.create([1,1,1,1]);

		this.uniforms = {
			u_point_size: 1,
			u_perspective: 1,
			u_point_perspective: 1,
			u_color: this.color
		};

		this.geometry_id = -1;
		this.version = -1;
		this.mesh = null;
	}

	LGraphRenderGeometryDOF.widgets_info = {
		color: { widget: "color" }
	};

	LGraphRenderGeometryDOF.prototype.updateMesh = function(geometry)
	{
		var buffer = this.buffer;
		if(!this.buffer || this.buffer.data.length != geometry.vertices.length)
			this.buffer = new GL.Buffer( GL.ARRAY_BUFFER, geometry.vertices,3,GL.DYNAMIC_DRAW);
		else
		{
			this.buffer.data.set( geometry.vertices );
			this.buffer.upload(GL.DYNAMIC_DRAW);
		}

		if(!this.mesh)
			this.mesh = new GL.Mesh();

		this.mesh.addBuffer("vertices",this.buffer);
		this.geometry_id = this.mesh.id = geometry._id;
		this.version = this.mesh.version = geometry._version;
	}

	LGraphRenderGeometryDOF.prototype.onExecute = function() {

		if(!this.properties.enabled)
			return;

		var geometry = this.getInputData(0);
		if(!geometry)
			return;
		if(this.version != geometry._version || this.geometry_id != geometry._id )
			this.updateMesh( geometry );

		if(!LiteGraph.LGraphRender.onRequestCameraMatrices)
		{
			console.warn("cannot render geometry, LiteGraph.onRequestCameraMatrices is null, remember to fill this with a callback(view_matrix, projection_matrix,viewprojection_matrix) to use 3D rendering from the graph");
			return;
		}

		LiteGraph.LGraphRender.onRequestCameraMatrices( view_matrix, projection_matrix,viewprojection_matrix );
		var shader = null;

		var texture = this.getInputData(2);
		
		if(texture)
		{
			shader = gl.shaders["textured_points"];
			if(!shader)
				shader = gl.shaders["textured_points"] = new GL.Shader( LGraphRenderGeometryDOF.vertex_shader_code, LGraphRenderGeometryDOF.fragment_shader_code, { USE_TEXTURED_POINTS:"" });
		}
		else
		{
			shader = gl.shaders["points"];
			if(!shader)
				shader = gl.shaders["points"] = new GL.Shader( LGraphRenderGeometryDOF.vertex_shader_code, LGraphRenderGeometryDOF.fragment_shader_code, { USE_POINTS: "" });
		}

		this.color.set( this.properties.color );
		this.color[3] = this.properties.opacity;

		var m = this.getInputData(1);
		if(m)
			model_matrix.set(m);
		else
			mat4.identity( model_matrix );

		this.uniforms.u_point_size = this.properties.point_size;
		this.uniforms.u_point_perspective = this.properties.fixed_size ? 0 : 1;
		this.uniforms.u_perspective = gl.viewport_data[3] * projection_matrix[5];

		shader.uniforms( global_uniforms );
		shader.uniforms( this.uniforms );

		if(this.properties.opacity >= 1)
			gl.disable( gl.BLEND );
		else
			gl.enable( gl.BLEND );

		gl.enable( gl.DEPTH_TEST );
		if( this.properties.additive )
		{
			gl.blendFunc( gl.SRC_ALPHA, gl.ONE );
			gl.depthMask( false );
		}
		else
			gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );

		shader.draw( this.mesh, GL.POINTS );

		gl.disable( gl.BLEND );
		gl.depthMask( true );
	}

	LiteGraph.registerNodeType( "geometry/render_dof", LGraphRenderGeometryDOF );

	LGraphRenderGeometryDOF.vertex_shader_code = '\
		precision mediump float;\n\
		attribute vec3 a_vertex;\n\
		varying vec3 v_vertex;\n\
		attribute vec3 a_normal;\n\
		varying vec3 v_normal;\n\
		#ifdef USE_COLOR\n\
			attribute vec4 a_color;\n\
			varying vec4 v_color;\n\
		#endif\n\
		attribute vec2 a_coord;\n\
		varying vec2 v_coord;\n\
		#ifdef USE_SIZE\n\
			attribute float a_extra;\n\
		#endif\n\
		#ifdef USE_INSTANCING\n\
			attribute mat4 u_model;\n\
		#else\n\
			uniform mat4 u_model;\n\
		#endif\n\
		uniform mat4 u_viewprojection;\n\
		uniform float u_point_size;\n\
		uniform float u_perspective;\n\
		uniform float u_point_perspective;\n\
		float computePointSize(float radius, float w)\n\
		{\n\
			if(radius < 0.0)\n\
				return -radius;\n\
			return u_perspective * radius / w;\n\
		}\n\
		void main() {\n\
			v_coord = a_coord;\n\
			#ifdef USE_COLOR\n\
				v_color = a_color;\n\
			#endif\n\
			v_vertex = ( u_model * vec4( a_vertex, 1.0 )).xyz;\n\
			v_normal = ( u_model * vec4( a_normal, 0.0 )).xyz;\n\
			gl_Position = u_viewprojection * vec4(v_vertex,1.0);\n\
			gl_PointSize = u_point_size;\n\
			#ifdef USE_SIZE\n\
				gl_PointSize = a_extra;\n\
			#endif\n\
			if(u_point_perspective != 0.0)\n\
				gl_PointSize = computePointSize( gl_PointSize, gl_Position.w );\n\
		}\
	';

	LGraphRenderGeometryDOF.fragment_shader_code = '\
		precision mediump float;\n\
		uniform vec4 u_color;\n\
		#ifdef USE_COLOR\n\
			varying vec4 v_color;\n\
		#endif\n\
		varying vec2 v_coord;\n\
		uniform sampler2D u_texture;\n\
		void main() {\n\
			vec4 color = u_color;\n\
			#ifdef USE_TEXTURED_POINTS\n\
				color *= texture2D(u_texture, gl_PointCoord.xy);\n\
			#else\n\
				#ifdef USE_TEXTURE\n\
				  color *= texture2D(u_texture, v_coord);\n\
				  if(color.a < 0.1)\n\
					discard;\n\
				#endif\n\
				#ifdef USE_POINTS\n\
					float dist = length( gl_PointCoord.xy - vec2(0.5) );\n\
					if( dist > 0.45 )\n\
						discard;\n\
				#endif\n\
			#endif\n\
			#ifdef USE_COLOR\n\
				color *= v_color;\n\
			#endif\n\
			gl_FragColor = color;\n\
		}\
	';
	*/



})(this);
(function(global) {
    var LiteGraph = global.LiteGraph;
    var LGraphTexture = global.LGraphTexture;

    //Works with Litegl.js to create WebGL nodes
    if (typeof GL != "undefined") {
        // Texture Lens *****************************************
        function LGraphFXLens() {
            this.addInput("Texture", "Texture");
            this.addInput("Aberration", "number");
            this.addInput("Distortion", "number");
            this.addInput("Blur", "number");
            this.addOutput("Texture", "Texture");
            this.properties = {
                aberration: 1.0,
                distortion: 1.0,
                blur: 1.0,
                precision: LGraphTexture.DEFAULT
            };

            if (!LGraphFXLens._shader) {
                LGraphFXLens._shader = new GL.Shader(
                    GL.Shader.SCREEN_VERTEX_SHADER,
                    LGraphFXLens.pixel_shader
                );
                LGraphFXLens._texture = new GL.Texture(3, 1, {
                    format: gl.RGB,
                    wrap: gl.CLAMP_TO_EDGE,
                    magFilter: gl.LINEAR,
                    minFilter: gl.LINEAR,
                    pixel_data: [255, 0, 0, 0, 255, 0, 0, 0, 255]
                });
            }
        }

        LGraphFXLens.title = "Lens";
        LGraphFXLens.desc = "Camera Lens distortion";
        LGraphFXLens.widgets_info = {
            precision: { widget: "combo", values: LGraphTexture.MODE_VALUES }
        };

        LGraphFXLens.prototype.onExecute = function() {
            var tex = this.getInputData(0);
            if (this.properties.precision === LGraphTexture.PASS_THROUGH) {
                this.setOutputData(0, tex);
                return;
            }

            if (!tex) {
                return;
            }

            this._tex = LGraphTexture.getTargetTexture(
                tex,
                this._tex,
                this.properties.precision
            );

            var aberration = this.properties.aberration;
            if (this.isInputConnected(1)) {
                aberration = this.getInputData(1);
                this.properties.aberration = aberration;
            }

            var distortion = this.properties.distortion;
            if (this.isInputConnected(2)) {
                distortion = this.getInputData(2);
                this.properties.distortion = distortion;
            }

            var blur = this.properties.blur;
            if (this.isInputConnected(3)) {
                blur = this.getInputData(3);
                this.properties.blur = blur;
            }

            gl.disable(gl.BLEND);
            gl.disable(gl.DEPTH_TEST);
            var mesh = Mesh.getScreenQuad();
            var shader = LGraphFXLens._shader;
            //var camera = LS.Renderer._current_camera;

            this._tex.drawTo(function() {
                tex.bind(0);
                shader
                    .uniforms({
                        u_texture: 0,
                        u_aberration: aberration,
                        u_distortion: distortion,
                        u_blur: blur
                    })
                    .draw(mesh);
            });

            this.setOutputData(0, this._tex);
        };

        LGraphFXLens.pixel_shader =
            "precision highp float;\n\
			precision highp float;\n\
			varying vec2 v_coord;\n\
			uniform sampler2D u_texture;\n\
			uniform vec2 u_camera_planes;\n\
			uniform float u_aberration;\n\
			uniform float u_distortion;\n\
			uniform float u_blur;\n\
			\n\
			void main() {\n\
				vec2 coord = v_coord;\n\
				float dist = distance(vec2(0.5), coord);\n\
				vec2 dist_coord = coord - vec2(0.5);\n\
				float percent = 1.0 + ((0.5 - dist) / 0.5) * u_distortion;\n\
				dist_coord *= percent;\n\
				coord = dist_coord + vec2(0.5);\n\
				vec4 color = texture2D(u_texture,coord, u_blur * dist);\n\
				color.r = texture2D(u_texture,vec2(0.5) + dist_coord * (1.0+0.01*u_aberration), u_blur * dist ).r;\n\
				color.b = texture2D(u_texture,vec2(0.5) + dist_coord * (1.0-0.01*u_aberration), u_blur * dist ).b;\n\
				gl_FragColor = color;\n\
			}\n\
			";
        /*
			float normalized_tunable_sigmoid(float xs, float k)\n\
			{\n\
				xs = xs * 2.0 - 1.0;\n\
				float signx = sign(xs);\n\
				float absx = abs(xs);\n\
				return signx * ((-k - 1.0)*absx)/(2.0*(-2.0*k*absx+k-1.0)) + 0.5;\n\
			}\n\
		*/

        LiteGraph.registerNodeType("fx/lens", LGraphFXLens);
        global.LGraphFXLens = LGraphFXLens;

        /* not working yet
	function LGraphDepthOfField()
	{
		this.addInput("Color","Texture");
		this.addInput("Linear Depth","Texture");
		this.addInput("Camera","camera");
		this.addOutput("Texture","Texture");
		this.properties = { high_precision: false };
	}

	LGraphDepthOfField.title = "Depth Of Field";
	LGraphDepthOfField.desc = "Applies a depth of field effect";

	LGraphDepthOfField.prototype.onExecute = function()
	{
		var tex = this.getInputData(0);
		var depth = this.getInputData(1);
		var camera = this.getInputData(2);

		if(!tex || !depth || !camera) 
		{
			this.setOutputData(0, tex);
			return;
		}

		var precision = gl.UNSIGNED_BYTE;
		if(this.properties.high_precision)
			precision = gl.half_float_ext ? gl.HALF_FLOAT_OES : gl.FLOAT;			
		if(!this._temp_texture || this._temp_texture.type != precision ||
			this._temp_texture.width != tex.width || this._temp_texture.height != tex.height)
			this._temp_texture = new GL.Texture( tex.width, tex.height, { type: precision, format: gl.RGBA, filter: gl.LINEAR });

		var shader = LGraphDepthOfField._shader = new GL.Shader( GL.Shader.SCREEN_VERTEX_SHADER, LGraphDepthOfField._pixel_shader );

		var screen_mesh = Mesh.getScreenQuad();

		gl.disable( gl.DEPTH_TEST );
		gl.disable( gl.BLEND );

		var camera_position = camera.getEye();
		var focus_point = camera.getCenter();
		var distance = vec3.distance( camera_position, focus_point );
		var far = camera.far;
		var focus_range = distance * 0.5;

		this._temp_texture.drawTo( function() {
			tex.bind(0);
			depth.bind(1);
			shader.uniforms({u_texture:0, u_depth_texture:1, u_resolution: [1/tex.width, 1/tex.height], u_far: far, u_focus_point: distance, u_focus_scale: focus_range }).draw(screen_mesh);
		});

		this.setOutputData(0, this._temp_texture);
	}

	//from http://tuxedolabs.blogspot.com.es/2018/05/bokeh-depth-of-field-in-single-pass.html
	LGraphDepthOfField._pixel_shader = "\n\
		precision highp float;\n\
		varying vec2 v_coord;\n\
		uniform sampler2D u_texture; //Image to be processed\n\
		uniform sampler2D u_depth_texture; //Linear depth, where 1.0 == far plane\n\
		uniform vec2 u_iresolution; //The size of a pixel: vec2(1.0/width, 1.0/height)\n\
		uniform float u_far; // Far plane\n\
		uniform float u_focus_point;\n\
		uniform float u_focus_scale;\n\
		\n\
		const float GOLDEN_ANGLE = 2.39996323;\n\
		const float MAX_BLUR_SIZE = 20.0;\n\
		const float RAD_SCALE = 0.5; // Smaller = nicer blur, larger = faster\n\
		\n\
		float getBlurSize(float depth, float focusPoint, float focusScale)\n\
		{\n\
		 float coc = clamp((1.0 / focusPoint - 1.0 / depth)*focusScale, -1.0, 1.0);\n\
		 return abs(coc) * MAX_BLUR_SIZE;\n\
		}\n\
		\n\
		vec3 depthOfField(vec2 texCoord, float focusPoint, float focusScale)\n\
		{\n\
		 float centerDepth = texture2D(u_depth_texture, texCoord).r * u_far;\n\
		 float centerSize = getBlurSize(centerDepth, focusPoint, focusScale);\n\
		 vec3 color = texture2D(u_texture, v_coord).rgb;\n\
		 float tot = 1.0;\n\
		\n\
		 float radius = RAD_SCALE;\n\
		 for (float ang = 0.0; ang < 100.0; ang += GOLDEN_ANGLE)\n\
		 {\n\
		  vec2 tc = texCoord + vec2(cos(ang), sin(ang)) * u_iresolution * radius;\n\
			\n\
		  vec3 sampleColor = texture2D(u_texture, tc).rgb;\n\
		  float sampleDepth = texture2D(u_depth_texture, tc).r * u_far;\n\
		  float sampleSize = getBlurSize( sampleDepth, focusPoint, focusScale );\n\
		  if (sampleDepth > centerDepth)\n\
		   sampleSize = clamp(sampleSize, 0.0, centerSize*2.0);\n\
			\n\
		  float m = smoothstep(radius-0.5, radius+0.5, sampleSize);\n\
		  color += mix(color/tot, sampleColor, m);\n\
		  tot += 1.0;\n\
		  radius += RAD_SCALE/radius;\n\
		  if(radius>=MAX_BLUR_SIZE)\n\
			 return color / tot;\n\
		 }\n\
		 return color / tot;\n\
		}\n\
		void main()\n\
		{\n\
			gl_FragColor = vec4( depthOfField( v_coord, u_focus_point, u_focus_scale ), 1.0 );\n\
			//gl_FragColor = vec4( texture2D(u_depth_texture, v_coord).r );\n\
		}\n\
		";

	LiteGraph.registerNodeType("fx/DOF", LGraphDepthOfField );
	global.LGraphDepthOfField = LGraphDepthOfField;
	*/

        //*******************************************************

        function LGraphFXBokeh() {
            this.addInput("Texture", "Texture");
            this.addInput("Blurred", "Texture");
            this.addInput("Mask", "Texture");
            this.addInput("Threshold", "number");
            this.addOutput("Texture", "Texture");
            this.properties = {
                shape: "",
                size: 10,
                alpha: 1.0,
                threshold: 1.0,
                high_precision: false
            };
        }

        LGraphFXBokeh.title = "Bokeh";
        LGraphFXBokeh.desc = "applies an Bokeh effect";

        LGraphFXBokeh.widgets_info = { shape: { widget: "texture" } };

        LGraphFXBokeh.prototype.onExecute = function() {
            var tex = this.getInputData(0);
            var blurred_tex = this.getInputData(1);
            var mask_tex = this.getInputData(2);
            if (!tex || !mask_tex || !this.properties.shape) {
                this.setOutputData(0, tex);
                return;
            }

            if (!blurred_tex) {
                blurred_tex = tex;
            }

            var shape_tex = LGraphTexture.getTexture(this.properties.shape);
            if (!shape_tex) {
                return;
            }

            var threshold = this.properties.threshold;
            if (this.isInputConnected(3)) {
                threshold = this.getInputData(3);
                this.properties.threshold = threshold;
            }

            var precision = gl.UNSIGNED_BYTE;
            if (this.properties.high_precision) {
                precision = gl.half_float_ext ? gl.HALF_FLOAT_OES : gl.FLOAT;
            }
            if (
                !this._temp_texture ||
                this._temp_texture.type != precision ||
                this._temp_texture.width != tex.width ||
                this._temp_texture.height != tex.height
            ) {
                this._temp_texture = new GL.Texture(tex.width, tex.height, {
                    type: precision,
                    format: gl.RGBA,
                    filter: gl.LINEAR
                });
            }

            //iterations
            var size = this.properties.size;

            var first_shader = LGraphFXBokeh._first_shader;
            if (!first_shader) {
                first_shader = LGraphFXBokeh._first_shader = new GL.Shader(
                    Shader.SCREEN_VERTEX_SHADER,
                    LGraphFXBokeh._first_pixel_shader
                );
            }

            var second_shader = LGraphFXBokeh._second_shader;
            if (!second_shader) {
                second_shader = LGraphFXBokeh._second_shader = new GL.Shader(
                    LGraphFXBokeh._second_vertex_shader,
                    LGraphFXBokeh._second_pixel_shader
                );
            }

            var points_mesh = this._points_mesh;
            if (
                !points_mesh ||
                points_mesh._width != tex.width ||
                points_mesh._height != tex.height ||
                points_mesh._spacing != 2
            ) {
                points_mesh = this.createPointsMesh(tex.width, tex.height, 2);
            }

            var screen_mesh = Mesh.getScreenQuad();

            var point_size = this.properties.size;
            var min_light = this.properties.min_light;
            var alpha = this.properties.alpha;

            gl.disable(gl.DEPTH_TEST);
            gl.disable(gl.BLEND);

            this._temp_texture.drawTo(function() {
                tex.bind(0);
                blurred_tex.bind(1);
                mask_tex.bind(2);
                first_shader
                    .uniforms({
                        u_texture: 0,
                        u_texture_blur: 1,
                        u_mask: 2,
                        u_texsize: [tex.width, tex.height]
                    })
                    .draw(screen_mesh);
            });

            this._temp_texture.drawTo(function() {
                //clear because we use blending
                //gl.clearColor(0.0,0.0,0.0,1.0);
                //gl.clear( gl.COLOR_BUFFER_BIT );
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.ONE, gl.ONE);

                tex.bind(0);
                shape_tex.bind(3);
                second_shader
                    .uniforms({
                        u_texture: 0,
                        u_mask: 2,
                        u_shape: 3,
                        u_alpha: alpha,
                        u_threshold: threshold,
                        u_pointSize: point_size,
                        u_itexsize: [1.0 / tex.width, 1.0 / tex.height]
                    })
                    .draw(points_mesh, gl.POINTS);
            });

            this.setOutputData(0, this._temp_texture);
        };

        LGraphFXBokeh.prototype.createPointsMesh = function(
            width,
            height,
            spacing
        ) {
            var nwidth = Math.round(width / spacing);
            var nheight = Math.round(height / spacing);

            var vertices = new Float32Array(nwidth * nheight * 2);

            var ny = -1;
            var dx = (2 / width) * spacing;
            var dy = (2 / height) * spacing;
            for (var y = 0; y < nheight; ++y) {
                var nx = -1;
                for (var x = 0; x < nwidth; ++x) {
                    var pos = y * nwidth * 2 + x * 2;
                    vertices[pos] = nx;
                    vertices[pos + 1] = ny;
                    nx += dx;
                }
                ny += dy;
            }

            this._points_mesh = GL.Mesh.load({ vertices2D: vertices });
            this._points_mesh._width = width;
            this._points_mesh._height = height;
            this._points_mesh._spacing = spacing;

            return this._points_mesh;
        };

        /*
	LGraphTextureBokeh._pixel_shader = "precision highp float;\n\
			varying vec2 a_coord;\n\
			uniform sampler2D u_texture;\n\
			uniform sampler2D u_shape;\n\
			\n\
			void main() {\n\
				vec4 color = texture2D( u_texture, gl_PointCoord );\n\
				color *= v_color * u_alpha;\n\
				gl_FragColor = color;\n\
			}\n";
	*/

        LGraphFXBokeh._first_pixel_shader =
            "precision highp float;\n\
			precision highp float;\n\
			varying vec2 v_coord;\n\
			uniform sampler2D u_texture;\n\
			uniform sampler2D u_texture_blur;\n\
			uniform sampler2D u_mask;\n\
			\n\
			void main() {\n\
				vec4 color = texture2D(u_texture, v_coord);\n\
				vec4 blurred_color = texture2D(u_texture_blur, v_coord);\n\
				float mask = texture2D(u_mask, v_coord).x;\n\
			   gl_FragColor = mix(color, blurred_color, mask);\n\
			}\n\
			";

        LGraphFXBokeh._second_vertex_shader =
            "precision highp float;\n\
			attribute vec2 a_vertex2D;\n\
			varying vec4 v_color;\n\
			uniform sampler2D u_texture;\n\
			uniform sampler2D u_mask;\n\
			uniform vec2 u_itexsize;\n\
			uniform float u_pointSize;\n\
			uniform float u_threshold;\n\
			void main() {\n\
				vec2 coord = a_vertex2D * 0.5 + 0.5;\n\
				v_color = texture2D( u_texture, coord );\n\
				v_color += texture2D( u_texture, coord + vec2(u_itexsize.x, 0.0) );\n\
				v_color += texture2D( u_texture, coord + vec2(0.0, u_itexsize.y));\n\
				v_color += texture2D( u_texture, coord + u_itexsize);\n\
				v_color *= 0.25;\n\
				float mask = texture2D(u_mask, coord).x;\n\
				float luminance = length(v_color) * mask;\n\
				/*luminance /= (u_pointSize*u_pointSize)*0.01 */;\n\
				luminance -= u_threshold;\n\
				if(luminance < 0.0)\n\
				{\n\
					gl_Position.x = -100.0;\n\
					return;\n\
				}\n\
				gl_PointSize = u_pointSize;\n\
				gl_Position = vec4(a_vertex2D,0.0,1.0);\n\
			}\n\
			";

        LGraphFXBokeh._second_pixel_shader =
            "precision highp float;\n\
			varying vec4 v_color;\n\
			uniform sampler2D u_shape;\n\
			uniform float u_alpha;\n\
			\n\
			void main() {\n\
				vec4 color = texture2D( u_shape, gl_PointCoord );\n\
				color *= v_color * u_alpha;\n\
				gl_FragColor = color;\n\
			}\n";

        LiteGraph.registerNodeType("fx/bokeh", LGraphFXBokeh);
        global.LGraphFXBokeh = LGraphFXBokeh;

        //************************************************

        function LGraphFXGeneric() {
            this.addInput("Texture", "Texture");
            this.addInput("value1", "number");
            this.addInput("value2", "number");
            this.addOutput("Texture", "Texture");
            this.properties = {
                fx: "halftone",
                value1: 1,
                value2: 1,
                precision: LGraphTexture.DEFAULT
            };
        }

        LGraphFXGeneric.title = "FX";
        LGraphFXGeneric.desc = "applies an FX from a list";

        LGraphFXGeneric.widgets_info = {
            fx: {
                widget: "combo",
                values: ["halftone", "pixelate", "lowpalette", "noise", "gamma"]
            },
            precision: { widget: "combo", values: LGraphTexture.MODE_VALUES }
        };
        LGraphFXGeneric.shaders = {};

        LGraphFXGeneric.prototype.onExecute = function() {
            if (!this.isOutputConnected(0)) {
                return;
            } //saves work

            var tex = this.getInputData(0);
            if (this.properties.precision === LGraphTexture.PASS_THROUGH) {
                this.setOutputData(0, tex);
                return;
            }

            if (!tex) {
                return;
            }

            this._tex = LGraphTexture.getTargetTexture(
                tex,
                this._tex,
                this.properties.precision
            );

            //iterations
            var value1 = this.properties.value1;
            if (this.isInputConnected(1)) {
                value1 = this.getInputData(1);
                this.properties.value1 = value1;
            }

            var value2 = this.properties.value2;
            if (this.isInputConnected(2)) {
                value2 = this.getInputData(2);
                this.properties.value2 = value2;
            }

            var fx = this.properties.fx;
            var shader = LGraphFXGeneric.shaders[fx];
            if (!shader) {
                var pixel_shader_code = LGraphFXGeneric["pixel_shader_" + fx];
                if (!pixel_shader_code) {
                    return;
                }

                shader = LGraphFXGeneric.shaders[fx] = new GL.Shader(
                    Shader.SCREEN_VERTEX_SHADER,
                    pixel_shader_code
                );
            }

            gl.disable(gl.BLEND);
            gl.disable(gl.DEPTH_TEST);
            var mesh = Mesh.getScreenQuad();
            var camera = global.LS ? LS.Renderer._current_camera : null;
            var camera_planes;
            if (camera) {
                camera_planes = [
                    LS.Renderer._current_camera.near,
                    LS.Renderer._current_camera.far
                ];
            } else {
                camera_planes = [1, 100];
            }

            var noise = null;
            if (fx == "noise") {
                noise = LGraphTexture.getNoiseTexture();
            }

            this._tex.drawTo(function() {
                tex.bind(0);
                if (fx == "noise") {
                    noise.bind(1);
                }

                shader
                    .uniforms({
                        u_texture: 0,
                        u_noise: 1,
                        u_size: [tex.width, tex.height],
                        u_rand: [Math.random(), Math.random()],
                        u_value1: value1,
                        u_value2: value2,
                        u_camera_planes: camera_planes
                    })
                    .draw(mesh);
            });

            this.setOutputData(0, this._tex);
        };

        LGraphFXGeneric.pixel_shader_halftone =
            "precision highp float;\n\
			varying vec2 v_coord;\n\
			uniform sampler2D u_texture;\n\
			uniform vec2 u_camera_planes;\n\
			uniform vec2 u_size;\n\
			uniform float u_value1;\n\
			uniform float u_value2;\n\
			\n\
			float pattern() {\n\
				float s = sin(u_value1 * 3.1415), c = cos(u_value1 * 3.1415);\n\
				vec2 tex = v_coord * u_size.xy;\n\
				vec2 point = vec2(\n\
				   c * tex.x - s * tex.y ,\n\
				   s * tex.x + c * tex.y \n\
				) * u_value2;\n\
				return (sin(point.x) * sin(point.y)) * 4.0;\n\
			}\n\
			void main() {\n\
				vec4 color = texture2D(u_texture, v_coord);\n\
				float average = (color.r + color.g + color.b) / 3.0;\n\
				gl_FragColor = vec4(vec3(average * 10.0 - 5.0 + pattern()), color.a);\n\
			}\n";

        LGraphFXGeneric.pixel_shader_pixelate =
            "precision highp float;\n\
			varying vec2 v_coord;\n\
			uniform sampler2D u_texture;\n\
			uniform vec2 u_camera_planes;\n\
			uniform vec2 u_size;\n\
			uniform float u_value1;\n\
			uniform float u_value2;\n\
			\n\
			void main() {\n\
				vec2 coord = vec2( floor(v_coord.x * u_value1) / u_value1, floor(v_coord.y * u_value2) / u_value2 );\n\
				vec4 color = texture2D(u_texture, coord);\n\
				gl_FragColor = color;\n\
			}\n";

        LGraphFXGeneric.pixel_shader_lowpalette =
            "precision highp float;\n\
			varying vec2 v_coord;\n\
			uniform sampler2D u_texture;\n\
			uniform vec2 u_camera_planes;\n\
			uniform vec2 u_size;\n\
			uniform float u_value1;\n\
			uniform float u_value2;\n\
			\n\
			void main() {\n\
				vec4 color = texture2D(u_texture, v_coord);\n\
				gl_FragColor = floor(color * u_value1) / u_value1;\n\
			}\n";

        LGraphFXGeneric.pixel_shader_noise =
            "precision highp float;\n\
			varying vec2 v_coord;\n\
			uniform sampler2D u_texture;\n\
			uniform sampler2D u_noise;\n\
			uniform vec2 u_size;\n\
			uniform float u_value1;\n\
			uniform float u_value2;\n\
			uniform vec2 u_rand;\n\
			\n\
			void main() {\n\
				vec4 color = texture2D(u_texture, v_coord);\n\
				vec3 noise = texture2D(u_noise, v_coord * vec2(u_size.x / 512.0, u_size.y / 512.0) + u_rand).xyz - vec3(0.5);\n\
				gl_FragColor = vec4( color.xyz + noise * u_value1, color.a );\n\
			}\n";

        LGraphFXGeneric.pixel_shader_gamma =
            "precision highp float;\n\
			varying vec2 v_coord;\n\
			uniform sampler2D u_texture;\n\
			uniform float u_value1;\n\
			\n\
			void main() {\n\
				vec4 color = texture2D(u_texture, v_coord);\n\
				float gamma = 1.0 / u_value1;\n\
				gl_FragColor = vec4( pow( color.xyz, vec3(gamma) ), color.a );\n\
			}\n";

        LiteGraph.registerNodeType("fx/generic", LGraphFXGeneric);
        global.LGraphFXGeneric = LGraphFXGeneric;

        // Vigneting ************************************

        function LGraphFXVigneting() {
            this.addInput("Tex.", "Texture");
            this.addInput("intensity", "number");

            this.addOutput("Texture", "Texture");
            this.properties = {
                intensity: 1,
                invert: false,
                precision: LGraphTexture.DEFAULT
            };

            if (!LGraphFXVigneting._shader) {
                LGraphFXVigneting._shader = new GL.Shader(
                    Shader.SCREEN_VERTEX_SHADER,
                    LGraphFXVigneting.pixel_shader
                );
            }
        }

        LGraphFXVigneting.title = "Vigneting";
        LGraphFXVigneting.desc = "Vigneting";

        LGraphFXVigneting.widgets_info = {
            precision: { widget: "combo", values: LGraphTexture.MODE_VALUES }
        };

        LGraphFXVigneting.prototype.onExecute = function() {
            var tex = this.getInputData(0);

            if (this.properties.precision === LGraphTexture.PASS_THROUGH) {
                this.setOutputData(0, tex);
                return;
            }

            if (!tex) {
                return;
            }

            this._tex = LGraphTexture.getTargetTexture(
                tex,
                this._tex,
                this.properties.precision
            );

            var intensity = this.properties.intensity;
            if (this.isInputConnected(1)) {
                intensity = this.getInputData(1);
                this.properties.intensity = intensity;
            }

            gl.disable(gl.BLEND);
            gl.disable(gl.DEPTH_TEST);

            var mesh = Mesh.getScreenQuad();
            var shader = LGraphFXVigneting._shader;
            var invert = this.properties.invert;

            this._tex.drawTo(function() {
                tex.bind(0);
                shader
                    .uniforms({
                        u_texture: 0,
                        u_intensity: intensity,
                        u_isize: [1 / tex.width, 1 / tex.height],
                        u_invert: invert ? 1 : 0
                    })
                    .draw(mesh);
            });

            this.setOutputData(0, this._tex);
        };

        LGraphFXVigneting.pixel_shader =
            "precision highp float;\n\
			precision highp float;\n\
			varying vec2 v_coord;\n\
			uniform sampler2D u_texture;\n\
			uniform float u_intensity;\n\
			uniform int u_invert;\n\
			\n\
			void main() {\n\
				float luminance = 1.0 - length( v_coord - vec2(0.5) ) * 1.414;\n\
				vec4 color = texture2D(u_texture, v_coord);\n\
				if(u_invert == 1)\n\
					luminance = 1.0 - luminance;\n\
				luminance = mix(1.0, luminance, u_intensity);\n\
			   gl_FragColor = vec4( luminance * color.xyz, color.a);\n\
			}\n\
			";

        LiteGraph.registerNodeType("fx/vigneting", LGraphFXVigneting);
        global.LGraphFXVigneting = LGraphFXVigneting;
    }
})(this);

(function(global) {
    var LiteGraph = global.LiteGraph;
    var MIDI_COLOR = "#243";

    function MIDIEvent(data) {
        this.channel = 0;
        this.cmd = 0;
        this.data = new Uint32Array(3);

        if (data) {
            this.setup(data);
        }
    }

    LiteGraph.MIDIEvent = MIDIEvent;

    MIDIEvent.prototype.fromJSON = function(o) {
        this.setup(o.data);
    };

    MIDIEvent.prototype.setup = function(data) {
        var raw_data = data;
        if (data.constructor === Object) {
            raw_data = data.data;
        }

        this.data.set(raw_data);

        var midiStatus = raw_data[0];
        this.status = midiStatus;

        var midiCommand = midiStatus & 0xf0;

        if (midiStatus >= 0xf0) {
            this.cmd = midiStatus;
        } else {
            this.cmd = midiCommand;
        }

        if (this.cmd == MIDIEvent.NOTEON && this.velocity == 0) {
            this.cmd = MIDIEvent.NOTEOFF;
        }

        this.cmd_str = MIDIEvent.commands[this.cmd] || "";

        if (
            midiCommand >= MIDIEvent.NOTEON ||
            midiCommand <= MIDIEvent.NOTEOFF
        ) {
            this.channel = midiStatus & 0x0f;
        }
    };

    Object.defineProperty(MIDIEvent.prototype, "velocity", {
        get: function() {
            if (this.cmd == MIDIEvent.NOTEON) {
                return this.data[2];
            }
            return -1;
        },
        set: function(v) {
            this.data[2] = v; //  v / 127;
        },
        enumerable: true
    });

    MIDIEvent.notes = [
        "A",
        "A#",
        "B",
        "C",
        "C#",
        "D",
        "D#",
        "E",
        "F",
        "F#",
        "G",
        "G#"
    ];
    MIDIEvent.note_to_index = {
        A: 0,
        "A#": 1,
        B: 2,
        C: 3,
        "C#": 4,
        D: 5,
        "D#": 6,
        E: 7,
        F: 8,
        "F#": 9,
        G: 10,
        "G#": 11
    };

    Object.defineProperty(MIDIEvent.prototype, "note", {
        get: function() {
            if (this.cmd != MIDIEvent.NOTEON) {
                return -1;
            }
            return MIDIEvent.toNoteString(this.data[1], true);
        },
        set: function(v) {
            throw "notes cannot be assigned this way, must modify the data[1]";
        },
        enumerable: true
    });

    Object.defineProperty(MIDIEvent.prototype, "octave", {
        get: function() {
            if (this.cmd != MIDIEvent.NOTEON) {
                return -1;
            }
            var octave = this.data[1] - 24;
            return Math.floor(octave / 12 + 1);
        },
        set: function(v) {
            throw "octave cannot be assigned this way, must modify the data[1]";
        },
        enumerable: true
    });

    //returns HZs
    MIDIEvent.prototype.getPitch = function() {
        return Math.pow(2, (this.data[1] - 69) / 12) * 440;
    };

    MIDIEvent.computePitch = function(note) {
        return Math.pow(2, (note - 69) / 12) * 440;
    };

    MIDIEvent.prototype.getCC = function() {
        return this.data[1];
    };

    MIDIEvent.prototype.getCCValue = function() {
        return this.data[2];
    };

    //not tested, there is a formula missing here
    MIDIEvent.prototype.getPitchBend = function() {
        return this.data[1] + (this.data[2] << 7) - 8192;
    };

    MIDIEvent.computePitchBend = function(v1, v2) {
        return v1 + (v2 << 7) - 8192;
    };

    MIDIEvent.prototype.setCommandFromString = function(str) {
        this.cmd = MIDIEvent.computeCommandFromString(str);
    };

    MIDIEvent.computeCommandFromString = function(str) {
        if (!str) {
            return 0;
        }

        if (str && str.constructor === Number) {
            return str;
        }

        str = str.toUpperCase();
        switch (str) {
            case "NOTE ON":
            case "NOTEON":
                return MIDIEvent.NOTEON;
                break;
            case "NOTE OFF":
            case "NOTEOFF":
                return MIDIEvent.NOTEON;
                break;
            case "KEY PRESSURE":
            case "KEYPRESSURE":
                return MIDIEvent.KEYPRESSURE;
                break;
            case "CONTROLLER CHANGE":
            case "CONTROLLERCHANGE":
            case "CC":
                return MIDIEvent.CONTROLLERCHANGE;
                break;
            case "PROGRAM CHANGE":
            case "PROGRAMCHANGE":
            case "PC":
                return MIDIEvent.PROGRAMCHANGE;
                break;
            case "CHANNEL PRESSURE":
            case "CHANNELPRESSURE":
                return MIDIEvent.CHANNELPRESSURE;
                break;
            case "PITCH BEND":
            case "PITCHBEND":
                return MIDIEvent.PITCHBEND;
                break;
            case "TIME TICK":
            case "TIMETICK":
                return MIDIEvent.TIMETICK;
                break;
            default:
                return Number(str); //asume its a hex code
        }
    };

    //transform from a pitch number to string like "C4"
    MIDIEvent.toNoteString = function(d, skip_octave) {
        d = Math.round(d); //in case it has decimals
        var note = d - 21;
        var octave = Math.floor((d - 24) / 12 + 1);
        note = note % 12;
        if (note < 0) {
            note = 12 + note;
        }
        return MIDIEvent.notes[note] + (skip_octave ? "" : octave);
    };

    MIDIEvent.NoteStringToPitch = function(str) {
        str = str.toUpperCase();
        var note = str[0];
        var octave = 4;

        if (str[1] == "#") {
            note += "#";
            if (str.length > 2) {
                octave = Number(str[2]);
            }
        } else {
            if (str.length > 1) {
                octave = Number(str[1]);
            }
        }
        var pitch = MIDIEvent.note_to_index[note];
        if (pitch == null) {
            return null;
        }
        return (octave - 1) * 12 + pitch + 21;
    };

    MIDIEvent.prototype.toString = function() {
        var str = "" + this.channel + ". ";
        switch (this.cmd) {
            case MIDIEvent.NOTEON:
                str += "NOTEON " + MIDIEvent.toNoteString(this.data[1]);
                break;
            case MIDIEvent.NOTEOFF:
                str += "NOTEOFF " + MIDIEvent.toNoteString(this.data[1]);
                break;
            case MIDIEvent.CONTROLLERCHANGE:
                str += "CC " + this.data[1] + " " + this.data[2];
                break;
            case MIDIEvent.PROGRAMCHANGE:
                str += "PC " + this.data[1];
                break;
            case MIDIEvent.PITCHBEND:
                str += "PITCHBEND " + this.getPitchBend();
                break;
            case MIDIEvent.KEYPRESSURE:
                str += "KEYPRESS " + this.data[1];
                break;
        }

        return str;
    };

    MIDIEvent.prototype.toHexString = function() {
        var str = "";
        for (var i = 0; i < this.data.length; i++) {
            str += this.data[i].toString(16) + " ";
        }
    };

    MIDIEvent.prototype.toJSON = function() {
        return {
            data: [this.data[0], this.data[1], this.data[2]],
            object_class: "MIDIEvent"
        };
    };

    MIDIEvent.NOTEOFF = 0x80;
    MIDIEvent.NOTEON = 0x90;
    MIDIEvent.KEYPRESSURE = 0xa0;
    MIDIEvent.CONTROLLERCHANGE = 0xb0;
    MIDIEvent.PROGRAMCHANGE = 0xc0;
    MIDIEvent.CHANNELPRESSURE = 0xd0;
    MIDIEvent.PITCHBEND = 0xe0;
    MIDIEvent.TIMETICK = 0xf8;

    MIDIEvent.commands = {
        0x80: "note off",
        0x90: "note on",
        0xa0: "key pressure",
        0xb0: "controller change",
        0xc0: "program change",
        0xd0: "channel pressure",
        0xe0: "pitch bend",
        0xf0: "system",
        0xf2: "Song pos",
        0xf3: "Song select",
        0xf6: "Tune request",
        0xf8: "time tick",
        0xfa: "Start Song",
        0xfb: "Continue Song",
        0xfc: "Stop Song",
        0xfe: "Sensing",
        0xff: "Reset"
    };

    MIDIEvent.commands_short = {
        0x80: "NOTEOFF",
        0x90: "NOTEOFF",
        0xa0: "KEYP",
        0xb0: "CC",
        0xc0: "PC",
        0xd0: "CP",
        0xe0: "PB",
        0xf0: "SYS",
        0xf2: "POS",
        0xf3: "SELECT",
        0xf6: "TUNEREQ",
        0xf8: "TT",
        0xfa: "START",
        0xfb: "CONTINUE",
        0xfc: "STOP",
        0xfe: "SENS",
        0xff: "RESET"
    };

    MIDIEvent.commands_reversed = {};
    for (var i in MIDIEvent.commands) {
        MIDIEvent.commands_reversed[MIDIEvent.commands[i]] = i;
    }

    //MIDI wrapper, instantiate by MIDIIn and MIDIOut
    function MIDIInterface(on_ready, on_error) {
        if (!navigator.requestMIDIAccess) {
            this.error = "not suppoorted";
            if (on_error) {
                on_error("Not supported");
            } else {
                console.error("MIDI NOT SUPPORTED, enable by chrome://flags");
            }
            return;
        }

        this.on_ready = on_ready;

        this.state = {
            note: [],
            cc: []
        };

		this.input_ports = null;
		this.input_ports_info = [];
		this.output_ports = null;
		this.output_ports_info = [];

        navigator.requestMIDIAccess().then(this.onMIDISuccess.bind(this), this.onMIDIFailure.bind(this));
    }

    MIDIInterface.input = null;

    MIDIInterface.MIDIEvent = MIDIEvent;

    MIDIInterface.prototype.onMIDISuccess = function(midiAccess) {
        console.log("MIDI ready!");
        console.log(midiAccess);
        this.midi = midiAccess; // store in the global (in real usage, would probably keep in an object instance)
        this.updatePorts();

        if (this.on_ready) {
            this.on_ready(this);
        }
    };

    MIDIInterface.prototype.updatePorts = function() {
        var midi = this.midi;
        this.input_ports = midi.inputs;
		this.input_ports_info = [];
        this.output_ports = midi.outputs;
		this.output_ports_info = [];

        var num = 0;

        var it = this.input_ports.values();
        var it_value = it.next();
        while (it_value && it_value.done === false) {
            var port_info = it_value.value;
			this.input_ports_info.push(port_info);
            console.log( "Input port [type:'" + port_info.type + "'] id:'" + port_info.id + "' manufacturer:'" + port_info.manufacturer + "' name:'" + port_info.name + "' version:'" + port_info.version + "'" );
            num++;
            it_value = it.next();
        }
        this.num_input_ports = num;

        num = 0;
        var it = this.output_ports.values();
        var it_value = it.next();
        while (it_value && it_value.done === false) {
            var port_info = it_value.value;
			this.output_ports_info.push(port_info);
            console.log( "Output port [type:'" + port_info.type + "'] id:'" + port_info.id + "' manufacturer:'" + port_info.manufacturer + "' name:'" + port_info.name + "' version:'" + port_info.version + "'" );
            num++;
            it_value = it.next();
        }
        this.num_output_ports = num;
    };

    MIDIInterface.prototype.onMIDIFailure = function(msg) {
        console.error("Failed to get MIDI access - " + msg);
    };

    MIDIInterface.prototype.openInputPort = function(port, callback) {
        var input_port = this.input_ports.get("input-" + port);
        if (!input_port) {
            return false;
        }
        MIDIInterface.input = this;
        var that = this;

        input_port.onmidimessage = function(a) {
            var midi_event = new MIDIEvent(a.data);
            that.updateState(midi_event);
            if (callback) {
                callback(a.data, midi_event);
            }
            if (MIDIInterface.on_message) {
                MIDIInterface.on_message(a.data, midi_event);
            }
        };
        console.log("port open: ", input_port);
        return true;
    };

    MIDIInterface.parseMsg = function(data) {};

    MIDIInterface.prototype.updateState = function(midi_event) {
        switch (midi_event.cmd) {
            case MIDIEvent.NOTEON:
                this.state.note[midi_event.value1 | 0] = midi_event.value2;
                break;
            case MIDIEvent.NOTEOFF:
                this.state.note[midi_event.value1 | 0] = 0;
                break;
            case MIDIEvent.CONTROLLERCHANGE:
                this.state.cc[midi_event.getCC()] = midi_event.getCCValue();
                break;
        }
    };

    MIDIInterface.prototype.sendMIDI = function(port, midi_data) {
        if (!midi_data) {
            return;
        }

        var output_port = this.output_ports_info[port];//this.output_ports.get("output-" + port);
        if (!output_port) {
            return;
        }

        MIDIInterface.output = this;

        if (midi_data.constructor === MIDIEvent) {
            output_port.send(midi_data.data);
        } else {
            output_port.send(midi_data);
        }
    };

    function LGMIDIIn() {
        this.addOutput("on_midi", LiteGraph.EVENT);
        this.addOutput("out", "midi");
        this.properties = { port: 0 };
        this._last_midi_event = null;
        this._current_midi_event = null;
        this.boxcolor = "#AAA";
        this._last_time = 0;

        var that = this;
        new MIDIInterface(function(midi) {
            //open
            that._midi = midi;
            if (that._waiting) {
                that.onStart();
            }
            that._waiting = false;
        });
    }

    LGMIDIIn.MIDIInterface = MIDIInterface;

    LGMIDIIn.title = "MIDI Input";
    LGMIDIIn.desc = "Reads MIDI from a input port";
    LGMIDIIn.color = MIDI_COLOR;

    LGMIDIIn.prototype.getPropertyInfo = function(name) {
        if (!this._midi) {
            return;
        }

        if (name == "port") {
            var values = {};
            for (var i = 0; i < this._midi.input_ports_info.length; ++i) {
                var input = this._midi.input_ports_info[i];
                values[i] = i + ".- " + input.name + " version:" + input.version;
            }
            return { type: "enum", values: values };
        }
    };

    LGMIDIIn.prototype.onStart = function() {
        if (this._midi) {
            this._midi.openInputPort(
                this.properties.port,
                this.onMIDIEvent.bind(this)
            );
        } else {
            this._waiting = true;
        }
    };

    LGMIDIIn.prototype.onMIDIEvent = function(data, midi_event) {
        this._last_midi_event = midi_event;
        this.boxcolor = "#AFA";
        this._last_time = LiteGraph.getTime();
        this.trigger("on_midi", midi_event);
        if (midi_event.cmd == MIDIEvent.NOTEON) {
            this.trigger("on_noteon", midi_event);
        } else if (midi_event.cmd == MIDIEvent.NOTEOFF) {
            this.trigger("on_noteoff", midi_event);
        } else if (midi_event.cmd == MIDIEvent.CONTROLLERCHANGE) {
            this.trigger("on_cc", midi_event);
        } else if (midi_event.cmd == MIDIEvent.PROGRAMCHANGE) {
            this.trigger("on_pc", midi_event);
        } else if (midi_event.cmd == MIDIEvent.PITCHBEND) {
            this.trigger("on_pitchbend", midi_event);
        }
    };

    LGMIDIIn.prototype.onDrawBackground = function(ctx) {
        this.boxcolor = "#AAA";
        if (!this.flags.collapsed && this._last_midi_event) {
            ctx.fillStyle = "white";
            var now = LiteGraph.getTime();
            var f = 1.0 - Math.max(0, (now - this._last_time) * 0.001);
            if (f > 0) {
                var t = ctx.globalAlpha;
                ctx.globalAlpha *= f;
                ctx.font = "12px Tahoma";
                ctx.fillText(
                    this._last_midi_event.toString(),
                    2,
                    this.size[1] * 0.5 + 3
                );
                //ctx.fillRect(0,0,this.size[0],this.size[1]);
                ctx.globalAlpha = t;
            }
        }
    };

    LGMIDIIn.prototype.onExecute = function() {
        if (this.outputs) {
            var last = this._last_midi_event;
            for (var i = 0; i < this.outputs.length; ++i) {
                var output = this.outputs[i];
                var v = null;
                switch (output.name) {
                    case "midi":
                        v = this._midi;
                        break;
                    case "last_midi":
                        v = last;
                        break;
                    default:
                        continue;
                }
                this.setOutputData(i, v);
            }
        }
    };

    LGMIDIIn.prototype.onGetOutputs = function() {
        return [
            ["last_midi", "midi"],
            ["on_midi", LiteGraph.EVENT],
            ["on_noteon", LiteGraph.EVENT],
            ["on_noteoff", LiteGraph.EVENT],
            ["on_cc", LiteGraph.EVENT],
            ["on_pc", LiteGraph.EVENT],
            ["on_pitchbend", LiteGraph.EVENT]
        ];
    };

    LiteGraph.registerNodeType("midi/input", LGMIDIIn);

    function LGMIDIOut() {
        this.addInput("send", LiteGraph.EVENT);
        this.properties = { port: 0 };

        var that = this;
        new MIDIInterface(function(midi) {
            that._midi = midi;
			that.widget.options.values = that.getMIDIOutputs();
        });
		this.widget = this.addWidget("combo","Device",this.properties.port,{ property: "port", values: this.getMIDIOutputs.bind(this) });
		this.size = [340,60];
    }

    LGMIDIOut.MIDIInterface = MIDIInterface;

    LGMIDIOut.title = "MIDI Output";
    LGMIDIOut.desc = "Sends MIDI to output channel";
    LGMIDIOut.color = MIDI_COLOR;

    LGMIDIOut.prototype.onGetPropertyInfo = function(name) {
        if (!this._midi) {
            return;
        }

        if (name == "port") {
			var values = this.getMIDIOutputs();
            return { type: "enum", values: values };
        }
    };
	LGMIDIOut.default_ports = {0:"unknown"};

	LGMIDIOut.prototype.getMIDIOutputs = function()
	{
		var values = {};
		if(!this._midi)
			return LGMIDIOut.default_ports;
		if(this._midi.output_ports_info)
		for (var i = 0; i < this._midi.output_ports_info.length; ++i) {
			var output = this._midi.output_ports_info[i];
			if(!output)
				continue;
			var name = i + ".- " + output.name + " version:" + output.version;
			values[i] = name;
		}
		return values;
	}

    LGMIDIOut.prototype.onAction = function(event, midi_event) {
        //console.log(midi_event);
        if (!this._midi) {
            return;
        }
        if (event == "send") {
            this._midi.sendMIDI(this.properties.port, midi_event);
        }
        this.trigger("midi", midi_event);
    };

    LGMIDIOut.prototype.onGetInputs = function() {
        return [["send", LiteGraph.ACTION]];
    };

    LGMIDIOut.prototype.onGetOutputs = function() {
        return [["on_midi", LiteGraph.EVENT]];
    };

    LiteGraph.registerNodeType("midi/output", LGMIDIOut);


    function LGMIDIShow() {
        this.addInput("on_midi", LiteGraph.EVENT);
        this._str = "";
        this.size = [200, 40];
    }

    LGMIDIShow.title = "MIDI Show";
    LGMIDIShow.desc = "Shows MIDI in the graph";
    LGMIDIShow.color = MIDI_COLOR;

    LGMIDIShow.prototype.getTitle = function() {
        if (this.flags.collapsed) {
            return this._str;
        }
        return this.title;
    };

    LGMIDIShow.prototype.onAction = function(event, midi_event) {
        if (!midi_event) {
            return;
        }
        if (midi_event.constructor === MIDIEvent) {
            this._str = midi_event.toString();
        } else {
            this._str = "???";
        }
    };

    LGMIDIShow.prototype.onDrawForeground = function(ctx) {
        if (!this._str || this.flags.collapsed) {
            return;
        }

        ctx.font = "30px Arial";
        ctx.fillText(this._str, 10, this.size[1] * 0.8);
    };

    LGMIDIShow.prototype.onGetInputs = function() {
        return [["in", LiteGraph.ACTION]];
    };

    LGMIDIShow.prototype.onGetOutputs = function() {
        return [["on_midi", LiteGraph.EVENT]];
    };

    LiteGraph.registerNodeType("midi/show", LGMIDIShow);

    function LGMIDIFilter() {
        this.properties = {
            channel: -1,
            cmd: -1,
            min_value: -1,
            max_value: -1
        };

        var that = this;
        this._learning = false;
        this.addWidget("button", "Learn", "", function() {
            that._learning = true;
            that.boxcolor = "#FA3";
        });

        this.addInput("in", LiteGraph.EVENT);
        this.addOutput("on_midi", LiteGraph.EVENT);
        this.boxcolor = "#AAA";
    }

    LGMIDIFilter.title = "MIDI Filter";
    LGMIDIFilter.desc = "Filters MIDI messages";
    LGMIDIFilter.color = MIDI_COLOR;

    LGMIDIFilter["@cmd"] = {
        type: "enum",
        title: "Command",
        values: MIDIEvent.commands_reversed
    };

    LGMIDIFilter.prototype.getTitle = function() {
        var str = null;
        if (this.properties.cmd == -1) {
            str = "Nothing";
        } else {
            str = MIDIEvent.commands_short[this.properties.cmd] || "Unknown";
        }

        if (
            this.properties.min_value != -1 &&
            this.properties.max_value != -1
        ) {
            str +=
                " " +
                (this.properties.min_value == this.properties.max_value
                    ? this.properties.max_value
                    : this.properties.min_value +
                      ".." +
                      this.properties.max_value);
        }

        return "Filter: " + str;
    };

    LGMIDIFilter.prototype.onPropertyChanged = function(name, value) {
        if (name == "cmd") {
            var num = Number(value);
            if (isNaN(num)) {
                num = MIDIEvent.commands[value] || 0;
            }
            this.properties.cmd = num;
        }
    };

    LGMIDIFilter.prototype.onAction = function(event, midi_event) {
        if (!midi_event || midi_event.constructor !== MIDIEvent) {
            return;
        }

        if (this._learning) {
            this._learning = false;
            this.boxcolor = "#AAA";
            this.properties.channel = midi_event.channel;
            this.properties.cmd = midi_event.cmd;
            this.properties.min_value = this.properties.max_value =
                midi_event.data[1];
        } else {
            if (
                this.properties.channel != -1 &&
                midi_event.channel != this.properties.channel
            ) {
                return;
            }
            if (
                this.properties.cmd != -1 &&
                midi_event.cmd != this.properties.cmd
            ) {
                return;
            }
            if (
                this.properties.min_value != -1 &&
                midi_event.data[1] < this.properties.min_value
            ) {
                return;
            }
            if (
                this.properties.max_value != -1 &&
                midi_event.data[1] > this.properties.max_value
            ) {
                return;
            }
        }

        this.trigger("on_midi", midi_event);
    };

    LiteGraph.registerNodeType("midi/filter", LGMIDIFilter);

    function LGMIDIEvent() {
        this.properties = {
            channel: 0,
            cmd: 144, //0x90
            value1: 1,
            value2: 1
        };

        this.addInput("send", LiteGraph.EVENT);
        this.addInput("assign", LiteGraph.EVENT);
        this.addOutput("on_midi", LiteGraph.EVENT);

        this.midi_event = new MIDIEvent();
        this.gate = false;
    }

    LGMIDIEvent.title = "MIDIEvent";
    LGMIDIEvent.desc = "Create a MIDI Event";
    LGMIDIEvent.color = MIDI_COLOR;

    LGMIDIEvent.prototype.onAction = function(event, midi_event) {
        if (event == "assign") {
            this.properties.channel = midi_event.channel;
            this.properties.cmd = midi_event.cmd;
            this.properties.value1 = midi_event.data[1];
            this.properties.value2 = midi_event.data[2];
            if (midi_event.cmd == MIDIEvent.NOTEON) {
                this.gate = true;
            } else if (midi_event.cmd == MIDIEvent.NOTEOFF) {
                this.gate = false;
            }
            return;
        }

        //send
        var midi_event = this.midi_event;
        midi_event.channel = this.properties.channel;
        if (this.properties.cmd && this.properties.cmd.constructor === String) {
            midi_event.setCommandFromString(this.properties.cmd);
        } else {
            midi_event.cmd = this.properties.cmd;
        }
        midi_event.data[0] = midi_event.cmd | midi_event.channel;
        midi_event.data[1] = Number(this.properties.value1);
        midi_event.data[2] = Number(this.properties.value2);

        this.trigger("on_midi", midi_event);
    };

    LGMIDIEvent.prototype.onExecute = function() {
        var props = this.properties;

        if (this.inputs) {
            for (var i = 0; i < this.inputs.length; ++i) {
                var input = this.inputs[i];
                if (input.link == -1) {
                    continue;
                }
                switch (input.name) {
                    case "note":
                        var v = this.getInputData(i);
                        if (v != null) {
                            if (v.constructor === String) {
                                v = MIDIEvent.NoteStringToPitch(v);
                            }
                            this.properties.value1 = (v | 0) % 255;
                        }
                        break;
                    case "cmd":
                        var v = this.getInputData(i);
                        if (v != null) {
                            this.properties.cmd = v;
                        }
                        break;
                    case "value1":
                        var v = this.getInputData(i);
                        if (v != null) {
                            this.properties.value1 = Math.clamp(v|0,0,127);
                        }
                        break;
                    case "value2":
                        var v = this.getInputData(i);
                        if (v != null) {
                            this.properties.value2 = Math.clamp(v|0,0,127);
                        }
                        break;
                }
            }
        }

        if (this.outputs) {
            for (var i = 0; i < this.outputs.length; ++i) {
                var output = this.outputs[i];
                var v = null;
                switch (output.name) {
                    case "midi":
                        v = new MIDIEvent();
                        v.setup([props.cmd, props.value1, props.value2]);
                        v.channel = props.channel;
                        break;
                    case "command":
                        v = props.cmd;
                        break;
                    case "cc":
                        v = props.value1;
                        break;
                    case "cc_value":
                        v = props.value2;
                        break;
                    case "note":
                        v =
                            props.cmd == MIDIEvent.NOTEON ||
                            props.cmd == MIDIEvent.NOTEOFF
                                ? props.value1
                                : null;
                        break;
                    case "velocity":
                        v = props.cmd == MIDIEvent.NOTEON ? props.value2 : null;
                        break;
                    case "pitch":
                        v =
                            props.cmd == MIDIEvent.NOTEON
                                ? MIDIEvent.computePitch(props.value1)
                                : null;
                        break;
                    case "pitchbend":
                        v =
                            props.cmd == MIDIEvent.PITCHBEND
                                ? MIDIEvent.computePitchBend(
                                      props.value1,
                                      props.value2
                                  )
                                : null;
                        break;
                    case "gate":
                        v = this.gate;
                        break;
                    default:
                        continue;
                }
                if (v !== null) {
                    this.setOutputData(i, v);
                }
            }
        }
    };

    LGMIDIEvent.prototype.onPropertyChanged = function(name, value) {
        if (name == "cmd") {
            this.properties.cmd = MIDIEvent.computeCommandFromString(value);
        }
    };

    LGMIDIEvent.prototype.onGetInputs = function() {
        return [["cmd", "number"],["note", "number"],["value1", "number"],["value2", "number"]];
    };

    LGMIDIEvent.prototype.onGetOutputs = function() {
        return [
            ["midi", "midi"],
            ["on_midi", LiteGraph.EVENT],
            ["command", "number"],
            ["note", "number"],
            ["velocity", "number"],
            ["cc", "number"],
            ["cc_value", "number"],
            ["pitch", "number"],
            ["gate", "bool"],
            ["pitchbend", "number"]
        ];
    };

    LiteGraph.registerNodeType("midi/event", LGMIDIEvent);

    function LGMIDICC() {
        this.properties = {
            //		channel: 0,
            cc: 1,
            value: 0
        };

        this.addOutput("value", "number");
    }

    LGMIDICC.title = "MIDICC";
    LGMIDICC.desc = "gets a Controller Change";
    LGMIDICC.color = MIDI_COLOR;

    LGMIDICC.prototype.onExecute = function() {
        var props = this.properties;
        if (MIDIInterface.input) {
            this.properties.value =
                MIDIInterface.input.state.cc[this.properties.cc];
        }
        this.setOutputData(0, this.properties.value);
    };

    LiteGraph.registerNodeType("midi/cc", LGMIDICC);

    function LGMIDIGenerator() {
        this.addInput("generate", LiteGraph.ACTION);
        this.addInput("scale", "string");
        this.addInput("octave", "number");
        this.addOutput("note", LiteGraph.EVENT);
        this.properties = {
            notes: "A,A#,B,C,C#,D,D#,E,F,F#,G,G#",
            octave: 2,
            duration: 0.5,
            mode: "sequence"
        };

        this.notes_pitches = LGMIDIGenerator.processScale(
            this.properties.notes
        );
        this.sequence_index = 0;
    }

    LGMIDIGenerator.title = "MIDI Generator";
    LGMIDIGenerator.desc = "Generates a random MIDI note";
    LGMIDIGenerator.color = MIDI_COLOR;

    LGMIDIGenerator.processScale = function(scale) {
        var notes = scale.split(",");
        for (var i = 0; i < notes.length; ++i) {
            var n = notes[i];
            if ((n.length == 2 && n[1] != "#") || n.length > 2) {
                notes[i] = -LiteGraph.MIDIEvent.NoteStringToPitch(n);
            } else {
                notes[i] = MIDIEvent.note_to_index[n] || 0;
            }
        }
        return notes;
    };

    LGMIDIGenerator.prototype.onPropertyChanged = function(name, value) {
        if (name == "notes") {
            this.notes_pitches = LGMIDIGenerator.processScale(value);
        }
    };

    LGMIDIGenerator.prototype.onExecute = function() {
        var octave = this.getInputData(2);
        if (octave != null) {
            this.properties.octave = octave;
        }

        var scale = this.getInputData(1);
        if (scale) {
            this.notes_pitches = LGMIDIGenerator.processScale(scale);
        }
    };

    LGMIDIGenerator.prototype.onAction = function(event, midi_event) {
        //var range = this.properties.max - this.properties.min;
        //var pitch = this.properties.min + ((Math.random() * range)|0);
        var pitch = 0;
        var range = this.notes_pitches.length;
        var index = 0;

        if (this.properties.mode == "sequence") {
            index = this.sequence_index = (this.sequence_index + 1) % range;
        } else if (this.properties.mode == "random") {
            index = Math.floor(Math.random() * range);
        }

        var note = this.notes_pitches[index];
        if (note >= 0) {
            pitch = note + (this.properties.octave - 1) * 12 + 33;
        } else {
            pitch = -note;
        }

        var midi_event = new MIDIEvent();
        midi_event.setup([MIDIEvent.NOTEON, pitch, 10]);
        var duration = this.properties.duration || 1;
        this.trigger("note", midi_event);

        //noteoff
        setTimeout(
            function() {
                var midi_event = new MIDIEvent();
                midi_event.setup([MIDIEvent.NOTEOFF, pitch, 0]);
                this.trigger("note", midi_event);
            }.bind(this),
            duration * 1000
        );
    };

    LiteGraph.registerNodeType("midi/generator", LGMIDIGenerator);

    function LGMIDITranspose() {
        this.properties = {
            amount: 0
        };
        this.addInput("in", LiteGraph.ACTION);
        this.addInput("amount", "number");
        this.addOutput("out", LiteGraph.EVENT);

        this.midi_event = new MIDIEvent();
    }

    LGMIDITranspose.title = "MIDI Transpose";
    LGMIDITranspose.desc = "Transpose a MIDI note";
    LGMIDITranspose.color = MIDI_COLOR;

    LGMIDITranspose.prototype.onAction = function(event, midi_event) {
        if (!midi_event || midi_event.constructor !== MIDIEvent) {
            return;
        }

        if (
            midi_event.data[0] == MIDIEvent.NOTEON ||
            midi_event.data[0] == MIDIEvent.NOTEOFF
        ) {
            this.midi_event = new MIDIEvent();
            this.midi_event.setup(midi_event.data);
            this.midi_event.data[1] = Math.round(
                this.midi_event.data[1] + this.properties.amount
            );
            this.trigger("out", this.midi_event);
        } else {
            this.trigger("out", midi_event);
        }
    };

    LGMIDITranspose.prototype.onExecute = function() {
        var amount = this.getInputData(1);
        if (amount != null) {
            this.properties.amount = amount;
        }
    };

    LiteGraph.registerNodeType("midi/transpose", LGMIDITranspose);

    function LGMIDIQuantize() {
        this.properties = {
            scale: "A,A#,B,C,C#,D,D#,E,F,F#,G,G#"
        };
        this.addInput("note", LiteGraph.ACTION);
        this.addInput("scale", "string");
        this.addOutput("out", LiteGraph.EVENT);

        this.valid_notes = new Array(12);
        this.offset_notes = new Array(12);
        this.processScale(this.properties.scale);
    }

    LGMIDIQuantize.title = "MIDI Quantize Pitch";
    LGMIDIQuantize.desc = "Transpose a MIDI note tp fit an scale";
    LGMIDIQuantize.color = MIDI_COLOR;

    LGMIDIQuantize.prototype.onPropertyChanged = function(name, value) {
        if (name == "scale") {
            this.processScale(value);
        }
    };

    LGMIDIQuantize.prototype.processScale = function(scale) {
        this._current_scale = scale;
        this.notes_pitches = LGMIDIGenerator.processScale(scale);
        for (var i = 0; i < 12; ++i) {
            this.valid_notes[i] = this.notes_pitches.indexOf(i) != -1;
        }
        for (var i = 0; i < 12; ++i) {
            if (this.valid_notes[i]) {
                this.offset_notes[i] = 0;
                continue;
            }
            for (var j = 1; j < 12; ++j) {
                if (this.valid_notes[(i - j) % 12]) {
                    this.offset_notes[i] = -j;
                    break;
                }
                if (this.valid_notes[(i + j) % 12]) {
                    this.offset_notes[i] = j;
                    break;
                }
            }
        }
    };

    LGMIDIQuantize.prototype.onAction = function(event, midi_event) {
        if (!midi_event || midi_event.constructor !== MIDIEvent) {
            return;
        }

        if (
            midi_event.data[0] == MIDIEvent.NOTEON ||
            midi_event.data[0] == MIDIEvent.NOTEOFF
        ) {
            this.midi_event = new MIDIEvent();
            this.midi_event.setup(midi_event.data);
            var note = midi_event.note;
            var index = MIDIEvent.note_to_index[note];
            var offset = this.offset_notes[index];
            this.midi_event.data[1] += offset;
            this.trigger("out", this.midi_event);
        } else {
            this.trigger("out", midi_event);
        }
    };

    LGMIDIQuantize.prototype.onExecute = function() {
        var scale = this.getInputData(1);
        if (scale != null && scale != this._current_scale) {
            this.processScale(scale);
        }
    };

    LiteGraph.registerNodeType("midi/quantize", LGMIDIQuantize);

	function LGMIDIFromFile() {
        this.properties = {
            url: "",
			autoplay: true
        };

        this.addInput("play", LiteGraph.ACTION);
        this.addInput("pause", LiteGraph.ACTION);
        this.addOutput("note", LiteGraph.EVENT);
		this._midi = null;
		this._current_time = 0;
		this._playing = false;

        if (typeof MidiParser == "undefined") {
            console.error(
                "midi-parser.js not included, LGMidiPlay requires that library: https://raw.githubusercontent.com/colxi/midi-parser-js/master/src/main.js"
            );
            this.boxcolor = "red";
		}

	}

    LGMIDIFromFile.title = "MIDI fromFile";
    LGMIDIFromFile.desc = "Plays a MIDI file";
    LGMIDIFromFile.color = MIDI_COLOR;

	LGMIDIFromFile.prototype.onAction = function( name )
	{
		if(name == "play")
			this.play();
		else if(name == "pause")
			this._playing = !this._playing;
	}

	LGMIDIFromFile.prototype.onPropertyChanged = function(name,value)
	{
		if(name == "url")
			this.loadMIDIFile(value);
	}

    LGMIDIFromFile.prototype.onExecute = function() {
		if(!this._midi)
			return;

		if(!this._playing)
			return;

		this._current_time += this.graph.elapsed_time;
		var current_time = this._current_time * 100;

		for(var i = 0; i < this._midi.tracks; ++i)
		{
			var track = this._midi.track[i];
			if(!track._last_pos)
			{
				track._last_pos = 0;
				track._time = 0;
			}

			var elem = track.event[ track._last_pos ];
			if(elem && (track._time + elem.deltaTime) <= current_time )
			{
				track._last_pos++;
				track._time += elem.deltaTime;

				if(elem.data)
				{
					var midi_cmd = elem.type << 4 + elem.channel;
					var midi_event = new MIDIEvent();
					midi_event.setup([midi_cmd, elem.data[0], elem.data[1]]);
					this.trigger("note", midi_event);
				}
			}
			
		}
    };

	LGMIDIFromFile.prototype.play = function()
	{
		this._playing = true;
		this._current_time = 0;
		if(!this._midi)
			return;

		for(var i = 0; i < this._midi.tracks; ++i)
		{
			var track = this._midi.track[i];
			track._last_pos = 0;
			track._time = 0;
		}		
	}

	LGMIDIFromFile.prototype.loadMIDIFile = function(url)
	{
		var that = this;
		LiteGraph.fetchFile( url, "arraybuffer", function(data)
		{
			that.boxcolor = "#AFA";
			that._midi = MidiParser.parse( new Uint8Array(data) );
			if(that.properties.autoplay)
				that.play();
		}, function(err){
			that.boxcolor = "#FAA";
			that._midi = null;
		});
	}

	LGMIDIFromFile.prototype.onDropFile = function(file)
	{
		this.properties.url = "";
		this.loadMIDIFile( file );
	}

    LiteGraph.registerNodeType("midi/fromFile", LGMIDIFromFile);


    function LGMIDIPlay() {
        this.properties = {
            volume: 0.5,
            duration: 1
        };
        this.addInput("note", LiteGraph.ACTION);
        this.addInput("volume", "number");
        this.addInput("duration", "number");
        this.addOutput("note", LiteGraph.EVENT);

        if (typeof AudioSynth == "undefined") {
            console.error(
                "Audiosynth.js not included, LGMidiPlay requires that library"
            );
            this.boxcolor = "red";
        } else {
            var Synth = (this.synth = new AudioSynth());
            this.instrument = Synth.createInstrument("piano");
        }
    }

    LGMIDIPlay.title = "MIDI Play";
    LGMIDIPlay.desc = "Plays a MIDI note";
    LGMIDIPlay.color = MIDI_COLOR;

    LGMIDIPlay.prototype.onAction = function(event, midi_event) {
        if (!midi_event || midi_event.constructor !== MIDIEvent) {
            return;
        }

        if (this.instrument && midi_event.data[0] == MIDIEvent.NOTEON) {
            var note = midi_event.note; //C#
            if (!note || note == "undefined" || note.constructor !== String) {
                return;
            }
            this.instrument.play(
                note,
                midi_event.octave,
                this.properties.duration,
                this.properties.volume
            );
        }
        this.trigger("note", midi_event);
    };

    LGMIDIPlay.prototype.onExecute = function() {
        var volume = this.getInputData(1);
        if (volume != null) {
            this.properties.volume = volume;
        }

        var duration = this.getInputData(2);
        if (duration != null) {
            this.properties.duration = duration;
        }
    };

    LiteGraph.registerNodeType("midi/play", LGMIDIPlay);

    function LGMIDIKeys() {
        this.properties = {
            num_octaves: 2,
            start_octave: 2
        };
        this.addInput("note", LiteGraph.ACTION);
        this.addInput("reset", LiteGraph.ACTION);
        this.addOutput("note", LiteGraph.EVENT);
        this.size = [400, 100];
        this.keys = [];
        this._last_key = -1;
    }

    LGMIDIKeys.title = "MIDI Keys";
    LGMIDIKeys.desc = "Keyboard to play notes";
    LGMIDIKeys.color = MIDI_COLOR;

    LGMIDIKeys.keys = [
        { x: 0, w: 1, h: 1, t: 0 },
        { x: 0.75, w: 0.5, h: 0.6, t: 1 },
        { x: 1, w: 1, h: 1, t: 0 },
        { x: 1.75, w: 0.5, h: 0.6, t: 1 },
        { x: 2, w: 1, h: 1, t: 0 },
        { x: 2.75, w: 0.5, h: 0.6, t: 1 },
        { x: 3, w: 1, h: 1, t: 0 },
        { x: 4, w: 1, h: 1, t: 0 },
        { x: 4.75, w: 0.5, h: 0.6, t: 1 },
        { x: 5, w: 1, h: 1, t: 0 },
        { x: 5.75, w: 0.5, h: 0.6, t: 1 },
        { x: 6, w: 1, h: 1, t: 0 }
    ];

    LGMIDIKeys.prototype.onDrawForeground = function(ctx) {
        if (this.flags.collapsed) {
            return;
        }

        var num_keys = this.properties.num_octaves * 12;
        this.keys.length = num_keys;
        var key_width = this.size[0] / (this.properties.num_octaves * 7);
        var key_height = this.size[1];

        ctx.globalAlpha = 1;

        for (
            var k = 0;
            k < 2;
            k++ //draw first whites (0) then blacks (1)
        ) {
            for (var i = 0; i < num_keys; ++i) {
                var key_info = LGMIDIKeys.keys[i % 12];
                if (key_info.t != k) {
                    continue;
                }
                var octave = Math.floor(i / 12);
                var x = octave * 7 * key_width + key_info.x * key_width;
                if (k == 0) {
                    ctx.fillStyle = this.keys[i] ? "#CCC" : "white";
                } else {
                    ctx.fillStyle = this.keys[i] ? "#333" : "black";
                }
                ctx.fillRect(
                    x + 1,
                    0,
                    key_width * key_info.w - 2,
                    key_height * key_info.h
                );
            }
        }
    };

    LGMIDIKeys.prototype.getKeyIndex = function(pos) {
        var num_keys = this.properties.num_octaves * 12;
        var key_width = this.size[0] / (this.properties.num_octaves * 7);
        var key_height = this.size[1];

        for (
            var k = 1;
            k >= 0;
            k-- //test blacks first (1) then whites (0)
        ) {
            for (var i = 0; i < this.keys.length; ++i) {
                var key_info = LGMIDIKeys.keys[i % 12];
                if (key_info.t != k) {
                    continue;
                }
                var octave = Math.floor(i / 12);
                var x = octave * 7 * key_width + key_info.x * key_width;
                var w = key_width * key_info.w;
                var h = key_height * key_info.h;
                if (pos[0] < x || pos[0] > x + w || pos[1] > h) {
                    continue;
                }
                return i;
            }
        }
        return -1;
    };

    LGMIDIKeys.prototype.onAction = function(event, params) {
        if (event == "reset") {
            for (var i = 0; i < this.keys.length; ++i) {
                this.keys[i] = false;
            }
            return;
        }

        if (!params || params.constructor !== MIDIEvent) {
            return;
        }
        var midi_event = params;
        var start_note = (this.properties.start_octave - 1) * 12 + 29;
        var index = midi_event.data[1] - start_note;
        if (index >= 0 && index < this.keys.length) {
            if (midi_event.data[0] == MIDIEvent.NOTEON) {
                this.keys[index] = true;
            } else if (midi_event.data[0] == MIDIEvent.NOTEOFF) {
                this.keys[index] = false;
            }
        }

        this.trigger("note", midi_event);
    };

    LGMIDIKeys.prototype.onMouseDown = function(e, pos) {
        if (pos[1] < 0) {
            return;
        }
        var index = this.getKeyIndex(pos);
        this.keys[index] = true;
        this._last_key = index;
        var pitch = (this.properties.start_octave - 1) * 12 + 29 + index;
        var midi_event = new MIDIEvent();
        midi_event.setup([MIDIEvent.NOTEON, pitch, 100]);
        this.trigger("note", midi_event);
        return true;
    };

    LGMIDIKeys.prototype.onMouseMove = function(e, pos) {
        if (pos[1] < 0 || this._last_key == -1) {
            return;
        }
        this.setDirtyCanvas(true);
        var index = this.getKeyIndex(pos);
        if (this._last_key == index) {
            return true;
        }
        this.keys[this._last_key] = false;
        var pitch =
            (this.properties.start_octave - 1) * 12 + 29 + this._last_key;
        var midi_event = new MIDIEvent();
        midi_event.setup([MIDIEvent.NOTEOFF, pitch, 100]);
        this.trigger("note", midi_event);

        this.keys[index] = true;
        var pitch = (this.properties.start_octave - 1) * 12 + 29 + index;
        var midi_event = new MIDIEvent();
        midi_event.setup([MIDIEvent.NOTEON, pitch, 100]);
        this.trigger("note", midi_event);

        this._last_key = index;
        return true;
    };

    LGMIDIKeys.prototype.onMouseUp = function(e, pos) {
        if (pos[1] < 0) {
            return;
        }
        var index = this.getKeyIndex(pos);
        this.keys[index] = false;
        this._last_key = -1;
        var pitch = (this.properties.start_octave - 1) * 12 + 29 + index;
        var midi_event = new MIDIEvent();
        midi_event.setup([MIDIEvent.NOTEOFF, pitch, 100]);
        this.trigger("note", midi_event);
        return true;
    };

    LiteGraph.registerNodeType("midi/keys", LGMIDIKeys);

    function now() {
        return window.performance.now();
    }
})(this);

(function(global) {
    var LiteGraph = global.LiteGraph;

    var LGAudio = {};
    global.LGAudio = LGAudio;

    LGAudio.getAudioContext = function() {
        if (!this._audio_context) {
            window.AudioContext =
                window.AudioContext || window.webkitAudioContext;
            if (!window.AudioContext) {
                console.error("AudioContext not supported by browser");
                return null;
            }
            this._audio_context = new AudioContext();
            this._audio_context.onmessage = function(msg) {
                console.log("msg", msg);
            };
            this._audio_context.onended = function(msg) {
                console.log("ended", msg);
            };
            this._audio_context.oncomplete = function(msg) {
                console.log("complete", msg);
            };
        }

        //in case it crashes
        //if(this._audio_context.state == "suspended")
        //	this._audio_context.resume();
        return this._audio_context;
    };

    LGAudio.connect = function(audionodeA, audionodeB) {
        try {
            audionodeA.connect(audionodeB);
        } catch (err) {
            console.warn("LGraphAudio:", err);
        }
    };

    LGAudio.disconnect = function(audionodeA, audionodeB) {
        try {
            audionodeA.disconnect(audionodeB);
        } catch (err) {
            console.warn("LGraphAudio:", err);
        }
    };

    LGAudio.changeAllAudiosConnections = function(node, connect) {
        if (node.inputs) {
            for (var i = 0; i < node.inputs.length; ++i) {
                var input = node.inputs[i];
                var link_info = node.graph.links[input.link];
                if (!link_info) {
                    continue;
                }

                var origin_node = node.graph.getNodeById(link_info.origin_id);
                var origin_audionode = null;
                if (origin_node.getAudioNodeInOutputSlot) {
                    origin_audionode = origin_node.getAudioNodeInOutputSlot(
                        link_info.origin_slot
                    );
                } else {
                    origin_audionode = origin_node.audionode;
                }

                var target_audionode = null;
                if (node.getAudioNodeInInputSlot) {
                    target_audionode = node.getAudioNodeInInputSlot(i);
                } else {
                    target_audionode = node.audionode;
                }

                if (connect) {
                    LGAudio.connect(origin_audionode, target_audionode);
                } else {
                    LGAudio.disconnect(origin_audionode, target_audionode);
                }
            }
        }

        if (node.outputs) {
            for (var i = 0; i < node.outputs.length; ++i) {
                var output = node.outputs[i];
                for (var j = 0; j < output.links.length; ++j) {
                    var link_info = node.graph.links[output.links[j]];
                    if (!link_info) {
                        continue;
                    }

                    var origin_audionode = null;
                    if (node.getAudioNodeInOutputSlot) {
                        origin_audionode = node.getAudioNodeInOutputSlot(i);
                    } else {
                        origin_audionode = node.audionode;
                    }

                    var target_node = node.graph.getNodeById(
                        link_info.target_id
                    );
                    var target_audionode = null;
                    if (target_node.getAudioNodeInInputSlot) {
                        target_audionode = target_node.getAudioNodeInInputSlot(
                            link_info.target_slot
                        );
                    } else {
                        target_audionode = target_node.audionode;
                    }

                    if (connect) {
                        LGAudio.connect(origin_audionode, target_audionode);
                    } else {
                        LGAudio.disconnect(origin_audionode, target_audionode);
                    }
                }
            }
        }
    };

    //used by many nodes
    LGAudio.onConnectionsChange = function(
        connection,
        slot,
        connected,
        link_info
    ) {
        //only process the outputs events
        if (connection != LiteGraph.OUTPUT) {
            return;
        }

        var target_node = null;
        if (link_info) {
            target_node = this.graph.getNodeById(link_info.target_id);
        }

        if (!target_node) {
            return;
        }

        //get origin audionode
        var local_audionode = null;
        if (this.getAudioNodeInOutputSlot) {
            local_audionode = this.getAudioNodeInOutputSlot(slot);
        } else {
            local_audionode = this.audionode;
        }

        //get target audionode
        var target_audionode = null;
        if (target_node.getAudioNodeInInputSlot) {
            target_audionode = target_node.getAudioNodeInInputSlot(
                link_info.target_slot
            );
        } else {
            target_audionode = target_node.audionode;
        }

        //do the connection/disconnection
        if (connected) {
            LGAudio.connect(local_audionode, target_audionode);
        } else {
            LGAudio.disconnect(local_audionode, target_audionode);
        }
    };

    //this function helps creating wrappers to existing classes
    LGAudio.createAudioNodeWrapper = function(class_object) {
        var old_func = class_object.prototype.onPropertyChanged;

        class_object.prototype.onPropertyChanged = function(name, value) {
            if (old_func) {
                old_func.call(this, name, value);
            }

            if (!this.audionode) {
                return;
            }

            if (this.audionode[name] === undefined) {
                return;
            }

            if (this.audionode[name].value !== undefined) {
                this.audionode[name].value = value;
            } else {
                this.audionode[name] = value;
            }
        };

        class_object.prototype.onConnectionsChange =
            LGAudio.onConnectionsChange;
    };

    //contains the samples decoded of the loaded audios in AudioBuffer format
    LGAudio.cached_audios = {};

    LGAudio.loadSound = function(url, on_complete, on_error) {
        if (LGAudio.cached_audios[url] && url.indexOf("blob:") == -1) {
            if (on_complete) {
                on_complete(LGAudio.cached_audios[url]);
            }
            return;
        }

        if (LGAudio.onProcessAudioURL) {
            url = LGAudio.onProcessAudioURL(url);
        }

        //load new sample
        var request = new XMLHttpRequest();
        request.open("GET", url, true);
        request.responseType = "arraybuffer";

        var context = LGAudio.getAudioContext();

        // Decode asynchronously
        request.onload = function() {
            console.log("AudioSource loaded");
            context.decodeAudioData(
                request.response,
                function(buffer) {
                    console.log("AudioSource decoded");
                    LGAudio.cached_audios[url] = buffer;
                    if (on_complete) {
                        on_complete(buffer);
                    }
                },
                onError
            );
        };
        request.send();

        function onError(err) {
            console.log("Audio loading sample error:", err);
            if (on_error) {
                on_error(err);
            }
        }

        return request;
    };

    //****************************************************

    function LGAudioSource() {
        this.properties = {
            src: "",
            gain: 0.5,
            loop: true,
            autoplay: true,
            playbackRate: 1
        };

        this._loading_audio = false;
        this._audiobuffer = null; //points to AudioBuffer with the audio samples decoded
        this._audionodes = [];
        this._last_sourcenode = null; //the last AudioBufferSourceNode (there could be more if there are several sounds playing)

        this.addOutput("out", "audio");
        this.addInput("gain", "number");

        //init context
        var context = LGAudio.getAudioContext();

        //create gain node to control volume
        this.audionode = context.createGain();
        this.audionode.graphnode = this;
        this.audionode.gain.value = this.properties.gain;

        //debug
        if (this.properties.src) {
            this.loadSound(this.properties.src);
        }
    }

	LGAudioSource.desc = "Plays an audio file";
    LGAudioSource["@src"] = { widget: "resource" };
    LGAudioSource.supported_extensions = ["wav", "ogg", "mp3"];

    LGAudioSource.prototype.onAdded = function(graph) {
        if (graph.status === LGraph.STATUS_RUNNING) {
            this.onStart();
        }
    };

    LGAudioSource.prototype.onStart = function() {
        if (!this._audiobuffer) {
            return;
        }

        if (this.properties.autoplay) {
			this.playBuffer(this._audiobuffer);
        }
    };

    LGAudioSource.prototype.onStop = function() {
        this.stopAllSounds();
    };

    LGAudioSource.prototype.onPause = function() {
        this.pauseAllSounds();
    };

    LGAudioSource.prototype.onUnpause = function() {
        this.unpauseAllSounds();
        //this.onStart();
    };

    LGAudioSource.prototype.onRemoved = function() {
        this.stopAllSounds();
        if (this._dropped_url) {
            URL.revokeObjectURL(this._url);
        }
    };

    LGAudioSource.prototype.stopAllSounds = function() {
        //iterate and stop
        for (var i = 0; i < this._audionodes.length; ++i) {
            if (this._audionodes[i].started) {
                this._audionodes[i].started = false;
                this._audionodes[i].stop();
            }
            //this._audionodes[i].disconnect( this.audionode );
        }
        this._audionodes.length = 0;
    };

    LGAudioSource.prototype.pauseAllSounds = function() {
        LGAudio.getAudioContext().suspend();
    };

    LGAudioSource.prototype.unpauseAllSounds = function() {
        LGAudio.getAudioContext().resume();
    };

    LGAudioSource.prototype.onExecute = function() {
        if (this.inputs) {
            for (var i = 0; i < this.inputs.length; ++i) {
                var input = this.inputs[i];
                if (input.link == null) {
                    continue;
                }
                var v = this.getInputData(i);
                if (v === undefined) {
                    continue;
                }
                if (input.name == "gain")
                    this.audionode.gain.value = v;
                else if (input.name == "src") {
                    this.setProperty("src",v);
                } else if (input.name == "playbackRate") {
                    this.properties.playbackRate = v;
                    for (var j = 0; j < this._audionodes.length; ++j) {
                        this._audionodes[j].playbackRate.value = v;
                    }
                }
            }
        }

        if (this.outputs) {
            for (var i = 0; i < this.outputs.length; ++i) {
                var output = this.outputs[i];
                if (output.name == "buffer" && this._audiobuffer) {
                    this.setOutputData(i, this._audiobuffer);
                }
            }
        }
    };

    LGAudioSource.prototype.onAction = function(event) {
        if (this._audiobuffer) {
            if (event == "Play") {
                this.playBuffer(this._audiobuffer);
            } else if (event == "Stop") {
                this.stopAllSounds();
            }
        }
    };

    LGAudioSource.prototype.onPropertyChanged = function(name, value) {
        if (name == "src") {
            this.loadSound(value);
        } else if (name == "gain") {
            this.audionode.gain.value = value;
        } else if (name == "playbackRate") {
            for (var j = 0; j < this._audionodes.length; ++j) {
                this._audionodes[j].playbackRate.value = value;
            }
        }
    };

    LGAudioSource.prototype.playBuffer = function(buffer) {
        var that = this;
        var context = LGAudio.getAudioContext();

        //create a new audionode (this is mandatory, AudioAPI doesnt like to reuse old ones)
        var audionode = context.createBufferSource(); //create a AudioBufferSourceNode
        this._last_sourcenode = audionode;
        audionode.graphnode = this;
        audionode.buffer = buffer;
        audionode.loop = this.properties.loop;
        audionode.playbackRate.value = this.properties.playbackRate;
        this._audionodes.push(audionode);
        audionode.connect(this.audionode); //connect to gain

		this._audionodes.push(audionode);

		this.trigger("start");

        audionode.onended = function() {
            //console.log("ended!");
            that.trigger("ended");
            //remove
            var index = that._audionodes.indexOf(audionode);
            if (index != -1) {
                that._audionodes.splice(index, 1);
            }
        };

        if (!audionode.started) {
            audionode.started = true;
            audionode.start();
        }
        return audionode;
    };

    LGAudioSource.prototype.loadSound = function(url) {
        var that = this;

        //kill previous load
        if (this._request) {
            this._request.abort();
            this._request = null;
        }

        this._audiobuffer = null; //points to the audiobuffer once the audio is loaded
        this._loading_audio = false;

        if (!url) {
            return;
        }

        this._request = LGAudio.loadSound(url, inner);

        this._loading_audio = true;
        this.boxcolor = "#AA4";

        function inner(buffer) {
            this.boxcolor = LiteGraph.NODE_DEFAULT_BOXCOLOR;
            that._audiobuffer = buffer;
            that._loading_audio = false;
            //if is playing, then play it
            if (that.graph && that.graph.status === LGraph.STATUS_RUNNING) {
                that.onStart();
            } //this controls the autoplay already
        }
    };

    //Helps connect/disconnect AudioNodes when new connections are made in the node
    LGAudioSource.prototype.onConnectionsChange = LGAudio.onConnectionsChange;

    LGAudioSource.prototype.onGetInputs = function() {
        return [
            ["playbackRate", "number"],
			["src","string"],
            ["Play", LiteGraph.ACTION],
            ["Stop", LiteGraph.ACTION]
        ];
    };

    LGAudioSource.prototype.onGetOutputs = function() {
        return [["buffer", "audiobuffer"], ["start", LiteGraph.EVENT], ["ended", LiteGraph.EVENT]];
    };

    LGAudioSource.prototype.onDropFile = function(file) {
        if (this._dropped_url) {
            URL.revokeObjectURL(this._dropped_url);
        }
        var url = URL.createObjectURL(file);
        this.properties.src = url;
        this.loadSound(url);
        this._dropped_url = url;
    };

    LGAudioSource.title = "Source";
    LGAudioSource.desc = "Plays audio";
    LiteGraph.registerNodeType("audio/source", LGAudioSource);

    //****************************************************

    function LGAudioMediaSource() {
        this.properties = {
            gain: 0.5
        };

        this._audionodes = [];
        this._media_stream = null;

        this.addOutput("out", "audio");
        this.addInput("gain", "number");

        //create gain node to control volume
        var context = LGAudio.getAudioContext();
        this.audionode = context.createGain();
        this.audionode.graphnode = this;
        this.audionode.gain.value = this.properties.gain;
    }

    LGAudioMediaSource.prototype.onAdded = function(graph) {
        if (graph.status === LGraph.STATUS_RUNNING) {
            this.onStart();
        }
    };

    LGAudioMediaSource.prototype.onStart = function() {
        if (this._media_stream == null && !this._waiting_confirmation) {
            this.openStream();
        }
    };

    LGAudioMediaSource.prototype.onStop = function() {
        this.audionode.gain.value = 0;
    };

    LGAudioMediaSource.prototype.onPause = function() {
        this.audionode.gain.value = 0;
    };

    LGAudioMediaSource.prototype.onUnpause = function() {
        this.audionode.gain.value = this.properties.gain;
    };

    LGAudioMediaSource.prototype.onRemoved = function() {
        this.audionode.gain.value = 0;
        if (this.audiosource_node) {
            this.audiosource_node.disconnect(this.audionode);
            this.audiosource_node = null;
        }
        if (this._media_stream) {
            var tracks = this._media_stream.getTracks();
            if (tracks.length) {
                tracks[0].stop();
            }
        }
    };

    LGAudioMediaSource.prototype.openStream = function() {
        if (!navigator.mediaDevices) {
            console.log(
                "getUserMedia() is not supported in your browser, use chrome and enable WebRTC from about://flags"
            );
            return;
        }

        this._waiting_confirmation = true;

        // Not showing vendor prefixes.
        navigator.mediaDevices
            .getUserMedia({ audio: true, video: false })
            .then(this.streamReady.bind(this))
            .catch(onFailSoHard);

        var that = this;
        function onFailSoHard(err) {
            console.log("Media rejected", err);
            that._media_stream = false;
            that.boxcolor = "red";
        }
    };

    LGAudioMediaSource.prototype.streamReady = function(localMediaStream) {
        this._media_stream = localMediaStream;
        //this._waiting_confirmation = false;

        //init context
        if (this.audiosource_node) {
            this.audiosource_node.disconnect(this.audionode);
        }
        var context = LGAudio.getAudioContext();
        this.audiosource_node = context.createMediaStreamSource(
            localMediaStream
        );
        this.audiosource_node.graphnode = this;
        this.audiosource_node.connect(this.audionode);
        this.boxcolor = "white";
    };

    LGAudioMediaSource.prototype.onExecute = function() {
        if (this._media_stream == null && !this._waiting_confirmation) {
            this.openStream();
        }

        if (this.inputs) {
            for (var i = 0; i < this.inputs.length; ++i) {
                var input = this.inputs[i];
                if (input.link == null) {
                    continue;
                }
                var v = this.getInputData(i);
                if (v === undefined) {
                    continue;
                }
                if (input.name == "gain") {
                    this.audionode.gain.value = this.properties.gain = v;
                }
            }
        }
    };

    LGAudioMediaSource.prototype.onAction = function(event) {
        if (event == "Play") {
            this.audionode.gain.value = this.properties.gain;
        } else if (event == "Stop") {
            this.audionode.gain.value = 0;
        }
    };

    LGAudioMediaSource.prototype.onPropertyChanged = function(name, value) {
        if (name == "gain") {
            this.audionode.gain.value = value;
        }
    };

    //Helps connect/disconnect AudioNodes when new connections are made in the node
    LGAudioMediaSource.prototype.onConnectionsChange =
        LGAudio.onConnectionsChange;

    LGAudioMediaSource.prototype.onGetInputs = function() {
        return [
            ["playbackRate", "number"],
            ["Play", LiteGraph.ACTION],
            ["Stop", LiteGraph.ACTION]
        ];
    };

    LGAudioMediaSource.title = "MediaSource";
    LGAudioMediaSource.desc = "Plays microphone";
    LiteGraph.registerNodeType("audio/media_source", LGAudioMediaSource);

    //*****************************************************

    function LGAudioAnalyser() {
        this.properties = {
            fftSize: 2048,
            minDecibels: -100,
            maxDecibels: -10,
            smoothingTimeConstant: 0.5
        };

        var context = LGAudio.getAudioContext();

        this.audionode = context.createAnalyser();
        this.audionode.graphnode = this;
        this.audionode.fftSize = this.properties.fftSize;
        this.audionode.minDecibels = this.properties.minDecibels;
        this.audionode.maxDecibels = this.properties.maxDecibels;
        this.audionode.smoothingTimeConstant = this.properties.smoothingTimeConstant;

        this.addInput("in", "audio");
        this.addOutput("freqs", "array");
        this.addOutput("samples", "array");

        this._freq_bin = null;
        this._time_bin = null;
    }

    LGAudioAnalyser.prototype.onPropertyChanged = function(name, value) {
        this.audionode[name] = value;
    };

    LGAudioAnalyser.prototype.onExecute = function() {
        if (this.isOutputConnected(0)) {
            //send FFT
            var bufferLength = this.audionode.frequencyBinCount;
            if (!this._freq_bin || this._freq_bin.length != bufferLength) {
                this._freq_bin = new Uint8Array(bufferLength);
            }
            this.audionode.getByteFrequencyData(this._freq_bin);
            this.setOutputData(0, this._freq_bin);
        }

        //send analyzer
        if (this.isOutputConnected(1)) {
            //send Samples
            var bufferLength = this.audionode.frequencyBinCount;
            if (!this._time_bin || this._time_bin.length != bufferLength) {
                this._time_bin = new Uint8Array(bufferLength);
            }
            this.audionode.getByteTimeDomainData(this._time_bin);
            this.setOutputData(1, this._time_bin);
        }

        //properties
        for (var i = 1; i < this.inputs.length; ++i) {
            var input = this.inputs[i];
            if (input.link == null) {
                continue;
            }
            var v = this.getInputData(i);
            if (v !== undefined) {
                this.audionode[input.name].value = v;
            }
        }

        //time domain
        //this.audionode.getFloatTimeDomainData( dataArray );
    };

    LGAudioAnalyser.prototype.onGetInputs = function() {
        return [
            ["minDecibels", "number"],
            ["maxDecibels", "number"],
            ["smoothingTimeConstant", "number"]
        ];
    };

    LGAudioAnalyser.prototype.onGetOutputs = function() {
        return [["freqs", "array"], ["samples", "array"]];
    };

    LGAudioAnalyser.title = "Analyser";
    LGAudioAnalyser.desc = "Audio Analyser";
    LiteGraph.registerNodeType("audio/analyser", LGAudioAnalyser);

    //*****************************************************

    function LGAudioGain() {
        //default
        this.properties = {
            gain: 1
        };

        this.audionode = LGAudio.getAudioContext().createGain();
        this.addInput("in", "audio");
        this.addInput("gain", "number");
        this.addOutput("out", "audio");
    }

    LGAudioGain.prototype.onExecute = function() {
        if (!this.inputs || !this.inputs.length) {
            return;
        }

        for (var i = 1; i < this.inputs.length; ++i) {
            var input = this.inputs[i];
            var v = this.getInputData(i);
            if (v !== undefined) {
                this.audionode[input.name].value = v;
            }
        }
    };

    LGAudio.createAudioNodeWrapper(LGAudioGain);

    LGAudioGain.title = "Gain";
    LGAudioGain.desc = "Audio gain";
    LiteGraph.registerNodeType("audio/gain", LGAudioGain);

    function LGAudioConvolver() {
        //default
        this.properties = {
            impulse_src: "",
            normalize: true
        };

        this.audionode = LGAudio.getAudioContext().createConvolver();
        this.addInput("in", "audio");
        this.addOutput("out", "audio");
    }

    LGAudio.createAudioNodeWrapper(LGAudioConvolver);

    LGAudioConvolver.prototype.onRemove = function() {
        if (this._dropped_url) {
            URL.revokeObjectURL(this._dropped_url);
        }
    };

    LGAudioConvolver.prototype.onPropertyChanged = function(name, value) {
        if (name == "impulse_src") {
            this.loadImpulse(value);
        } else if (name == "normalize") {
            this.audionode.normalize = value;
        }
    };

    LGAudioConvolver.prototype.onDropFile = function(file) {
        if (this._dropped_url) {
            URL.revokeObjectURL(this._dropped_url);
        }
        this._dropped_url = URL.createObjectURL(file);
        this.properties.impulse_src = this._dropped_url;
        this.loadImpulse(this._dropped_url);
    };

    LGAudioConvolver.prototype.loadImpulse = function(url) {
        var that = this;

        //kill previous load
        if (this._request) {
            this._request.abort();
            this._request = null;
        }

        this._impulse_buffer = null;
        this._loading_impulse = false;

        if (!url) {
            return;
        }

        //load new sample
        this._request = LGAudio.loadSound(url, inner);
        this._loading_impulse = true;

        // Decode asynchronously
        function inner(buffer) {
            that._impulse_buffer = buffer;
            that.audionode.buffer = buffer;
            console.log("Impulse signal set");
            that._loading_impulse = false;
        }
    };

    LGAudioConvolver.title = "Convolver";
    LGAudioConvolver.desc = "Convolves the signal (used for reverb)";
    LiteGraph.registerNodeType("audio/convolver", LGAudioConvolver);

    function LGAudioDynamicsCompressor() {
        //default
        this.properties = {
            threshold: -50,
            knee: 40,
            ratio: 12,
            reduction: -20,
            attack: 0,
            release: 0.25
        };

        this.audionode = LGAudio.getAudioContext().createDynamicsCompressor();
        this.addInput("in", "audio");
        this.addOutput("out", "audio");
    }

    LGAudio.createAudioNodeWrapper(LGAudioDynamicsCompressor);

    LGAudioDynamicsCompressor.prototype.onExecute = function() {
        if (!this.inputs || !this.inputs.length) {
            return;
        }
        for (var i = 1; i < this.inputs.length; ++i) {
            var input = this.inputs[i];
            if (input.link == null) {
                continue;
            }
            var v = this.getInputData(i);
            if (v !== undefined) {
                this.audionode[input.name].value = v;
            }
        }
    };

    LGAudioDynamicsCompressor.prototype.onGetInputs = function() {
        return [
            ["threshold", "number"],
            ["knee", "number"],
            ["ratio", "number"],
            ["reduction", "number"],
            ["attack", "number"],
            ["release", "number"]
        ];
    };

    LGAudioDynamicsCompressor.title = "DynamicsCompressor";
    LGAudioDynamicsCompressor.desc = "Dynamics Compressor";
    LiteGraph.registerNodeType(
        "audio/dynamicsCompressor",
        LGAudioDynamicsCompressor
    );

    function LGAudioWaveShaper() {
        //default
        this.properties = {};

        this.audionode = LGAudio.getAudioContext().createWaveShaper();
        this.addInput("in", "audio");
        this.addInput("shape", "waveshape");
        this.addOutput("out", "audio");
    }

    LGAudioWaveShaper.prototype.onExecute = function() {
        if (!this.inputs || !this.inputs.length) {
            return;
        }
        var v = this.getInputData(1);
        if (v === undefined) {
            return;
        }
        this.audionode.curve = v;
    };

    LGAudioWaveShaper.prototype.setWaveShape = function(shape) {
        this.audionode.curve = shape;
    };

    LGAudio.createAudioNodeWrapper(LGAudioWaveShaper);

    /* disabled till I dont find a way to do a wave shape
LGAudioWaveShaper.title = "WaveShaper";
LGAudioWaveShaper.desc = "Distortion using wave shape";
LiteGraph.registerNodeType("audio/waveShaper", LGAudioWaveShaper);
*/

    function LGAudioMixer() {
        //default
        this.properties = {
            gain1: 0.5,
            gain2: 0.5
        };

        this.audionode = LGAudio.getAudioContext().createGain();

        this.audionode1 = LGAudio.getAudioContext().createGain();
        this.audionode1.gain.value = this.properties.gain1;
        this.audionode2 = LGAudio.getAudioContext().createGain();
        this.audionode2.gain.value = this.properties.gain2;

        this.audionode1.connect(this.audionode);
        this.audionode2.connect(this.audionode);

        this.addInput("in1", "audio");
        this.addInput("in1 gain", "number");
        this.addInput("in2", "audio");
        this.addInput("in2 gain", "number");

        this.addOutput("out", "audio");
    }

    LGAudioMixer.prototype.getAudioNodeInInputSlot = function(slot) {
        if (slot == 0) {
            return this.audionode1;
        } else if (slot == 2) {
            return this.audionode2;
        }
    };

    LGAudioMixer.prototype.onPropertyChanged = function(name, value) {
        if (name == "gain1") {
            this.audionode1.gain.value = value;
        } else if (name == "gain2") {
            this.audionode2.gain.value = value;
        }
    };

    LGAudioMixer.prototype.onExecute = function() {
        if (!this.inputs || !this.inputs.length) {
            return;
        }

        for (var i = 1; i < this.inputs.length; ++i) {
            var input = this.inputs[i];

            if (input.link == null || input.type == "audio") {
                continue;
            }

            var v = this.getInputData(i);
            if (v === undefined) {
                continue;
            }

            if (i == 1) {
                this.audionode1.gain.value = v;
            } else if (i == 3) {
                this.audionode2.gain.value = v;
            }
        }
    };

    LGAudio.createAudioNodeWrapper(LGAudioMixer);

    LGAudioMixer.title = "Mixer";
    LGAudioMixer.desc = "Audio mixer";
    LiteGraph.registerNodeType("audio/mixer", LGAudioMixer);

    function LGAudioADSR() {
        //default
        this.properties = {
            A: 0.1,
            D: 0.1,
            S: 0.1,
            R: 0.1
        };

        this.audionode = LGAudio.getAudioContext().createGain();
        this.audionode.gain.value = 0;
        this.addInput("in", "audio");
        this.addInput("gate", "bool");
        this.addOutput("out", "audio");
        this.gate = false;
    }

    LGAudioADSR.prototype.onExecute = function() {
        var audioContext = LGAudio.getAudioContext();
        var now = audioContext.currentTime;
        var node = this.audionode;
        var gain = node.gain;
        var current_gate = this.getInputData(1);

        var A = this.getInputOrProperty("A");
        var D = this.getInputOrProperty("D");
        var S = this.getInputOrProperty("S");
        var R = this.getInputOrProperty("R");

        if (!this.gate && current_gate) {
            gain.cancelScheduledValues(0);
            gain.setValueAtTime(0, now);
            gain.linearRampToValueAtTime(1, now + A);
            gain.linearRampToValueAtTime(S, now + A + D);
        } else if (this.gate && !current_gate) {
            gain.cancelScheduledValues(0);
            gain.setValueAtTime(gain.value, now);
            gain.linearRampToValueAtTime(0, now + R);
        }

        this.gate = current_gate;
    };

    LGAudioADSR.prototype.onGetInputs = function() {
        return [
            ["A", "number"],
            ["D", "number"],
            ["S", "number"],
            ["R", "number"]
        ];
    };

    LGAudio.createAudioNodeWrapper(LGAudioADSR);

    LGAudioADSR.title = "ADSR";
    LGAudioADSR.desc = "Audio envelope";
    LiteGraph.registerNodeType("audio/adsr", LGAudioADSR);

    function LGAudioDelay() {
        //default
        this.properties = {
            delayTime: 0.5
        };

        this.audionode = LGAudio.getAudioContext().createDelay(10);
        this.audionode.delayTime.value = this.properties.delayTime;
        this.addInput("in", "audio");
        this.addInput("time", "number");
        this.addOutput("out", "audio");
    }

    LGAudio.createAudioNodeWrapper(LGAudioDelay);

    LGAudioDelay.prototype.onExecute = function() {
        var v = this.getInputData(1);
        if (v !== undefined) {
            this.audionode.delayTime.value = v;
        }
    };

    LGAudioDelay.title = "Delay";
    LGAudioDelay.desc = "Audio delay";
    LiteGraph.registerNodeType("audio/delay", LGAudioDelay);

    function LGAudioBiquadFilter() {
        //default
        this.properties = {
            frequency: 350,
            detune: 0,
            Q: 1
        };
        this.addProperty("type", "lowpass", "enum", {
            values: [
                "lowpass",
                "highpass",
                "bandpass",
                "lowshelf",
                "highshelf",
                "peaking",
                "notch",
                "allpass"
            ]
        });

        //create node
        this.audionode = LGAudio.getAudioContext().createBiquadFilter();

        //slots
        this.addInput("in", "audio");
        this.addOutput("out", "audio");
    }

    LGAudioBiquadFilter.prototype.onExecute = function() {
        if (!this.inputs || !this.inputs.length) {
            return;
        }

        for (var i = 1; i < this.inputs.length; ++i) {
            var input = this.inputs[i];
            if (input.link == null) {
                continue;
            }
            var v = this.getInputData(i);
            if (v !== undefined) {
                this.audionode[input.name].value = v;
            }
        }
    };

    LGAudioBiquadFilter.prototype.onGetInputs = function() {
        return [["frequency", "number"], ["detune", "number"], ["Q", "number"]];
    };

    LGAudio.createAudioNodeWrapper(LGAudioBiquadFilter);

    LGAudioBiquadFilter.title = "BiquadFilter";
    LGAudioBiquadFilter.desc = "Audio filter";
    LiteGraph.registerNodeType("audio/biquadfilter", LGAudioBiquadFilter);

    function LGAudioOscillatorNode() {
        //default
        this.properties = {
            frequency: 440,
            detune: 0,
            type: "sine"
        };
        this.addProperty("type", "sine", "enum", {
            values: ["sine", "square", "sawtooth", "triangle", "custom"]
        });

        //create node
        this.audionode = LGAudio.getAudioContext().createOscillator();

        //slots
        this.addOutput("out", "audio");
    }

    LGAudioOscillatorNode.prototype.onStart = function() {
        if (!this.audionode.started) {
            this.audionode.started = true;
            try {
                this.audionode.start();
            } catch (err) {}
        }
    };

    LGAudioOscillatorNode.prototype.onStop = function() {
        if (this.audionode.started) {
            this.audionode.started = false;
            this.audionode.stop();
        }
    };

    LGAudioOscillatorNode.prototype.onPause = function() {
        this.onStop();
    };

    LGAudioOscillatorNode.prototype.onUnpause = function() {
        this.onStart();
    };

    LGAudioOscillatorNode.prototype.onExecute = function() {
        if (!this.inputs || !this.inputs.length) {
            return;
        }

        for (var i = 0; i < this.inputs.length; ++i) {
            var input = this.inputs[i];
            if (input.link == null) {
                continue;
            }
            var v = this.getInputData(i);
            if (v !== undefined) {
                this.audionode[input.name].value = v;
            }
        }
    };

    LGAudioOscillatorNode.prototype.onGetInputs = function() {
        return [
            ["frequency", "number"],
            ["detune", "number"],
            ["type", "string"]
        ];
    };

    LGAudio.createAudioNodeWrapper(LGAudioOscillatorNode);

    LGAudioOscillatorNode.title = "Oscillator";
    LGAudioOscillatorNode.desc = "Oscillator";
    LiteGraph.registerNodeType("audio/oscillator", LGAudioOscillatorNode);

    //*****************************************************

    //EXTRA

    function LGAudioVisualization() {
        this.properties = {
            continuous: true,
            mark: -1
        };

        this.addInput("data", "array");
        this.addInput("mark", "number");
        this.size = [300, 200];
        this._last_buffer = null;
    }

    LGAudioVisualization.prototype.onExecute = function() {
        this._last_buffer = this.getInputData(0);
        var v = this.getInputData(1);
        if (v !== undefined) {
            this.properties.mark = v;
        }
        this.setDirtyCanvas(true, false);
    };

    LGAudioVisualization.prototype.onDrawForeground = function(ctx) {
        if (!this._last_buffer) {
            return;
        }

        var buffer = this._last_buffer;

        //delta represents how many samples we advance per pixel
        var delta = buffer.length / this.size[0];
        var h = this.size[1];

        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, this.size[0], this.size[1]);
        ctx.strokeStyle = "white";
        ctx.beginPath();
        var x = 0;

        if (this.properties.continuous) {
            ctx.moveTo(x, h);
            for (var i = 0; i < buffer.length; i += delta) {
                ctx.lineTo(x, h - (buffer[i | 0] / 255) * h);
                x++;
            }
        } else {
            for (var i = 0; i < buffer.length; i += delta) {
                ctx.moveTo(x + 0.5, h);
                ctx.lineTo(x + 0.5, h - (buffer[i | 0] / 255) * h);
                x++;
            }
        }
        ctx.stroke();

        if (this.properties.mark >= 0) {
            var samplerate = LGAudio.getAudioContext().sampleRate;
            var binfreq = samplerate / buffer.length;
            var x = (2 * (this.properties.mark / binfreq)) / delta;
            if (x >= this.size[0]) {
                x = this.size[0] - 1;
            }
            ctx.strokeStyle = "red";
            ctx.beginPath();
            ctx.moveTo(x, h);
            ctx.lineTo(x, 0);
            ctx.stroke();
        }
    };

    LGAudioVisualization.title = "Visualization";
    LGAudioVisualization.desc = "Audio Visualization";
    LiteGraph.registerNodeType("audio/visualization", LGAudioVisualization);

    function LGAudioBandSignal() {
        //default
        this.properties = {
            band: 440,
            amplitude: 1
        };

        this.addInput("freqs", "array");
        this.addOutput("signal", "number");
    }

    LGAudioBandSignal.prototype.onExecute = function() {
        this._freqs = this.getInputData(0);
        if (!this._freqs) {
            return;
        }

        var band = this.properties.band;
        var v = this.getInputData(1);
        if (v !== undefined) {
            band = v;
        }

        var samplerate = LGAudio.getAudioContext().sampleRate;
        var binfreq = samplerate / this._freqs.length;
        var index = 2 * (band / binfreq);
        var v = 0;
        if (index < 0) {
            v = this._freqs[0];
        }
        if (index >= this._freqs.length) {
            v = this._freqs[this._freqs.length - 1];
        } else {
            var pos = index | 0;
            var v0 = this._freqs[pos];
            var v1 = this._freqs[pos + 1];
            var f = index - pos;
            v = v0 * (1 - f) + v1 * f;
        }

        this.setOutputData(0, (v / 255) * this.properties.amplitude);
    };

    LGAudioBandSignal.prototype.onGetInputs = function() {
        return [["band", "number"]];
    };

    LGAudioBandSignal.title = "Signal";
    LGAudioBandSignal.desc = "extract the signal of some frequency";
    LiteGraph.registerNodeType("audio/signal", LGAudioBandSignal);

    function LGAudioScript() {
        if (!LGAudioScript.default_code) {
            var code = LGAudioScript.default_function.toString();
            var index = code.indexOf("{") + 1;
            var index2 = code.lastIndexOf("}");
            LGAudioScript.default_code = code.substr(index, index2 - index);
        }

        //default
        this.properties = {
            code: LGAudioScript.default_code
        };

        //create node
        var ctx = LGAudio.getAudioContext();
        if (ctx.createScriptProcessor) {
            this.audionode = ctx.createScriptProcessor(4096, 1, 1);
        }
        //buffer size, input channels, output channels
        else {
            console.warn("ScriptProcessorNode deprecated");
            this.audionode = ctx.createGain(); //bypass audio
        }

        this.processCode();
        if (!LGAudioScript._bypass_function) {
            LGAudioScript._bypass_function = this.audionode.onaudioprocess;
        }

        //slots
        this.addInput("in", "audio");
        this.addOutput("out", "audio");
    }

    LGAudioScript.prototype.onAdded = function(graph) {
        if (graph.status == LGraph.STATUS_RUNNING) {
            this.audionode.onaudioprocess = this._callback;
        }
    };

    LGAudioScript["@code"] = { widget: "code", type: "code" };

    LGAudioScript.prototype.onStart = function() {
        this.audionode.onaudioprocess = this._callback;
    };

    LGAudioScript.prototype.onStop = function() {
        this.audionode.onaudioprocess = LGAudioScript._bypass_function;
    };

    LGAudioScript.prototype.onPause = function() {
        this.audionode.onaudioprocess = LGAudioScript._bypass_function;
    };

    LGAudioScript.prototype.onUnpause = function() {
        this.audionode.onaudioprocess = this._callback;
    };

    LGAudioScript.prototype.onExecute = function() {
        //nothing! because we need an onExecute to receive onStart... fix that
    };

    LGAudioScript.prototype.onRemoved = function() {
        this.audionode.onaudioprocess = LGAudioScript._bypass_function;
    };

    LGAudioScript.prototype.processCode = function() {
        try {
            var func = new Function("properties", this.properties.code);
            this._script = new func(this.properties);
            this._old_code = this.properties.code;
            this._callback = this._script.onaudioprocess;
        } catch (err) {
            console.error("Error in onaudioprocess code", err);
            this._callback = LGAudioScript._bypass_function;
            this.audionode.onaudioprocess = this._callback;
        }
    };

    LGAudioScript.prototype.onPropertyChanged = function(name, value) {
        if (name == "code") {
            this.properties.code = value;
            this.processCode();
            if (this.graph && this.graph.status == LGraph.STATUS_RUNNING) {
                this.audionode.onaudioprocess = this._callback;
            }
        }
    };

    LGAudioScript.default_function = function() {
        this.onaudioprocess = function(audioProcessingEvent) {
            // The input buffer is the song we loaded earlier
            var inputBuffer = audioProcessingEvent.inputBuffer;

            // The output buffer contains the samples that will be modified and played
            var outputBuffer = audioProcessingEvent.outputBuffer;

            // Loop through the output channels (in this case there is only one)
            for (
                var channel = 0;
                channel < outputBuffer.numberOfChannels;
                channel++
            ) {
                var inputData = inputBuffer.getChannelData(channel);
                var outputData = outputBuffer.getChannelData(channel);

                // Loop through the 4096 samples
                for (var sample = 0; sample < inputBuffer.length; sample++) {
                    // make output equal to the same as the input
                    outputData[sample] = inputData[sample];
                }
            }
        };
    };

    LGAudio.createAudioNodeWrapper(LGAudioScript);

    LGAudioScript.title = "Script";
    LGAudioScript.desc = "apply script to signal";
    LiteGraph.registerNodeType("audio/script", LGAudioScript);

    function LGAudioDestination() {
        this.audionode = LGAudio.getAudioContext().destination;
        this.addInput("in", "audio");
    }

    LGAudioDestination.title = "Destination";
    LGAudioDestination.desc = "Audio output";
    LiteGraph.registerNodeType("audio/destination", LGAudioDestination);
})(this);

//event related nodes
(function(global) {
    var LiteGraph = global.LiteGraph;

    function LGWebSocket() {
        this.size = [60, 20];
        this.addInput("send", LiteGraph.ACTION);
        this.addOutput("received", LiteGraph.EVENT);
        this.addInput("in", 0);
        this.addOutput("out", 0);
        this.properties = {
            url: "",
            room: "lgraph", //allows to filter messages,
            only_send_changes: true
        };
        this._ws = null;
        this._last_sent_data = [];
        this._last_received_data = [];
    }

    LGWebSocket.title = "WebSocket";
    LGWebSocket.desc = "Send data through a websocket";

    LGWebSocket.prototype.onPropertyChanged = function(name, value) {
        if (name == "url") {
            this.connectSocket();
        }
    };

    LGWebSocket.prototype.onExecute = function() {
        if (!this._ws && this.properties.url) {
            this.connectSocket();
        }

        if (!this._ws || this._ws.readyState != WebSocket.OPEN) {
            return;
        }

        var room = this.properties.room;
        var only_changes = this.properties.only_send_changes;

        for (var i = 1; i < this.inputs.length; ++i) {
            var data = this.getInputData(i);
            if (data == null) {
                continue;
            }
            var json;
            try {
                json = JSON.stringify({
                    type: 0,
                    room: room,
                    channel: i,
                    data: data
                });
            } catch (err) {
                continue;
            }
            if (only_changes && this._last_sent_data[i] == json) {
                continue;
            }

            this._last_sent_data[i] = json;
            this._ws.send(json);
        }

        for (var i = 1; i < this.outputs.length; ++i) {
            this.setOutputData(i, this._last_received_data[i]);
        }

        if (this.boxcolor == "#AFA") {
            this.boxcolor = "#6C6";
        }
    };

    LGWebSocket.prototype.connectSocket = function() {
        var that = this;
        var url = this.properties.url;
        if (url.substr(0, 2) != "ws") {
            url = "ws://" + url;
        }
        this._ws = new WebSocket(url);
        this._ws.onopen = function() {
            console.log("ready");
            that.boxcolor = "#6C6";
        };
        this._ws.onmessage = function(e) {
            that.boxcolor = "#AFA";
            var tokens = e.data.split("|"); //author id | cmd | data
            var data = JSON.parse(tokens[tokens.length-1]);
            if (data.room && data.room != that.properties.room) {
                return;
            }
            if (data.type == 1) {
                if (
                    data.data.object_class &&
                    LiteGraph[data.data.object_class]
                ) {
                    var obj = null;
                    try {
                        obj = new LiteGraph[data.data.object_class](data.data);
                        that.triggerSlot(0, obj);
                    } catch (err) {
                        return;
                    }
                } else {
                    that.triggerSlot(0, data.data);
                }
            } else {
                that._last_received_data[data.channel || 0] = data.data;
            }
        };
        this._ws.onerror = function(e) {
            console.log("couldnt connect to websocket");
            that.boxcolor = "#E88";
        };
        this._ws.onclose = function(e) {
            console.log("connection closed");
            that.boxcolor = "#000";
        };
    };

    LGWebSocket.prototype.send = function(data) {
        if (!this._ws || this._ws.readyState != WebSocket.OPEN) {
            return;
        }
        this._ws.send(JSON.stringify({ type: 1, msg: data }));
    };

    LGWebSocket.prototype.onAction = function(action, param) {
        if (!this._ws || this._ws.readyState != WebSocket.OPEN) {
            return;
        }
        this._ws.send({
            type: 1,
            room: this.properties.room,
            action: action,
            data: param
        });
    };

    LGWebSocket.prototype.onGetInputs = function() {
        return [["in", 0]];
    };

    LGWebSocket.prototype.onGetOutputs = function() {
        return [["out", 0]];
    };

    LiteGraph.registerNodeType("network/websocket", LGWebSocket);

    //It is like a websocket but using the SillyServer.js server that bounces packets back to all clients connected:
    //For more information: https://github.com/jagenjo/SillyServer.js

    function LGSillyClient() {
        //this.size = [60,20];
        this.room_widget = this.addWidget(
            "text",
            "Room",
            "lgraph",
            this.setRoom.bind(this)
        );
        this.addWidget(
            "button",
            "Reconnect",
            null,
            this.connectSocket.bind(this)
        );

        this.addInput("send", LiteGraph.ACTION);
        this.addOutput("received", LiteGraph.EVENT);
        this.addInput("in", 0);
        this.addOutput("out", 0);
        this.properties = {
            url: "tamats.com:55000",
            room: "lgraph",
            only_send_changes: true
        };

        this._server = null;
        this.connectSocket();
        this._last_sent_data = [];
        this._last_received_data = [];

		if(typeof(SillyClient) == "undefined")
			console.warn("remember to add SillyClient.js to your project: https://tamats.com/projects/sillyserver/src/sillyclient.js");
    }

    LGSillyClient.title = "SillyClient";
    LGSillyClient.desc = "Connects to SillyServer to broadcast messages";

    LGSillyClient.prototype.onPropertyChanged = function(name, value) {
        if (name == "room") {
            this.room_widget.value = value;
        }
        this.connectSocket();
    };

    LGSillyClient.prototype.setRoom = function(room_name) {
        this.properties.room = room_name;
        this.room_widget.value = room_name;
        this.connectSocket();
    };

    //force label names
    LGSillyClient.prototype.onDrawForeground = function() {
        for (var i = 1; i < this.inputs.length; ++i) {
            var slot = this.inputs[i];
            slot.label = "in_" + i;
        }
        for (var i = 1; i < this.outputs.length; ++i) {
            var slot = this.outputs[i];
            slot.label = "out_" + i;
        }
    };

    LGSillyClient.prototype.onExecute = function() {
        if (!this._server || !this._server.is_connected) {
            return;
        }

        var only_send_changes = this.properties.only_send_changes;

        for (var i = 1; i < this.inputs.length; ++i) {
            var data = this.getInputData(i);
			var prev_data = this._last_sent_data[i];
            if (data != null) {
                if (only_send_changes)
				{	
					var is_equal = true;
					if( data && data.length && prev_data && prev_data.length == data.length && data.constructor !== String)
					{
						for(var j = 0; j < data.length; ++j)
							if( prev_data[j] != data[j] )
							{
								is_equal = false;
								break;
							}
					}
					else if(this._last_sent_data[i] != data)
						is_equal = false;
					if(is_equal)
							continue;
                }
                this._server.sendMessage({ type: 0, channel: i, data: data });
				if( data.length && data.constructor !== String )
				{
					if( this._last_sent_data[i] )
					{
						this._last_sent_data[i].length = data.length;
						for(var j = 0; j < data.length; ++j)
							this._last_sent_data[i][j] = data[j];
					}
					else //create
					{
						if(data.constructor === Array)
							this._last_sent_data[i] = data.concat();
						else
							this._last_sent_data[i] = new data.constructor( data );
					}
				}
				else
	                this._last_sent_data[i] = data; //should be cloned
            }
        }

        for (var i = 1; i < this.outputs.length; ++i) {
            this.setOutputData(i, this._last_received_data[i]);
        }

        if (this.boxcolor == "#AFA") {
            this.boxcolor = "#6C6";
        }
    };

    LGSillyClient.prototype.connectSocket = function() {
        var that = this;
        if (typeof SillyClient == "undefined") {
            if (!this._error) {
                console.error(
                    "SillyClient node cannot be used, you must include SillyServer.js"
                );
            }
            this._error = true;
            return;
        }

        this._server = new SillyClient();
        this._server.on_ready = function() {
            console.log("ready");
            that.boxcolor = "#6C6";
        };
        this._server.on_message = function(id, msg) {
            var data = null;
            try {
                data = JSON.parse(msg);
            } catch (err) {
                return;
            }

            if (data.type == 1) {
                //EVENT slot
                if (
                    data.data.object_class &&
                    LiteGraph[data.data.object_class]
                ) {
                    var obj = null;
                    try {
                        obj = new LiteGraph[data.data.object_class](data.data);
                        that.triggerSlot(0, obj);
                    } catch (err) {
                        return;
                    }
                } else {
                    that.triggerSlot(0, data.data);
                }
            } //for FLOW slots
            else {
                that._last_received_data[data.channel || 0] = data.data;
            }
            that.boxcolor = "#AFA";
        };
        this._server.on_error = function(e) {
            console.log("couldnt connect to websocket");
            that.boxcolor = "#E88";
        };
        this._server.on_close = function(e) {
            console.log("connection closed");
            that.boxcolor = "#000";
        };

        if (this.properties.url && this.properties.room) {
            try {
                this._server.connect(this.properties.url, this.properties.room);
            } catch (err) {
                console.error("SillyServer error: " + err);
                this._server = null;
                return;
            }
            this._final_url = this.properties.url + "/" + this.properties.room;
        }
    };

    LGSillyClient.prototype.send = function(data) {
        if (!this._server || !this._server.is_connected) {
            return;
        }
        this._server.sendMessage({ type: 1, data: data });
    };

    LGSillyClient.prototype.onAction = function(action, param) {
        if (!this._server || !this._server.is_connected) {
            return;
        }
        this._server.sendMessage({ type: 1, action: action, data: param });
    };

    LGSillyClient.prototype.onGetInputs = function() {
        return [["in", 0]];
    };

    LGSillyClient.prototype.onGetOutputs = function() {
        return [["out", 0]];
    };

    LiteGraph.registerNodeType("network/sillyclient", LGSillyClient);
})(this);

