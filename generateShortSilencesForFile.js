var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var child = require('child_process');
var rawDataDir = config.rawDataDirectory;
var files = [];
var filename = process.argv[2], identifier, fullFilenameRawData, silencesWithTotalTime;
var didLong = false, didShort = false;
var PID = process.pid;
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


var processShortSilence = function (filename, filenameInClips, range, totalTime) {
  var output = config.shortSilencesDirectory + filename + '.mov';
  var time = (totalTime / 100).toFixed(2);
  var command = '-i ' + config.videoFileDirectory + filenameInClips + ".mov" + ' -c:v prores -profile:v 1 -ss ' + range[0] + ' -t ' + time + ' ' + output;
  console.log(command);
  var result = child.spawnSync('ffmpeg', command.split(' '));
  return result;
};

fullFilenameRawData = config.rawDataDirectory + identifier + '.json';
if (fs.existsSync(fullFilenameRawData)) {
	console.log(filename, identifier, fullFilenameRawData);
	var fileData = JSON.parse(fs.readFileSync(fullFilenameRawData));

	if (typeof fileData.shortSilences === 'undefined') {
		console.log("NO SHORT SILENCES RECORDED FOR FILE:", filename);
	}
	silencesWithTotalTime = fileData.shortSilences.map(function (ss) {
		return [Math.round((ss[1] - ss[0]) * 100), ss];
	});
	silencesWithTotalTime.sort(function (a, b) {
		if (a[0] < b[0]) return 1;
		else if (a[0] > b[0]) return -1;
		else return 0;
	});
	if (silencesWithTotalTime.length > 3) {
		silencesWithTotalTime = [ silencesWithTotalTime[0],
								 silencesWithTotalTime.pop(),
								 silencesWithTotalTime.pop() ];
	}
	silencesWithTotalTime.forEach(function (s) {
		var totalTime = s[0], range = s[1];
		processShortSilence(identifier + "__" + totalTime, identifier, range, totalTime);
	});
	// fileData.shortSilences.forEach(function (s) {
	// 	var totalTime = Math.round((s[1] - s[0]) * 100);
	// 	console.log(identifier);
	// 	processShortSilence(identifier + "__" + s[0] + "-" + s[1] + "__" + totalTime, identifier, s, totalTime);
	// });
	
} else {
	console.log("NO RAW DATA FOR FILE", fullFilenameRawData);
}