class JSONFormatter {

    constructor() {
        this.tabSpaces = 4;
        this.plain_text = null;

        this.name = "unnamed";
		this.inspector = new LiteGUI.Inspector();
        this.fromfile = null;
    }

    makeSpaces(spaces) {
        var string = "";
        for(var i = 0; i < this.tabSpaces * (spaces != undefined ? spaces : 1); i++)
        string += " ";
        return string;
    }

    validate(data) {
        this.valid_text.querySelector(".inputfield input").value = "Valid";
        this.valid_text.querySelector(".keyframe_icon_status").classList.replace("invalid", "valid");
        HttpRequest.RAO_Templates["/" + this.name] = data;
    }

    error() {
        this.valid_text.querySelector(".inputfield input").value = "Invalid";
        this.valid_text.querySelector(".keyframe_icon_status").classList.replace("valid", "invalid");
    }

    readJSON(f) {
        var that = this;
        var reader = new FileReader();
        reader.onload = function(e){
            var data = e.target.result;
            try{
                var data_parsed = JSON.parse(data);
                data = JSON.stringify(data_parsed, null, 4);
                that.name = f.name;
                that.fromfile = f;
                that.inputArea.value = that.plain_text = data;
                that.inspector.on_refresh();
            }catch(e){
                that.error();
            }
            
        }
        reader.readAsText( f );
    }

    openWindow() {
        
        var that = this;

        var pretitle = "<span class='keyframe_icon_status valid'></span>";
		var dialog = new LiteGUI.Dialog({ title:"New template", width: 600, closable: true });

        this.inspector.on_refresh = (function() {

            this.inspector.clear();
            this.inspector.widgets_per_row = 3;
            this.inspector.addString("Format:", "JSON", {disabled: true, width: "35%", name_width: "40%"});
            this.valid_text = this.inspector.addString("", "Valid", {disabled: true, width: "20%", name_width: "20%", pretitle: pretitle});
            this.inspector.addFile("Import", this.fromfile, {width: "40%", callback: function(f){
                
                that.readJSON(f);
    
            }});
            this.inspector.addSeparator();
            this.inspector.widgets_per_row = 1;
            var text_area = this.inspector.addTextarea(null, this.plain_text || "",{height: "350px", callback: function(v){
                that.plain_text = v;
            }});
            var text_box = text_area.querySelector(".inputfield");
            text_box.classList.add("console-text");
            this.inputArea = text_box.querySelector("textarea");
    
            this.inputArea.addEventListener('keydown', function(e) {
    
                var start = this.selectionStart;
                var end = this.selectionEnd;
    
                var tabSpaces = that.tabSpaces;
                var line = UTILS.getLine(this.value, start);
                var numTabs = UTILS.getTabs(line, 4);

                if (e.key == 'Tab') {
                    e.preventDefault();
                    // Soportar más casos de espacios/tabs
                    if(e.shiftKey) {
                        if(start == end && this.value.substring(start - tabSpaces, start) == that.makeSpaces()) {
                            this.value = this.value.substring(0, start - tabSpaces) + this.value.substring(end);
                            this.selectionStart = this.selectionEnd = start - tabSpaces;
                        }
                    }else {
                        this.value = this.value.substring(0, start) + that.makeSpaces() + this.value.substring(end);
                        this.selectionStart = this.selectionEnd = start + tabSpaces;
                    } 
                }
                else if (e.key == 'Enter') {

                    if(start != end)
                    return false;

                    e.preventDefault();

                    if(this.value.substring(start - 1, start) == "{") {
                        this.value = this.value.substring(0, start) + "\n" + that.makeSpaces(numTabs + 1) + "\n" + that.makeSpaces(numTabs) + "}" + this.value.substring(end);
                        this.selectionStart = this.selectionEnd = start + tabSpaces * (numTabs + 1) + 1;
                    }else
                    {
                        this.value = this.value.substring(0, start) + "\n" + that.makeSpaces(numTabs) + this.value.substring(end);
                        this.selectionStart = this.selectionEnd = start + tabSpaces * (numTabs) + 1;
                    }
                }else if (e.key == '"') {
                    if(start == end && this.value.substring(start - 1, start) != '"' && this.value.substring(start, start + 1) != '"'){
                        this.value = this.value.substring(0, start) + '"' + this.value.substring(end);
                        this.selectionStart = this.selectionEnd = start;
                    }
                }
    
                return false;
            });
    
            this.inspector.widgets_per_row = 2;
            this.inspector.addString("Name", "", {placeHolder: this.name, callback: function(v){
                that.name = v;
            }})
    
            this.inspector.addButton(null, "Load", function(){
                if(!that.plain_text)
                    return;
                var data;
                try{
                    data = JSON.parse(that.plain_text);
                    that.validate(data);
                    dialog.close();
                }catch(e){
                    that.error();
                }
            });
            this.inspector.widgets_per_row = 1;
            dialog.add( this.inspector );
            dialog.adjustSize(2);
            dialog.makeModal();
        }).bind(this);

        this.inspector.on_refresh();
    }
}

CORE.registerModule( JSONFormatter );