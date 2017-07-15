var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var child = require('child_process');
var rawDataDir = config.rawDataDirectory;
var soundFilesDir = config.waveFileDirectory;
var files = [];
files = fs.readdirSync(soundFilesDir);
files.forEach(function (filename) {
	console.log(filename);
	a = child.spawnSync('node', ['./processSilencesAndShortSilences.js', filename]);
	console.log(a);
});