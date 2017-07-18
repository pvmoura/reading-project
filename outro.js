var fs = require('fs');
var child = require('child_process');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var today = process.argv[2];
var numberOfClips = parseInt(process.argv[3], 10);
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
if (typeof numberOfClips !== 'number') {
  console.log("NOT A VALID NUMBER OF CLIPS, PLEASE USE AN INTEGER VALUE");
  process.kill(process.pid);
}

var favoredClips = [];
try {
  fs.unlinkSync('./concat_silences.txt');
} catch (err) {
  console.log("No silence file to delete");
}
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


var makeSilencesOutro = function () {
  var total = 0;
  var fd = fs.openSync('concat_silences.txt', 'w');
  favoredClips.forEach(function(f) {
    fs.writeSync(fd, "file '" + config.shortSilencesDirectory + f + ".mov\n");
    total++;
  });
  
  // for (var i = 0, len = unUsedPeople.length; i < len; i++) {
  //   fs.writeSync(fd, "file '" + config.shortSilencesDirectory + unUsedPeople[i] + "'\n");
  // }

  var filtered = shortSilenceFiles.filter(function (f) {
    return favoredClips.indexOf(f.split('.')[0]) === -1;
  });
  while (total < numberOfClips) {
    var shortSilenceClip = drawRandomlyFromArray(filtered);
    if (typeof shortSilenceClip !== 'undefined')
      fs.writeSync(fd, "file '" + config.shortSilencesDirectory + shortSilenceClip + "'\n");
    total++;
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
favoredClips.forEach(function (filename) {
  child.spawnSync('node', ['./generateShortSilencesForFile.js', filename + ".wav"]);
});
// makeSilencesOutro();
// makeSilencesOutroClip();

