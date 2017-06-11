var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var mostCommonWords = JSON.parse(fs.readFileSync('most_common_words.json', 'utf-8'));
var watsonTranscriber = require('./transcriber.js');
var child = require('child_process');
var files = fs.readdirSync(config.soundFileDirectory);
// files = files.filter(function(a) { return a.split('.')[1] === 'wav'; });
var numOfFiles = files.length;
var processedFiles = 0;
var allData = {};
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
    console.log(command, time, datum, "DATUM");
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
    var command = '-i ' + config.videoFileDirectory + "/" + datum[3] + ".mov" + ' -ss 00:00:' + datum[4] + ' -t 00:00:' + time + ' ' + output;
    console.log(command, time, datum, "DATUM");
    var result = child.spawnSync('ffmpeg', command.split(' '));
    console.log(result);
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
//   console.log(processedFiles, allData);
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
      segment.filename = filename
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
    return [segment.commonRatio, segment.originalOrder, segment.totalTime, filename, segment.startTimeStamp, segment.endTimeStamp]; 
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
var callback = function (err, data, filename) {
  var fd = fs.openSync('./transcripts/' + filename.split('.')[0] + '.txt', 'a');
  fs.writeSync(fd, JSON.stringify(data));
  fs.closeSync(fd);
}
var soundFiles = [], rankedSoundFiles = [], videoDuration = 0, used = [];
files.forEach(function (filename) {
  console.log(filename);
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
  var soundFile, rankedSoundFile = [];
  if (filename.split('.')[1] === 'json') {
    soundFile = JSON.parse(fs.readFileSync(config.soundFileDirectory + "/" + filename, 'utf-8'));
    soundFile = countUpTimestamps(soundFile, filename.split('.')[0]);
    soundFile = wordVariety(soundFile);
    rankedSoundFile = rankInterestingness(soundFile, filename.split('.')[0]);
    rankedSoundFile.forEach(function (s) {
      rankedSoundFiles.push(s);
    });
    soundFile.forEach(function (s) {
      soundFiles.push(s);
    })
  }

});

// soundFiles = soundFiles.sort(function (a, b) {
//     if (a[0] > b[0][0])
//       return 1;
//     else if (a[0][0] < b[0][0])
//       return -1;
//     else
//       return 0;
//   });
rankedSoundFiles = rankedSoundFiles.sort(function (a, b) {
  if (a[0] > b[0])
    return a[2] > b[2] ? 1 : -1;
  else if (a[0] < b[0])
    return a[2] < b[2] ? -1 : 1;
  else
    return 0;
});
var sequence = [], videoTime = 0, clips = [], totalTime = 0, index, fn;
var findClip = function (clip) {
  var order = clip.originalOrder, name = clip.filename, index = 0;
  for (index; index < rankedSoundFiles.length; index++) {
    // if (order == rankdedSoundFiles[index])
  }

  rankedSoundFiles.forEach(function (f, i) {
    // f[]
  });
};
while (config.videoDuration > videoTime) {
  clip = rankedSoundFiles.pop();
  used.push(clip);
  if (false && clip[2] < config.segmentMinTime) {
    totalTime += clip[2];
    index = clip[1];
    fn = clip[3];
    clips.push(clip);
    while (totalTime < config.segmentMinTime) {
      index++;
      if (index < soundFiles) {
        nextClip = soundFiles[fn][index];  
      } else {
        break;
      }
      totalTime += nextClip.totalTime;

    }
  } else {
    sequence.push(clip);  
  }
  
  videoTime += clip[2];
}
makeClipInteresting(sequence);
