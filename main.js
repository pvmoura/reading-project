var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var mostCommonWords = JSON.parse(fs.readFileSync('most_common_words.json', 'utf-8'));
mostCommonWords = mostCommonWords.map( function (word) { return word.toLowerCase(); } );
var watsonTranscriber = require('./transcriber.js');
var child = require('child_process');
var files = fs.readdirSync(config.soundFileDirectory);
var silences = child.execFile('./silences.py');
// var wn = child.execFile('./wordnet_analysis.py');
// files = files.filter(function(a) { return a.split('.')[1] === 'wav'; });
// a function to 
var numOfFiles = files.length;
var processedFiles = 0;
var processed = 0, numToProcess = 0;
var allData = {};
var usedClips = [];
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
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
var countWords = function (words) {
  words.forEach(function (word) {
    word = word[0].toLowerCase();
    if (mostCommonWords.indexOf(word) === -1 && word.indexOf("\'") === -1 && word != '%hesitation') {
      if (typeof wordCounts[word] === 'undefined')
        wordCounts[word] = 0;
      wordCounts[word] = wordCounts[word] + 1;
    }
  });
};
var countWordFiles = function (words, identifier) {
  words.forEach(function (word) {
    word = word[0].toLowerCase();
    if (mostCommonWords.indexOf(word) === -1 && word.indexOf("\'") === -1 && word != '%hesitation') {
      if (typeof wordInFiles[word] === 'undefined')
        wordInFiles[word] = [];
      var w = wordInFiles[word];
      if (w.indexOf(identifier) === -1)
        wordInFiles[word].push(identifier);
    }
  });

}
silences.stdout.on('data', function (data) {
  data = JSON.parse(data.trim());
  if (allData[data.filename] === 'undefined')
    allData[data.filename] = {};
  allData[data.filename]['silences'] = data.silences;
  processed++;
  if (processed === numToProcess) {
    // silences.kill();
    getStartingSegments();
    getEndingSegments();
    writeUpWords("wordCounts");
    ////console.log((endingSegments);
    wordCounts = {};
    wordInFiles = {};
    populateGraph();
    var fd = fs.openSync('graph.txt', 'w');
    fs.writeSync(fd, JSON.stringify(graph));
    fs.closeSync(fd);
    for (var key in startingSegments) {
      if (startingSegments.hasOwnProperty(key)) {
        var segment = startingSegments[key];
        var words = getWordsFromRange(key, segment);
        var countedWords = countWords(words);
        countWordFiles(words, key);
        //////console.log((wordInFiles);
      }
    }
    writeUpWords("startingWordCounts");
    makeClipWithSilences();

  }
});
silences.stderr.on('data', function (err) {
  //////console.log((err);
});


var getWordTimestamps = function (filename, word) {
  var clip = allData[filename], timestamps;
  if (typeof clip === 'undefined') return null;
  timestamps = clip.combinedWatson.timestamps;
  timestamps = timestamps.filter(function (t) {
    return t[0] === word; 
  });
  return timestamps;
};

