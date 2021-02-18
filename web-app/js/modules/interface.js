class Interface {

    constructor() {
        this.sceneTabs = new LiteGUI.Tabs({id: "scene-tabs", height:"calc(100% - 30px)"});
        this.contentTabs = new LiteGUI.Tabs({id: "content-tabs", height:"100%"});
        this.graphTabs = new LiteGUI.Tabs({id: "graph-tabs", height:"100%"});
        this.tree = null;

        this.icons= {
            clear: '<svg xmlns="http://www.w3.org/2000/svg" class="icon" x="0px" y="0px" viewBox="0 0 172 172"><path d="M0,172v-172h172v172z" fill="none"></path><path d="M112.1225,13.8675c-2.70094,0 -5.34812,0.91375 -7.31,2.9025l-91.4825,92.45c-4.03125,4.07156 -4.03125,10.75 0,14.835l32.895,33.2175c0.65844,0.65844 1.54531,0.9675 2.4725,0.9675h92.3425c1.34375,0.20156 2.6875,-0.41656 3.42656,-1.55875c0.73906,-1.14219 0.73906,-2.62031 0,-3.7625c-0.73906,-1.14219 -2.08281,-1.76031 -3.42656,-1.55875h-54.9325l76.0025,-76.755c4.03125,-4.07156 4.03125,-10.76344 0,-14.835l-42.57,-43c-1.96187,-1.98875 -4.71656,-2.9025 -7.4175,-2.9025zM61.92,70.09l49.235,46.1175l-34.7225,35.1525h-26.3375l-31.82,-32.25c-1.35719,-1.38406 -1.35719,-3.57437 0,-4.945z"></path></svg>', //last slash removed to avoid problems comparing in addButtons
            play: '<svg xmlns="http://www.w3.org/2000/svg" class="icon" x="0px" y="0px" viewBox="0 0 172 172"><path d="M0,172v-172h172v172z" fill="none"></path><path d="M34.4,18.06v135.86656l115.48188,-67.92656z"></path></svg>',
            stop: '<svg xmlns="http://www.w3.org/2000/svg" class="icon" x="0px" y="0px" viewBox="0 0 172 172"><path d="M0,172v-172h172v172z" fill="none"></path><g fill="#aaaaaa"><path d="M126.13333,34.4h-80.26667c-6.33533,0 -11.46667,5.13133 -11.46667,11.46667v80.26667c0,6.33533 5.13133,11.46667 11.46667,11.46667h80.26667c6.33533,0 11.46667,-5.13133 11.46667,-11.46667v-80.26667c0,-6.33533 -5.13133,-11.46667 -11.46667,-11.46667z"></path></svg>',//'<span class="material-icons"> stop</span>',
            stream: '<svg xmlns="http://www.w3.org/2000/svg" class="icon" x="0px" y="0px" viewBox="0 0 50 50"><path d="M 41.8125 6.96875 C 41.738281 6.976563 41.667969 6.984375 41.59375 7 C 40.855469 7.101563 40.234375 7.609375 39.984375 8.3125 C 39.734375 9.015625 39.898438 9.796875 40.40625 10.34375 C 43.878906 14.230469 46 19.347656 46 25 C 46 30.644531 43.894531 35.792969 40.40625 39.6875 C 39.851563 40.203125 39.636719 40.992188 39.851563 41.71875 C 40.066406 42.445313 40.671875 42.988281 41.417969 43.121094 C 42.164063 43.253906 42.921875 42.953125 43.375 42.34375 C 47.496094 37.742188 50 31.648438 50 25 C 50 18.351563 47.507813 12.28125 43.40625 7.6875 C 43.011719 7.214844 42.425781 6.953125 41.8125 6.96875 Z M 7.9375 7 C 7.417969 7.042969 6.933594 7.292969 6.59375 7.6875 C 2.492188 12.285156 0 18.371094 0 25 C 0 31.664063 2.503906 37.746094 6.625 42.34375 C 7.078125 42.953125 7.835938 43.253906 8.582031 43.121094 C 9.328125 42.988281 9.933594 42.445313 10.148438 41.71875 C 10.363281 40.992188 10.148438 40.203125 9.59375 39.6875 C 6.105469 35.796875 4 30.664063 4 25 C 4 19.371094 6.121094 14.234375 9.59375 10.34375 C 10.152344 9.734375 10.277344 8.84375 9.910156 8.105469 C 9.546875 7.363281 8.761719 6.925781 7.9375 7 Z M 34.65625 14.34375 C 34.582031 14.351563 34.511719 14.359375 34.4375 14.375 C 33.699219 14.476563 33.078125 14.984375 32.828125 15.6875 C 32.578125 16.390625 32.742188 17.171875 33.25 17.71875 C 34.964844 19.65625 36 22.183594 36 25 C 36 27.796875 34.960938 30.335938 33.25 32.28125 C 32.707031 32.804688 32.503906 33.589844 32.730469 34.3125 C 32.953125 35.03125 33.5625 35.566406 34.304688 35.691406 C 35.050781 35.816406 35.800781 35.515625 36.25 34.90625 C 38.578125 32.261719 40 28.789063 40 25 C 40 21.191406 38.589844 17.703125 36.25 15.0625 C 35.855469 14.589844 35.269531 14.328125 34.65625 14.34375 Z M 15.0625 14.40625 C 14.542969 14.449219 14.058594 14.699219 13.71875 15.09375 C 11.402344 17.734375 10 21.222656 10 25 C 10 28.847656 11.457031 32.378906 13.84375 35.03125 C 14.585938 35.851563 15.851563 35.914063 16.671875 35.171875 C 17.492188 34.429688 17.554688 33.164063 16.8125 32.34375 C 15.0625 30.398438 14 27.847656 14 25 C 14 22.210938 15.015625 19.691406 16.71875 17.75 C 17.277344 17.140625 17.402344 16.25 17.035156 15.511719 C 16.671875 14.769531 15.886719 14.332031 15.0625 14.40625 Z M 25 20 C 22.242188 20 20 22.242188 20 25 C 20 27.757813 22.242188 30 25 30 C 27.757813 30 30 27.757813 30 25 C 30 22.242188 27.757813 20 25 20 Z"></path></svg>',
            trash:'<span class="material-icons"> delete</span>',// '<img src="'+baseURL+'/latest/imgs/mini-icon-trash.png" alt="W3Schools.com">';
            edit: '<span class="material-icons"> edit</span>',
            folder: '<span class="material-icons"> folder</span>',
            visibility: '<span class="material-icons"> visibility</span>',
            search: '<span class="material-icons"> code</span>',
            download: '<span class="material-icons"> get_app</span>',
            settings: '<span class="material-icons">settings</span>',
            minimize: '<span class="material-icons">double_arrow</span>',
            expand: '<span class="material-icons">navigate_next</span>',
            tree: '<span class="material-icons">account_tree</span>',
            chat: '<span class="material-icons">chat</span>',
            pause: '<span class="material-icons">pause</span>'
        }

    }

    preInit() {
        //create a left panel
        LiteGUI.init();

        var mainarea = new LiteGUI.Area({id :"mainarea", content_id:"main-area", autoresize: true, inmediateResize: true});
        mainarea.split("horizontal",[300,null], false);

        /* Left area */
        var left_area = mainarea.getSection(0);
        left_area.root.id = "left-inspector"
        left_area.root.className += " content";

        // Create a menu bar
        var menu = new LiteGUI.Menubar();
        this.menu = menu;

        var example_url = baseURL+"/users/evalls/dialog-manager/dev/data/RAO-expressions.json";

        menu.refresh = (function()
        {
            // Clean first
            this.menu.clear();

            this.menu.add("Project/New/Empty"); //clear all
            this.menu.add("Project/New/Template", {callback: this.importFromURL.bind(this, example_url)});
            // Server options
            this.menu.separator("Project");
            this.menu.add("Project/Save", { callback: this.showExportDialog.bind(this)});
            this.menu.add("Project/Load", { callback: this.showLoadFromServerDialog.bind(this)});
            this.menu.separator("Project");
            // Disc options
            this.menu.add("Project/Import/From Disc", { callback: this.openImportFromFileDialog.bind(this)});
            this.menu.add("Project/Import/From URL", { callback:  this.openImportURLDialog.bind(this)});
            this.menu.add("Project/Export/Environment", { id: "download-env", callback: this.showDownloadDialog.bind(this)});
            this.menu.add("Project/Export/Graph", { id: "download-graph", callback: this.showDownloadDialog.bind(this)});
            // Other
            this.menu.add("Project/Publish"); // load behaviour tree to the server and execute it permanently
            // this.menu.add("Actions");

            if(!CORE.modules["FileSystem"].session)
            {
                this.menu.add("Account/Login", {callback: this.showLoginDialog.bind(this)});
            }else
            {
                this.menu.add("Account/Profile", {callback: this.showAccountInfo.bind(this)});
                this.menu.add("Account/Logout", {callback: function(e){
                    var FS = CORE.modules["FileSystem"];
                    FS.session.logout(FS.onLogout.bind(FS, function(){
                        menu.refresh();
                    }));
                }});
            }
        }).bind(this);

        menu.refresh();
        left_area.add(menu);

        var div = document.createElement("DIV");
        div.className+= " litetabs buttons right";
        var btn_expand = this.addButton(null,{title: "Minimize/Expand", innerHTML: this.icons.minimize,callback: this.onExpandInspector.bind(this,mainarea)});
        btn_expand.className+= "btn btn-icon btn-expand invert right";
        div.append(btn_expand);
        left_area.add(div);
        /*EDIT*/
        var edit_tab = this.sceneTabs.addTab("edit", { title: this.icons.tree, selected:true, width:"100%", height:"calc(100% - 26px)"});
        edit_tab.tab.title = "Edit environment";
        edit_tab.content.className+=" content";

        var edit_area = new LiteGUI.Area({id: "eidtareditareaea", autoresize:true, height: "fit-content"});

        edit_area.split("vertical", ["fit-content",null], false);
        /* Tree */
        var tree_area = edit_area.getSection(0);
        this.tree = this.createTree();

        tree_area.add(this.tree);

        var insp_area = edit_area.getSection(1);
        insp_area.content.id = "edit-inspect";
        insp_area.content.style.height = "fit-content"

        this.graphinspector = new LiteGUI.Inspector({id:"edit-inspector"})
        insp_area.add(this.graphinspector)
        edit_tab.add(edit_area  )
        
        /* 
        FILE ACTIONS
        */
        if ( 0 ) {
            var actions_tab = this.sceneTabs.addTab("actions", { title: this.icons.folder, width:"100%", height:"calc(100% - 26px)"});
            actions_tab.tab.title = "Files";
            actions_tab.content.className+=" content";
            var actions_inspector = new LiteGUI.Inspector( {width:"100%"});
    
            /*Import section*/
            actions_inspector.addSection("Import", {width:"100%"});
            actions_inspector.addInfo("Environment", "");
            var env_fromfile = this.addButton("From file", {className:"btn btn-str", callback: this.openImportFromFileDialog.bind(this)});
            var env_fromURL = this.addButton("From URL", {className:"btn btn-str"});
            actions_inspector.current_section.children[1].append(env_fromfile);
            actions_inspector.current_section.children[1].append(env_fromURL);
    
            actions_inspector.addInfo("Graphs", "");
            var graph_fromfile = this.addButton("From file", {className:"btn btn-str", callback: this.openImportFromFileDialog.bind(this)});
            var graph_fromURL = this.addButton("From URL", {className:"btn btn-str"});
            actions_inspector.current_section.children[1].append(graph_fromfile);
            actions_inspector.current_section.children[1].append(graph_fromURL);
    
            actions_inspector.addInfo("Corpus", "");
            var corpus_fromfile = this.addButton("From file", {className:"btn btn-str", callback: this.openImportFromFileDialog.bind(this)});
            var corpus_fromURL = this.addButton("From URL", {className:"btn btn-str", callback:   this.openImportURLDialog.bind(this)});
            actions_inspector.current_section.children[1].append(corpus_fromfile);
            actions_inspector.current_section.children[1].append(corpus_fromURL);
    
            /*Export section*/
            actions_inspector.addSection("Export", {width:"100%"});
            var env_download= this.addButton("", {className: "btn btn-icon", innerHTML: this.icons.download, id: "download-env", callback: this.showDownloadDialog.bind(this)});
            actions_inspector.addInfo("Environment",env_download, {height:"20px"});
            var graph_download= this.addButton("", {className: "btn btn-icon", innerHTML: this.icons.download, id: "download-graph", callback: this.showDownloadDialog.bind(this)});
            actions_inspector.addInfo("Graph selected",graph_download, {height:"20px"});
            actions_tab.add(actions_inspector);
        }

        /*-------------------------------------------------------------------------------------------*/
        /* Right area */
        var right_area = mainarea.getSection(1);
        right_area.split("horizontal",[null,"30%"], true);
        right_area.id = "right-area"
        /* Graph area */
        var graph_area = right_area.getSection(0);
        //graph_area.split("vertical", [25,null], false);
        //LiteGUI.bind(graph_area, "resized", function(){GraphManager.resize()})

        //var graph_bar = graph_area.getSection(0);

        // Create a menu bar
        //graph_bar.root.className+= " litetabs";
        var div = document.createElement("DIV");

        div.className+= " litetabs buttons right";
        var stream_btn = this.addButton("", {id: "stream-btn", title: "Stream behaviour", className: "btn btn-icon right",innerHTML: this.icons.stream, callback: this.onStream});
        stream_btn.style.display="none";
        var clear_btn = this.addButton("", {title: "Clear graph", className: "btn btn-icon right", innerHTML: this.icons.clear, callback: GraphManager.clearCurrentGraph});
        var play_btn = this.addButton("", {title: "Play graphs", id: "play-btn", className: "btn btn-icon right",innerHTML: this.icons.play, callback: function(){
            CORE.App.onPlayClicked();
        }});

        div.append(clear_btn);
        div.append(play_btn);
        div.append(stream_btn);

        /*IFRAME*/

        var show_btn = this.addButton("", {title: "Show scene", id: "show-btn", className: "btn btn-icon right",innerHTML: this.icons.visibility, callback: function openOther() {
        iframeWindow = window.open("iframe.html", "otherWindow");

        }});
        div.append(show_btn);
        var div_area = graph_area.add(div);
        /*graph_bar.add(clear_btn);
        graph_bar.add(play_btn);
        graph_bar.add(stream_btn);

        var graph = graph_area.getSection(1);*/
        /*graph.content.className+= " graph-content";
        graph.onresize = GraphManager.resize.bind(this);*/
        graph_area.content.className+= " graph-content";
        graph_area.onResize = GraphManager.resize.bind(this);
        /* Content area */
      /*  var iframe_tab = this.contentTabs.addTab("iframe", {title: this.icons.visibility, width:"100%", height:"calc(100% - 27px)"});
        iframe_tab.tab.title = "Show scene";
        var iframe = document.createElement("IFRAME");
        iframe.id = "iframe-character"
        iframe.src ="https://webglstudio.org/latest/player.html?url=fileserver%2Ffiles%2Fevalls%2Fprojects%2Fscenes%2FBehaviourPlanner.scene.json" //"/latest/player.html?url=fileserver%2Ffiles%2Fevalls%2Fprojects%2Fscenes%2FBPtest.scene.json";
        var iframe_area = new LiteGUI.Area("iframe-content", {autoresize:false});
        iframe_area.add(iframe);
        iframe_tab.add(iframe_area)
*/
        var behaviour_tab = this.contentTabs.addTab("behaviour", { title: this.icons.search, width:"100%", height:"calc(100% - 27px)"});
        behaviour_tab.tab.title = "Show behaviours";
        var behaviour_area = new LiteGUI.Area({id: "behaviour-content", autoresize:false});
        behaviour_tab.add(behaviour_area)

        /*CHAT*/
        var chat_tab = this.contentTabs.addTab("chat", {selected:true, title: this.icons.chat, width:"100%", height:"calc(100% - 27px)"});
        //this.contentTabs.root.className+= " right";
        var chat_area = new LiteGUI.Area({id:"chat-content", autoresize:false});
        var chat = CORE.App.chat.createGUI();
        chat_area.add(chat);
        chat_tab.add(chat_area);
        var right_content = right_area.getSection(1);

        right_content.add(this.contentTabs);
        mainarea.add(this.sceneTabs);
        LiteGUI.add( mainarea );
        this.tabsRefresh()
        
        // assign drop area -> only once
        let that = this;
        var FS = CORE["FileSystem"];
        var canvas = document.getElementsByClassName("graph-content");
        LiteGUI.createDropArea( canvas[0], FS.onDrop.bind(FS, function(file){

            that.openImportDialog(file);

        }));

    }

    onExpandInspector(area,e) {
        var that = this;
        if(e.currentTarget.classList.contains("invert"))
        {
            var w= area.getSection(0).getWidth();
            area.moveSplit(w-30);
            that.sceneTabs.hide();
            e.currentTarget.classList.remove("invert");
        }else
        {
            var w= area.getSection(0).getWidth();
            area.moveSplit(-270);
            that.sceneTabs.show();
            e.currentTarget.classList.add("invert");
        }
        GraphManager.resize();
    }
    /* -----------------------------------------------------------GRAPH AREA------------------------------------------------------------ */
    newTab(g)  {
        var that = this;
        that.graphTabs.removeTab("plus-tab");
        var graph_area = document.createElement("DIV");
        graph_area.id = g.id? g.id :"graph-canvas";
        graph_area.className = "graph-canvas";
        var title = g.type==GraphManager.HBTGRAPH? "HBT Graph": "Basic Graph";

        var tab = that.graphTabs.addTab(g.id, {title: title, closable:true, autoswitch:true, width:"100%", height:"calc(100% - 27px)",callback: GraphManager.onGraphSelected, onclose: this.onCloseTab.bind(this), callback_context: this.onContextTab.bind(this) })
        tab.add(  graph_area);
        var ngraph_tab = that.graphTabs.addTab("plus-tab", { title:"+"});
        ngraph_tab.tab.addEventListener("click", that.newGraphDialog.bind(that) );
        GraphManager.graphSelected = g;

        that.graphTabs.selectTab(tab)

    }

    tabsRefresh(id) {
        
        var that = this;

        this.graphTabs.clear();
        var tab;

        for(var i in GraphManager.graphs)
        {
            var g = GraphManager.graphs[i];
            var graph_area = document.createElement("DIV");
            graph_area.id = g.id? g.id :"graph-canvas";
            graph_area.className = "graph-canvas";
            var title = g.type==GraphManager.HBTGRAPH? "HBT Graph": "Basic Graph";
            if(g.type==GraphManager.BASICGRAPH)
            {

                var canvasDOM = document.createElement("CANVAS");
                canvasDOM.id = "g"+graph_area.id;
                canvasDOM.id = "g"+graph_area.id;
                canvasDOM.width="954";
                canvasDOM.height="937";
                graph_area.appendChild(canvasDOM)
            }
            GraphManager.graphSelected = g;
            tab = this.graphTabs.addTab(g.id, {title: title, editable: true, closable:true, width:"100%", height:"calc(100% - 27px)", callback: GraphManager.onGraphSelected, onclose: this.onCloseTab.bind(this), callback_context: this.onContextTab.bind(this,g.id)})
            tab.add(  graph_area);

        }
        var ngraph_tab = this.graphTabs.addTab("plus-tab", { title:"+"});
        ngraph_tab.tab.addEventListener("click", this.newGraphDialog.bind(this) );

        this.graphTabs.selectTab(tab)

        var canvas = document.getElementsByClassName("graph-content");
        canvas[0].appendChild(this.graphTabs.root)
    }

    onContextTab(id) {
        var that = this;
        var contextmenu = new LiteGUI.ContextMenu( ["Rename"], { callback: that.renameTab.bind(this,id)})
    }

    renameTab(id) {
        var that = this;
        LiteGUI.prompt("Enter name", function(v){
            var tab = that.graphTabs.getTab(id);
            tab.setTitle(v);
        },{title: "Rename tab"});
    }

    onCloseTab(data) {

        var that = this;
        GraphManager.removeGraph(data.id);
        //that.tabsRefresh()
        var currentTab = that.graphTabs.selected;
        var tabs = that.graphTabs.tabs_by_index;
        for(var i in tabs)
        {
            if(currentTab == tabs[i].id && i>0)
            {
                var prevTab = that.graphTabs.getTabByIndex(i-1);
                that.graphTabs.selectTab(prevTab);
            }
        }
    }

    newGraphDialog() {
        var that = this;
        LiteGUI.choice("Select type", ["HBT Graph", "Basic Graph"], that.onNewGraphSelected.bind(that), {title:"New graph"} )
    }

    onNewGraphSelected(data) {
        var type;
        switch(data){
            case "HBT Graph":
                type = GraphManager.HBTGRAPH;
                break;
            case "Basic Graph":
                type = GraphManager.BASICGRAPH;
                break;
        }
        var that = this;
        var graph = GraphManager.newGraph(type, that.newTab.bind(that));
        if(data == "HBT Graph")
            CORE.App.agent_selected.hbt_graph = graph.name;
       // this.newTab(graph);
    }
    
    openImportDialog(data, session_type) {

        var title = "Replace current graph?";
        if(!data)
            return;
        var file = data;

        if(data && data.env)
            title = "Replace environment?";
        if(data.name)
          title = "Replace "+data.name+"?";

        if(data.constructor != Object)
            data = JSON.parse(data.data);

        var type = "Basic graph";
        if(data.behaviour) type = "HBT graph";
        if(data.env) type = "Environment"
        if(data.type) type = data.type;

        function processFile(data, type)
        {
            if(type == "Environment")
                CORE.App.loadEnvironment(data);
            else if(type == "dialogue-corpus")
                CORE.App.loadCorpusData(data);
            else
                GraphManager.putGraphOnEditor( data )
        }

        if(session_type !== SESSION.IS_GUEST)
        {
            var choice = LiteGUI.choice("", ["Import", "Cancel"], function(v){
                if(v == "Import")
                {
                    processFile(data, type);
                }
    
            }, { title: title});
    
            var import_inspector = new LiteGUI.Inspector();
            import_inspector.clear();
            import_inspector.addInfo("Type ", type, {name_width:"40%"});
            if(file.name || file.filename) import_inspector.addInfo("Filename  ", file.name || file.filename, {name_width:"40%"});
            if(file.size) import_inspector.addInfo("Size", file.size/1000 + " KB", {name_width:"40%"});
    
            choice.content.prepend(import_inspector.root);
        }else
        {
            processFile(data, type);
        }

    }

    openImportURLDialog( )
    {
        LiteGUI.prompt("URL name", this.importFromURL.bind(this),{title: "Import from URL"});
    }

    // session_type is for guest issues, to load a template on login
    importFromURL(url, session_type)
    {
        var that = this;
        if(!url)
         url = baseURL+"/users/evalls/behavior-planner/data/gestenv.json"

        if(UTILS.getFileExtension(url) !== "json")
        throw("only JSON supported");

        LiteGUI.requestJSON( url, function(data) {
            
            if(!data)
            return;
            if(!data.behaviour)
            {
                console.log("Basic graph imported")
            }
            else if (data.type) {
                console.log(data.type + " imported")
            }
            else 
                console.log("Behaviour graph imported")
            
            that.openImportDialog(data, session_type);
        });
    }

    openImportFromFileDialog()
	{
        var that = this;
		var dialog = new LiteGUI.Dialog({ title:"Load File", width: 200, closable: true });
		var inspector = new LiteGUI.Inspector();
		var file = null;
		inspector.addFile("Select File","",{ read_file: true, callback: function(v){
			// console.log(v);
			file = v;
		}});
		inspector.addButton(null,"Load File", function(){
			if(!file || !file.data)
                return;
                var data = JSON.parse(file.data);
                var filename = file.name.split(".");
                if( filename[filename.length-1].toLowerCase()== "json")
                {
                    if(!data)
                        return;
                    if(!data.behaviour)
                    {
                       /* var graphData = {behaviour : data};
                        data = graphData;*/
                        console.log("Basic graph imported")

                    }
                    else if (data.type) {
                      console.log(data.type + " imported")
                    }
                    else console.log("Behaviour graph imported")
                    that.openImportDialog(data);

                };
                dialog.close();
		});
		dialog.add( inspector );
		dialog.adjustSize(2);
		dialog.makeModal();
	}

    showExportDialog() {
        
        var curr_session = CORE["FileSystem"].getSession();
        if(!curr_session)
        return;

        if(curr_session.user.username === "guest"
            && !CORE["FileSystem"].ALLOW_GUEST_UPLOADS
        ) {
            LiteGUI.alert("Create your own account to upload files to the server", {title: "Guest"});
            return;
        }

        var canvas = GraphManager.currentCanvas.canvas2D;
        var tbh_data, boo;
	    var filename = "export", path = "/";

        var inner = function(v) {

            if(!filename.length) {
                LiteGUI.alert("File name length must be > 0", {title: "Invalid filename"})
                return;
            }

            try
            {
                boo = CORE.App.toJSON(
                    v === "Graph" ? "download-graph" : "download-env",
                    filename
                );
                boo = JSON.stringify(boo);
            }
            catch (e)
            {
                console.error("Error creating json", e);
                LiteGUI.alert("Something went wrong");
                return;
            }

            var FS = CORE["FileSystem"];
            
            // upload file
            FS.uploadFile(path, new File([boo], filename + ".json"), []);
                    
            // upload thb
            if(tbh_data){
                // change file extension and folder for thb
                var tkn = path.split("/");
                var _name = tkn.pop().replace("json", "png"); // name.png
                path = tkn.join("/") + "/thb/" + _name;
                FS.uploadFile(path, new File([tbh_data], filename + ".png"), [] );
            }
            
        };

        if(!canvas) {
            console.warn("nothing to export");
            return;
        }

        canvas.toBlob(function(v){ 
		
            tbh_data = v;
            var user_name = curr_session.user.username;
            var url =  URL.createObjectURL( tbh_data );
            var width = 500;
            var choice = LiteGUI.choice("<img src='" + url + "' style='margin-left: 115px;' width='50%'>", ["Graph","Environment"], inner, {title: "Save to server", width: width});
    
            var widgets = new LiteGUI.Inspector();
            var r_widgets = new LiteGUI.Inspector();
            widgets.addInfo( null, "Filename");
            window.filename_w = widgets.addString( null, filename );

            filename_w.lastElementChild.lastElementChild.lastElementChild.addEventListener("keyup", function(e){
                filename = filename_w.getValue();
                r_widgets.refresh();
            });

            widgets.addSeparator();
            
            curr_session.getFolders(user_name, (function(data) {

                var selected = null;
                var litetree = new LiteGUI.Tree({id: user_name});
                LiteGUI.bind( litetree.root, "item_selected", function(item) {
                    selected = item.detail.data.id;
                    r_widgets.refresh();
                });     

                /*
                    recursive function to get all folders in unit 
                    as a data tree
                */
                function __showFolders(object, parent)
                {
                    for(var f in object)
                    {
                        if(f === "thb") // discard thumb previews for folders
                        continue;
                        litetree.insertItem({id: f}, parent);
                        if(object[f])
                            __showFolders(object[f], f);
                    }
                }

                __showFolders(data, user_name);
                widgets.addInfo( null, "Path");
                widgets.root.appendChild(litetree.root);

                /*
                    recursive function to get each item parent
                */
                function __getParent(id)
                {
                    var parent = litetree.getParent(id);
                    if(parent)
                    {
                        var parent_id = parent.data.id;
                        path = parent_id + "/" + path;
                        __getParent(parent_id);
                    }
                }

                r_widgets.refresh = function() {

                    r_widgets.clear();
                    let curr = selected;

                    if(curr) {
                        path = curr;
                        __getParent(selected);
                    }
                    else {
                        path = user_name;
                    }

                    path += "/" + filename + ".json";
                    
                    r_widgets.addString( null, path, {disabled: true} );
                    r_widgets.addSeparator();
                }

                r_widgets.refresh();
               
                choice.add( r_widgets.root, true );
                choice.add( widgets.root, true );
                choice.setPosition( window.innerWidth/2 - width/2, window.innerHeight/2 - 300 ); 
                
            }).bind(this));
            
        });
    }

    showLoadFromServerDialog() {

        var curr_session = CORE["FileSystem"].getSession();
        if(!curr_session)
        return;

        var user_name = curr_session.user.username;
        var files = {};
        var file_selected = "";
        var folder_selected = user_name;
        var path = "";

        curr_session.getFolders(user_name, (function(data) { 
    
            function __getFolderFiles(unit, folder, callback) {

                var _folder = folder;

                if(!_folder)
                _folder = "";

                CORE["FileSystem"].getFiles(unit, _folder).then(function(data) {

                    data.forEach(function(e){
                        
                        if(e.unit !== unit)
                            return;
                        files[e.filename] = e;
                    });
                    widgets.refresh();
                });
            }

            /*
                recursive function to get each item parent
            */
            function __getParent(id)
            {
                var parent = litetree.getParent(id);
                if(parent)
                {
                    var parent_id = parent.data.id;
                    path = parent_id + "/" + path;
                    __getParent(parent_id);
                }
            }

            /*
                recursive function to get all folders in unit 
                as a data tree
            */
            function __showFolders(object, parent)
            {
                for(var f in object)
                {
                    if(f === "thb") // discard thumb previews for folders
                    continue;
                    litetree.insertItem({id: f}, parent);
                    if(object[f])
                        __showFolders(object[f], f);
                }
            }

            var selected = null;
            var litetree = new LiteGUI.Tree({id: user_name});
            LiteGUI.bind( litetree.root, "item_selected", function(item) {
                selected = item.detail.data.id;
                
                path = "";
                files = {};
                file_selected = null;
                
                // get full path
                __getParent(selected);
                path += selected;
                var tk = path.split("/");
                tk.shift();
                path = tk.join("/");
                if(!path.length)
                    path = null;

                // fetch files in folder
                folder_selected = user_name + (path ? "/" + path : "");
                // console.log(folder_selected);
                __getFolderFiles(user_name, path);
            });    
    
            __showFolders(data, user_name);
        
            var id = "Load from Server";
            var dialog_id = UTILS.replaceAll(id," ", "-").toLowerCase();
            var w = 400;
            var dialog = new LiteGUI.Dialog( {id: dialog_id, parent: "body", close: true, title: id, width: w, draggable: true });
            dialog.makeModal('fade');
            var widgets = new LiteGUI.Inspector();
        
            var oncomplete = function( data ){
                dialog.close();
            }
        
            widgets.on_refresh = function(){
        
                widgets.clear();
        
                widgets.widgets_per_row = 2;
                widgets.addTitle( "Path");
                widgets.root.appendChild(litetree.root);
                widgets.addTitle( "Files");
                widgets.addList( null, files, {height: "150px", callback: function(v) {
                    file_selected = v;
                    widgets.on_refresh();
                } });
        
                var thb = widgets.addContainer("thb");
                thb.style.width = "50%";
                thb.style.height = "145px";
                thb.style.display = "inline-block";
                thb.style.marginTop = "5px";
                if(file_selected) {
                    var src = "https://webglstudio.org/projects/present/repository/files/" + folder_selected + "/thb/" + file_selected.filename.replace("json", "png");    
                    thb.innerHTML = "<img height='100%' src='" + src + "'>";

                }
            
                widgets.widgets_per_row = 1;
                widgets.addSeparator();
                widgets.addString(null, 
                    file_selected ? folder_selected + "/" + file_selected.filename : folder_selected + "/", 
                    {disabled: true});

                if(file_selected)
                {
                    widgets.addButton( null, "Load", {callback: function() {
            
                        if(!file_selected)
                            return;
    
                        dialog.close();
    
                        var fullpath = CORE["FileSystem"].root + folder_selected + "/" + file_selected.filename;
                        // LiteGUI.requestJSON( fullpath, function(data){
                        //     console.log(data);
                        // });
    
                        CORE["Interface"].importFromURL( fullpath );
                        
                    } });
                }

                widgets.addSeparator();
            }
        
            __getFolderFiles(user_name, null);

            widgets.on_refresh();
            dialog.add(widgets);  
            dialog.setPosition( window.innerWidth/2 - w/2, window.innerHeight/2 - 150 );

        }));
    }

    showLoginDialog( session_type )
    {
        let user = "", pass = "";

        var dialog = new LiteGUI.Dialog({ id:"login-dialog", title:"Login", width: 300, closable:true });
        var inspector = new LiteGUI.Inspector();
        var error_inspector = new LiteGUI.Inspector();
        inspector.addString("Username", user, {callback: function(v){ user = v; }});
        var pass_widget = inspector.addString("Password", pass, {password: true, callback: function(v){ pass = v; }});

        // hacky to get input of element
        pass_widget.lastElementChild.
        lastElementChild.lastElementChild.
        addEventListener("keyup", function(e){

            if(e.keyCode === 13)
            {
                e.stopPropagation();
                LOG_IN();
            }
        });

        inspector.widgets_per_row = 2;
        inspector.addButton(null, "Register", {name_width: "30%", callback: (function(){
            this.showCreateAccountDialog();
            document.querySelector("#login-dialog").remove();
        }).bind(this)});
        inspector.addButton(null, "Login", {name_width: "30%", callback: function(){
            LOG_IN();
        }});
        inspector.widgets_per_row = 1;
        inspector.addSeparator();
        inspector.addButton(null, "Login as guest", {callback: (function(){
            LOG_IN("guest", "guest");
        }).bind(this)});
        inspector.addSeparator();

        function LOG_IN(u, p)
        {
            let lg_user = u || user;
            let lg_pass = p || pass;

            var FS = CORE.modules["FileSystem"];
            LFS.login( lg_user, lg_pass, FS.onLogin.bind(FS, function(valid, msg_info){

                if(valid)
                {
                    if(lg_user === "guest")
                    CORE["Interface"].importFromURL(
                        baseURL+"/users/evalls/dialog-manager/dev/data/RAO-expressions.json",
                        SESSION.IS_GUEST
                    );

                    dialog.close();
                    CORE["Interface"].menu.refresh();
                }
                else
                {
                    error_inspector.clear();
                    error_inspector.addInfo(null, "-- " + msg_info);
                }
            }));
        }

        dialog.add(inspector);
        dialog.add(error_inspector);

        dialog.makeModal();
    }
    showCreateAccountDialog()
    {
        let user = "", pass = "",
        pass2 = "", email = "";
        let errors = false;

        var dialog = new LiteGUI.Dialog({ id:"register-dialog", title:"Register", width: 350, closable:true });
        var inspector = new LiteGUI.Inspector();
        var error_inspector = new LiteGUI.Inspector();
        inspector.addString("Username", user, {callback: function(v){ user = v; }});
        inspector.addString("Email", email, {callback: function(v){ email = v; }});
        inspector.addString("Password", pass, {password: true, callback: function(v){ pass = v; }});
        inspector.addString("Confirm password", pass2, {password: true, callback: function(v){ pass2 = v; }});
        inspector.addButton(null, "Register", {callback: function(){
            if(pass === pass2)
            {
                var req = LFS.createAccount(user, pass, email, function(valid, request){
                    if(valid)
                    {
                        var FS = CORE.modules["FileSystem"];
                        LFS.login( user, pass, FS.onLogin.bind(FS, function(){
                            dialog.close();
                            CORE["Interface"].menu.refresh();
                        }));
                    }else
                    {
                        error_inspector.clear();
                        error_inspector.addInfo(null, "-- " + request.msg);
                        console.error(request.msg);
                    }
                });
            }else
            {
                error_inspector.clear();
                error_inspector.addInfo(null, "-- Please confirm password");
                console.error("Wrong pass confirmation");
            }
        }});
        dialog.add(inspector);
        dialog.add(error_inspector);
        dialog.makeModal();
    }

    showAccountInfo()
    {
        var dialog = new LiteGUI.Dialog({ title:"Account profile", width: 350, closable:true });
        var inspector = new LiteGUI.Inspector();

        var session = CORE["FileSystem"].getSession();
        if(!session) {
            console.warn("no logged account");
            return;
        }

        var user = session.user;

        inspector.addInfo("Username", user.username);
        inspector.addInfo("Email", user.email);
        inspector.addSeparator();
        inspector.addInfo("Unit size", user.total_space / 1e6 + " MB");

        var roles = [];

        for(var o in user.roles)
            if(user.roles[o] === true)
                roles.push(o);

        inspector.addList("Roles", roles, {disabled: true});
       
        dialog.adjustSize();
        dialog.add(inspector);
        dialog.makeModal();
    }

    showConnectionDialog()
    {
        LiteGUI.prompt("URL", function(url){CORE.App.streamer.connect(url)},{title: "Websocket connection"});
    }

    showStreaming(url, room)
    {

        var btn = document.getElementById("stream-btn");
        btn.style.display="block";

        GraphManager.newGraph(GraphManager.BASICGRAPH);
        var node = LiteGraph.createNode( "network/sillyclient" ,"", {url:url});
        node.properties.url = url;
        node.properties.room = room;
        node.room_widget.value = room;
        node.properties.only_send_changes = false;
        node.connectSocket();
        var graphcanvas = LGraphCanvas.active_canvas;
        graphcanvas.graph.add(node);
        if(!CORE.App.streamer)
            CORE.App.streamer = new Streamer();

        CORE.App.streamer.ws = node._server;
        node._server.onReady = CORE.App.streamer.onReady;
        CORE.App.streamer.is_connected = node._server.is_connected;
    }

    onStream()
    {
        CORE.App.streamer.streaming = !CORE.App.streamer.streaming;
        if(CORE.App.streamer.streaming && CORE.App.state == PLAYING)
        {
            this.lastChild.classList.add("play");
        }
        else if(CORE.App.streamer.streaming && CORE.App.state == STOP )
        {
            this.lastChild.classList.remove("play");
            this.lastChild.classList.add("active")
        }
        else
        {
            this.lastChild.classList.remove("play")
            this.lastChild.classList.remove("active")
        }
    }
    
    /* ----------------------------------------------------DOWNLOAD------------------------------------------------------------*/
    
    showDownloadDialog(data)
    {
        var id = data["id"];
        if(!id)
            console.warn("no file type");
        //    id = data.srcElement.parentElement.getAttribute("id");

        LiteGUI.prompt(
            "File name", 
            CORE.App.downloadJSON.bind(CORE.App, id),
            {
                title: "Export file"
            }
        );
    }
    
    /* ----------------------------------------------------------------------------------------------------------------------- */

    showContent(data)
    {
        var b_content = document.getElementById("behaviour-content");//document.querySelector('[data-id="behaviour-content"]');
        b_content.innerHTML = "";
        for(var i in data)
        {
            var div = document.createElement("DIV");
            div.className = "b-content";
            var behaviour = data[i];
            var type = "";
            switch(behaviour.type){
                case HBTree.B_TYPE.moveToLocation:
                    type = "Move to location";
                    break;
                case HBTree.B_TYPE.lookAt:
                    type = "Look at";
                    break;
                case HBTree.B_TYPE.animateSimple:
                    type = "Animate simple";
                    break;
                case HBTree.B_TYPE.wait:
                    type = "Wait";
                    break;
                case HBTree.B_TYPE.nextTarget:
                    type = "Next target";
                    break;
                case HBTree.B_TYPE.setMotion:
                    type = "Set motion";
                    break;
                case HBTree.B_TYPE.setProperty:
                    type = "Set property";
                    break;
                case HBTree.B_TYPE.succeeder:
                    type = "Succeeder";
                    break;
                case HBTree.B_TYPE.action:
                    type = "Action";
                    break;
                case HBTree.B_TYPE.conditional:
                    type = "Conditional";
                    break;
                case HBTree.B_TYPE.facialExpression:
                    type = "Facial expression";
                    break;
            }
            for(var attr in behaviour)
            {
                var p = document.createElement("P");
                if(attr == "_ctor")
                    continue;
                if(attr == "type")
                {
                    p.className += " color-"+ behaviour.type;
                    var b = document.createElement("B");
                    b.innerText = type;
                    p.appendChild(b);
                }
                else if(attr == "data")
                {
                    var p_data = document.createElement("P");
                    p_data.innerText = "DATA:";
                    p.appendChild(p_data)

                    for(var i in behaviour.data)
                    {

                        var p_data = document.createElement("P");
                        p_data.className="data-content";
                        p_data.innerHTML = "<b>"+i+"</b>"+" : "+JSON.stringify(behaviour.data[i]);
                        p.appendChild(p_data)
                    }
                }
                else{
                    p.innerText = attr+" : "+JSON.stringify(behaviour[attr]);
                }

                div.appendChild(p);
            }

            b_content.appendChild(div);
        }

    }
    /*-----------------------------------------------------------------LEFT AREA----------------------------------------------------------- */
    createTree()
    {

        var litetree = new LiteGUI.Tree(CORE.App.env_tree, { allow_rename: true });

        LiteGUI.bind( litetree.root, "item_selected", this.createNodeInspector.bind(this));
        litetree.onItemContextMenu =  this.onItemSelected.bind(this)
       // litetree.setSelectedItem(CORE.App.env_tree.id, true, this.createNodeInspector({detail:{data:{id: CORE.App.env_tree.id, type: CORE.App.env_tree.type}}}))
        return litetree;
    }
    onItemSelected(e,data){
        var that = this;
        var type = data.data.type;
        var actions = [];
        if(type == "env")
            actions = ["Add Agent","Add User", "Add Gesture Manager"];

        else return;
        var contextmenu = new LiteGUI.ContextMenu( actions, { callback: that.createNode.bind(this,data.data) });

    }
    createNode(data,sel)
    {
        switch(sel)
        {
            case "Add Agent":
                var agent = new Agent(null, [0,0,0]);

                this.tree.insertItem({id: agent.uid, type: "agent"}, data.id);
                break;
            case "Add User":
                var user = new User(null, [0,0,0]);

                this.tree.insertItem({id: user.uid, type: "user"}, data.id);
                break;
            case "Add Gesture Manager":

                this.tree.insertItem({id: "Gesture Manager", type: "gesture"}, data.id);
                CORE.App.env_tree.children.push({id: "Gesture Manager", type: "gesture"})
                this.tree.setSelectedItem("Gesture Manager", true, this.createNodeInspector({detail:{data:{id: "Gesture Manager", type: "gesture"}}}))
                break;
        }

    }
    createNodeInspector(e)
    {
        var that = this;
        var id = e.detail.data.id.toLowerCase();
        var type = e.detail.data.type.toLowerCase();
        var inspector = this.graphinspector//new LiteGUI.Inspector();
        var inspec_area = document.getElementById("edit-inspect");
        switch(type)
        {
            case "env":
              inspector.on_refresh = function()
              {
                var that = this;
                inspector.clear();

                inspector.addSection("Environment properties");
                inspector.addString("Token", CORE.App.env_tree.token, {width:"calc(100% - 45px)",callback: function(v){
                  CORE.App.env_tree.token = v;
                  that.tree.tree.token = v;
                  CORE.App.streamer.createRoom(v);
                  inspector.refresh();
                  /*TO DO*/
                  //update token to STREAMER
                }})
              /*  var btn = inspector.addButton(null, "Add Agent", {className:"btn btn-str", width:"100%", callback: that.createNode.bind(this, {id: "Environment"})});
                btn.getElementsByTagName("button")[0].className = "btn btn-str";
                var btn = inspector.addButton(null, "Add User", {className:"btn btn-str", width:"100%", callback: that.createNode.bind(this, {id: "Environment"})});
                btn.getElementsByTagName("button")[0].className = "btn btn-str";
                if(!that.tree.getItem("Gesture Manager", {className:"btn btn-str", width:"100%", callback: that.createNode.bind(this, {id: "Environment"})}))
                {
                    var btn = inspector.addButton(null, "Add Gesture Manager", { callback: that.createNode.bind(this, {id: "Environment"}) });
                    btn.getElementsByTagName("button")[0].className = "btn btn-str";
                }*/
              }.bind(this)
              inspector.refresh();
              /*  if(inspec_area.childNodes.length>0)
                    inspec_area.removeChild(inspec_area.childNodes[0])*/
              //  inspec_area.append(inspector.root);

            break;
            case "agent":
                var agent = AgentManager.getAgentById(id);

                /*var gest_btn = inspector.addButton(null, "Add Gesture Manager", { className:"btn btn-str", width:"100%", callback:that.createNode.bind(this,{id: agent.uid})});
                gest_btn.getElementsByTagName("button")[0].className = "btn btn-str";*/
                inspector = agent.createAgentInspector(inspector);
                var graph_btn = inspector.addButton(null, "Add Behaviour Tree", { className:"btn btn-str", width:"100%", callback:that.createNode.bind(this,{id: agent.uid})});
                graph_btn.getElementsByTagName("button")[0].className = "btn btn-str";

              /*  inspect_area.clear();
                if(inspec_area.childNodes.length>0)
                    inspec_area.removeChild(inspec_area.childNodes[0])
                inspec_area.append(inspector.root);*/
                break;
            case "user":
                var user = UserManager.getUserById(id);
                /*inspect_area.clear();
                if(inspec_area.childNodes.length>0)
                    inspec_area.removeChild(inspec_area.childNodes[0])*/
                inspector = user.createUserInspector(inspector);
                //inspec_area.append(inspector.root)
                break;
            case "gesture":
              /*  inspect_area.clear();
                if(inspec_area.childNodes.length>0)
                    inspec_area.removeChild(inspec_area.childNodes[0]);*/

                inspector = GestureManager.createGestureInspector(inspector);
                //inspec_area.append(inspector.root)
                break;
        }
    }

    /* Create button element */
    addButton(name, options)
    {
        var button = document.createElement("BUTTON");
        button.innerText = name;
        for(var i in options)
        {
            if(i=="callback")
                button.addEventListener("click", options[i])

            button[i] = options[i];
        }
        return button;
    }

    addInputTags(name, tags, options) { 

        var area = document.createElement("DIV");
        var title = document.createElement("DIV");
        title.setAttribute("style", "padding: 2px 5px");
        title.innerText = name;
        area.appendChild(title);
        var inputtags = document.createElement("DIV");
        var inputtags = document.createElement("DIV");
        inputtags.id = "tags";
        if(tags)
        {
            for(var i in tags)
            {
                this.createTag(tags[i], inputtags, options)
            }
        }

        var input = document.createElement("INPUT");
        input.setAttribute("type", "text");
        input.setAttribute("id", "input-tag")
        if(options.placeholder)
            input.setAttribute("placeholder", options.placeholder);
    /*    input.addEventListener("focusout", function(e) {
            var that = this
            var value = e.target.value;
            e.target.value = "";
            that.createTag(value, inputtags, options)


		}.bind(this));
*/

        input.addEventListener( "keydown" , function(e) {
            var that = this
            if(e.keyCode == 13 || e.keyCode == 188) //, or ENTER
            {
            //  e.stopPropagation()
                that.createTag(e.target.value, inputtags, options)
                e.target.value = "";
            }
        }.bind(this));
        inputtags.appendChild(input)
        area.appendChild(inputtags)
        return area;
    }

    createTag(value, inspector, options){
        var value = value.replace(/[^a-zA-Z0-9\+\-\.\#]/g, ''); // allowed characters list
        if (value)
        {
            var span = document.createElement("SPAN")
            span.className = "tag";
            span.innerText = value;
            span.addEventListener("click", function(){
                if(options.callback_delete)
                    options.callback_delete.call(this.innerText)
                this.remove()

            })
            inspector.appendChild(span);
            var that = this;
            if(options.callback)
                options.callback.call(that,value);
        //this.focus();
        }
    }
}

function autocomplete(inp, arr, words, options) {
    /*the autocomplete function takes two arguments,
    the text field element and an array of possible autocompleted values:*/
    var currentFocus;
    /*execute a function when someone writes in the text field:*/
    inp.addEventListener("input", function(e) {
        var a, b, i, val = this.value!=undefined? this.value : this.getValue();

        var values = val.split(" ");
        val = values[values.length-1]

        /*close any already open lists of autocompleted values*/
        closeAllLists();
        if (!val) { return false;}
        currentFocus = -1;
        /*create a DIV element that will contain the items (values):*/
        a = document.createElement("DIV");
        a.setAttribute("id", this.id + "autocomplete-list");
        a.setAttribute("class", "autocomplete-items");
        /*append the DIV element as a child of the autocomplete container:*/
        this.parentNode.appendChild(a);
        /*for each item in the array...*/
        for (i = 0; i < arr.length; i++) {
            /*check if the item starts with the same letters as the text field value:*/
            if (arr[i].substr(0, val.length).toUpperCase() == val.toUpperCase()) {
            /*create a DIV element for each matching element:*/
            b = document.createElement("DIV");
            /*make the matching letters bold:*/
            b.innerHTML = "<strong>" + arr[i].substr(0, val.length) + "</strong>";
            b.innerHTML += arr[i].substr(val.length);
            /*insert a input field that will hold the current array item's value:*/
            b.innerHTML += "<input type='hidden' value='" + arr[i] + "'>";
            /*execute a function when someone clicks on the item value (DIV element):*/
                b.addEventListener("click", function(e) {
                /*insert the value for the autocomplete text field:*/
                var w = this.getElementsByTagName("input")[0].value;
                if(words)
                    words.push(w);
                values.pop();
                values.push(w);
                var current = values.join(" ")
                if(inp.value!=undefined)
                    inp.value = current;
                else
                    inp.setValue(current);
                /*close the list of autocompleted values,
                (or any other open lists of autocompleted values:*/
                closeAllLists();
                if(options && options.callback)
                    options.callback.call()
            });
            a.appendChild(b);
            }
        }
    });
    
    /*execute a function presses a key on the keyboard:*/
    inp.addEventListener("keydown", function(e) {
        var x = document.getElementById(this.id + "autocomplete-list");
        if (x) x = x.getElementsByTagName("div");
        if (e.keyCode == 40) {
            /*If the arrow DOWN key is pressed,
            increase the currentFocus variable:*/
            currentFocus++;
            /*and and make the current item more visible:*/
            addActive(x);
        } else if (e.keyCode == 38) { //up
            /*If the arrow UP key is pressed,
            decrease the currentFocus variable:*/
            currentFocus--;
            /*and and make the current item more visible:*/
            addActive(x);
        } else if (e.keyCode == 13) {
            /*If the ENTER key is pressed, prevent the form from being submitted,*/
            e.preventDefault();
            if (currentFocus > -1) {
            /*and simulate a click on the "active" item:*/
            if (x) x[currentFocus].click();
            }
        }
    });

    function addActive(x) {
        /*a function to classify an item as "active":*/
        if (!x) return false;
        /*start by removing the "active" class on all items:*/
        removeActive(x);
        if (currentFocus >= x.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = (x.length - 1);
        /*add class "autocomplete-active":*/
        x[currentFocus].classList.add("autocomplete-active");
    }

    function removeActive(x) {
        /*a function to remove the "active" class from all autocomplete items:*/
        for (var i = 0; i < x.length; i++) {
        x[i].classList.remove("autocomplete-active");
        }
    }

    function closeAllLists(elmnt) {
        /*close all autocomplete lists in the document,
        except the one passed as an argument:*/
        var x = document.getElementsByClassName("autocomplete-items");
        for (var i = 0; i < x.length; i++) {
            if (elmnt != x[i] && elmnt != inp) {
                x[i].parentNode.removeChild(x[i]);
            }
        }
    }

    /*execute a function when someone clicks in the document:*/
    document.addEventListener("click", function (e) {
        closeAllLists(e.target);
    });
}

CORE.registerModule( Interface );
