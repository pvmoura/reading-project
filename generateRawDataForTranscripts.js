var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var child = require('child_process');
var rawDataDir = config.rawDataDirectory;
var soundFilesDir = config.waveFileDirectory;
var files = [];
files = fs.readdirSync(soundFilesDir);
files.forEach(function (filename) {
	// console.log(filename);
	child.spawn('node', ['./processSilencesAndShortSilences.js', filename]);
	// if (!fs.existsSync(config.transcriptsDirectory + filename.split('.')[0] + '.json') && filename.split('.')[1] === 'wav') {
	// 	child.spawn('node', ['./singleFileWatsonTranscription.js', filename]);
	// 	console.log("PROCESSING", filename);
	// }
	// child.spawnSync('node', ['./generateShortSilencesForFile.js', filename]);
});