class Drive {

    constructor() {
        this.filter_by_name = null;
    }

    createTab() {
        var drive_area = new LiteGUI.Area({id :"drivearea", content_id:"drive-area", autoresize: true, inmediateResize: true});;
        drive_area.split("horizontal",[250,null], true);

        var dt_area = drive_area.getSection(0);
        var fixed_dt_inspector = new LiteGUI.Inspector();
        dt_area.add( fixed_dt_inspector );

        var dt_inspector = new LiteGUI.Inspector({id: "drive-tree-inspector"});
        this.dt_inspector = dt_inspector;
        dt_area.add( dt_inspector );

        var files_area = drive_area.getSection(1);

        // Files area -> top bar (filter, etc) and files panel
        var browser_root = new LiteGUI.Area( { full: true });
        files_area.add( browser_root );
        browser_root.split("vertical",[30,null]);

        var fixed_files_inspector = new LiteGUI.Inspector({ one_line: true });
        fixed_files_inspector.root.style.marginTop = "3px";
        browser_root.sections[0].add( fixed_files_inspector );

        fixed_files_inspector.addString("Filter", "", {name_width: 40, content_width: 120, width: 160, callback: (function(v){
            this.filter_by_name = v ? v.toLowerCase() : null;
	        this.applyFilters();
        }.bind(this))});
        fixed_files_inspector.addCombo("Type", "", {values: ["Graph", "Environment"], name_width: 60, content_width: 140, width: 200});
        fixed_files_inspector.addSeparator();
        fixed_files_inspector.root.style.background = "#222";

        // files
        this.browser_container = browser_root.sections[1].content;
        this.browser_container.classList.add("resources-panel-container");
        this.drive_area = drive_area;
        CORE["Interface"]._drive_tab.add( drive_area );
    }

    createSidePanel() {

        this.panel_drive = new LiteGUI.Area({id :"paneldrivearea", content_id:"paneldrive-area", autoresize: true, inmediateResize: true});;
        var session_drive_inspector = new LiteGUI.Inspector({id:"drive-inspector"});
        this.panel_drive.add(session_drive_inspector);
        this.panel_drive.inspector = session_drive_inspector;
        
        session_drive_inspector.on_refresh = function() {

            session_drive_inspector.clear();
            session_drive_inspector.addSection("Session");

            var session = CORE["FileSystem"].getSession();
            if(session) {
                var user = session.user;

                session_drive_inspector.addInfo("Username", user.username);
                session_drive_inspector.addInfo("Email", user.email);
                session_drive_inspector.addSeparator();
                session_drive_inspector.addInfo("Unit size", user.total_space / 1e6 + " MB");

                var roles = [];

                for(var o in user.roles)
                    if(user.roles[o] === true)
                        roles.push(o);

                session_drive_inspector.addList("Roles", roles, {height: "60px", disabled: true});
            }

            session_drive_inspector.endCurrentSection();
        }

        var file_info_inspector = new LiteGUI.Inspector({id:"drive-inspector"});
        this.panel_drive.add(file_info_inspector);
        this.current_file_inspector = file_info_inspector;

        this.current_file_inspector.refresh = function(item) {

            file_info_inspector.clear();
            file_info_inspector.addSection("Item");

            var session = CORE["FileSystem"].getSession();
            if(!session) 
            return;
            
            file_info_inspector.addString("Filename", item.filename, {disabled: true});
            file_info_inspector.endCurrentSection();
        }
    }

