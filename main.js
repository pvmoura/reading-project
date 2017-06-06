var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var watsonTranscriber = require('./transcriber.js');
var child = require('child_process');
var files = fs.readdirSync(config.soundFileDirectory);
files = files.filter(function(a) { return a.split('.')[1] === 'wav'; });
var numOfFiles = files.length;
var processedFiles = 0;
var allData = [];
var processData = function (data) {
  var processed = [], watsonObj;
  data.forEach(function (datum) {
    for (var key in datum) {
      if (datum.hasOwnProperty(key)) {
        watsonObj = datum[key];
        processed.push({
          filename: config.soundFileDirectory + '/' + key,
          start: watsonObj.timestamps[0][1],
          end: watsonObj.timestamps[10][2]
        });
      }
    }
  });
  return processed;
}
var makeClip = function (data) {
  var datum;
  var fd = fs.openSync('concat_list.txt', 'a');
  var fragments = data.map(function (datum, i) {
    var time = datum.end - datum.start;
    var output = 'output' + i + '.wav';
    var command = '-i ' + datum.filename + ' -ss 00:00:' + datum.start + ' -t 00:00:' + time + ' ' + output;
    console.log(command, time, datum, "DATUM");
    child.spawnSync('ffmpeg', command.split(' '));
    fs.writeSync(fd, "file './" + output + "'\n");
    return output;
  });
  fs.closeSync(fd);
  child.spawnSync('ffmpeg', '-f concat -safe 0 -i concat_list.txt -c copy final_output.wav'.split(' '));
}
var callback = function (err, data, filename) {
  var processedData = [];
  allData.push(data);
  processedFiles++;
  // console.log(numOfFiles, allData, data, processedFiles);
  if (processedFiles === numOfFiles) {
    processedData = processData(allData);
    makeClip(processedData);
  }
  return allData;
}

files.forEach(function (filename) {
  var transcriber,
    options = {
      dir: config.dir,
      restart: true,
      filename: filename
    };
  if (filename.split('.')[1] === 'wav') {
    transcriber = watsonTranscriber.createTranscriber(options, callback);
    transcriber.startTranscription();
    fs.createReadStream(config.soundFileDirectory + '/' + filename).pipe(transcriber.watsonObj);
  }

});