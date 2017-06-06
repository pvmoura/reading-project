var watson = require('watson-developer-cloud');
var fs = require('fs');
var timestamps = [];
var EE = require('events');
module.exports = new EE();
var fileName;

  var speech = watson.speech_to_text({
    username: process.env.watsonSpeechUser,
    password: process.env.watsonSpeechPass,
    version: 'v1'
  });
  var recognizeStream = speech.createRecognizeStream({
    'content-type': 'audio/wav; rate 44100',
    word_confidence: true,
    interim_results: true,
    continuous: true,
    timestamps: true
    // audio: fs.createReadStream('./resources/ReadingSpeaks_3.flac')
  });
  recognizeStream.on('error', function(error) {
    var now = new Date();
    // errorLogs.write(now.toString() + ": " +  error.toString());
    // console.log(now.toString() + ": " + error.toString());
    recognizeStream.emit('watsonError', error);
  });

  // Watson streams emit a "results" event when they have any result
  // from Watson, interim or final. Interim results have a final attribute
  // set to false and they provide a draft of Watson's transcription.
  // This function waits for a final result
  recognizeStream.on('results', function (data) {
    var results = data ? data.results : null, alternatives;
    if (results && results.length > 0) {
      if (results[0].final === true) {
      	// console.log(results[0].alternatives[0]);
      	var ts = results[0].alternatives[0].timestamps;
      	for (var i=0; i < ts.length; i++) {
      		timestamps.push(ts[i]);
      	}
        if (results[0].alternatives && results[0].alternatives.length >=0)
          alternatives = results[0].alternatives[0];
        if (typeof alternatives === 'undefined')
          recognizeStream.emit('noAlternatives', data);
        else
          recognizeStream.emit('finalData', data);
      } else {
        recognizeStream.emit('interimData', data);
      }
    } else {
      recognizeStream.emit('noData', results);
    }
  });

  recognizeStream.on('close', function (code, reason) {
    recognizeStream.emit('watsonClose', { code: code, reason: reason });
    var data = {};
    module.exports.emit('timestamps', { timestamps: timestamps });
  });
fs.createReadStream('./resources/ReadingSpeaks_11.wav')
  .pipe(recognizeStream);