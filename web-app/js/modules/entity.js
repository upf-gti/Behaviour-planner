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
        if(entity == "#Value")
        {
            text = text.toLowerCase();
        }
        var doc = nlp(text)
        if(entity == "#PhoneNumber")
        {
            //text = text.replaceAll(" ", "");
            text = text.replaceAll("-", "");
            var text = doc.match("#NumericValue").text();
            return this.checkPhoneFormatValidity(text)
        }
        
        var text = doc.match(entity).text();
        
        if(entity == "#TextValue" || entity == "#Value"){
            text = text2num(text.toLowerCase()).toString()
            text = text.toUpperCase()
        }
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
        text = text.replaceAll(" ", "");
        if(text.length >= 7 && text.length <= 12 ) //9 + 2 numbers for extension   
        {
            if(text[0] != '+')
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

var Small = {
    'zero': 0,
    'one': 1,
    'two': 2,
    'three': 3,
    'four': 4,
    'five': 5,
    'six': 6,
    'seven': 7,
    'eight': 8,
    'nine': 9,
    'ten': 10,
    'eleven': 11,
    'twelve': 12,
    'thirteen': 13,
    'fourteen': 14,
    'fifteen': 15,
    'sixteen': 16,
    'seventeen': 17,
    'eighteen': 18,
    'nineteen': 19,
    'twenty': 20,
    'thirty': 30,
    'forty': 40,
    'fifty': 50,
    'sixty': 60,
    'seventy': 70,
    'eighty': 80,
    'ninety': 90
};

var Magnitude = {
    'thousand':     1000,
    'million':      1000000,
    'billion':      1000000000,
    'trillion':     1000000000000,
    'quadrillion':  1000000000000000,
    'quintillion':  1000000000000000000,
    'sextillion':   1000000000000000000000,
    'septillion':   1000000000000000000000000,
    'octillion':    1000000000000000000000000000,
    'nonillion':    1000000000000000000000000000000,
    'decillion':    1000000000000000000000000000000000,
};

var a, n, g;

function text2num(s) {
    a = s.toString().split(/[\s-]+/);
    n = 0;
    g = 0;
    a.forEach(feach);
    return n + g;
}

function feach(w) {
    var x = Small[w];
    if (x != null) {
        g = g + x;
    }
    else if (w == "hundred") {
        g = g * 100;
    }
    else {
        x = Magnitude[w];
        if (x != null) {
            n = n + g * x
            g = 0;
        }
        else{
            n = w;
            g = "";
        }
    }
}