var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var child = require('child_process');
var rawDataDir = config.rawDataDirectory;
var files = [];
var filter = process.argv[2];
if (typeof rawDataDir === 'undefined') {
	console.log("Please set the raw data directory in the config file");
	process.kill(process.pid);
}

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


var processShortSilence = function (filename, range) {
  var output = config.shortSilencesDirectory + filename + '.mov';
  var time = range[1] - range[0];
  var command = '-i ' + config.videoFileDirectory + filename + ".mov" + ' -c:v prores -profile:v 1 -ss ' + convertTimeToTimeStamp(range[0]) + ' -t ' + convertTimeToTimeStamp(time) + ' ' + output;
  console.log(command);
  var result = child.spawn('ffmpeg', command.split(' '));
  return result;
};

files = fs.readdirSync(rawDataDir);
files.forEach(function (filename) {
	var split_file = filename.split('.');
	if (split_file[1] === 'json' && split_file[0].indexOf(filter) !== -1) {
		console.log(filename, identifier);
		var fileData = JSON.parse(fs.readFileSync(config.rawDataDirectory + filename));
		var identifier = filename.split('.')[0];

		if (typeof fileData.shortSilences === 'undefined') {
			console.log("NO SHORT SILENCES RECORDED FOR FILE:", filename);
			return;
		}
		silence = drawRandomlyFromArray(fileData.shortSilences);
		if (typeof silence === 'undefined') {
			console.log("NO SHORT SILENCES IN FILE:", filename);
			return;
		}
		processShortSilence(identifier, silence);
	}
});