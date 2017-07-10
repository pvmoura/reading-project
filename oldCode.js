var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var files = fs.readdirSync(config.soundFileDirectory);
var soundFiles = fs.readdirSync(config.waveFileDirectory);
var watsonTranscriber = require('./transcriber.js');
var numOfFiles = 0, processedFiles = 0;
var numOfFiles = files.length;
var usedRanges = [], possibleRanges = {};
var startingSegments = {}, endingSegments = {};
var soundFiles = [], rankedSoundFiles = [], videoDuration = 0, used = [];
files = files.filter( function (f) { return f.split(".")[1] === 'json' } );
files = files.map( function (f) { return f.split(".")[0] } );


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
      ////(newSilence);
      if (typeof startingSegments[key] === 'undefined')
        startingSegments[key] = reduceToStartAndEndPoints(newSilence);
    }
  }

};

var addToUsedClips = function (clip) {
  usedClips.push(clip);
};

var processLastClip = function (result, counter) {
  var clip = result[0];
  //////(result);
  addToUsedClips(clip);
  processClip(clip, result[1], counter);
  addUsedRanges(result);
  counter++;
  time += result[1][1] - result[1][0];
  words = getWordsFromRange(result[0], result[1]);
  words = filterUndesirableWords(words);
  return words;
};

var getEndingSegments = function () {
  for (var key in allData) {
    if (allData.hasOwnProperty(key)) {
      var silences = allData[key].silences;
      ////(silences, key);
      var totalTime = 0, last = silences[silences.length - 1][1];
      var newSilence = [silences[silences.length - 1]];
      for (var i = silences.length - 2; i > 0; i--) {
        if (totalTime < config.segmentMinTime)
          newSilence.push(silences[i]);
        totalTime += last - silences[i][0];
        last = silences[i][1];
      }
      //(key, newSilence);
      if (typeof endingSegments[key] === 'undefined') {
        endingSegments[key] = [newSilence[newSilence.length - 1][0], newSilence[0][1]];
      }
    }
  }
};

var rankBits = function (data, filename) {
  var ranked = {};
  ranked[filename] = [];
  data.forEach(function (datum) {

  });
};
var processData = function (data) {
  var processed = [], watsonObj;
  for (var dataKey in data) {
    if (data.hasOwnProperty(dataKey)) {
      watsonObj = data[dataKey];
      processed.push(rankBits(data[dataKey], dataKey));
      processed.push({
        filename: config.soundFileDirectory + '/' + key,
        start: watsonObj.timestamps[0][1],
        end: watsonObj.timestamps[10][2]
      });
    }
  }
  data.forEach(function (datum) {

  });
  return processed;
};
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

