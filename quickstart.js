/**
 * Copyright 2017, Google, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

// [START speech_quickstart]
// Imports the Google Cloud client library
const Speech = require('@google-cloud/speech');
const fs = require('fs');

// Your Google Cloud Platform project ID
const projectId = 'reading-speaks';

// Instantiates a client
const speechClient = Speech({
  projectId: projectId
});

// The name of the audio file to transcribe
const fileName = './resources/ReadingSpeaks_12.flac';

// The audio file's encoding, sample rate in hertz, and BCP-47 language code
const options = {
  encoding: 'FLAC',
  sampleRateHertz: 48000,
  languageCode: 'en-US'
};

// Detects speech in the audio file
speechClient.recognize(fileName, options)
  .then((results) => {
    const transcription = results[0];
    console.log(`Transcription: ${transcription}`);
    fs.open('google_transcriptions/transcription_12.txt', 'wx', function (err, fd) {
      if (err) {
        if(err.code === 'EEXIST')
          return
      }
      fs.writeSync(fd, transcription);
    });
  })
  .catch((err) => {
    console.error('ERROR:', err);
  });
// [END speech_quickstart]
