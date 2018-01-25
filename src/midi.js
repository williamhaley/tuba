// Gets a URL referencing the asset.
import tubaAudioURL from './tuba-ogg.dat';

const spec = {
  id:      'tuba',
  name:    'Tuba',
  program:  58,
};

var Base64Binary = {
  _keyStr : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

  /* will return a  Uint8Array type */
  decodeArrayBuffer: function(base64String) {
    let bytes = Math.ceil((3 * base64String.length) / 4.0);

    let arrayBuffer = new ArrayBuffer(bytes);

    this.decode(base64String, arrayBuffer, bytes);

    return arrayBuffer;
  },

  decode: function(base64String, arrayBuffer, bytes) {
    //get last chars to see if are valid
    var lkey1 = this._keyStr.indexOf(base64String.charAt(base64String.length-1));
    var lkey2 = this._keyStr.indexOf(base64String.charAt(base64String.length-1));

    if (lkey1 == 64) bytes--; //padding chars, so skip
    if (lkey2 == 64) bytes--; //padding chars, so skip

    var chr1, chr2, chr3;
    var enc1, enc2, enc3, enc4;
    var i = 0;
    var j = 0;

    let uarray = new Uint8Array(arrayBuffer);

    base64String = base64String.replace(/[^A-Za-z0-9\+\/\=]/g, "");

    // TODO WFH Ah, this may explain our 3 * x / 4
    for (i=0; i<bytes; i+=3) {
      //get the 3 octects in 4 ascii chars
      enc1 = this._keyStr.indexOf(base64String.charAt(j++));
      enc2 = this._keyStr.indexOf(base64String.charAt(j++));
      enc3 = this._keyStr.indexOf(base64String.charAt(j++));
      enc4 = this._keyStr.indexOf(base64String.charAt(j++));

      chr1 = (enc1 << 2) | (enc2 >> 4);
      chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      chr3 = ((enc3 & 3) << 6) | enc4;

      uarray[i] = chr1;
      if (enc3 != 64) uarray[i+1] = chr2;
      if (enc4 != 64) uarray[i+2] = chr3;
    }

    return uarray;
  }
};

let MIDI = { Soundfont: {} };

(function (Context) {
  var contextMethods = [
    ["createGainNode", "createGain"],
    ["createDelayNode", "createDelay"],
    ["createJavaScriptNode", "createScriptProcessor"]
  ];

  let proto = Context.prototype;
  let instance = new Context();
  let sourceProto = Object.getPrototypeOf(instance.createBufferSource());

  if (typeof sourceProto.noteOn !== 'function') {
    sourceProto.noteOn = sourceProto.start;
  }

  if (typeof sourceProto.noteGrainOn !== 'function') {
    sourceProto.noteGrainOn = sourceProto.start;
  }

  contextMethods.forEach(function (names) {
    while (names.length) {
      let name = names.pop();

      this[names.pop()] = this[name];
    }
  }, proto);
})(window.AudioContext);

// C8  == 108
let keyToNote = (function(memo = {}) {
  var A0 = 0x15; // first note
  var C8 = 0x6C; // last note

  var number2key = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

  for (var n = A0; n <= C8; n++) {
    var octave = (n - 12) / 12 >> 0;
    var name = number2key[n % 12] + octave;

    memo[name] = n;
  }

  return memo;
})();

let channels = (function(memo = {}) {
  for (var number = 0; number <= 15; number++) {
    memo[number] = {
      number:    number,
      program:   number,
      pitchBend: 0,
      mute:      false,
      mono:      false,
      omni:      false,
      solo:      false
    };
  }

  return memo;
})();

MIDI.loadPlugin = function(opts = {}) {
  return new Promise((resolve) => {
    if (MIDI.Soundfont[opts.instrument]) {
      midi.connect(opts);

      return resolve();
    }

    fetch(tubaAudioURL).then(function (res) {
      let script = document.createElement('script');
      script.language = 'javascript';
      script.type = 'text/javascript';
      res.text().then((text) => {
        script.text = text;
        document.body.appendChild(script);

        midi.connect(opts);

        resolve();
      });
    }).catch(function (e) {
      reject();
    });
  });
};

let midi = (function(midi = {}) {
  var audioContext = null;
  var midiAudioContext;
  var sources = {};
  var audioBuffers = {};

  midi.noteOn = function(channelId, noteId, velocity, volume) {
    var channel = channels[channelId];
    var instrument = channel.program;

    instrument = spec.program;
    console.warn(`overriding instrument id: ${instrument}`);

    var bufferId = instrument + 'x' + noteId;

    console.log(`bufferId: ${bufferId}`);

    var buffer = audioBuffers[bufferId];
    if (!buffer) {
      console.error('no buffer', arguments);

      return;
    }

    var source = midiAudioContext.createBufferSource();

    source.buffer = buffer;

    console.log(`note duration: ${source.buffer.duration}`);

    var gain = (velocity / 127) * (volume / 127) * 2 - 1;

    console.log(`gain: ${gain}`);

    source.connect(midiAudioContext.destination);
    source.playbackRate.value = 1;
    source.gainNode = midiAudioContext.createGain();
    source.gainNode.connect(midiAudioContext.destination);
    source.gainNode.gain.value = Math.min(1.0, Math.max(-1.0, gain));
    source.connect(source.gainNode);

    source.start();

    sources[channelId + 'x' + noteId] = source;

    return source;
  };

  midi.connect = function() {
    // TODO WFH This is insane.
    for (var key in midi) {
      console.log(key);
      MIDI[key] = midi[key];
    }

    midiAudioContext = new window.AudioContext();

    var keyURLs = [];
    var notes = keyToNote;
    for (var key in notes) {
      keyURLs.push(key);
    }

    function waitForEnd(instrument) {
      for (var key in bufferPending) { // has pending items
        if (bufferPending[key]) {
          return;
        }
      }
    };

    function requestAudio(soundfont, programId, index, key) {
      var keyURL = soundfont[key];
      if (!keyURL) {
        return;
      }

      bufferPending[programId] ++;

      var base64 = keyURL.split(',')[1];
      var buffer = Base64Binary.decodeArrayBuffer(base64);

      midiAudioContext.decodeAudioData(buffer).then((decodedBuffer) => {
        decodedBuffer.id = key;
        var noteId = keyToNote[key];
        audioBuffers[programId + 'x' + noteId] = decodedBuffer;

        if (--bufferPending[programId] === 0) {
          soundfont.isLoaded = true;
          waitForEnd(instrument);
        }
      }).catch(() => {
        console.error('audio could not load', arguments);
      });
    };

    var bufferPending = {};

    var soundfonts = MIDI.Soundfont;

    for (var instrument in soundfonts) {
      var soundfont = soundfonts[instrument];
      if (soundfont.isLoaded) {
        continue;
      }

      bufferPending[spec.program] = 0;

      for (var index = 0; index < keyURLs.length; index++) {
        requestAudio(soundfont, spec.program, index, keyURLs[index]);
      }
    }

    setTimeout(waitForEnd, 1);
  };

  return midi;
})();

export default {
    MIDI,
};