var isUsedClip = function (resultObj) {
  //////(resultObj, "IN USED CLIP");
  var filename = resultObj[0], rangeLow = resultObj[1][0], rangeHigh = resultObj[1][1], used = false;
  usedRanges.forEach(function (r) {
    
    if (r[0] === filename) {
      used = true;
      if (numberInRange(rangeLow, r[1][0], r[1][1]) ||
          numberInRange(rangeHigh, r[1][0], r[1][1])) {
        //////(r[1][0], r[1][1], r, resultObj);
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
};
var makeClip = function (data) {
  var datum;
  var fd = fs.openSync('concat_list.txt', 'a');
  var fragments = data.map(function (datum, i) {
    var time = datum.end - datum.start;
    var output = "./temp_videos" + 'output' + i + '.mov';
    var command = '-i ' + config.videoFileDirectory + "/" + datum.filename + ".mov" + ' -ss 00:00:' + datum.start + ' -t 00:00:' + time + ' ' + output;
    //console.log(command, time, datum, "DATUM");
    child.spawnSync('ffmpeg', command.split(' '));
    fs.writeSync(fd, "file './" + output + "'\n");
    return output;
  });
  fs.closeSync(fd);
  child.spawnSync('ffmpeg', '-f concat -safe 0 -i concat_list.txt -c copy final_output.mov'.split(' '));
}
var makeClipInteresting = function (data) {
  var datum;
  var fd = fs.openSync('concat_list.txt', 'a');
  var fragments = data.map(function (datum, i) {
    var time = datum[2];
    var output = "./temp_videos/" + 'output' + i + '.mov';
    var command = '-i ' + config.videoFileDirectory + "/" + datum[3] + ".mov" + ' -ss ' + convertTimeToTimeStamp(datum[4]) + ' -t ' + convertTimeToTimeStamp(time) + ' ' + output;
    //console.log(command, time, datum, "DATUM");
    var result = child.spawnSync('ffmpeg', command.split(' '));
    // //console.log(result);
    fs.writeSync(fd, "file '" + output + "'\n");
    return output;
  });
  fs.closeSync(fd);
  child.spawnSync('ffmpeg', '-f concat -safe 0 -i concat_list.txt -c copy final_output.mov'.split(' '));
}
// var callback = function (err, data, filename) {
//   var processedData = [];
  
//   if (typeof allData[filename] === 'undefined')
//     allData[filename] = []
//   allData[filename].push(data);
//   //console.log(processedFiles, allData);
//   if (processedFiles === numOfFiles) {
//     processedData = processData(allData);
//     makeClip(processedData);
//   }
//   return allData;
// }
var countUpTimestamps = function (fileRep, filename) {
  fileRep.map(function (segment) {
    var ts = segment.timestamps, beginning = ts[0], end = ts[ts.length - 1], totalTime;
    if (beginning && end) {
      totalTime = end[2] - beginning[1];
      segment.totalTime = totalTime;
      segment.startTimeStamp = beginning[1];
      segment.endTimeStamp = end[2];
      segment.filename = filename;
    }
    return segment;
  });
  return fileRep
}
var firstAndLastWords = function (fileRep) {
  fileRep.map(function (segment) {
    var wc = segment.word_confidence, beginning = wc[0], end = wc[wc.length - 1];
    if (beginning && end) {

    }
  });
};
var segmentByTime = function (fileRep) {
  function consolidateSegments(temp, segment) {
    if (typeof temp.transcript === 'undefined')
      temp.transcript = "";
      
    temp.transcript += segment.transcript;

    if (typeof temp.startTimeStamp === 'undefined')
      temp.startTimeStamp = segment.startTimeStamp;
    temp.endTimeStamp = segment.endTimeStamp;
    temp.filename = segment.filename;
    if (typeof temp.totalTime === 'undefined')
      temp.totalTime = 0;
    temp.totalTime += segment.totalTime;
    if (typeof temp.word_confidence === 'undefined')
      temp.word_confidence = segment.word_confidence;
    else
      temp.word_confidence = temp.word_confidence.concat(segment.word_confidence);
    if (typeof temp.timestamps === 'undefined')
      temp.timestamps = segment.timestamps;
    else
      temp.timestamps = temp.timestamps.concat(segment.timestamps);
    return temp
  }
  var newRep = [], temp = {}, countedUpTime = 0;
  fileRep.forEach(function (segment) {
    if (countedUpTime > 0 && countedUpTime < config.segmentMinTime) {
      temp = consolidateSegments(temp, segment);
      countedUpTime += segment.totalTime;
    } else if (countedUpTime >= config.segmentMinTime) {
      countedUpTime = 0;
      newRep.push(temp);
      temp = {};
    } else if (segment.totalTime < config.segmentMinTime) {
      temp = consolidateSegments(temp, segment);

      countedUpTime += segment.totalTime;
    } else
      newRep.push(segment);
      // //console.log(countedUpTime, newRep);
  });
  
  return newRep;
};
var convertTimeToTimeStamp = function (time) {
  var seconds = time % 60;
  var minutes = parseInt(time / 60, 10);
  var hours = parseInt(time / 360, 10);
  var timeList = [hours.toString(), minutes.toString(), seconds.toString()];
  timeList = timeList.map(function (t) { return t.length === 1 ? "0" + t : t; });
  return timeList.join(":");

}
var wordVariety = function (fileRep) {
  fileRep.map(function (segment, i) {
    var count = {}, numberOfWords = 0, numberOfCommon = 0;
    segment.words = segment.transcript.split(" ").filter(function (w) { return w.length; });
    segment.words.forEach(function (word) {
      if (typeof count[word] === 'undefined') {
        if (mostCommonWords.indexOf(word) !== -1)
          numberOfCommon++;
        numberOfWords++;
        count[word] = 0;
      }
      count[word]++;
    });
    segment.wordCount = count;
    segment.numberOfWords = numberOfWords;
    segment.commonRatio = numberOfCommon / numberOfWords;
    segment.originalOrder = i;
    return segment;
  });
  return fileRep;
};
var rankInterestingness = function (fileRep, filename) {
  var ranked = fileRep.map(function (segment, i) {
    return [segment.commonRatio, segment.originalOrder, segment.totalTime, filename, segment.startTimeStamp, segment.endTimeStamp, segment.words]; 
  });
  return ranked.sort(function (a, b) {
    if (a[0] > b[0])
      return 1;
    else if (a[0] < b[0])
      return -1;
    else
      return 0;
  });
};
var findSimilarSegment = function (segments, segment) {
  var words = segment[6];
  words = words.filter(function (w) {
    return mostCommonWords.indexOf(w) === -1;
  });
  words = words.slice(parseInt(words.length / 2, 10));
  var similar = segments.filter(function (s) {
    var sWords = s[6], sim = false;
    words.forEach(function (w) {
      if (sWords.indexOf(w) !== -1)
        sim = true;
    });
    return sim;
  })
  return similar.length ? similar.popByIndex(getRandomInt(0, similar.length - 1)) : null;
}
var callback = function (err, data, filename) {
  var fd = fs.openSync('./reading-transcripts/' + filename.split('.')[0] + '.txt', 'a');
  fs.writeSync(fd, JSON.stringify(data));
  fs.closeSync(fd);
};

var combineTranscript = function (fileRep) {
  return fileRep.reduce(function (prev, curr, arr, i) {
    prev.transcript += curr.transcript;
    prev.timestamps = prev.timestamps.concat(curr.timestamps);
    return prev;
  }, {transcript: '', timestamps: []});
};
soundFiles.forEach(function (filename) {
  var fn = filename.split(".");
  console.log(fn);
  if (fn[1] === 'wav' && files.indexOf(fn[0]) === -1) {
    numOfFiles++;
    var transcriber,
    options = {
      dir: config.dir,
      restart: true,
      filename: filename
    };
    transcriber = watsonTranscriber.createTranscriber(options, callback);
    transcriber.startTranscription();
    transcriber.watsonObj.on('watsonClose', function () {
      processedFiles++;
    });
    fs.createReadStream(config.waveFileDirectory + filename).pipe(transcriber.watsonObj);
  }
});

var getSegmentsFromWordList = function (wordList) {
  var clips = wordList.map(function (word) {
    var d = {}, clipsWithWord = findClipsWithWord(word), timestamps;
    clipsWithWord.forEach(function (c) {
      var timestamps = getTimestampsForOneWord(c, word);
      timestamps.forEach(function (t) {
        var s = getAllSilenceRanges(c, t);
        s = reduceToStartAndEndPoints(s);
      });
    });
    timestamps = getTimestampsForOneWord
    d[word] = findClipsWithWord(word);
    return d;
  });
  return clips.filter(function (d) {
    return d !== null;
  })
};

var makeClipWithSilences = function () {
  var words = ["child"], clips, clip, word, shortCounter = 0, counter = 0, start = true, result, ending = true;
  while ( time < config.videoDuration ) {
    if (!start) {
      ////(words, "WORDS");
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
        ////(possibleRanges, usedRanges, result);
        result = getNewPossible(word);
      }

      // if (result === null) {
      //   ////("IN ANY NEW POSSIBLE");
      //   while (result !== null && isUsedClip(result)) {
      //     result = getAnyNewPossible();  
      //   }
      // }
      if (result) {
        counter++;
        shortCounter++;
        words = processLastClip(result, counter);
        // clip = result[0];
        // //////(result);
        // processClip(clip, result[1], counter);
        // addUsedRanges(result);
        // counter++;
        // time += result[1][1] - result[1][0];
        // words = getWordsFromRange(result[0], result[1]);
        // words = filterUndesirableWords(words);
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
    ////(result);
    words = processLastClip(result, counter);
    start = false;
  }
  }
  makeVideo();
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
  ////(words);
  return words.indexOf(word.toLowerCase()) !== -1;
}

var dictToList = function (dict) {
  l = [];
  for (var key in dict) {
    l.push([key, dict[key]]);
  }
  return l;
};

var addUsedRanges = function (range) {
  usedRanges.push(range);
};

var getWords = function (clips, startingWord) {
  var clip, timestamps, rand, words;
  clips.forEach(function (c) {
    timestamps = getTimestampsForOneWord(c, startingWord);
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

var getNewClip = function (word, clip, usedClips) {
  var clips = edgeList[word];
  clips = clips.filter(function (c) {
    return c[0] === clip && usedClips.indexOf(c[1]) === -1;
  });
  return clips[getRandomInt(0, clips.length - 1)];
};

var wordWithinRange = function (clip, startWord, endTimestamps) {
  var timestamps = getTimestampsForOneWord(clip, startWord), within = false;
  timestamps = timestamps.filter(function (t) {
    if (withinRange(t[2], endTimestamps[2], config.segmentMinTime, config.segmentMaxTime))
      within = true;
  });
  return within;
};

var withinRange = function (start, end, lowerThreshold, upperThreshold) {
  if (end < start) return false;
  var diff = end - start;
  return diff >= lowerThreshold && diff <= upperThreshold;
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


// files.forEach(function (filename) {
//   // var transcriber,
//   //   options = {
//   //     dir: config.dir,
//   //     restart: true,
//   //     filename: filename
//   //   };
//   // if (filename.split('.')[1] === 'wav') {
//   //   transcriber = watsonTranscriber.createTranscriber(options, callback);
//   //   transcriber.startTranscription();
//   //   transcriber.watsonObj.on('watsonClose', function () {
//   //     processedFiles++;
//   //   });
//   //   fs.createReadStream(config.soundFileDirectory + '/' + filename).pipe(transcriber.watsonObj);
//   // }
//   var soundFile, rankedSoundFile = [], identifier = filename.split('.')[0];
//   if (filename.split('.')[1] === 'json') {
//     numToProcess++;
//     silences.stdin.write(config.waveFileDirectory + "Leveled-_" + identifier + '.wav\n');
//     soundFile = JSON.parse(fs.readFileSync(config.soundFileDirectory + "/" + filename, 'utf-8'));

//     if (typeof allData[identifier] === 'undefined')
//       allData[identifier] = {};
//     allData[identifier]['rawWatsonData'] = soundFile;
//     allData[identifier]['combinedWatson'] = combineTranscript(soundFile);
    
//     // soundFile = JSON.parse(fs.readFileSync(config.soundFileDirectory + "/" + filename, 'utf-8'));
//     // soundFile = countUpTimestamps(soundFile, filename.split('.')[0]);
//     // soundFile = segmentByTime(soundFile);
//     // soundFile = wordVariety(soundFile);
//     // rankedSoundFile = rankInterestingness(soundFile, filename.split('.')[0]);
//     // rankedSoundFile.forEach(function (s) {
//     //   rankedSoundFiles.push(s);
//     // });
//     // soundFile.forEach(function (s) {
//     //   soundFiles.push(s);
//     // });
//   }

// });

// Get silences into a dictionary with filename keys
// search words for a starting keyword
// find a segment with a "complete thought" that includes that word
// pick an uncommon word from the last half of that segment
// find that word in another clip
// if you don't find the word, find a synonym
// if you don't find the synonym, find a part of speech continuation
// soundFiles = soundFiles.sort(function (a, b) {
//     if (a[0] > b[0][0])
//       return 1;
//     else if (a[0][0] < b[0][0])
//       return -1;
//     else
//       return 0;
//   });

// rankedSoundFiles = rankedSoundFiles.sort(function (a, b) {
//   if (a[0] > b[0])
//     return a[2] > b[2] ? 1 : -1;
//   else if (a[0] < b[0])
//     return a[2] < b[2] ? -1 : 1;
//   else
//     return 0;
// });
// var getRandomInt = function (min, max) {
//   min = Math.ceil(min);
//   max = Math.floor(max);
//   return Math.floor(Math.random() * (max - min)) + min;
// }
// var sequence = [], videoTime = 0, clips = [], totalTime = 0, index, fn;
// var midRange = rankedSoundFiles.filter(function (c) {
//   return c[2] <= config.segmentMinTime * 3;
// });
// clip = midRange.popByIndex(getRandomInt(0, midRange.length - 1));
// //console.log(midRange.length, clip);
// while (config.videoDuration > videoTime) {
//   if (!clip) {
//     //console.log("NO SIMILAR");
//     midRange.popByIndex(getRandomInt(0, midRange.length - 1));
//   } else {
//     midRange.popByIndex(midRange.indexOf(clip));
//   }
//   sequence.push(clip);
//   videoTime += clip[2];
//   clip = findSimilarSegment(midRange, clip);
// }
// makeClipInteresting(sequence);