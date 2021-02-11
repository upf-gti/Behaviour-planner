
// FILESYSTEM FOR PRESENT PROJECT 

class FileSystem{
    
    constructor(user, pass, callback)
    {
        this.session = null;
        this.parsers = {};
        this.root = "https://webglstudio.org/projects/present/repository/files/";

        // init server
        LFS.setup("https://webglstudio.org/projects/present/repository/src/", this.onReady.bind(this));
    }
   
    init(){
      console.log(this);
    }

    onFileDrop( files ){
        
        console.log(files);
        for(var i = 0; i < files.items.length; i++){

            let fileReader = new FileReader(),
            file = files.items[i].getAsFile(),
            ext = (file.name).substr((file.name).lastIndexOf(".")+1),
            folder = "other";

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
    
    async uploadFile(folder, file, metadata){


        return new Promise((resolve, reject) => {

            let path = "present/" + folder + "/" + file.name;
            var session = this.session;

			session.uploadFile( path, file, 
                    { "metadata": metadata }, 
                    function(e){console.log("complete",e); resolve()},
                    e => console.log("error",e)); //,
//                    e => console.log("progress",e));
        });
    }

    async uploadData(folder, data, filename, metadata){


        return new Promise((resolve, reject) => {

            let path = "present/" + folder + "/" + filename;
            var session = this.session;

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