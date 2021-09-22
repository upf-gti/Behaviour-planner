var compromiseNumbers;
var EntitiesManager = {
    name : "EntitiesManager",
	properties_log : {},
    entities: [],
    customEntities : {},
    preInit(){

        var compromise = document.createElement('script');
        compromise.src = "https://unpkg.com/compromise";
        var compromise_numbers = document.createElement('script');
        compromise_numbers.src = "https://unpkg.com/compromise-numbers";
        document.head.appendChild(compromise);
        document.head.appendChild(compromise_numbers);
        compromise.onload = this.initData.bind(this);

    },
    initData(){
        /*loadJSON(function(response) {
            // Parse JSON string into object
            var actual_JSON = JSON.parse(response);
            data = actual_JSON.data;
            for(var i in data)
            {
                intents.push(data[i].intent);
            }*/
        if(!compromiseNumbers)
        {
          setTimeout(this.initData, 1000);
          return;
        }
        nlp.extend(compromiseNumbers)

        for(var i in nlp.world().tags)
            this.entities.push("#"+i);
    },
	getEntity(text, entity)
    {
        var doc = nlp(text)
        if(entity == "#PhoneNumber")
        {
            var text = doc.match("#NumericValue").text();
            return this.checkPhoneFormatValidity(text)
        }
      
        var text = doc.match(entity).text();
        if(text!="")
            return text;
        return false;

    },
    getEntityInfo(entity)
    {
        return nlp.world.tags[entity];
    },
    getEntities()
    {
        if(this.entities.length == 0)
            this.initData()
        return this.entities;
    },
    getAllEntitiesInfo()
    {
        return nlp.world.tags;
    },
    checkPhoneFormatValidity(text)
    {
        if(text.length >= 7 && text.length <= 12 ) //9 + 2 numbers for extension   
        {
            if(text[0] == '3')
                text = '+'+text;
            return text
        }
        return false
    },
    addWordsToWorld(tag, words){
        if(this.entities.length == 0)
            this.initData()
        this.customEntities[tag] = words;
        words = words.replace(", ",",").split(",");
        var map = {};
        for(var i=0; i<words.length; i++)
        {
            map[words[i]] = tag;
        }
        if(this.entities.indexOf("#"+tag)<0)
            this.entities.push("#"+tag)
       
        nlp.extend((Doc, world) =>{
            // add new words to the lexicon
            world.addWords(map)
        })

    }
}
function loadJSON(callback) {
    var xobj = new XMLHttpRequest();
    xobj.overrideMimeType("application/json");
    xobj.open('GET', 'corpus.json', true);
    // Replace 'my_data' with the path to your file
    xobj.onreadystatechange = function() {
        if (xobj.readyState === 4 && xobj.status === 200) {
            // Required use of an anonymous callback
            // as .open() will NOT return a value but simply returns undefined in asynchronous mode
            callback(xobj.responseText);
        }
    };
    xobj.send(null);
}
CORE.registerModule( EntitiesManager );
