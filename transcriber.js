var watson = require('./watson_transcriber.js'),
  exec = require('child_process').exec,
  fs = require('fs');

function launchWatson (callback, filename) {
  watson_stream = watson.createStream();

  watson_stream.on('finalData', function (data) {
    var passAlong = {};
    passAlong[filename] = data;
    callback(null, passAlong);
  });

  watson_stream.on('watsonError', function (err) {
    callback(err);
  });
  return watson_stream;
}

// takes an options objects with keys:
// restart : Boolean
// dir : string
module.exports.createTranscriber = function (options, callback) {
  var dir, restart;
  if (!callback || typeof callback !== 'function')
    throw new Error('createTranscriber(options, callback) expects a function callback');
  
  options.dir = options.dir || 'data';
  restart = options.restart === false ? false : true;
  dir = options.dir || '.';

  return {
    filename: options.filename,
    watsonObj: null,
    active: false,
    restart: restart,
    startTranscription: function (test) {
      this.watsonObj = launchWatson(callback, this.filename);
    }
  }
}