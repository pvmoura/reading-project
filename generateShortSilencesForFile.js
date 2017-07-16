var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var child = require('child_process');
var rawDataDir = config.rawDataDirectory;
var files = [];
var filename = process.argv[2], identifier, fullFilenameRawData;
var portraits = process.argv[3];
var didLong = false, didShort = false;
if (portraits !== 'portraits')
	var DIR = config.videoFileDirectory;
else
	var DIR = config.portraitsDirectory;

if (typeof filename === 'undefined' || filename.split('.')[1] !== 'wav') {
	console.log("Bad Filename -- either you didn't give me one or it wasn't a WAV file");
	process.kill(PID);
}

identifier = filename.split('.')[0];
var drawRandomlyFromArray = function (arr) {
  return arr[getRandomInt(0, arr.length - 1)];
};

var getRandomInt = function (min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

var convertTimeToTimeStamp = function (time) {
  var seconds = time % 60;
  var minutes = parseInt(time / 60, 10);
  var hours = parseInt(time / 360, 10);
  var timeList = [hours.toString(), minutes.toString(), seconds.toString()];
  timeList = timeList.map(function (t) { return t.length === 1 ? "0" + t : t; });
  return timeList.join(":");
};


var processShortSilence = function (filename, filenameInClips, range) {
  var output = config.shortSilencesDirectory + filename + '.mov';
  var time = range[1] - range[0];
  var command = '-i ' + DIR + filenameInClips + ".mov" + ' -c:v prores -profile:v 1 -ss ' + convertTimeToTimeStamp(range[0]) + ' -t ' + convertTimeToTimeStamp(time) + ' ' + output;
  console.log(command);
  var result = child.spawn('ffmpeg', command.split(' '));
  return result;
};

fullFilenameRawData = config.rawDataDirectory + identifier + '.json';
if (fs.existsSync(fullFilenameRawData)) {
	console.log(filename, identifier, fullFilenameRawData);
	var fileData = JSON.parse(fs.readFileSync(fullFilenameRawData));

	if (typeof fileData.shortSilences === 'undefined') {
		console.log("NO SHORT SILENCES RECORDED FOR FILE:", filename);
	}
	silence = drawRandomlyFromArray(fileData.shortSilences);
	didLong = 0;
	fileData.shortSilences.forEach(function (s) {
		var totalTime = Math.round((s[1] - s[0]) * 100);
		if (!didLong && totalTime >= 90) {
			processShortSilence(identifier + "__" + totalTime, identifier, s);
			didLong = true;
		} else if (!didShort && totalTime <= 50) {
			didShort = true;
			processShortSilence(identifier + "__" + totalTime, identifier, s);
		}

		// console.log(s, identifier + "__" + totalTime);
		
	});
	// if (typeof silence === 'undefined') {
	// 	console.log("NO SHORT SILENCES IN FILE:", filename);
	// 	return;
	// }
	
} else {
	console.log("NO RAW DATA FOR FILE", fullFilenameRawData);
}