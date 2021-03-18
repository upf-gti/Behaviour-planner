var _clip_id_count = 0;
var _clip_data = [0, 0, 0, {}]; //type, start, duration, data

function fillTimeline(timelineN, lines){
    //Add intents to timeline (each phrase and emotions)
    for(var i=1; i<lines.length; i++){
        var line = lines[i];
        if(lines[i].startsWith("<EMOTION:")){
            var emotion = line.substr(10, line.indexOf(">")-10);
            var emotionClipData = {
                amount: 0.5,
                attackPeak: 0.25,
                duration: 2,
                id: "faceLexeme-" + (++_clip_id_count),
                lexeme: "", //TODO
                relax: 0.75,
                start: i*10,
            };
            _clip_data[0] = 2; //FaceFACSClip
            _clip_data[1] = emotionClipData.start;
            _clip_data[2] = emotionClipData.duration;
            _clip_data[3] = emotionClipData;
            var emotionClip = ANIM.clipFromJSON(_clip_data);
		    timelineN.tracks[2].add(emotionClip);

            line = line.substr(line.indexOf(">")+2);
        }

        var speechClipData = {
            duration: 10,
            id: "speech-" + + (++_clip_id_count),
            start: i*10,
            text: line,
        };
        _clip_data[0] = 0; //SpeechClip
        _clip_data[1] = speechClipData.start;
        _clip_data[2] = speechClipData.duration;
        _clip_data[3] = speechClipData;
        speechClip = ANIM.clipFromJSON(_clip_data);
        timelineN.tracks[0].add(speechClip);
    }
}

function testAuto(){
    var hbtgraph = GraphManager.newGraph(GraphManager.HBTGRAPH);
    var h = 0;

    var rootN = LiteGraph.createNode("btree/Root");
    rootN.pos[1] = h++*200;
    hbtgraph.graph.add(rootN);

    var eventN = LiteGraph.createNode("btree/Event");
    eventN.pos[1] = h++*200;
    hbtgraph.graph.add(eventN);
    rootN.connect(0,eventN,0);

    var parallelN = LiteGraph.createNode("btree/Parallel");
    parallelN.pos[1] = h++*200;
    hbtgraph.graph.add(parallelN);
    eventN.connect(0,parallelN,0);

    var intentN = LiteGraph.createNode("btree/Intent");
    intentN.pos[1] = h++*200;
    intentN.responses.push({text: "Welcome. Can you please give me your name and surname?", tags: []});
    hbtgraph.graph.add(intentN);
    parallelN.connect(0,intentN,0);
}
function convertNoSubgraph(script){
    var hbtgraph = GraphManager.newGraph(GraphManager.HBTGRAPH);
    var sections = script.split("\n---\n");

    var previous_part_end = null;

    var rootN = LiteGraph.createNode("btree/Root");
    rootN.pos[1] = -200;
    hbtgraph.graph.add(rootN);

    previous_part_end = rootN;

    var prevh = 0;
    var h = 0;

    for(var s in sections){
        var parts = sections[s].split("\n\n");

        for(var p = 1; p < parts.length; p++){
            var part = parts[p];
            var lines = part.split("\n");

            if(lines[0].startsWith("User")){
                var n = parseInt( lines[0].substr(-1) );
                var l = 1;

                var eventN = LiteGraph.createNode("btree/Event");
                eventN.pos[1] = h++*200;
                hbtgraph.graph.add(eventN);

                previous_part_end.connect(0, eventN, 0);

                for(var c=0; c<n; c++){
                    var key = lines[l].substr(2);
                    var agent_lines = [];
                    l++;
                    while(l < lines.length){
                        if(lines[l].startsWith("-")) break;
                        else agent_lines.push(lines[l]);
                        l++;
                    }

                    var parseN = LiteGraph.createNode("btree/ParseCompare");
                    parseN.pos[0] = c*400;
                    parseN.pos[1] = h*200;
                    parseN.processPhrase({value: key}, []);
                    hbtgraph.graph.add(parseN);

                    eventN.connect(0, parseN, 0);

                    //Add agent stuff
                    var parallelN = LiteGraph.createNode("btree/Parallel");
                    parallelN.pos[0] = c*400;
                    parallelN.pos[1] = (h+1)*200;
                    hbtgraph.graph.add(parallelN);

                    parseN.connect(0, parallelN, 0);

                    var timelineN = LiteGraph.createNode("btree/TimelineIntent");
                    timelineN.pos[0] = 200 + c*400;
                    timelineN.pos[1] = (h+2)*200;
                    fillTimeline(timelineN, agent_lines);
                    hbtgraph.graph.add(timelineN);

                    parallelN.connect(0, timelineN, 0);

                    if(c == 0){
                        previous_part_end = parallelN;
                    }
                }

                h+=3;

            }else if(lines[0].startsWith("Agent")){
                var parallelN = LiteGraph.createNode("btree/Parallel");
                parallelN.pos[1] = h++*200;
                hbtgraph.graph.add(parallelN);

                previous_part_end.connect(0, parallelN, 0);

                var timelineN = LiteGraph.createNode("btree/TimelineIntent");
                timelineN.pos[0] = 200;
                timelineN.pos[1] = h++*200;
                fillTimeline(timelineN, lines);
                hbtgraph.graph.add(timelineN);

                parallelN.connect(0, timelineN, 0);

                previous_part_end = parallelN;
            }
        }  
        var sectionG = new LiteGraph.LGraphGroup(parts[0]);
        sectionG.pos = [-200, 200*prevh - 50];
        sectionG.size = [1400, 200*(h-prevh) - 100];
        hbtgraph.graph.add(sectionG);

        prevh = h;
    }
}

