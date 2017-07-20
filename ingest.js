var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var child = require('child_process');
var portraits = process.argv[2];
if (portraits !== 'portraits')
	portraits = '';
var watcher = fs.watch(config.waveFileDirectory);
var processedFiles = {};




watcher.on('change', function (eventType, filename) {
	var silenceProcesser, watsonProcesser, shortSilenceGenerator;
	console.log(eventType, filename);
	var extension, fn, identifier;
	if (eventType === 'rename') {
		fn = filename.split('.');
		try {
			extension = fn[1];
			identifier = fn[0];
		} catch (err) {
			console.log(filename);
		}
		if (extension === 'wav' && fs.existsSync(config.waveFileDirectory + filename)) {
			console.log("PROCESSING FILE", filename);
			if (typeof identifier !== 'undefined' && typeof processedFiles[identifier] === 'undefined') {

				silenceProcesser = child.spawn('node', ['./processSilencesAndShortSilences.js', filename, portraits]);
				silenceProcesser.on('close', function (code, signal) {
					// console.log("FINISHED PROCESSING SILENCES IN RAW DATA", filename, code);
					// shortSilenceGenerator = child.spawn('node', ['./generateShortSilencesForFile.js', filename, portraits]);
					// shortSilenceGenerator.on('close', function (code, signal) {
					// 	if (code === 0)
					// 		console.log("SUCCESSFULLY CREATED SHORT SILENCES FOR", filename);
					// 	else
					// 		console.log("\x1b[31m", "ERROR WHEN CREATING SHORT SILENCES FOR", filename, "\x1b[0m");
					// });
				});
				silenceProcesser.on('error', function (err) {
					console.log(err);
				});
				watsonProcesser = child.spawn('node', ['./singleFileWatsonTranscription.js', filename, portraits]);
				watsonProcesser.on('close', function (code, signal) {
					console.log("FINISHED TRANSCRIBING FILE", filename, code);
				});
				watsonProcesser.on('error', function (err) {
					console.log(err);
				});
			}
		}
	}
});
