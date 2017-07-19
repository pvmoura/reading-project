var fs = require('fs');
var child = require('child_process');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var today = process.argv[2];
var numberOfClips = process.argv[3];
console.log(numberOfClips);
var files = fs.readdirSync(config.rawDataDirectory);
var shortSilenceFiles = fs.readdirSync(config.shortSilencesDirectory);
if (typeof today === 'undefined') {
  console.log("NEED AN INDENTIFIER");
  process.kill(process.pid);
}
if (typeof numberOfClips === 'undefined') {
  console.log("NO NUMBER OF SIILENCES GIVEN, PRODUCING OUTRO WITH 15 SILENCES");
  numberOfClips = 15;
}
numberOfClips = parseInt(numberOfClips, 10);
if (isNaN(numberOfClips)) {
  console.log("NOT A VALID NUMBER OF CLIPS, PLEASE USE AN INTEGER VALUE");
  process.kill(process.pid);
} else {
  console.log("PRODUCING OUTRO WITH", numberOfClips, "SILENCES");
}

var favoredClips = [];
try {
  fs.unlinkSync('./concat_silences.txt');
} catch (err) {
  console.log("No silence file to delete");
}

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
var getFavoredClips = function (today) {
  favoredClips = files.map(function (f) {
    return f.split('.')[0];
  });
  favoredClips = favoredClips.filter(function (f) {
    return f.indexOf(today) !== -1;
  });
  return favoredClips;
};

var getRandomInt = function (min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

var drawRandomlyFromArray = function (arr) {
  return arr[getRandomInt(0, arr.length - 1)];
};

var addSilenceFileToConcatFile = function (identifier, longsUsed, fileDescriptor, total) {
  var lengths = [], length;
  possibleClips = shortSilenceFiles.filter(function(sf) {
    return sf.indexOf(identifier) !== -1;
  });
  if (possibleClips.length > 0) {
    lengths = possibleClips.map(function (sf) {
      sf = sf.split('.')[0];
      length = sf.split('__')[1];
      return parseInt(length, 10);
    });
    console.log(possibleClips, identifier, lengths);
    lengths.sort();
    if (longsUsed < 2) {
      length = lengths[0];
      longsUsed++;
    } else {
      length = lengths[lengths.length - 1];
    }
    if (!isNaN(length)) {
      fs.writeSync(fileDescriptor, "file '" + config.shortSilencesDirectory + identifier + "__" + length + ".mov\n");
      total += 1;
    }
  }
  return [longsUsed, total];
}

var makeSilencesOutro = function () {
  var total = 0, possibleClips, longsUsed = 0;
  var fd = fs.openSync('concat_silences.txt', 'w'), usedClips = [];

  favoredClips.forEach(function(f) {
    result = addSilenceFileToConcatFile(f, longsUsed, fd, total);
    longsUsed = result[0];
    total = result[1];
  });
  console.log(total);
  var filtered = shortSilenceFiles.filter(function (f) {
    var identifier = f.split('.')[0];
    identifier = f.split('__')[0];
    return favoredClips.indexOf(identifier) === -1;
  });
  while (total < numberOfClips && filtered.length > 0) {
    var shortSilenceClip = filtered.popByIndex(getRandomInt(0, filtered.length - 1));
    if (shortSilenceClip !== null) {
      result = addSilenceFileToConcatFile(shortSilenceClip, longsUsed, fd, total);
      longsUsed = result[0];
      total = result[1];
    }
  }
  fs.closeSync(fd);
  return;
};

var makeSilencesOutroClip = function () {
  var outputFilename = config.outputDirectory + 'outro.mov';
  var command = '-f concat -safe 0 -i concat_silences.txt -c copy ' + outputFilename;
  console.log(command);
  child.spawnSync('ffmpeg', command.split(' '));
  return outputFilename;
};

favoredClips = getFavoredClips(today);
if (favoredClips.length == 0) {
  console.log("DIDN'T FIND ANY CLIPS WITH IDENTIFIER", today);
  process.kill(process.pid);
}
favoredClips.forEach(function (filename) {
  child.spawnSync('node', ['./generateShortSilencesForFile.js', filename + ".wav"]);
});
makeSilencesOutro();
makeSilencesOutroClip();

