var GestureManager = {
    name:"GestureManager",
    properties_log: {},
    gestures: new Proxy({}, {
            set: (target, property, value, receiver) => {
                target[property] = value;

                if(property == "length")
                    return true;

                return true;
            }
        }),

    init(){
    },
    createGestureInspector(inspector){
        var that = this;
        var inspector = this.inspector = inspector || new LiteGUI.Inspector();

        inspector.on_refresh = function()
        {

            inspector.clear();
            inspector.root.id = "gestures-inspector"
            var section = inspector.addSection("Gestures Manager");

            section.firstElementChild.classList.add("draggable-item");
            section.firstElementChild.addEventListener("dragstart", function(a){

                a.dataTransfer.setData("type", "GestureManager" );
                a.dataTransfer.setData("name", that.name );
                a.dataTransfer.setData("data_type", "gesture");
                a.dataTransfer.setData("info", JSON.stringify(that.gestures))

            });
            var pretitle = "<span title='Drag " + this.name + "' class='keyframe_icon'></span>";
            // inspector.widgets_per_row = 3;



            section.firstElementChild.setAttribute("draggable", true);
            for(var i in that.gestures)
            {
                var gesture = that.gestures[i];
                var widget = GestureManager.createGUIParams(inspector, gesture)
                var edit_btn = inspector.addButton(null,  CORE.Interface.icons.edit, { width:40, callback: that.openEditGesture.bind(that,gesture)});
                edit_btn.className+= "btn btn-icon btn-inspect"
                var delete_btn = inspector.addButton(null,  CORE.Interface.icons.trash, {  width:40, name_width:"0%",callback: that.deleteGesture.bind(that,gesture.name) });
                delete_btn.className+= "btn btn-icon btn-inspect"
            }

            inspector.widgets_per_row = 2;
            inspector.addButton(null, "Add gesture", {callback: that.openNewGesture.bind(that)})
            inspector.addButton(null, "From file")
        }
        inspector.refresh();
        return inspector;

    },
    createGesture(data)
    {
        //dialog.close();
        var gesture = new Gesture(data);
        this.gestures[gesture.name] = gesture;
        console.log(gesture)
    },
    openNewGesture(){
        var gestureManager = this;
        var showIntensity = false;
        var showController = false;
        var showSpeed = false;
        var gesture = {
            name : "",
            duration : Gesture.DURATION[0],
	        priority : Gesture.PRIORITY[0],
	        interface : "",
            keywords : "",
            properties : {}
        };
        var title = "New gesture";

        //create the dialog
        var dialog = new LiteGUI.Dialog({title: title, close: true, width: 300, height: 120, scroll: false, draggable: true});

        //add some widgets
        var widgets = new LiteGUI.Inspector();

        widgets.on_refresh = function (){
            widgets.clear();
            widgets.addString("Name", gesture.name, {callback: function(v){gesture.name = v;}});
            widgets.addString("Interface name", gesture.interface, {callback: function(v){gesture.interface = v;}});
            widgets.addString("Keywords", gesture.keywords, {callback: function(v){gesture.keywords = v;}});
            widgets.addCombo("Duration", gesture.duration, { values: Gesture.DURATION, callback: function(v){gesture.duration = v;}});
            widgets.addCombo("Priority", gesture.priority, { values: Gesture.PRIORITY, callback: function(v){gesture.priority = v;}});
            widgets.addCheckbox("Intensity  property", showIntensity, {name_width:150,callback: function(v){
                if(!v)
                    delete gesture.properties.intensity;

                showIntensity = v;

                widgets.refresh();
            }});
            if(showIntensity)
            {
                gesture.properties.intensity = 1;
                widgets.addNumber("Intensity", gesture.properties.intensity, {min:0, max:1, callback:function(v){gesture.properties.intensity = v}})
            }


            widgets.addCheckbox("Controller property", showController, {name_width:150, callback: function(v){
                if(!v)
                    delete gesture.properties.controller;
                showController = v;
                widgets.refresh();

            }});
            if(showController)
            {
                gesture.properties.controller = [0,0,0];
                widgets.addVector3("World coordinates", gesture.properties.controller, { callback:function(v){gesture.properties.controller = v}})
            }

            widgets.addCheckbox("Speed property", showSpeed, {name_width:150,callback: function(v){
                if(!v)
                    delete gesture.properties.speed;
                showSpeed = v;
                widgets.refresh();
            }});
            if(showSpeed)
            {
                gesture.properties.speed = 1;
                widgets.addNumber("Speed", gesture.properties.speed, { callback:function(v){gesture.properties.speed = v}})
            }


            widgets.addButton(null, "Add gesture", {callback: function(){
                dialog.close();
                var gest = new Gesture(gesture);
                GestureManager.gestures[gest.name] = gest;
                //GestureManager.createGesture(gesture);
                var insp = document.getElementById("inspector")
                GestureManager.inspector.refresh()//createGestureInspector(insp.litearea)
            } })



            dialog.adjustSize();
        }
        widgets.refresh();

        dialog.add(widgets);

        //show and ensure the content fits
        dialog.show();
        dialog.adjustSize();

    },
    openEditGesture(data){
        var that = this;
        var showIntensity = false;
        var showController = false;
        var showSpeed = false;
        var gesture = {
            name : "",
            duration : Gesture.DURATION[0],
	        priority : Gesture.PRIORITY[0],
	        interface : "",
            keywords : "",
            properties : {}
        };
        var title = "Edit gesture";
        if(data.constructor && data.constructor == Gesture)
        {
            gesture = data;
            showIntensity = data.properties.hasOwnProperty("intensity");
            showController = data.properties.hasOwnProperty("controller");
            showSpeed = data.properties.hasOwnProperty("speed");

        }

        //create the dialog
        var dialog = new LiteGUI.Dialog({title: title, close: true, width: 300, height: 120, scroll: false, draggable: false, show:'fade'});

        //add some widgets
        var widgets = new LiteGUI.Inspector();
        var delete_html = '<img src="'+baseURL+'/latest/imgs/mini-icon-trash.png" alt="W3Schools.com">'
            //inspector.clear();
        var pretitle = "<span title='Drag " + data.name + "' class='keyframe_icon'></span>";
        widgets.on_refresh = function (){
            widgets.clear();
            widgets.addString("Name", gesture.name, {disable:true, callback: function(v){gesture.name = v;}});
            widgets.addString("Interface name", gesture.interface, {callback: function(v){gesture.interface = v;}});
            widgets.addString("Keywords", gesture.keywords, {callback: function(v){gesture.keywords = v;}});
           // widgets.root.classList.add("draggable-item");

            widgets.addCombo("Duration", gesture.duration, {pretitle:pretitle, values: Gesture.DURATION, callback: function(v){gesture.duration = v;}});
            widgets.addCombo("Priority", gesture.priority, { pretitle:pretitle, values: Gesture.PRIORITY, callback: function(v){gesture.priority = v;}});
            widgets.addCheckbox("Intensity  property", showIntensity, {name_width:150,callback: function(v){
                if(!v)
                    delete gesture.properties.intensity;

                showIntensity = v;

                widgets.refresh();
            }});
            if(showIntensity)
            {
                if(!data.properties.hasOwnProperty("intensity"))
                    gesture.properties.intensity = 1;
                widgets.addNumber("Intensity", gesture.properties.intensity, {pretitle:pretitle,min:0, max:1, callback:function(v){gesture.properties.intensity = v}})
            }


            widgets.addCheckbox("Controller property", showController, {name_width:150, callback: function(v){
                if(!v)
                    delete gesture.properties.controller;
                showController = v;

            }});
            if(showController)
            {
                if(!data.properties.hasOwnProperty("controller"))
                    gesture.properties.controller = [0,0,0];
                widgets.addVector3("World coordinates", gesture.properties.controller, { pretitle:pretitle, callback:function(v){gesture.properties.controller = v}})
            }

            widgets.addCheckbox("Speed property", showSpeed, {name_width:150,callback: function(v){
                if(!v)
                    delete gesture.properties.speed;
                showSpeed = v;
                widgets.refresh();
            }});
            if(showSpeed)
            {
                if(!data.properties.hasOwnProperty("speed"))
                    gesture.properties.speed = 1;
                widgets.addNumber("Speed", gesture.properties.speed, { pretitle:pretitle, callback:function(v){gesture.properties.speed = v}})
            }

            widgets.addButton(null, "Save gesture", {callback: function(){
                dialog.close();
                that.editGesture(gesture);

                that.inspector.refresh()//createGestureInspector(insp.litearea)
            } })


            var icons = widgets.root.getElementsByClassName("keyframe_icon");
            if(icons){
                for(var i=0; i<icons.length;i++)
                {
                    var icon = icons[i];
                    icon.addEventListener("dragstart", function(a){

                        a.dataTransfer.setData("type", "HBTProperty" );
                        a.dataTransfer.setData("name", a.srcElement.parentElement.title );
                        a.dataTransfer.setData("data_type", "gesture-property");
                        a.dataTransfer.setData("info", data.name);

                    });
                    icon.setAttribute("draggable", true);
                }

            }

            dialog.adjustSize();
        }
        widgets.refresh();

        dialog.add(widgets);

        //show and ensure the content fits
        dialog.show('fade');
        dialog.adjustSize();

    },

    deleteGesture(gestureName){
        var that = this;
        var data = this.gestures[gestureName];
        if(data)
            delete this.gestures[gestureName];
            that.inspector.refresh();
    },

    editGesture(gesture){
        var data = this.gestures[gesture.name];
        if(data)
            data = gesture;
    },
    serialize(){
        var gestures = {};
        for(var i in this.gestures)
        {
            gestures[i] = this.gestures[i];
        }
        return gestures;
    },
    createGUIParams(inspector, gesture){
            //inspector.clear();
            var pretitle = "<span title='Drag " + gesture.name + "' class='keyframe_icon'></span>";
           // inspector.widgets_per_row = 3;

            var str = inspector.addInfo( gesture.name, null, { disabled:true,pretitle: pretitle});
            str.className+=" gesture-str";
            str.classList.add("draggable-item");
            str.addEventListener("dragstart", function(a){

                a.dataTransfer.setData("type", "GestureNode" );
                a.dataTransfer.setData("name", gesture.name );
                a.dataTransfer.setData("data_type", "gesture");

            });
            str.setAttribute("draggable", true);
           //var edit_btn = that.interface.addButton("", {className: "btn btn-icon ",innerHTML: '<span class="material-icons"> edit</span>', callback:GestureManager.openEditGesture.bind(this,that)})
           // inspector.add(edit_btn)
            //inspector.addButton(null, "Edit", { width:40,callback:GestureManager.openEditGesture.bind(this,that)});



       // area.litearea.add(inspector);
    }
}
//CORE.registerModule( GestureManager );
