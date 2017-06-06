/*********************************************
 *                                           *
 *                                           *
 *                                           *
 *                                           * 
 *                                           *
 *                                           *
 *                                           *
 *                                           *
 *                                           *
 ********************************************/

// load necessary libraries
var watson = require('watson-developer-cloud');
var fs = require('fs');
var EE = require('events');
// make speech-to-text object using nodejs watson library

module.exports.createStream = function () {
  var speech = watson.speech_to_text({
    username: process.env.watsonSpeechUser,
    password: process.env.watsonSpeechPass,
    version: 'v1'
  });
  var recognizeStream = speech.createRecognizeStream({
    'content-type': 'audio/wav; rate 44100',
    word_confidence: true,
    interim_results: true,
    continuous: true
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
    var results = data ? data.results : null;
    if (results && results.length > 0) {

      if (results[0].final === true) {
        if (results[0].alternatives && results[0].alternatives.length >=0)
          alternatives = results[0].alternatives[0];
        if (typeof alternatives === 'undefined')
          recognizeStream.emit('noAlternatives', data);
        else
          recognizeStream.emit('finalData', results[0].alternatives[0]);
      } else {
        recognizeStream.emit('interimData', data);
      }
    } else {
      recognizeStream.emit('noData', results);
    }
  });

  recognizeStream.on('close', function (code, reason) {
    recognizeStream.emit('watsonClose', { code: code, reason: reason });
  });
  return recognizeStream;
}
