var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var mostCommonWords = JSON.parse(fs.readFileSync('most_common_words.json', 'utf-8'));
mostCommonWords = mostCommonWords.map( function (word) { return word.toLowerCase(); } );
var watsonTranscriber = require('./transcriber.js');
var child = require('child_process');
var files = fs.readdirSync(config.transcriptsDirectory);
var silences = child.execFile('./silences.py');
// var wn = child.execFile('./wordnet_analysis.py');
// files = files.filter(function(a) { return a.split('.')[1] === 'wav'; });
// a function to 

var processedFiles = 0;
var processed = 0, numToProcess = 0;
var allData = {};
var usedClips = [];
var graph = {};
var time = 0;
var edgeList = [], allTheClips = [], allTheWords;

Array.prototype.popByIndex = function (index) {
  var val = this[index];
  if (typeof(val) === 'undefined' || typeof(index) !== 'number') return null;
  
  for (var i=index+1, len=this.length; i < len; i++) {
    this[index] = this[i];
    index++;
  }
  
  this.pop();
  return val;
};
var getRandomInt = function (min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

silences.stdout.on('data', function (data) {
  var soundFile, identifier = data.filename;
  data = JSON.parse(data.trim());
  if (allData[data.filename] === 'undefined')
    allData[data.filename] = {};
  allData[data.filename]['silences'] = data.silences;
  processed++;

  if (processed === numToProcess) {
    populateGraph();
    edgeList = createEdgeList(graph);
    allTheWords = getAllTheWords(edgeList);
    // silences.kill();
    // getStartingSegments();
    // getEndingSegments();
    // writeUpWords("wordCounts");
    // ////(endingSegments);
    // wordCounts = {};
    // wordInFiles = {};
    // populateGraph();
    // var fd = fs.openSync('graph.txt', 'w');
    // fs.writeSync(fd, JSON.stringify(graph));
    // fs.closeSync(fd);
    // for (var key in startingSegments) {
    //   if (startingSegments.hasOwnProperty(key)) {
    //     var segment = startingSegments[key];
    //     var words = getWordsFromRange(key, segment);
    //     var countedWords = countWords(words);
    //     countWordFiles(words, key);
    //     //////(wordInFiles);
    //   }
    // }
    // writeUpWords("startingWordCounts");
    // makeClipWithSilences();

    path = getPath(allTheWords.popByIndex(0), allTheClips, edgeList);
    path.forEach(function (item, i) {
      console.log(item);
      // processClip(item[1], item[2], i);
    });
    // makeVideo();

  }
});
silences.stderr.on('data', function (err) {
  console.log(err);
});


var getTimestampsForOneWord = function (filename, word) {
  var clip = allData[filename], timestamps;
  if (typeof clip === 'undefined') return null;
  timestamps = clip.combinedWatson.timestamps;
  timestamps = timestamps.filter(function (t) {
    return t[0] === word; 
  });
  return timestamps;
};

var getWordsFromRange = function (filename, range) {
  var clip = allData[filename], timestamps = clip.combinedWatson.timestamps;
  var start, end;
  timestamps.forEach(function (t, i) {
    if (t[1] < range[1])
      end = i;
    if (t[1] < range[0])
      start = i;
  });
  return timestamps.slice(start, end + 1);
};

var convertTimeToTimeStamp = function (time) {
  var seconds = time % 60;
  var minutes = parseInt(time / 60, 10);
  var hours = parseInt(time / 360, 10);
  var timeList = [hours.toString(), minutes.toString(), seconds.toString()];
  timeList = timeList.map(function (t) { return t.length === 1 ? "0" + t : t; });
  return timeList.join(":");
};

var goToEnd = function () {

};

var processClip = function (filename, range, num) {
  var fd = fs.openSync('concat_list.txt', 'a');
  var output = "./temp_videos/" + 'output' + num + '.mov';
  var time = range[1] - range[0];
  var command = '-i ' + config.videoFileDirectory + "/" + filename + ".mov" + ' -c:v prores -profile:v 3 -strict -2 -ss ' + convertTimeToTimeStamp(range[0]) + ' -t ' + convertTimeToTimeStamp(time) + ' ' + output;
  console.log(command);
  var result = child.spawnSync('ffmpeg', command.split(' '));
  fs.writeSync(fd, "file '" + output + "'\n");
  fs.closeSync(fd);
};

var makeVideo = function () {
  child.spawnSync('ffmpeg', '-f concat -safe 0 -i concat_list.txt -c copy final_output.mov'.split(' '));
};

var filterUndesirableWords = function (words, halve) {
  words = words.map(function (w) {
    return w[0];
  });
  words = words.map( function (w) { return w.toLowerCase(); });
  words = words.filter(function (w) {
    return mostCommonWords.indexOf(w) === -1 && w.indexOf("\'") === -1 && w != '%hesitation';
  });
  // filter by words in the word counts
  if (halve)
    words = words.slice(words.length / 2);
  return words;
  
};


var numberInRange = function (number, rangeStart, rangeEnd) {
  return number <= rangeEnd && number >= rangeStart;
};

var findClipsWithWord = function (word, usedClip) {
  var clip, clips = [], clipWord, transcript, temp;
  for (var key in allData) {
    if (allData.hasOwnProperty(key) && usedClip != key) {
      clip = allData[key];
      if (clip.combinedWatson.transcript.indexOf(word + " ") !== -1) {
        clips.push(key);
      }
    }
  }
  return clips;
};

var populateGraph = function () {
  for (var key in allData) {
    if (allData.hasOwnProperty(key)) {
      graph[key] = {};
      var words = allData[key].combinedWatson.timestamps;
      words = words.map(function (w) { return w[0].toLowerCase(); });

      words = words.filter(function (word) {
        word = word;
        return mostCommonWords.indexOf(word) === -1 && word.indexOf("\'") === -1 && word != '%hesitation';
      });
      words.forEach(function (word) {
        var clips =  findClipsWithWord(word, key);
        graph[key][word] = clips.map(function (clip) {
          var ret_val = [clip];
          var timestamps = getTimestampsForOneWord(clip, word);
          ret_val = ret_val.concat(timestamps);
          return ret_val;
        });
      });
    }
  }
};

var reduceToStartAndEndPoints = function (silenceRange) {
  return [ silenceRange[0][0], silenceRange[silenceRange.length - 1][1] ];
};

var combineTranscript = function (fileRep) {
  return fileRep.reduce(function (prev, curr, arr, i) {
    var timestamps = curr.timestamps.map(function (w) {
      return [w[0].toLowerCase(), w[1], w[2]];
    });
    prev.transcript += curr.transcript.toLowerCase();
    prev.timestamps = prev.timestamps.concat(timestamps);
    // if (prev.transcript.indexOf('love') !== -1)
    //   prev.transcript);
    return prev;
  }, {transcript: '', timestamps: []});
};

var findNewWord = function (clip, wordChoices, oldWord, usedClips, usedWords) {
  for (var word in graph[clip]) {
    // if (usedWords.indexOf(word) !== -1)
    //   continue;
    if (graph[clip].hasOwnProperty(word)) {

    }
    var clips = graph[clip][word];
    clips = clips.filter(function (c) {
      return usedClips.indexOf(c) === -1;
    });
    if (clips.length > 0)
      return word;
  }
};

var orderByConnections = function (wordList) {
  wordList.sort(function (a, b) {
    if (edgeList[a].length < edgeList[b].length)
      return 1;
    else if (edgeList[a].length > edgeList[b].length)
      return -1;
    else
      return 0;
  });
  return wordList;
};



// analysis phase pick up every word that occurs between two or three chunks from an end
// choose 
// we have to make sure that the words in the SEGMENT have a next CLIP (IE the prunedWords
// LEAD to another clip). That's the search you have to do at the beginning.
// You don't just pick a 

var makeSureClipSegmentHasConnection = function (wordsInSegment, word) {
  var temp = filterUndesirableWords(wordsInSegment);
  temp = temp.filter(function (w) {
    return w != word && edgeList[w].length;
  });
  return temp.length > 0;
};

var translateToSegments = function (clip, word) {
  var theWordsTimestamps = getTimestampsForOneWord(clip, word);
  if (typeof theWordsTimestamps === 'undefined') return false;
  return theWordsTimestamps.map(function (timestamp) {
    var wordStartStamp = timestamp[1];
    var range = [wordStartStamp, wordStartStamp + (config.segmentMinTime)]
    return wordsInSegment = getWordsFromRange(clip, range);
  });
};

var drawRandomlyFromArray = function (arr) {
  return arr[getRandomInt(0, arr.length - 1)];
};

var getClosestSilenceRange = function (clip, wordTimestamps, goToEnd) {
  var silences = allData[clip].silences, start = wordTimestamps[0][1],
  end = wordTimestamps[wordTimestamps.length - 1][1];
  var startSilences = silences.filter(function (s) {
    return s[0] <= start;
  });
  var startSilence = startSilences[startSilences.length - 1];
  if (typeof startSilence === 'undefined') startSilence = 0;
  else startSilence = startSilence[0];
  var endSilences = silences.filter(function (s) {
    return s[0] >= end; 
  });

  var endSilence = endSilences[0];
  if (typeof endSilence === 'undefined' || goToEnd) endSilence = silences[silences.length - 1][1];
  else endSilence = endSilence[1];
  // console.log(silences, start, end, startSilences, endSilences, startSilence, endSilence, "HELLLLLO");
  return [startSilence, endSilence];
};

var getNewStart = function (list, word, usedClips) {
  var possibles = list.filter(function (c) {
    return usedClips.indexOf(c[0]) === -1 && usedClips.indexOf(c[1][0]) === -1; 
  });
  return drawRandomlyFromArray(possibles);
};
var getNewWord = function (word, clip, segment, usedWords, usedClips) {
  usedWords.push(word);
  usedClips.push(clip);
  segment = filterUndesirableWords(segment);
  segment = orderByConnections(segment);
  segment = segment.filter(function (w) {
    return usedWords.indexOf(w) === -1;
  });
  return segment[0];
};
var getPath = function (word, clips, edgeList) {
  var path = [], segment, possibleList, start, clip, wordsInSegment, wordsTimestamps, usedClips = [], usedWords = [], counter = 0;
  
  // go down edgeList for the word until you have a connection
  
  
  while (time < config.videoDuration) {
    possibleList = edgeList[word];
    start = getNewStart(possibleList, word, usedClips);
    while (edgeList[word].length > 0 && typeof start !== 'undefined') {
      
      // console.log(path, word, clip, start, path.length, possibleList);
      // console.log(path, path.length, time);
      clip = start[0];
      segments = translateToSegments(clip, word);
      segments = segments.filter(function (s) {
        return makeSureClipSegmentHasConnection(s, word);
      });
      segment = drawRandomlyFromArray(segments);
      // need to work on getting out of a clip that doesn't have a segment 
      // console.log(segments.length, segment);
      if (segment) {
        if (config.videoDuration - time < 20)
          silenceRange = getClosestSilenceRange(clip, segment, true);
        else
          silenceRange = getClosestSilenceRange(clip, segment);
        path.push([word, clip, silenceRange]);
        word = getNewWord(word, clip, segment, usedWords, usedClips);
        usedClips.push(clip);
        clip = start[1][0];
        possibleList = edgeList[word];
        start = getNewStart(possibleList, word, usedClips);
        time += silenceRange[1] - silenceRange[0];
      }
    };
    // console.log("HELLO", word, start);
    // need to check the current clip to get a new word;
    if (edgeList[word].length == 0 || typeof start === 'undefined') {
      if (!segment || typeof start === 'undefined')
      word = allTheWords.pop(0);
      else {
        word = get
      }
      continue;
    }

  }
  return path;
};
var createEdgeList = function (graph) {
  var edges = {};
  for (var start in graph) {
    if (graph.hasOwnProperty(start)) {
      for (var edge in graph[start]) {
        if (typeof edges[edge] === 'undefined')
          edges[edge] = [];
        graph[start][edge].forEach(function (end) {
          // var inThere = false;
          // edges[edge].forEach(function (e) {
          //   if ((e[0] != start && e[1] != end) || (e[1] != start && e[0] != end))
          //     inThere = true;
          // });
          // if (!inThere)
            edges[edge].push([start, end]);
        });
      }
    }
  }
  return edges;
};


files.forEach(function (filename) {
  // var transcriber,
  //   options = {
  //     dir: config.dir,
  //     restart: true,
  //     filename: filename
  //   };
  // if (filename.split('.')[1] === 'wav') {
  //   transcriber = watsonTranscriber.createTranscriber(options, callback);
  //   transcriber.startTranscription();
  //   transcriber.watsonObj.on('watsonClose', function () {
  //     processedFiles++;
  //   });
  //   fs.createReadStream(config.soundFileDirectory + '/' + filename).pipe(transcriber.watsonObj);
  // }
  var soundFile, rankedSoundFile = [], identifier = filename.split('.')[0];
  if (filename.split('.')[1] === 'json') {
    numToProcess++;
    silences.stdin.write(config.waveFileDirectory + identifier + '.wav\n');
    soundFile = JSON.parse(fs.readFileSync(config.transcriptsDirectory + "/" + identifier + '.json', 'utf-8'));

    if (typeof allData[identifier] === 'undefined')
      allData[identifier] = {};
    allData[identifier]['rawWatsonData'] = soundFile;
    allData[identifier]['combinedWatson'] = combineTranscript(soundFile);
    allTheClips.push(identifier);
  }

});
var getAllTheWords = function (edgeList) {
  words = [];
  for (var key in edgeList) {
    if (edgeList.hasOwnProperty(key)) {
      words.push([key, edgeList[key]]);
    }
  }
  words.sort(function (a, b) {
    if (a[1].length < b[1].length)
      return 1;
    else if (a[1].length > b[1].length)
      return -1;
    else
      return 0;
  });
  return words.map(function (w) { return w[0]; });
}
  // var fd = fs.openSync('graph.txt', 'w');
  // fs.writeSync(fd, JSON.stringify(graph));
  // fs.closeSync(fd);
  // var fd = fs.openSync('edgeList.txt', 'w');
  // fs.writeSync(fd, JSON.stringify(edgeList));
  // fs.closeSync(fd);
  // edgeList['love'], "HELLLLLO");
