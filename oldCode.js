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