var getAllSilenceRanges = function (filename, timestamp) {
  var start = timestamp[1], clip = allData[filename], silences = clip.silences;
  var lastBeforeWord, totalTime = 0, startTime;
  silences.forEach(function (s, i) {
    if (s[1] < start)
      lastBeforeWord = i;
  });
  silences = silences.slice(lastBeforeWord);
  if (silences.length == 0) return silences;
  startTime = silences[0][1];
  return silences.filter(function (s) {
    var keep = false;
    if (totalTime <= config.segmentMinTime) {
      keep = true;
    }
    totalTime += s[1] - startTime;
    startTime = s[1];
    return keep;
  });
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
var processClip = function (filename, range, num) {
  var fd = fs.openSync('concat_list.txt', 'a');
  var output = "./temp_videos/" + 'output' + num + '.mov';
  var time = range[1] - range[0];
  var command = '-i ' + config.videoFileDirectory + "/" + filename + ".mov" + ' -c:v prores -profile:v 3 -strict -2 -ss ' + convertTimeToTimeStamp(range[0]) + ' -t ' + convertTimeToTimeStamp(time) + ' ' + output;
  //////console.log((command);
  var result = child.spawnSync('ffmpeg', command.split(' '));
  fs.writeSync(fd, "file '" + output + "'\n");
  fs.closeSync(fd);
};
var makeVideo = function () {
  child.spawnSync('ffmpeg', '-f concat -safe 0 -i concat_list.txt -c copy final_output.mov'.split(' '));
}
var getWordsFromClip = function (words) {
  words = words.map(function (w) {
    return w[0];
  });
  words = words.map( function (w) { return w.toLowerCase(); });
  words = words.filter(function (w) {
    return mostCommonWords.indexOf(w) === -1 && w.indexOf("\'") === -1 && w != '%hesitation';
  });
  // filter by words in the word counts
  return words.slice(words.length / 2);
  
};

var usedRanges = [], possibleRanges = {};
var numberInRange = function (number, rangeStart, rangeEnd) {
  return number <= rangeEnd && number >= rangeStart;
}
var isUsedClip = function (resultObj) {
  //////console.log((resultObj, "IN USED CLIP");
  var filename = resultObj[0], rangeLow = resultObj[1][0], rangeHigh = resultObj[1][1], used = false;
  usedRanges.forEach(function (r) {
    
    if (r[0] === filename) {
      used = true;
      if (numberInRange(rangeLow, r[1][0], r[1][1]) ||
          numberInRange(rangeHigh, r[1][0], r[1][1])) {
        //////console.log((r[1][0], r[1][1], r, resultObj);
        used = true;
      }
        
    }
  });
  return used;
};

var getNewPossible = function (word) {
  var ranges = possibleRanges[word];
  if (typeof ranges === 'undefined') return null;
  return ranges.popByIndex(getRandomInt(0, ranges.length - 1));
};
var getAnyNewPossible = function () {
  for (var key in possibleRanges) {
    if (possibleRanges.hasOwnProperty(key)) {
      if (possibleRanges[key].length > 0)
        return possibleRanges[key].popByIndex(getRandomInt(0, possibleRanges[key].length - 1));
    }
  }
  return null;
};
var graph = {};
var populateGraph = function () {
  for (var key in allData) {
    if (allData.hasOwnProperty(key)) {
      graph[key] = {};
      var words = allData[key].combinedWatson.timestamps;
      words = words.map(function (w) { return w[0].toLowerCase(); });

      words = words.filter(function (word) {
        return mostCommonWords.indexOf(word) === -1 && word.indexOf("\'") === -1 && word != '%hesitation';
      });
      words.forEach(function (word) {
        graph[key][word] = findClipsWithWord(word, key);
      });
    }
  }
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
var reduceToStartAndEndPoints = function (silenceRange) {
  return [ silenceRange[0][0], silenceRange[silenceRange.length - 1][1] ];
};
var getSegmentsFromWordList = function (wordList) {
  var clips = wordList.map(function (word) {
    var d = {}, clipsWithWord = findClipsWithWord(word), timestamps;
    clipsWithWord.forEach(function (c) {
      var timestamps = getWordTimestamps(c, word);
      timestamps.forEach(function (t) {
        var s = getAllSilenceRanges(c, t);
        s = reduceToStartAndEndPoints(s);
      });
    });
    timestamps = getWordTimestamps
    d[word] = findClipsWithWord(word);
    return d;
  });
  return clips.filter(function (d) {
    return d !== null;
  })
};
var analyzeAllClips = function () {
  var words = countUpWords();
};
var isStartingClip = function () {

};
var startingSegments = {}, endingSegments = {};
var getStartingSegments = function () {
  for (var key in allData) {
    if (allData.hasOwnProperty(key)) {
      var silences = allData[key].silences;
      var totalTime = 0, last = 0;
      var newSilence = [[0, 0]];
      silences.forEach(function (s) {
        if (totalTime < config.segmentMinTime)
          newSilence.push(s)
        totalTime += s[1] - last;
        last = s[1];
      });
      ////console.log((newSilence);
      if (typeof startingSegments[key] === 'undefined')
        startingSegments[key] = reduceToStartAndEndPoints(newSilence);
    }
  }

};
var getEndingSegments = function () {
  for (var key in allData) {
    if (allData.hasOwnProperty(key)) {
      var silences = allData[key].silences;
      ////console.log((silences, key);
      var totalTime = 0, last = silences[silences.length - 1][1];
      var newSilence = [silences[silences.length - 1]];
      for (var i = silences.length - 2; i > 0; i--) {
        if (totalTime < config.segmentMinTime)
          newSilence.push(silences[i]);
        totalTime += last - silences[i][0];
        last = silences[i][1];
      }
      //console.log((key, newSilence);
      if (typeof endingSegments[key] === 'undefined') {
        endingSegments[key] = [newSilence[newSilence.length - 1][0], newSilence[0][1]];
      }
    }
  }
};
var time = 0;
var addToUsedClips = function (clip) {
  usedClips.push(clip);
};
var processLastClip = function (result, counter) {
  var clip = result[0];
  //////console.log((result);
  addToUsedClips(clip);
  processClip(clip, result[1], counter);
  addUsedRanges(result);
  counter++;
  time += result[1][1] - result[1][0];
  words = getWordsFromRange(result[0], result[1]);
  words = getWordsFromClip(words);
  return words;
};
var getEndingClips = function (usedClips) {
  var ends = [];
  for (var key in endingSegments) {
    if (usedClips.indexOf(key) === -1)
      ends.push([key, endingSegments[key]]);
  }
  return ends;
};
var wordInClip = function (clip, range, word) {
  words = getWordsFromRange(clip, range);
  words = words.map( function (w) { return w[0].toLowerCase(); } );
  ////console.log((words);
  return words.indexOf(word.toLowerCase()) !== -1;
}
var makeClipWithSilences = function () {
  var words = ["child"], clips, clip, word, shortCounter = 0, counter = 0, start = true, result, ending = true;
  while ( time < config.videoDuration ) {
    if (!start) {
      ////console.log((words, "WORDS");
    for (var i = 0, length = words.length; i < length; i++) {
      if (shortCounter > 1) {
        clips = getEndingClips(usedClips);
        clips = clips.filter(function (clip) {
          return wordInClip(clip[0], clip[1], words[i]);
        });
        ending = true;
      } else {
        clips = findClipsWithWord(words[i], usedClips);
        ending = false;
      }
      if (clips.length > 0) {
        break;
      }
    }
    // clips = getClipsFromWordList(words);
    if (clips && clips.length > 0) {
      if (ending) {
        shortCounter = 0;
        ending = false;
        start = true;
        result = clips[getRandomInt(0, clips.length - 1)];
        counter++;
        processLastClip(result, counter);
      }
      word = words.popByIndex(i);
      result = getWords(clips, word);
      while (result !== null && isUsedClip(result)) {
        ////console.log((possibleRanges, usedRanges, result);
        result = getNewPossible(word);
      }

      // if (result === null) {
      //   ////console.log(("IN ANY NEW POSSIBLE");
      //   while (result !== null && isUsedClip(result)) {
      //     result = getAnyNewPossible();  
      //   }
      // }
      if (result) {
        counter++;
        shortCounter++;
        words = processLastClip(result, counter);
        // clip = result[0];
        // //////console.log((result);
        // processClip(clip, result[1], counter);
        // addUsedRanges(result);
        // counter++;
        // time += result[1][1] - result[1][0];
        // words = getWordsFromRange(result[0], result[1]);
        // words = getWordsFromClip(words);
      } else {
        words = JSON.parse(child.execFileSync('./wordnet_analysis.py', [words[getRandomInt(0, words.length)]]));  
      }
      
    } else {
      if (ending) {
        ending = false; shortCounter = 0;
      }
      words = JSON.parse(child.execFileSync('./wordnet_analysis.py', [words[getRandomInt(0, words.length)]]));
      if (words.length == 0) {
        words = ["and"];
      }
    }
  } else {
    var l = dictToList(startingSegments);
    result = l[getRandomInt(0, l.length - 1)];
    ////console.log((result);
    words = processLastClip(result, counter);
    start = false;
  }
  }
  makeVideo();
};
var dictToList = function (dict) {
  l = [];
  for (var key in dict) {
    l.push([key, dict[key]]);
  }
  return l;
};

var addPossibleRanges = function (filename, timestamps, word) {
  if (typeof possibleRanges[word] === 'undefined')
    possibleRanges[word] = [];
  possibleRanges[word].push([filename, timestamps]);
  return possibleRanges;
};

var pickAPossibleRange = function (possibleRanges, word) {
  var rand, range;
  if (typeof possibleRanges[word] !== 'undefined') {
    rand = getRandomInt(0, possibleRanges[word].length - 1);
    range = possibleRanges[word].popByIndex(rand);
    return range;
  }
  return null;
};

var addUsedRanges = function (range) {
  usedRanges.push(range);
};
var getWords = function (clips, startingWord) {
  var clip, timestamps, rand, words;
  clips.forEach(function (c) {
    timestamps = getWordTimestamps(c, startingWord);
    timestamps.forEach(function (t) {
      var s = getAllSilenceRanges(c, t);
      s = [ s[0][0], s[s.length - 1][1] ];
      addPossibleRanges(c, s, startingWord);
    });
    
  });
  range = pickAPossibleRange(possibleRanges, startingWord);
  if (range === null) return range;
  return range;
};
var soundFiles = [], rankedSoundFiles = [], videoDuration = 0, used = [];
var combineTranscript = function (fileRep) {
  return fileRep.reduce(function (prev, curr, arr, i) {
    var timestamps = curr.timestamps.map(function (w) {
      return [w[0].toLowerCase(), w[1], w[2]];
    });
    prev.transcript += curr.transcript.toLowerCase();
    prev.timestamps = prev.timestamps.concat(timestamps);
    // if (prev.transcript.indexOf('love') !== -1)
    //   console.log(prev.transcript);
    return prev;
  }, {transcript: '', timestamps: []});
};
var wordCounts = {}, wordInFiles = {};
var countUpWords = function (identifier) {
  var transcript = allData[identifier];
  if (typeof transcript !== 'undefined')
    transcript = transcript.combinedWatson.transcript;
  transcript.split(" ").forEach(function (word) {
    word = word.toLowerCase();
    if (mostCommonWords.indexOf(word) === -1 && word.indexOf("\'") === -1 && word != '%hesitation') {
    if (typeof wordCounts[word] === 'undefined')
      wordCounts[word] = 0;
    wordCounts[word] = wordCounts[word] + 1;
    }
  });
};
var countUpWordFiles = function (identifier) {
  var transcript = allData[identifier];
  if (typeof transcript !== 'undefined')
    transcript = transcript.combinedWatson.transcript;
  transcript.split(" ").forEach(function (word) {
    var w, word = word.toLowerCase();
    if (mostCommonWords.indexOf(word) === -1 && word.indexOf("\'") === -1 && word != '%hesitation') {
    if (typeof wordInFiles[word] === 'undefined')
      wordInFiles[word] = [];
    w = wordInFiles[word];
    if (w.indexOf(identifier) === -1)
      wordInFiles[word].push(identifier);
    }
  });
};

var writeUpWords = function (filename) {
  var words = [];
  if (typeof filename === 'undefined') filename = "wordCounts";
  var sd = fs.openSync(filename + '.txt', 'w');
for (var key in wordCounts) {
  words.push([key, wordCounts[key], wordInFiles[key].length]);
}
words.sort(function (a, b) {
  if (a[2] < b[2])
    return 1;
  else if (a[2] > b[2])
    return -1;
  else
    return 0;
});
words.forEach(function (word) {
  fs.writeSync(sd, word.join(":") + "\n"); // + " " + wordInFiles[word[0]].length + "\n");
});

};
var findNewWord = function (clip, usedClips, usedWords) {
  for (var word in graph[clip]) {
    if (usedWords.indexOf(word) !== -1)
      continue;
    var clips = graph[clip][word];
    clips = clips.filter(function (c) {
      return usedClips.indexOf(c) === -1;
    });
    if (clips.length > 0)
      return word;
  }
};
var getNewClip = function (word, clip, usedClips) {
  var clips = edgeList[word];
  clips = clips.filter(function (c) {
    return c[0] === clip && usedClips.indexOf(c[1]) === -1;
  });
  return clips[getRandomInt(0, clips.length - 1)];
}
var getPath = function (word, clips, edgeList) {
  var path = [], usedClips = [], start = edgeList[word].pop(), usedWords = [], clip = start[0], counter = 0;
  while (clips.length > 0) {
    counter++;
    usedWords.push(word);
    console.log(clip, clips.indexOf(clip));
    clips.popByIndex(clips.indexOf(clip));
    path.push([clip, word]);
    clip = start[1];
    word = findNewWord(clip, usedClips, usedWords);
    clip = getNewClip(word, clip, usedClips)[1];
    console.log(clips.length, path, usedWords);
    if (counter > 10)
      break;
    // figure out why the loop becomes infinite
    // when it becomes infinite, call it an end, a leaf node
    // once you've reached an end, start again with a start clip that hasn't been used yet
    // keep going until you've used all the clips
  }
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
}
var edgeList = [], allTheClips = [];
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
    // silences.stdin.write(config.waveFileDirectory + identifier + '.wav\n');
    soundFile = JSON.parse(fs.readFileSync(config.soundFileDirectory + "/" + filename, 'utf-8'));
    
    if (typeof allData[identifier] === 'undefined')
      allData[identifier] = {};
    allData[identifier]['rawWatsonData'] = soundFile;
    allData[identifier]['combinedWatson'] = combineTranscript(soundFile);
    allTheClips.push(identifier);
    // countUpWords(identifier);
    // countUpWordFiles(identifier);
    // soundFile = JSON.parse(fs.readFileSync(config.soundFileDirectory + "/" + filename, 'utf-8'));
    // soundFile = countUpTimestamps(soundFile, filename.split('.')[0]);
    // soundFile = segmentByTime(soundFile);
    // soundFile = wordVariety(soundFile);
    // rankedSoundFile = rankInterestingness(soundFile, filename.split('.')[0]);
    // rankedSoundFile.forEach(function (s) {
    //   rankedSoundFiles.push(s);
    // });
    // soundFile.forEach(function (s) {
    //   soundFiles.push(s);
    // });
  }

});
  populateGraph();
  edgeList = createEdgeList(graph);
  var fd = fs.openSync('graph.txt', 'w');
  fs.writeSync(fd, JSON.stringify(graph));
  fs.closeSync(fd);
  // var fd = fs.openSync('edgeList.txt', 'w');
  // fs.writeSync(fd, JSON.stringify(edgeList));
  // fs.closeSync(fd);
  console.log(edgeList['love'], "HELLLLLO");
  getPath("love", allTheClips, edgeList);