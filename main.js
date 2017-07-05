var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var mostCommonWords = JSON.parse(fs.readFileSync('most_common_words.json', 'utf-8'));
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
  console.log(err);
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
  var command = '-i ' + config.videoFileDirectory + "/" + filename + ".mov" + ' -strict -2 -ss ' + convertTimeToTimeStamp(range[0]) + ' -t ' + convertTimeToTimeStamp(time) + ' ' + output;
  console.log(command);
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
var findClipsWithWord = function (word) {
  var clip, clips = [], clipWord, transcript, temp;
  for (var key in allData) {
    if (allData.hasOwnProperty(key)) {
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

var makeClipWithSilences = function () {
  var words = ["beauty"], clips, clip, word, time = 0, counter = 0;
  while ( time < config.videoDuration ) {
    for (var i = 0, length = words.length; i < length; i++) {
      clips = findClipsWithWord(words[i], usedRanges);
      if (clips.length > 0) {
        break;
      }
    }
    // clips = getClipsFromWordList(words);
    if (clips && clips.length > 0) {
      word = words.popByIndex(i);
      var result = getWords(clips, word);
      while (result !== null && isUsedClip(result)) {
        console.log(possibleRanges, usedRanges);
        result = getNewPossible(word);
      }
      if (result === null) {
        while (result !== null && isUsedClip(result)) {
          result = getAnyNewPossible();  
        }
      }
      if (result) {
        clip = result[0];
        console.log(result);
        processClip(clip, result[1], counter);
        addUsedRanges(result);
        counter++;
        time += result[1][1] - result[1][0];
        words = getWordsFromRange(result[0], result[1]);
        words = getWordsFromClip(words);
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
    prev.transcript += curr.transcript;
    prev.timestamps = prev.timestamps.concat(curr.timestamps);
    return prev;
  }, {transcript: '', timestamps: []});
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

