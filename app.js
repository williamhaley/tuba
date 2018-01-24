import base64js from 'base64-js';

var Base64Binary = {
	_keyStr : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

	/* will return a  Uint8Array type */
	decodeArrayBuffer: function(base64String) {
		// TODO WFH What is this?
		// Seems like we're estimating the size of the buffer?
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

let MIDI = window.MIDI = { Soundfont: {} };

(function (Context) {
	var contextMethods = [
		["createGainNode", "createGain"],
		["createDelayNode", "createDelay"],
		["createJavaScriptNode", "createScriptProcessor"]
	];

	let proto = Context.prototype;
	let instance = new Context();
	let sourceProto = Object.getPrototypeOf(instance.createBufferSource());

	if (typeof sourceProto.start !== 'function') {
		if (typeof sourceProto.noteOn === 'function') {
			sourceProto.start = function (when, offset, duration) {
				switch (arguments.length) {
					case 0:
						throw new Error("Not enough arguments.");
					case 1:
						this.noteOn(when);
						break;
					case 2:
						if (this.buffer) {
							this.noteGrainOn(when, offset, this.buffer.duration - offset);
						} else {
							throw new Error("Missing AudioBuffer");
						}
						break;
					case 3:
						this.noteGrainOn(when, offset, duration);
				}
			};
		}
	}

	if (typeof sourceProto.noteOn !== 'function') {
		sourceProto.noteOn = sourceProto.start;
	}

	if (typeof sourceProto.noteGrainOn !== 'function') {
		sourceProto.noteGrainOn = sourceProto.start;
	}

	if (typeof sourceProto.stop !== 'function') {
		sourceProto.stop = sourceProto.noteOff;
	}

	if (typeof sourceProto.noteOff !== 'function') {
		sourceProto.noteOff = sourceProto.stop;
	}

	contextMethods.forEach(function (names) {
		while (names.length) {
			let name = names.pop();
			this[names.pop()] = this[name];
		}
	}, proto);
})(window.AudioContext);

MIDI.getMono = function(channelId) {
	var channel = channels[channelId];
	if (channel) {
		return channel['mono'];
	}
};

MIDI.setMono = function(channelId, truthy, delay) {
	if (!isFinite(truthy)) {
		return;
	}

	var channel = channels[channelId];
	if (channel) {
		if (delay) {
			setTimeout(function() { //- is there a better option?
				channel['mono'] = value;
			}, delay);
		} else {
			channel['mono'] = value;
		}
	}
};

MIDI.keyToNote = {}; // C8  == 108

(function() {
	var A0 = 0x15; // first note
	var C8 = 0x6C; // last note
	var number2key = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
	for (var n = A0; n <= C8; n++) {
		var octave = (n - 12) / 12 >> 0;
		var name = number2key[n % 12] + octave;
		MIDI.keyToNote[name] = n;
	}
})();

MIDI.channels = (function() {
	var res = {};
	for (var number = 0; number <= 15; number++) {
		res[number] = {
			number: number,
			program: number,
			pitchBend: 0,
			mute: false,
			mono: false,
			omni: false,
			solo: false
		};
	}
	return res;
})();

const API = 'webaudio'; // 'webmidi', 'audiotag'
const FORMAT = 'ogg';

MIDI.loadPlugin = function(opts = {}) {
	return new Promise((resolve) => {
		const context = 'WebAudio';

		if (MIDI.Soundfont[opts.instrument]) {
			MIDI[context].connect(opts);

			return resolve();
		}

		sendRequest(opts.instrument, FORMAT).then(() => {
			MIDI[context].connect(opts);
		}).catch((e) => {
			console.error(e);
		});

		resolve();
	});
};

function sendRequest(programId) {
	const url = `./soundfont/${programId}-${FORMAT}.js`;

	return new Promise((resolve, reject) => {
		fetch(url).then(function (res) {
			let script = document.createElement('script');
			script.language = 'javascript';
			script.type = 'text/javascript';
			res.text().then((text) => {
				script.text = text;
				document.body.appendChild(script);

				resolve();
			});
		}).catch(function (e) {
			reject();
		});
	});
};

(function() {
	var audioContext = null; // new AudioContext();
	var midi = MIDI.WebAudio = {api: 'webaudio'};
	var midiAudioContext; // audio context
	var sources = {};
	var masterVolume = 127;
	var audioBuffers = {};

	midi.audioBuffers = audioBuffers;

	midi.send = function(data, delay) { };

	midi.setController = function(channelId, type, value, delay) { };

	midi.setVolume = function(channelId, volume, delay) {
		if (delay) {
			setTimeout(function() {
				masterVolume = volume;
			}, delay * 1000);
		} else {
			masterVolume = volume;
		}
	};

	midi.pitchBend = function(channelId, bend, delay) {
		var channel = MIDI.channels[channelId];
		if (channel) {
			if (delay) {
				setTimeout(function() {
					channel.pitchBend = bend;
				}, delay);
			} else {
				channel.pitchBend = bend;
			}
		}
	};

	midi.noteOn = function(channelId, noteId, velocity, delay) {
		delay = delay || 0;

		/// check whether the note exists
		var channel = MIDI.channels[channelId];
		var instrument = channel.program;

		console.warn('overriding instrument id');
		instrument = 58;

		var bufferId = instrument + 'x' + noteId;

		console.log(`bufferId: ${bufferId}`);

		var buffer = audioBuffers[bufferId];
		if (!buffer) {
			console.error('no buffer', arguments);

			return;
		}

		// convert relative delay to absolute delay
		if (delay < midiAudioContext.currentTime) {
			delay += midiAudioContext.currentTime;
		}

		var source = midiAudioContext.createBufferSource();
		source.buffer = buffer;

		/// add gain + pitchShift
		var gain = (velocity / 127) * (masterVolume / 127) * 2 - 1;
		source.connect(midiAudioContext.destination);
		source.playbackRate.value = 1; // pitch shift
		source.gainNode = midiAudioContext.createGain(); // gain
		source.gainNode.connect(midiAudioContext.destination);
		source.gainNode.gain.value = Math.min(1.0, Math.max(-1.0, gain));
		source.connect(source.gainNode);
		source.start(delay || 0);

		sources[channelId + 'x' + noteId] = source;

		return source;
	};

	midi.noteOff = function(channelId, noteId, delay) {
		delay = delay || 0;

		/// check whether the note exists
		var channel = MIDI.channels[channelId];
		var instrument = channel.program;
		var bufferId = instrument + 'x' + noteId;
		var buffer = audioBuffers[bufferId];
		if (buffer) {
			if (delay < midiAudioContext.currentTime) {
				delay += midiAudioContext.currentTime;
			}
			///
			var source = sources[channelId + 'x' + noteId];
			if (source) {
				if (source.gainNode) {
					// @Miranet: 'the values of 0.2 and 0.3 could of course be used as
					// a 'release' parameter for ADSR like time settings.'
					// add { 'metadata': { release: 0.3 } } to soundfont files
					var gain = source.gainNode.gain;
					gain.linearRampToValueAtTime(gain.value, delay);
					gain.linearRampToValueAtTime(-1.0, delay + 0.3);
				}

				if (source.noteOff) {
					source.noteOff(delay + 0.5);
				} else {
					source.stop(delay + 0.5);
				}

				delete sources[channelId + 'x' + noteId];

				return source;
			}
		}
	};

	midi.connect = function() {
		// TODO WFH This is insane.
		for (var key in midi) {
			MIDI[key] = midi[key];
		}

		midiAudioContext = new window.AudioContext();

		var keyURLs = [];
		var notes = MIDI.keyToNote;
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

			loadAudio(keyURL).then((buffer) => {
				buffer.id = key;
				var noteId = MIDI.keyToNote[key];
				audioBuffers[programId + 'x' + noteId] = buffer;

				if (--bufferPending[programId] === 0) {
					soundfont.isLoaded = true;
					waitForEnd(instrument);
				}
			}).catch(() => {
				console.error('audio could not load', arguments);
			});
		};
		///
		var bufferPending = {};

		var soundfonts = MIDI.Soundfont;
		for (var instrument in soundfonts) {
			var soundfont = soundfonts[instrument];
			if (soundfont.isLoaded) {
				continue;
			}

			const spec = {
				id:      'tuba',
				name:    'Tuba',
				program:  58,
			};

			bufferPending[spec.program] = 0;

			for (var index = 0; index < keyURLs.length; index++) {
				requestAudio(soundfont, spec.program, index, keyURLs[index]);
			}
		}
		///
		setTimeout(waitForEnd, 1);
	};

	function loadAudio(url) {
		return new Promise((resolve, reject) => {
			var base64 = url.split(',')[1];
			var buffer = Base64Binary.decodeArrayBuffer(base64);
			midiAudioContext.decodeAudioData(buffer, resolve, reject);
		});
	};
})();
