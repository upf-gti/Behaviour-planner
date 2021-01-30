class Chat{
  constructor(){
      this.state = STOP;


  }
  createGUI()
  {
      var typing_console = document.createElement("DIV");
      typing_console.id= "typing";
      typing_console.className = "console";
      typing_console.style="display.none";

      this.log_container = document.createElement("DIV");
      this.log_container.className = "log";
      this.log_container.id = "log-container";
      typing_console.appendChild(this.log_container);

      var clearBtn = document.createElement("BUTTON");
      clearBtn.id = "clear-chat";
      clearBtn.innerText = "Clear";
      clearBtn.addEventListener("click", this.clearChat.bind(this));
      typing_console.appendChild(clearBtn);

      var typing = document.createElement("DIV");
      typing.className = "typing";


      this.input = document.createElement("INPUT");
      this.input.type = "text";
      this.input.placeHolder = "type here...";
      this.input.addEventListener("keydown",function(e){
        var that = this;
          if(e.keyCode == 13) //enter
          {
              if(that.input.value == "")
                  return;
              if(that.input.value[0] == "/")
                  that.processCommand( that.input.value.substr(1) );
              else
                  that.userMessage( that.input.value );
              that.input.value = "";
              return;
          }
      }.bind(this));
      typing.appendChild(this.input);

      var sendBtn = document.createElement("BUTTON");
      sendBtn.id = "send";
      sendBtn.innerHTML = '<span class="material-icons">send</span>';
      sendBtn.addEventListener("click",function(e){
         var that = this;
          if(that.input.value == "")
              return;
         /* if(that.input.value[0] == "/")
              that.processCommand( that.input.value.substr(1) );
          else*/
          that.userMessage( that.input.value );
          that.input.value = "";
      }.bind(this));
      typing.appendChild(sendBtn);
      typing_console.appendChild(typing);

      var start = document.createElement("DIV");
      start.id = "div_start";
      typing_console.appendChild(start);

      /*<div id="typing" class="console" style= "display:none">
		<div class='log'></div>
		<div class='typing'>
			<input type='text' placeHolder="type here..."/>
			<button id="send">Send</button>
			<button id="mic" class='' ></button>
		</div>
		<div id="div_start">

		</div>
      </div>*/
      return typing_console;
  }
  clearChat()
  {
    var log_container = document.getElementById("log-container")

    while(log_container.children.length)
      log_container.removeChild(log_container.lastChild)
     /* if(that.input.value[0] == "/")
          that.processCommand( that.input.value.substr(1) );
      else*/

  }
  showMessage(msg, className)
	{
		var div = document.createElement("div");
		div.innerHTML = msg;
		div.className = "msg " + (className||"");
		this.log_container.appendChild(div);
		this.log_container.scrollTop = 100000;
		return div;

	}
  getMessage()
  {
    if(!tmp.behaviour)
      setTimeout(this.getMessage(), 30000)
    for(var b in tmp.behaviour)
    {

        if(tmp.behaviour[b].type == 16)
            this.showMessage(tmp.behaviour[b].data.text)
    }
  }
	userMessage( text_message )
	{

    text_message = text_message.replace(/\b\w/g, l => l.toUpperCase());
    CORE.App.onDataReceived({type:"user-data", data: {text: text_message}});
    /*var user = CORE.UserManager.getUserById("User-1600260845413");
    if(user.properties.text!=undefined)
      user.setProperty("text", text_message);*/

		//userText = true;

		/*if(text_message.toLowerCase().includes("bye") || text_message.toLowerCase().includes("shut up")){
			mind.sendMessage( {type:"end", content:""} );
			return;
		}*/
  //  setTimeout(this.getMessage(), 30000)

	}
}
