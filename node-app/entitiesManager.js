
//EntitiesManager does the natural language processing for the ParseCompare logic (extracts tags)

/**
 * Dependencies:
 *  Compromise Cool
 */


 (function _entities(global)
 {
    const nlp = require('compromise')
    nlp.extend(require('compromise-numbers'))
    nlp.extend(require('compromise-dates'))
    class EntitiesManager{
        constructor(){

        this.name = "EntitiesManager";
        this.properties_log = {};
        this.entities= [];
        this.customEntities = {};
       
        }
       
        initData(){
            for(var i in nlp.world().tags)
                this.entities.push("#"+i);
        }

        getEntity(text, entity)
        {
            if(entity == "#Value")
            {
                text = text.toLowerCase();
            }
            
            if(entity == "#PhoneNumber" || entity == "#NumericValue")
            {
                //text = text.replaceAll(" ", "");
                text = text.replaceAll("-", "");
                var text_split = text.split(" ");
                var numbers = [];
                for(var i=0; i< text_split.length; i++)
                { 
                    var n = nlp(text_split[i]).match("#NumericValue").text();
                    if(n!="") numbers.push(n);
                }
                if(!numbers.length)
                    return false;
                text = numbers.join("");
                if(entity == "#PhoneNumber")
                    return this.checkPhoneFormatValidity(text)
            }
            if(entity == "#Date")
            {
                text = nlp(text).dates().format("{month-number} {date}").text()
                if(text=="") return false;
                else return text;
                /*
                var date = text.split(" ");
                date[0] = (parseInt(date[0])+1).toString()
                text = date.joint("-");*/
            }
            var doc = nlp(text)
            var text = doc.match(entity).text();
            
            if(entity == "#TextValue" || entity == "#Value"){
                text = text2num(text.toLowerCase()).toString()
                text = text.toUpperCase()
            }
            if(text!="")
                return text;
            return false;

        }

        getEntityInfo(entity)
        {
            return nlp.world.tags[entity];
        }

        getEntities()
        {
            if(this.entities.length == 0)
                this.initData()
            return this.entities;
        }

        getAllEntitiesInfo()
        {
            return nlp.world.tags;
        }

        checkPhoneFormatValidity(text)
        {
            text = text.replaceAll(" ", "");
            if(text.length >= 8 && text.length <= 15 ) //9 + 2 numbers for extension   
            {
                if(text[0] != '+')
                    text = '+'+text;
                return text
            }
            return false
        }

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
    global.EntitiesManager = EntitiesManager;
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
})(this)
