var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var mostCommonWords = JSON.parse(fs.readFileSync('most_common_words.json', 'utf-8'));
mostCommonWords = mostCommonWords.map( function (word) { return word.toLowerCase(); } );
var watsonTranscriber = require('./transcriber.js');
var child = require('child_process');
var files = fs.readdirSync(config.rawDataDirectory);
var shortSilenceFiles = fs.readdirSync(config.shortSilencesDirectory);
var allTheLengths = {};
var processedFiles = 0;
var processed = 0, numToProcess = 0;
var allData = {};
var usedClips = [];
var graph = {};
var time = 0;
var todaysClips = [];
var edgeList = [], allTheClips = [], allTheWords, usedSegments = {}, favoredClips = [];
var startingSegments = {};
var shortSilences = [];
var favoredIdentifier = process.argv[2];
if (typeof favoredIdentifier === 'undefined')
  favoredIdentifier = null;
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

var getFavoredWords = function (edgeList) {
  var words = [], connectionList = [];
  var start, end;
  for (var key in edgeList) {
    if (edgeList.hasOwnProperty(key)) {
      connectionList = edgeList[key];
      for (var i = 0; i < connectionList.length; i++) {
        if (connectionList[i].length != 0) {
          start = connectionList[i][0];
          end = connectionList[i][1];
        if (favoredClips.indexOf(start) !== -1 || favoredClips.indexOf(end) !== -1)
          words.push([key, edgeList[key]]);
        }
      }
    }
  }
  words = words.filter(function (w) {
    return mostCommonWords.indexOf(w) === -1 && w.indexOf("\'") === -1 && w != '%hesitation';
  });
  var uniques = []
  words.sort(function(a, b) {
    if (a[1].length < b[1].length)
      return 1;
    else if (a[1].length > b[1].length)
      return -1;
    else
      return 0;
  });
  
  words = words.map(function (w) {
    return w[0];
  });
  words.forEach(function (w) {
    if (uniques.indexOf(w) === -1)
      uniques.push(w);
  });
  return uniques;
};

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
var getFavoredClips = function () {
  favoredClips = files.map(function (f) {
    return f.split('.')[0];
  });
  favoredClips = favoredClips.filter(function (f) {
    if (!favoredIdentifier)
      return false;
    return f.indexOf(favoredIdentifier) !== -1;
  });
}
var makeSilencesOutro = function (usedClips) {
  var total = 0;
  var unUsedPeople = shortSilenceFiles.filter(function (s) {
    var identifier = s.split('.')[0];
    return usedClips.indexOf(identifier) === -1 && favoredClips.indexOf(identifier) !== -1;
  });
  var fd = fs.openSync('concat_silences.txt', 'w');
  favoredClips.forEach(function(f) {
    fs.writeSync(fd, "file '" + config.shortSilencesDirectory + f + ".mov\n");
    total++;
  });
  
  // for (var i = 0, len = unUsedPeople.length; i < len; i++) {
  //   fs.writeSync(fd, "file '" + config.shortSilencesDirectory + unUsedPeople[i] + "'\n");
  // }

  var filtered = shortSilenceFiles.filter(function (s) {
    var identifier = s.split('.')[0];
    return usedClips.indexOf(identifier) === -1 && unUsedPeople.indexOf(identifier) === -1;
  });
  while (total < 18) {
    var shortSilenceClip = drawRandomlyFromArray(filtered);
    if (typeof shortSilenceClip !== 'undefined')
      fs.writeSync(fd, "file '" + config.shortSilencesDirectory + shortSilenceClip + "'\n");
    total++;
  }
  fs.closeSync(fd);
  return;
};

var getAllLengths = function (clips) {
  clips.forEach(function (clip) {
    allTheLengths[clip] = clip;
  });
};

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
  var output = config.tempDirectory + 'output' + num + '.mov';
  var time = range[1] - range[0];
  var command = '-i ' + config.videoFileDirectory + filename + ".mov" + ' -c:v prores -profile:v 1 -ss ' + convertTimeToTimeStamp(range[0]) + ' -t ' + convertTimeToTimeStamp(time) + ' ' + output;
  console.log(command);
  var result = child.spawnSync('ffmpeg', command.split(' '));
  fs.writeSync(fd, "file '" + output + "'\n");
  fs.closeSync(fd);
};

