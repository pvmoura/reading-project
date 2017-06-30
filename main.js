var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var mostCommonWords = JSON.parse(fs.readFileSync('most_common_words.json', 'utf-8'));
var watsonTranscriber = require('./transcriber.js');
var child = require('child_process');
var files = fs.readdirSync(config.soundFileDirectory);
var silences = child.execFile('./silences.py');
// var wn = child.execFile('./wordnet_analysis.py');
// files = files.filter(function(a) { return a.split('.')[1] === 'wav'; });
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
silences.stdout.on('data', function (data) {
  data = JSON.parse(data.trim());
  if (allData[data.filename] === 'undefined')
    allData[data.filename] = {};
  allData[data.filename]['silences'] = data.silences;
  processed++;
  if (processed === numToProcess) {
    // silences.kill();
    makeClipWithSilences();
  }
});
silences.stderr.on('data', function (err) {
  //console.log(err);
});
var findClipsWithWord = function (word) {
  var clip, clips = [], clipWord, transcript, temp;
  for (var key in allData) {
    if (allData.hasOwnProperty(key)) {
      clip = allData[key];
      transcript = clip.combinedWatson.transcript;
      temp = transcript.split(' ')
      transcript = temp.slice(temp.length / 2).join(' ');
      if (clip.combinedWatson.transcript.indexOf(word + " ") !== -1) {
        //console.log(clip.combinedWatson.transcript);
        clips.push(key);
      }
        
    }

  }
  return clips;
}

var getWordTimestamps = function (filename, word) {
  var clip = allData[filename], timestamps;
  if (typeof clip === 'undefined') return null;
  timestamps = clip.combinedWatson.timestamps;
  timestamps = timestamps.filter(function (t) {
    // //console.log(t[0], word);
    return t[0] === word; 
  });
  return timestamps;
};
var retrieveClosestSilenceToWord = function (silences, wordTime) {
  var indexOfClosestSilence;
  silences.forEach(function (s, i) {
    
  })
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
  // //console.log("TIMESTAMPS", timestamps, range);
  timestamps.forEach(function (t, i) {
    if (t[1] < range[1])
      end = i;
    if (t[1] < range[0])
      start = i;
  });
  //console.log(filename, range, timestamps, start, end, "HELLLLLLLO");
  return timestamps.slice(start, end + 1);
}
var processClip = function (filename, range, num) {
  var fd = fs.openSync('concat_list.txt', 'a');
  var output = "./temp_videos/" + 'output' + num + '.mov';
  var time = range[1] - range[0];
  var command = '-i ' + config.videoFileDirectory + "/" + filename + ".mov" + ' -strict -2 -ss ' + convertTimeToTimeStamp(range[0]) + ' -t ' + convertTimeToTimeStamp(time) + ' ' + output;
  //console.log(command);
  var result = child.spawnSync('ffmpeg', command.split(' '));
  //console.log("Done with ", filename);
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
  words = words.filter(function (w) {
    return mostCommonWords.indexOf(w) === -1 && w.indexOf("\'") === -1 && w != '%HESITATION';
  });
  return words.slice(words.length / 2);
};

var usedRanges = [], possibleRanges = {};
var numberInRange = function (number, rangeStart, rangeEnd) {
  return number <= rangeEnd && number >= rangeStart;
}
var isUsedClip = function (resultObj) {
  console.log(resultObj, "IN USED CLIP");
  var filename = resultObj[0], rangeLow = resultObj[1][0], rangeHigh = resultObj[1][1], used = false;
  usedRanges.forEach(function (r) {
    
    if (r[0] === filename) {
      used = true;
      if (numberInRange(rangeLow, r[1][0], r[1][1]) ||
          numberInRange(rangeHigh, r[1][0], r[1][1])) {
        console.log(r[1][0], r[1][1], r, resultObj);
        used = true;
      }
        
    }
  });
  return used;
};

