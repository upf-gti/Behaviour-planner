window.SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;

class Chat{
  constructor(){
      this.state = STOP;
      this.recognition = new window.SpeechRecognition();
      this.recognition.lang = 'en-US'
      this.recognition.onresult = this.onSpeechRecieved.bind(this);
      this.start_recognition = false;
      this.final_transcript = "";
  }
  createGUI(area)
  {
      var typing_console = document.createElement("DIV");
      typing_console.id= "typing";
      typing_console.className = "console";
      // typing_console.style="display.none";

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

      var microBtn = document.createElement("BUTTON");
      microBtn.id = "mic";
      microBtn.innerHTML = '<span class="material-icons" style= "width:18px!important">micro</span>';

      microBtn.addEventListener("click",function(e){
        var that = this;
        if(that.start_recognition){
					that.recognition.stop();
					that.start_recognition = false;
          microBtn.classList.remove("animated");
				}
				else{
					that.recognition.start();
					that.start_recognition = true;
					microBtn.classList.add("animated");
					that.input.value = "";
				}
        if(that.input.value == "")
            return;
       /* if(that.input.value[0] == "/")
            that.processCommand( that.input.value.substr(1) );
        else*/
      ///  that.userMessage( that.input.value );
      //  that.input.value = "";
      }.bind(this));
      typing.appendChild(microBtn);

      typing_console.appendChild(typing);

      var start = document.createElement("DIV");
      start.id = "div_start";
      typing_console.appendChild(start);

      area.add(typing_console);
      // return typing_console;
  }
  clearChat()
  {
    var log_container = document.getElementById("log-container");

    if(!log_container)
      return;

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
    CORE.App.onDataReceived({type:"data", data: {user: {text: text_message}}});
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
  onSpeechRecieved(event) {
    console.log("Result")
    var that = this;
    var interim_transcript = '';
    if (typeof(event.results) == 'undefined') {
      //recognition.onend = null;
      //recognition.stop();

      return;
    }
    console.log(event.results);

    for (var i = event.resultIndex; i < event.results.length; ++i) {

      if (event.results[i].isFinal) {
        that.recognition.stop();
        that.start_recognition = false;
        document.getElementById("mic").classList.remove("animated");

        that.final_transcript += event.results[i][0].transcript;
        interim_transcript = "";


      }
      else {
        interim_transcript += event.results[i][0].transcript;

      }
      //recognition.stop();


    }
    //that.startRecognition();
    that.final_transcript = capitalize(that.final_transcript);

    that.input.value = that.final_transcript;

    console.log(that.final_transcript)

  //  that.userMessage( that.final_transcript );



    that.final_transcript = "";

  }
}
var first_char = /\S/;
function capitalize(s) {
  return s.replace(first_char, function(m) { return m.toUpperCase(); });
}