var makeVideo = function () {
  var outputFilename = config.outputDirectory + 'final_output.mov';
  var command = '-f concat -safe 0 -i concat_list.txt -c copy ' + outputFilename;
  child.spawnSync('ffmpeg', command.split(' '));
  return outputFilename;
};

var makeSilencesOutroClip = function () {
  var outputFilename = config.outputDirectory + 'outro.mov';
  var command = '-f concat -safe 0 -i concat_silences.txt -c copy ' + outputFilename;
  console.log(command);
  child.spawnSync('ffmpeg', command.split(' '));
  return outputFilename
};

var filterUndesirableWords = function (words, usedWords, halve) {
  if (halve !== false)
    halve = true;
  words = words.map(function (w) {
    return w[0];
  });
  words = words.map( function (w) { return w.toLowerCase(); });
  words = words.filter(function (w) {
    return mostCommonWords.indexOf(w) === -1 && w.indexOf("\'") === -1 && w != '%hesitation' && edgeList[w].length > 0;
  });
  words = words.filter(function (w) {
    var temp = usedWords.filter(function (u) {
      return w == u;
    });
    return temp.length <= 2;
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
        var clips = findClipsWithWord(word, key);
        graph[key][word] = clips;
        // graph[key][word] = clips.map(function (clip) {
        //   var ret_val = [clip];
        //   var timestamps = getTimestampsForOneWord(clip, word);
        //   ret_val = ret_val.concat(timestamps);
        //   return ret_val;
        // });
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
// should I include an analysis that places the distance of a word to a silence?

var makeSureClipSegmentHasConnection = function (wordsInSegment, word, usedWords) {
  var temp = filterUndesirableWords(wordsInSegment, usedWords);
  temp = temp.filter(function (w) {
    return w != word && edgeList[w].length // in here I should probably include the used clips;
  });
  return temp.length > 0;
};



var drawRandomlyFromArray = function (arr) {
  return arr[getRandomInt(0, arr.length - 1)];
};

var getMiddleOfSilence = function (silencePeriod) {
  // //console.log(silencePeriod);
  return ((silencePeriod[1] - silencePeriod[0]) / 2) + silencePeriod[0];
}

var getClosestSilenceRange = function (clip, wordTimestamps, goToEnd) {
  if (typeof wordTimestamps === 'undefined')
    return null;
  var silences = allData[clip].silences, start = wordTimestamps[0][1],
  end = wordTimestamps[wordTimestamps.length - 1][1];
  var startSilences = silences.filter(function (s) {
    return s[0] <= start;
  });

  var startSilence = startSilences[startSilences.length - 1];
  if (typeof startSilence === 'undefined') startSilence = 0;
  else startSilence = getMiddleOfSilence(startSilence);
  var endSilences = silences.filter(function (s) {
    return s[0] >= end; 
  });

  var endSilence = endSilences[0];
  if (typeof endSilence === 'undefined') endSilence = allTheLengths[clip];
  else if (goToEnd) endSilence = allTheLengths[clip];
  else endSilence = getMiddleOfSilence(endSilence);
  // //console.log(silences, start, end, startSilences, endSilences, startSilence, endSilence, "HELLLLLO");
  return [startSilence, endSilence];
};
var addUsedSegments = function (clip, segment, usedSegments) {
  if (typeof usedSegments[clip] === 'undefined')
    usedSegments[clip] = [];
  usedSegments[clip].push(segment);
  return usedSegments;
};
var getNewStart = function (list, word, usedClips) {
  if (typeof list === 'undefined') return;
  // filter the list by usedClips?

  var possibles = list.filter(function (c) {
    return usedClips.indexOf(c[0]) === -1; //&& usedClips.indexOf(c[1][0]) === -1; 
  });
  return drawRandomlyFromArray(possibles);
};
var getNewWord = function (word, clip, segment, usedWords, usedClips) {
  // usedWords.push(word);
  usedClips.push(clip);
  segment = filterUndesirableWords(segment);
  segment = orderByConnections(segment);
  // segment = segment.filter(function (w) {
  //   return usedWords.indexOf(w) === -1;
  // });
  return segment[getRandomInt(0, parseInt(segment.length / 3, 0))];
};

var withinRange = function (start, end, lowerThreshold, upperThreshold) {
  if (end < start) return false;
  var diff = end - start;
  return diff >= lowerThreshold && diff <= upperThreshold;
};
var numberWithinRange = function (num, start, end) {
  return num >= start && num <= end;
};
// structure of a possible connections list:
// [ [ 'asdf', [ 'bds', 'a', 1, 1.5 ] ], [ 'hello', [ 'goodbye', 'word', 1, 1.5 ] ] ]
var filterConnectionsSegmentsByUsedSegments = function (possibleConnections, usedSegments) {
  return possibleConnections.filter(function (connection) {
    var start = connection[0], end = connection[1], used = false;
    var endTimestamp = end[3], endClip = end[0];

    var segments = usedSegments[endClip];
    if (typeof segments !== 'undefined') {
      segments.forEach(function (usedSegment) {
        if (numberWithinRange(endTimestamp, usedSegment[0], usedSegment[1]))
          used = true;
      });
    }
    return used;
  });
};
var filterConnectionsListByUsedClips = function (possibleConnections, usedClips) {
  // //console.log(usedClips);
  return possibleConnections.filter(function (connection) {
    return usedClips.indexOf(connection[0]) === -1 && usedClips.indexOf(connection[1]) === -1;
  });
};


var filterConnectionsListByTodaysClips = function (possibleList, favoredClips) {
  return possibleList.filter(function (connection) {
    var start = connection[0], end = connection[1];
    // //console.log(favoredClips, favoredClips.indexOf(start), start, favoredClips.indexOf(end), end);
    // process.kill(process.pid);
    return favoredClips.indexOf(start) !== -1 || favoredClips.indexOf(end) !== -1;
  });
};

var filterConnectionsListByFeatured = function (possibleList) {
  return possibleList.filter(function (conncetion) {
    var start = connection[0], end = connection[1];
    if (typeof allData[start] === 'undefined' || typeof allData[end] === 'undefined')
      return false;
    return allData[start] && allData[end] && (allData[start].curated || allData[end].curated);
  });
}


var filterConnectionsSegmentsByFutureConnection = function (possibleSegments, word, usedWords) {
  return possibleSegments.filter(function (connection) {
    var start = connection[0], end = connection[1], out = [];
    if (typeof end[1] === 'undefined')
      return false;
    end = end[1];
    return end.filter(function (e) {
      return makeSureClipSegmentHasConnection(e, word, usedWords);
    });
  });
};

var isSegmentNearEnd = function (filename, segment, lengths, range) {
  if (typeof range === 'undefined')
    range = config.segmentMinTime;
  var length = allTheLengths[filename];
  if (typeof end === 'undefined' || typeof length === 'undefined')
    return false;
  firstWord = segment[0];
  if (typeof firstWord[1] === 'undefined')
    return false;
  firstWordStamp = firstWord[1];
  if (numberWithinRange(firstWordStamp, length - (range * 1.5), length))
    return true;
  return false;
}

var filterConnectionsSegmentsByEnds = function (possibleSegments, word) {
  return possibleSegments.filter(function (connection) {
    var start = connection[0], end = connection[1];
    if (typeof end[1] === 'undefined')
      return false;
    end = end[1];
    return isSegmentNearEnd(clip, end);
  });
};

var translateConnectionsToSegments = function (possibleConnections, word, range) {
  if (typeof range === 'undefined') range = config.segmentMinTime;
  return possibleConnections.map(function (connection) {
    var startClip = connection[0], endClip = connection[1];
    var startWordsTimestamps = translateToSegments(startClip, word, range),
        endWordsTimestamps = translateToSegments(endClip, word, range);
    return [ [ startClip, startWordsTimestamps ], [ endClip, endWordsTimestamps ] ];

  })
};

var translateToSegments = function (clip, word, range) {
  if (typeof range === 'undefined') range = config.segmentMinTime;
  var theWordsTimestamps = getTimestampsForOneWord(clip, word);
  if (typeof theWordsTimestamps === 'undefined') return false;
  return theWordsTimestamps.map(function (timestamp) {
    var wordStartStamp = timestamp[1];
    var wordsRange = [wordStartStamp, wordStartStamp + range];
    return wordsInSegment = getWordsFromRange(clip, wordsRange);
  });
};

var getStartingSegments = function () {
  for (var key in allData) {
    if (allData.hasOwnProperty(key)) {
      if (favoredClips.length > 0 && favoredClips.indexOf(key) === -1) {
        continue;
      }
      var silences = allData[key].silences;
      var totalTime = 0, last = 0;
      var newSilence = [[0, 0]];
      silences.forEach(function (s) {
        if (totalTime < config.startTime)
          newSilence.push(s)
        totalTime += s[1] - last;
        last = s[1];
      });
      ////(newSilence);
      newSilence = reduceToStartAndEndPoints(newSilence);
      totalTime = newSilence[1] - newSilence[0];
      if (typeof startingSegments[key] === 'undefined' && totalTime >= config.segmentMinTime && totalTime <= config.segmentMaxTime) {
        startingSegments[key] = newSilence;
      }
    }
  }

};

var drawFromTodaysClips = function (possibleList, favoredClips, usedClips) {
  var temp = possibleList.filter(function (connection) {
    var start = connection[0], end = connection[1];
    if (usedClips.indexOf(start) !== -1 || usedClips.indexOf(end) !== -1)
      return false;
    return favoredClips.indexOf(start) !== -1 || favoredClips.indexOf(end) !== -1;
  });
  return drawRandomlyFromArray(temp);
};

var filterAllClipsByUsed = function(allTheClips, usedClips) {
  return allTheClips.filter(function (clip) {
    return usedClips.indexOf(clip) === -1;
  });
}
var pickWordFromEndOfConnection = function (connection, usedWords) {
  var end = connection[1];
  if (typeof end === 'undefined') return null;
  var segment = end[1];
  if (typeof segment === 'undefined') return null;
  segment = filterUndesirableWords(segment, usedWords);
  segment = orderByConnections(segment);

  word = segment[0];
  return word;
};
// connection is of the form
// [ [startFilename, [startSegment1, startSegment2,...] ], [ endFilename, [ endSegment1, endSegment2, ...] ] ]
var pickRandomConnectionSegment = function (connection, word) {
  var start = connection[0], end = connection[1],
      startSegment = drawRandomlyFromArray(start[1]),
      endSegment = drawRandomlyFromArray(end[1]);
  return [ [ start[0], startSegment ], [ end[0], endSegment ] ];
};
var translatePickedConnectionSegmentToSilenceRange = function (connectionSegment, word, goToEnd) {
  //console.log(connectionSegment);
  return connectionSegment.map(function (c) {
    var start = connectionSegment[0], end = connectionSegment[1],
        startSilences = getClosestSilenceRange(start[0], start[1]),
        endSilences = getClosestSilenceRange(end[0], end[1], goToEnd);
    console.log(endSilences, startSilences);
    if (startSilences === null || endSilences === null)
      return null;
    return [ [word, start[0], startSilences ], [ word, end[0], endSilences ] ]
  });
};
var updateTime = function (time, nextPath, clipLengths) {
  var start = nextPath[0], end = nextPath[1];
  var startSilences = start[2], endSilences = end[2];
  var startSegment = startSilences[1] - startSilences[0],
      endSegment = endSilences[1] - endSilences[0];
  clipLengths.push(startSegment);
  clipLengths.push(endSegment);

  return time + startSegment + endSegment;
};
updateTimeWithOneClip = function (time, nextPath, clipLengths) {
  var startSilences = nextPath[2];
  var segment = startSilences[1] - startSilences[0];
  clipLengths.push(segment);
  return time + segment;
}
var addUsedThings = function (connection, nextPath, usedSegments, usedClips, usedWords, word) {
  addUsedSegments(nextPath[0][1], nextPath[0][2], usedSegments);
  addUsedSegments(nextPath[1][1], nextPath[1][2], usedSegments);
  addUsedClip(nextPath[0][1], usedClips);
  addUsedClip(nextPath[1][1], usedClips);
  usedWords.push(word);
  usedWords.push(word);
};
var addUsedClip = function(clip, usedClips) {
  usedClips.push(clip);
}
var orderStartingSegmentsByConnections = function (startingSegments, edgeList, usedClips, usedWords) {
  var ordered = [], sr;
  for (var key in startingSegments) {
    if (startingSegments.hasOwnProperty(key)) {
      if (usedClips.indexOf(key) === -1) {
        sr = startingSegments[key];
        words = getWordsFromRange(key, sr);
        words = filterUndesirableWords(words, usedWords);
        words = orderByConnections(words);
        ordered.push([key, words]);
      }
    }
  }
  ordered.sort(function (a, b) {
    if (a[1].length > b[1].length)
      return -1;
    else if (a[1].length < b[1].length)
      return 1;
    else
      return 0;
  });
  return ordered;
};

var getShortSilences = function () {
  for (var key in allData) {
    if (allData.hasOwnProperty(key)) {
      var esses = allData[key].silences;
      esses.filter(function (ess) {
        var diff = ess[1] - ess[0];
        if (diff >= 1) {
          shortSilences.push([ key, ess ]);
        }
      });
    }
  }
};

var filterConnectionsListByFewSilences = function (connectionList) {
  return connectionList.filter(function (connection) {
    var start = connection[0], end = connection[1];
    if (allData[start].silences.length <= 1 || allData[end].silences.length <= 1)
      return true;
  });
};
var filterConnectionsListByManySilences = function (connectionList) {
  return connectionList.filter(function (connection) {
    var start = connection[0], end = connection[1];
    // //console.log(allData[start].silences, allData[end].silences);
    // process.kill(process.pid);
    if (allData[start].silences.length >= 3 && allData[end].silences.length >= 3)
      return true;
  });
};
var lastFiveWereShort = function (clipLengths) {
  if (clipLengths.length < 8) return false;
  var lastFive = clipLengths.slice(clipLengths.length - 9);
  lastFive = lastFive.filter(function (a) {
    if (a < config.segmentMaxTime) return true;
  });
  return lastFive.length >= 8;
}
var getPath = function (word, allTheClips, edgeList) {
  var path = [], usedSegments = [], ordered = [], segment, possibleList = [], start = true, clip, wordsInSegment, wordsTimestamps, usedWords = [], counter = 0;
  var featured;
  // go down edgeList for the word until you have a connection
  var clipLengths = [], usedSilences = [], keepGoing = true, favor = true;
  
  while (time < config.videoDuration && keepGoing) {
    if (start) {
      //console.log("IN START");
      word = drawRandomlyFromArray(allTheWords);
      var clips = filterAllClipsByUsed(allTheClips, usedClips);
      // clip = drawRandomlyFromArray(clips);
      // usedClips.push(clip);
      ordered = orderStartingSegmentsByConnections(startingSegments, edgeList, usedClips, usedWords);
      segmentAndClip = ordered[0];
      clip = segmentAndClip[0];
      segment = segmentAndClip[1];
      addUsedSegments(clip, startingSegments[clip], usedSegments);
      nextPath = ['START', clip, startingSegments[clip]];
      addUsedClip(clip, usedClips);
      path.push(nextPath);
      time = updateTimeWithOneClip(time, nextPath, clipLengths);
      //console.log(path);
      // segment = getWordsFromRange(clip, startingSegments[clip]);
      // //console.log(segment);
      // segment = filterUndesirableWords(segment);
      // segment = orderByConnections(segment);
      // //console.log(segment);
      // word = drawRandomlyFromArray(segment);
      word = segment[0];
      start = false;
    }
    // } else if (getRandomInt(0, 9) === 8) {
    //   // pepper in a silence
    //   //console.log("ADDING A SHORT SILENCE");
    //   var ss = shortSilences.popByIndex(0);
    //   if (ss != null && usedSilences.indexOf(ss[0])) {
    //     usedSilences.push(ss[0]);
    //     path.push(['shortSilence', ss[0], ss[1]]);
    //   }
    // }
    // first pick a list of connections by that word
    possibleList = edgeList[word];
    
    if (typeof possibleList === 'undefined') {
      //console.log("WORD NOT IN EDGELIST", word);
      word = allTheWords.popByIndex(0);
      // keepGoing = false;
      continue;
    }
    

    //console.log(possibleList);
    possibleList = filterConnectionsListByUsedClips(possibleList, usedClips);
    console.log(possibleList.length);

    // if (lastFiveWereShort(clipLengths)) {
    //   possibleList = filterConnectionsListByFewSilences(possibleList);
    // // } else {
    // if (path.length === 7) {
    //   possibleList = filterConnectionsListByFewSilences(possibleList);
    // } else {
      if (path.length >= 3) {
        featured = filterConnectionsListByFeatured(possibleList);
        if (featured.length > 0) {
          featured = translateConnectionsToSegments(possibleList, word, config.segmentMinTime);
          featured = filterConnectionsSegmentsByFutureConnection(possibleList, word, usedWords);
        }
      }
      featured = false;
      console.log(featured, possibleList.length)
      if (path.length < 3 || !featured || featured.length == 0 || alreadyFeatured) {
        if (favor) {
          possibleList = filterConnectionsListByTodaysClips(possibleList, favoredClips);
        }
        possibleList = filterConnectionsListByManySilences(possibleList);
        possibleList = translateConnectionsToSegments(possibleList, word, config.segmentMinTime);
        futureConnections = filterConnectionsSegmentsByFutureConnection(possibleList, word, usedWords);


        if (futureConnections.length == 0) {
          if (possibleList.length == 0) {
            //console.log("DIDNT FIND A USABLE CONNECTING CLIP FROM", word);
            if (favor) {
              //console.log("TRYING NOT TO FAVOR", word);
              favor = false;
              continue;
            }
            favor = true;
            word = drawRandomlyFromArray(allTheWords);
            // word = allTheWords.popByIndex(0);
            continue;
          }
        } else {
          possibleList = futureConnections;
        }
      } else {
        possibleList = featured;
      }

    // }
    // }

    
    
    // possibleList = filterConnectionsSegmentsByUsedSegments(possibleList, usedSegments, word);


    // possibleList = filterOutErrors(possibleList);
    // connection = drawRandomlyFromArray(possibleList);
    connection = drawFromTodaysClips(possibleList, favoredClips, usedClips);
    
    if (!connection) {
      connection = drawRandomlyFromArray(possibleList);
    }
    connection = pickRandomConnectionSegment(connection, word);

    // console.log(connection);
    if (config.videoDuration - time <= 40) {
      nextPath = translatePickedConnectionSegmentToSilenceRange(connection, word, true);
      keepGoing = false;  
    } else {
      nextPath = translatePickedConnectionSegmentToSilenceRange(connection, word);
    }
    if (nextPath.indexOf(null) === -1) {
      // console.log(nextPath, "YUUPPPPPP");
      nextPath = drawRandomlyFromArray(nextPath);
      path = path.concat(nextPath);
      time = updateTime(time, nextPath, clipLengths);
      //console.log(path, time);
      addUsedThings(connection, nextPath, usedSegments, usedClips, usedWords, word);
      //console.log(usedWords);
      word = pickWordFromEndOfConnection(connection, usedWords);
    }
    // from that list, pick a connection that you haven't used yet
    // in the connections list, I should do the work I do later
    // of translating to segments and checking that they have a connection
    // of course that will change as clips get used, so I need to do this each time
    // should filter list (and keep around) instead of picking immediately and moving on
    // maybe should save the filtered lists in a dictionary?
    // Or just do the work all over again?

    // start = getNewStart(possibleList, word, usedClips);

    // // a lot of this gets moved out of this while loop
    // while (edgeList[word] && edgeList[word].length > 0 && typeof start !== 'undefined') {
    //   // //console.log(path, word, clip, start, path.length, possibleList);
    //   //console.log(path, path.length, time, usedClips);
    //   clip = start[0];
    //   segments = translateToSegments(clip, word);
    //   segments = segments.filter(function (s) {
    //     return makeSureClipSegmentHasConnection(s, word);
    //   });
    //   segment = drawRandomlyFromArray(segments);
    //   // need to work on getting out of a clip that doesn't have a segment 
    //   // //console.log(segments.length, segment);
    //   if (segment) {
    //     if (config.videoDuration - time <= 20)
    //       silenceRange = getClosestSilenceRange(clip, segment, true);
    //     else
    //       silenceRange = getClosestSilenceRange(clip, segment);
    //     path.push([word, clip, silenceRange]);
    //     addUsedSegments(clip, silenceRange, usedSegments);
    //     word = getNewWord(word, clip, segment, usedWords, usedClips);
    //     // usedClips.push(clip);
    //     clip = start[1][0];
    //     //console.log(clip);
    //     possibleList = edgeList[word];
    //     start = getNewStart(possibleList, word, usedClips);  
    //     //console.log(start);
    //     time += silenceRange[1] - silenceRange[0];
    //   }
    // };
    // // //console.log("HELLO", word, start);
    // // need to check the current clip to get a new word;
    // if (/*edgeList[word].length == 0 || */typeof start === 'undefined') {
    //   word = allTheWords.pop(0);
    //   if (!segment || typeof start === 'undefined')
    //     word = word;
    //   else {
    //     // word = get
    //   }
    //   continue;
    // }

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
    // silences.stdin.write(config.waveFileDirectory + identifier + '.wav\n');
    try {
      soundFile = JSON.parse(fs.readFileSync(config.transcriptsDirectory + identifier + '.json'), 'utf-8');
      var dataFile = JSON.parse(fs.readFileSync(config.rawDataDirectory + filename), 'utf-8');

    // //console.log(allData, config.transcriptsDirectory, identifier, soundFile, dataFile);
    if (dataFile && !dataFile.portrait) { //&& fs.existsSync(config.videoFileDirectory + identifier + '.mov')) {
      if (typeof allData[identifier] === 'undefined')
        allData[identifier] = dataFile;
    
      allData[identifier]['rawWatsonData'] = soundFile;
      allData[identifier]['combinedWatson'] = combineTranscript(soundFile);
      allTheClips.push(identifier);
      allTheLengths[dataFile.filename] = dataFile.fileLength;
    } else {
      console.log(identifier, "wasn't in video directory");
    }
    } catch (e) {
      //console.log(e);
    }

  }

});
var cleanup = function (finalOutput) {
  if (fs.existsSync(finalOutput)) {
    var tempVids = fs.readdirSync(config.tempDirectory);
    tempVids.forEach(function(v) {
      fs.unlinkSync(config.tempDirectory + v);
    });
    try {
      fs.unlinkSync('./concat_list.txt'); 
      fs.unlinkSync('./concat_silences.txt'); 
    } catch (err) {
      console.log("concat file doesn't exist");
    }
  } else {
    console.log("\x1b[31m\x1b[40m", "Not deleting temp files because the final video wasn't made. Please manually concatenate the videos.", "\x1b[0m");
  }
};
try {
  fs.unlinkSync('./concat_list.txt');
  fs.unlinkSync('./concat_silences.txt');
} catch (err) {
  console.log(err);
}
populateGraph();
edgeList = createEdgeList(graph);
allTheWords = getAllTheWords(edgeList);
getFavoredClips();
favoredWords = getFavoredWords(edgeList);
// console.log(favoredWords, favoredClips);
// console.log(favoredClips);
// silences.kill();
getStartingSegments();
// console.log(startingSegments);
// getEndingSegments();
// writeUpWords("wordCounts");
// ////(endingSegments);
// wordCounts = {};
// wordInFiles = {};
// populateGraph();

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
// // makeClipWithSilences();

// path = getPath("hello", allTheClips, edgeList);
// console.log(path, time);
// path.forEach(function (item, i) {
//   console.log(item);
//   // processClip(item[1], item[2], i);
// });


// usedClips = [];
path = getPath("hello", allTheClips, edgeList);

console.log(path, "HELLLLLLLLO", time);
path.forEach(function (item, i) {
  console.log(item);
  // processClip(item[1], item[2], i);
});
// var finalOutput = makeVideo();
// makeSilencesOutro(usedClips);
// var outroOutput = makeSilencesOutroClip();
// cleanup(finalOutput, outroOutput);
  // var fd = fs.openSync('graph.txt', 'w');
  // fs.writeSync(fd, JSON.stringify(graph));
  // fs.closeSync(fd);
  // var fd = fs.openSync('edgeList.txt', 'w');
  // fs.writeSync(fd, JSON.stringify(edgeList));
  // fs.closeSync(fd);
  // edgeList['love'], "HELLLLLO");