var getNewPossible = function (word) {
  var ranges = possibleRanges[word];
  if (typeof ranges === 'undefined') return null;
  console.log(ranges, "IN NEW POSSIBLE")
  return ranges.popByIndex(getRandomInt(0, ranges.length - 1));
}
var makeClipWithSilences = function () {
  var words = ["beauty"], clips, clip, word, time = 0, counter = 0;
  while ( time < config.videoDuration ) {
    // console.log("WORDSSSSSS", words);
    for (var i = 0, length = words.length; i < length; i++) {
      clips = findClipsWithWord(words[i], usedRanges);
      console.log("CLIPS CLIPS CLIPS", clips);
      if (clips.length > 0) {
        break;
      }
    }
    if (clips && clips.length > 0) {
      word = words.popByIndex(i);
      var result = getWords(clips, word);
      while (result !== null && isUsedClip(result)) {
        result = getNewPossible(word);
      }
      if (result) {

        clip = result[0];
        console.log(result);
        processClip(clip, result[1], counter);
        addUsedRanges(result);
        counter++;
        time += result[1][1] - result[1][0];
        console.log(time, "TIMEMEMEMME");
        words = getWordsFromRange(result[0], result[1]);
        words = getWordsFromClip(words);
        console.log(words, word, time, "TIME AND WORD AND WORDS");
      } else {
        words = JSON.parse(child.execFileSync('./wordnet_analysis.py', [words[getRandomInt(0, words.length)]]));  
      }
      
    } else {
      words = JSON.parse(child.execFileSync('./wordnet_analysis.py', [words[getRandomInt(0, words.length)]]));
      if (words.length == 0) {
        words = ["and"];
      }
    }
  }
  makeVideo();
}
var getFreeRanges = function (usedRanges, filename, word) {
  var wordTimestamps = getWordTimestamps(filename, word),
      range = usedRanges[filename];
  //console.log(wordTimestamps);
  if (wordTimestamps === null) return null;
  if (typeof range !== 'undefined') {
    for (var i = 0, length = range.length; i < length; i++) {

    }
  }

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
}
var getWords = function (clips, startingWord) {
  var clip, timestamps, rand, words;
  clips.forEach(function (c) {
    timestamps = getWordTimestamps(c, startingWord);
    timestamps.forEach(function (t) {
      var s = getAllSilenceRanges(c, t);
      s = [ s[0][0], s[s.length - 1][1] ];
      //console.log(s, t);
      addPossibleRanges(c, s, startingWord);
    });
    
  });
  range = pickAPossibleRange(possibleRanges, startingWord);
  if (range === null) return range;
  //console.log(range, "EREARALERJKEALKRJ", usedRanges, possibleRanges);
  
  
  return range;

  // do {
  //   rand = getRandomInt(0, clips.length - 1);
    
  //   clip = clips.popByIndex(rand);
  //   timestamps = getWordTimestamps(clip, startingWord);
  //   //console.log(timestamps, clip, clips, rand);
  //   timestamps.forEach(function (t) {
  //     //console.log(getAllSilenceRanges(clip, t));
  //   });
  //   getFreeRanges(usedRanges, clip, startingWord);
  // } while (usedClips.indexOf(clip) !== -1 && clips.length != 0);
  // return null;
  // if (!clip) return null;
  // usedClips.push(clip);
  // var timestamp = getWordTimestamps(clip, startingWord);
  // if (!timestamp || timestamp.length == 0) {
  //   return null;
  // }
  // // //console.log("TIMESTAMP", timestamp);
  // var silencesRange = getAllSilenceRanges(clip, timestamp[0]);
  // if (silencesRange.length >= 2) {
  //   var counter = 0, time = 0;
  //   //console.log(silencesRange, "SILENCES RANGE");
  //   do {
  //     time = silencesRange[counter][0] - silencesRange[0][1];
  //     counter++;
  //   } while (time < config.segmentMinTime && counter < silencesRange.length);
  //   if (counter >= silencesRange.length)
  //     return null;
  //   var timeRange = [silencesRange[0][0], silencesRange[counter][1]];
    
    
  // } else if (silencesRange.length == 1) {
  //   timeRange = [silencesRange[0][0], silencesRange[0][1]];
  // } else {
  //   return null;
  // }
  // var words = getWordsFromRange(clip, timeRange);
  // return [clip, words, timeRange];
}
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
}
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
  var fd = fs.openSync('./transcripts/' + filename.split('.')[0] + '.txt', 'a');
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
var soundFiles = [], rankedSoundFiles = [], videoDuration = 0, used = [];
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
    silences.stdin.write(config.waveFileDirectory + "Leveled-_" + identifier + '.wav\n');
    soundFile = JSON.parse(fs.readFileSync(config.soundFileDirectory + "/" + filename, 'utf-8'));

    if (typeof allData[identifier] === 'undefined')
      allData[identifier] = {};
    allData[identifier]['rawWatsonData'] = soundFile;
    allData[identifier]['combinedWatson'] = combineTranscript(soundFile);
    
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
