
// FILESYSTEM FOR PRESENT PROJECT 

class FileSystem{
    
    constructor(user, pass, callback)
    {
        this.session = null;
        this.parsers = {};
        this.root = "https://webglstudio.org/projects/present/repository/files/";

        this.ALLOW_GUEST_UPLOADS = false;

        // init server
        LFS.setup("https://webglstudio.org/projects/present/repository/src/", this.onReady.bind(this));
    }
   
    init(){
      console.log(this);
    }

    getSession() {
        return this.session;
    }

    onDrop (callback, ev) {

        var UI = CORE["Interface"];
        if(!UI)
        throw("error: no interface");

        console.log('File(s) dropped');

        // Prevent default behavior (Prevent file from being opened)
        ev.preventDefault();
        ev.stopPropagation();

        if (ev.dataTransfer.items) {

          // Use DataTransferItemList interface to access the file(s)
          for (var i = 0; i < ev.dataTransfer.items.length; i++) {
            // If dropped items aren't files, reject them
            if (ev.dataTransfer.items[i].kind === 'file') {
                var file = ev.dataTransfer.items[i].getAsFile();

                console.log('Processing file[' + i + '] ' + file.name);

                var fileElement = document.getElementsByClassName("file");
                if(fileElement)
                    fileElement.files = file;
                var reader = new FileReader();
                reader.onload = function(e2){
                    file.data = e2.target.result;
                    fileElement.innerText = file.name;
                    //Inspector.onWidgetChange.call( GraphManager.inspector, element, name, file, options );

                    if(callback)
                    callback(file);
                }
                reader.readAsText( file );
            }
          }
        } else {
          // Use DataTransfer interface to access the file(s)
          for (var i = 0; i < ev.dataTransfer.files.length; i++) {
            console.log('... file[' + i + '].name = ' + ev.dataTransfer.files[i].name);
            }
        }
    }

    depr___onFileDrop( files ){
        
        console.log(files);
        for(var i = 0; i < files.items.length; i++){

            let fileReader = new FileReader(),
            file = files.items[i].getAsFile(),
            ext = (file.name).substr((file.name).lastIndexOf(".")+1),
            folder = "projects";

            // select folder
            // ...

            this.uploadFile(folder, files.items[i], [ext]);
        }

    }

    onReady(u, p, callback) {
        
        // something to do here?
    }

    onLogin( callback, session, req ){

        if(!session)
            throw("error in server login");

        if(req.status == -1) // Error in login
        {
            console.error(req.msg);
        }
        else
        {
            this.session = session;
            console.log("%cLOGGED " + session.user.username,"color: #7676cc; font-size: 16px" );
        }

        if(callback)
        callback(req.status != -1, req.msg);
    }

    onLogout( callback, closed ){

        if(closed)
        {
            this.session = null;
            console.log("%cLOGGED OUT","color: #7676cc; font-size: 16px" );
            if(callback)
                callback();    
        }
    }

    async getTags( folder, session ){

        return new Promise( (resolve, reject)=>{

            var session = this.session;

            session.request(
                session.server_url, 
                { action: "tags/getTags"}, e=>{
                console.log(e);
                resolve(e);
            }, reject, e => {});
        });
    }
    
    async uploadFile(path, file, metadata){


        return new Promise((resolve, reject) => {

            var session = this.session;
            // var unit_name = session.user.username;
            // let path = unit_name + "/" + folder + "/" + file.name;

			session.uploadFile( path, file, 
                    { "metadata": metadata }, 
                    function(e){console.log("complete",e); resolve()},
                    function(e, req){console.error("error",e, req);},
            );
        });
                //                    e => console.log("progress",e));
    }

    async uploadData(folder, data, filename, metadata){


        return new Promise((resolve, reject) => {

            var session = this.session;
            var unit_name = session.user.username + " unit";
            let path = unit_name + "/" + folder + "/" + filename;

			session.uploadFile( path, data, 
                    { "metadata": metadata }, 
                    function(e){console.log("complete",e); resolve()},
                    e => console.log("error",e)); //,
//                    e => console.log("progress",e));
        });
    }

    async getFiles( folder ){
        return new Promise( (resolve, reject)=>{
        
            function onError(e){
                reject(e);
            }
    
            function onFiles(f){
                if(!f)
                    return onError("Error: folder \""+folder+"\" not found.");
                resolve(f);
            }

            var session = this.session;
            var unit_name = session.user.username + " unit";

            session.request( 
                session.server_url,
                { action: "tags/getFilesInFolder", unit: unit_name, folder: folder }, function(resp){

                if(resp.status < 1){
                    onError(resp.msg);
                    return;
                }
                //resp.data = JSON.parse(resp.data);
                LiteFileServer.Session.processFileList( resp.data, unit_name + "/" + folder );
                onFiles(resp.data, resp);
            });


        });
    }

    
}

CORE.registerModule( FileSystem );
