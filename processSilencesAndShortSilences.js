var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var child = require('child_process');
var silences = child.execFile('./silences.py');
var identifier;
var filename = process.argv[2];
var fullFilename = config.waveFileDirectory + filename;
var PID = process.pid;
if (typeof filename === 'undefined' || filename.split('.')[1] !== 'wav') {
	console.log("Bad Filename -- either you didn't give me one or it wasn't a WAV file");
	process.kill(PID);
}
if (!fs.existsSync(fullFilename)) {
	console.log("File doesn't exist in directory, make sure config.json has correct directory");
	process.kill(PID);
}
identifier = filename.split('.')[0];

var writeToJSObj = function (dataToWrite, JSObj) {
	for (var key in dataToWrite) {
		if (dataToWrite.hasOwnProperty(key))
			JSObj[key] = dataToWrite[key];
	}
	return JSObj;
};

var getShortSilences = function (silences, maxSilenceThreshold) {
	if (typeof silences === 'undefined') return [];
	return silences.filter(function (ess) {
    	var diff = ess[1] - ess[0];
    	return diff <= maxSilenceThreshold;
    });
};

silences.stdin.write(fullFilename + '\n');
silences.stdout.on('data', function (data) {
	var JSObj, JSObjLoc = config.rawDataDirectory + identifier + '.json', fd;
	data = JSON.parse(data.trim());
	data['shortSilences'] = getShortSilences(data.silences, config.shortSilenceMax);
	if (fs.existsSync(JSObjLoc)) {
		JSObj = JSON.parse(fs.readFileSync(JSObjLoc, 'utf-8'));
	} else {
		JSObj = {};
	}
	JSObj = writeToJSObj(data, JSObj);
	fd = fs.openSync(JSObjLoc, 'w');
	fs.writeSync(fd, JSON.stringify(JSObj));
	fs.closeSync(fd);
	silences.kill();
	return;
});
silences.stderr.on('data', function (err) {
  console.log(err);
});