//Subgraph don't work properly with HBTrees at this moment
function testAuto2(){
    var hbtgraph = GraphManager.newGraph(GraphManager.HBTGRAPH);
    var h = 0;

    var rootN = LiteGraph.createNode("btree/Root");
    rootN.pos[1] = 0;
    hbtgraph.graph.add(rootN);

    var sectionG = LiteGraph.createNode("graph/subgraph");
    sectionG.pos[1] = 200;
    sectionG.title = "TEST";
    hbtgraph.graph.add(sectionG);

    var inputN = LiteGraph.createNode("graph/HBTreeinput"); //new HBTreeInput();
    inputN.pos[1] = h++*200; //Y
    sectionG.subgraph.add(inputN);

    rootN.connect(0,sectionG,0);

    var eventN = LiteGraph.createNode("btree/Event");
    eventN.pos[1] = h++*200;
    sectionG.subgraph.add(eventN);
    inputN.connect(0,eventN,0);

    var parallelN = LiteGraph.createNode("btree/Parallel");
    parallelN.pos[1] = h++*200;
    sectionG.subgraph.add(parallelN);
    eventN.connect(0,parallelN,0);

    var intentN = LiteGraph.createNode("btree/Intent");
    intentN.pos[1] = h++*200;
    intentN.responses.push({text: "Welcome. Can you please give me your name and surname?", tags: []});
    sectionG.subgraph.add(intentN);
    parallelN.connect(0,intentN,0);
}
function convert(script){
    var hbtgraph = GraphManager.newGraph(GraphManager.HBTGRAPH);
    var sections = script.split("\n---\n");

    var previous_section_end = null;
    var previous_part_end = null;

    var rootN = LiteGraph.createNode("btree/Root");
    rootN.pos[1] = -200;
    hbtgraph.graph.add(rootN);

    previous_section_end = rootN;

    for(var s in sections){
        var parts = sections[s].split("\n\n");

        var h = 1;

        var sectionG = LiteGraph.createNode("graph/subgraph");
        sectionG.title = parts[0];

        var inputN = LiteGraph.createNode("graph/HBTreeinput"); //new HBTreeInput();
        inputN.pos[1] = 0; //Y
        sectionG.subgraph.add(inputN);

        previous_part_end = inputN;

        for(var p = 1; p < parts.length; p++){
            var part = parts[p];
            var lines = part.split("\n");

            if(lines[0].startsWith("User")){
                var n = parseInt( lines[0].substr(-1) );
                var l = 1;

                var eventN = LiteGraph.createNode("btree/Event");
                eventN.pos[1] = h++*200;
                sectionG.subgraph.add(eventN);

                previous_part_end.connect(0, eventN, 0);

                for(var c=0; c<n; c++){
                    var key = lines[l].substr(2);
                    var agent_lines = [];
                    l++;
                    while(l < lines.length){
                        if(lines[l].startsWith("-")) break;
                        else agent_lines.push(lines[l]);
                        l++;
                    }

                    var parseN = LiteGraph.createNode("btree/ParseCompare");
                    parseN.pos[0] = c*400;
                    parseN.pos[1] = h*200;
                    parseN.processPhrase({value: key}, []);
                    sectionG.subgraph.add(parseN);

                    eventN.connect(0, parseN, 0);

                    //Add agent stuff
                    var parallelN = LiteGraph.createNode("btree/Parallel");
                    parallelN.pos[0] = c*400;
                    parallelN.pos[1] = (h+1)*200;
                    sectionG.subgraph.add(parallelN);

                    parseN.connect(0, parallelN, 0);

                    var timelineN = LiteGraph.createNode("btree/TimelineIntent");
                    timelineN.pos[0] = 200 + c*400;
                    timelineN.pos[1] = (h+2)*200;
                    fillTimeline(timelineN, agent_lines);
                    sectionG.subgraph.add(timelineN);

                    parallelN.connect(0, timelineN, 0);

                    if(c == 0){
                        previous_part_end = parallelN;
                    }
                }

                h+=3;

            }else if(lines[0].startsWith("Agent")){
                var parallelN = LiteGraph.createNode("btree/Parallel");
                parallelN.pos[1] = h++*200;
                sectionG.subgraph.add(parallelN);

                previous_part_end.connect(0, parallelN, 0);

                var timelineN = LiteGraph.createNode("btree/TimelineIntent");
                timelineN.pos[0] = 200;
                timelineN.pos[1] = h++*200;
                fillTimeline(timelineN, lines);
                sectionG.subgraph.add(timelineN);

                parallelN.connect(0, timelineN, 0);

                previous_part_end = parallelN;
            }
        }

        var outputN = LiteGraph.createNode("graph/HBTreeOutput"); //new HBTreeOutput();
        outputN.pos[1] = (h+1)*200;
        sectionG.subgraph.add(outputN);

        previous_part_end.connect(0, outputN, 0);

        sectionG.pos[1] = s*200;
        hbtgraph.graph.add(sectionG);

        previous_section_end.connect(0, sectionG, 0);
        previous_section_end = sectionG;        
    }
}