    refresh() {

        var curr_session = CORE["FileSystem"].getSession();
        if(!curr_session)
        return;

        var user_name = curr_session.user.username;
        var files = {};
        var file_selected = "";
        var folder_selected = user_name;
        var path = "";
        var widgets = this.dt_inspector, that = this;

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
                    
                    that.showInBrowserContent(folder_selected, files);
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
            var litetree = new LiteGUI.Tree({id: user_name, collapsed_depth: 3, indent_offset: -1 });
            litetree.root.classList.add("resources-tree");
            litetree.root.style.backgroundColor = "black";
            litetree.root.style.padding = "5px";
            litetree.root.style.width = "100%";
            litetree.root.style.height = "100%";
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
                __getFolderFiles(user_name, path);
            });

            __showFolders(data, user_name);

            widgets.on_refresh = function(){

                console.log("refreshing drive tree");
                widgets.clear();
                widgets.root.appendChild(litetree.root);
                widgets.addSeparator();
            }

            widgets.on_refresh();
            __getFolderFiles(user_name, null);
        }));
    }

    //where items is object with files
    showInBrowserContent( folder_selected, items, options )
    {
        options = options || {};
        var parent = this.browser_container;

        // Clear resources panel
        parent.innerHTML = "";

        var title = document.createElement("div");
        title.className = "file-list-title";
        title.innerHTML = folder_selected;
        parent.appendChild( title );

        var root =  document.createElement("ul");
        root.className = "file-list";
        root.style.height = "calc( 100% - 24px )";
        parent.appendChild( root );

        this.visible_resources = items;
        this._last_options = options;

        if(Object.keys(items).length)
            for(var i in items)
            {
                if(i[0] == ":") //local resource
                    continue;
                var item = items[i];
                if(!item.name)
                    item.name = i;
                this.addItemToBrowser( folder_selected, item );
            }
        else
        {
            if(options.content)
                root.innerHTML = options.content;
            else if(options.info)
                root.innerHTML = "<div class='file-list-info'>"+options.info+"</div>";
            else
                root.innerHTML = "<div class='file-list-info'>No items</div>";
        }
    }

    // add a new file to the browser window
    addItemToBrowser( folder_selected, resource )
    {
        console.log(resource);
        var that = this;
        var parent = this.browser_container.querySelector(".file-list");

        var element =  document.createElement("li");
        if(resource.id)
            element.dataset["id"] = resource.id;
        element.dataset["filename"] = resource.filename;
        if(resource.fullpath)
            element.dataset["fullpath"] = resource.fullpath;

        var category = ""; //DriveModule.getResourceCategory( resource );

        var type = resource.object_class || resource.category || UTILS.getObjectClassName( resource );
        /*if(type == "Object") //in server_side resources that dont have category
            type = LS.Formats.guessType( resource.fullpath || resource.filename );*/
        if(!type)
            type = "unknown";
        element.dataset["restype"] = type;
        element.dataset["category"] = category;

        element.className = "resource file-item resource-" + type;
        if(resource.id)
            element.className += " in-server";
        else
            element.className += " in-client";

        element.resource = resource;

        if(resource._modified)
            element.className += " modified";

        var filename = resource.filename;
        if(!filename) 
            filename = resource.fullpath || "";

        element.title = type + ": " + resource.filename;
        if(filename)
        {
            var clean_name = filename.split(".");
            clean_name = clean_name.shift() + "<span class='extension'>." + clean_name.join(".") + "</span>";
            element.innerHTML = "<span class='title'>"+clean_name+"</span>";
        }

        var extension = UTILS.getFileExtension( filename );
        var type_title = extension;
        if(!type_title || type_title.toUpperCase() == "JSON")
            type_title = type;
        else
            type_title = type_title.toUpperCase();
        

        var preview = "https://webglstudio.org/projects/present/repository/files/" + folder_selected + "/thb/" + resource.filename.replace(extension, "png");
        if(preview)
        {
            if( typeof(preview) == "string") 
            {
                var img = new Image();
                img.src = preview;
                // img.style.width = "100%";
                img.style.height = "100%";
                img.style.maxWidth = 200;
                img.onerror = function() { this.parentNode.removeChild( this ); }
            }
            else
                img = preview;
            element.appendChild(img);
        }
        
        var info = document.createElement("span");
        info.className = "info";
        info.innerHTML = "<span class='category'>" + category + "</span><span class='extension'>." + type_title.toLowerCase() + "</span>";
        element.appendChild(info);

        element.addEventListener("click", item_selected);
        element.addEventListener("dblclick", item_dblclick);

        this.applyFilters([element]);
        parent.appendChild(element);

        //when the resources is clicked
        function item_selected(e)
        {
            var path = element.dataset["fullpath"] || element.dataset["filename"];

            var items = parent.querySelectorAll(".selected");
            for(var i = 0; i < items.length; ++i)
                items[i].classList.remove("selected");
            element.classList.add("selected");
            LiteGUI.trigger( that, "item_selected", element );
            LiteGUI.trigger( that, "resource_selected", path );
            that.selected_item = element;

            that.current_file_inspector.refresh(resource);
        }

        function item_dblclick(e)
        {
            var file = resource;
        }
    }

    applyFilters( items )
    {
        if(!items)
        {
            var parent = this.browser_container.querySelector(".file-list");
            items = parent.querySelectorAll(".file-item");
        }

        for(var i = 0; i < items.length; ++i )
        {
            var item = items[i];
            var must_be_filtered = false;

            //filter by name
            var filename = item.dataset["filename"];
            if( this.filter_by_name && filename )
            {
                filename = filename.toLowerCase();
                if( this.filter_by_name && filename.indexOf( this.filter_by_name ) == -1 )
                    must_be_filtered = true;
            }

            //filter by category
            var item_category = item.dataset["category"];
            if( this.filter_by_category && item_category )
            {
                item_category = item_category.toLowerCase();
                if( item_category != this.filter_by_category )
                    must_be_filtered = true;
            }

            //apply filter
            if(must_be_filtered)
                item.classList.add("filtered");
            else
                item.classList.remove("filtered");
        }
    }
}

CORE.registerModule( Drive );