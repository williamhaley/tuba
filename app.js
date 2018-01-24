import base64js from 'base64-js';

var Base64Binary = {
	_keyStr : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

	/* will return a  Uint8Array type */
	decodeArrayBuffer: function(base64String) {
		// TODO WFH What is this?
		// Seems like we're estimating the size of the buffer?
		let bytes = Math.ceil((3 * base64String.length) / 4.0);

		let arrayBuffer = new ArrayBuffer(bytes);

		this.decode(base64String, arrayBuffer);

		return arrayBuffer;
	},

	decode: function(base64String, arrayBuffer) {
		//get last chars to see if are valid
		var lkey1 = this._keyStr.indexOf(base64String.charAt(base64String.length-1));
		var lkey2 = this._keyStr.indexOf(base64String.charAt(base64String.length-1));

		var bytes = Math.ceil((3 * base64String.length) / 4.0);
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

window.AudioContext = window.AudioContext || window.webkitAudioContext || null;
window.OfflineAudioContext = window.OfflineAudioContext || window.webkitOfflineAudioContext || null;

let MIDI = window.MIDI = {};
MIDI.Soundfont = MIDI.Soundfont || {};
MIDI.player = MIDI.player || {};

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
		var name1;
		var name2;
		while (names.length) {
			name1 = names.pop();
			this[names.pop()] = this[name1];
		}
	}, proto);
})(window.AudioContext);

function asId(name) {
	return name.replace(/[^a-z0-9_ ]/gi, '').replace(/[ ]/g, '_').toLowerCase();
};

var GM = (function(arr) {
	var res = {};
	var byCategory = res.byCategory = {};
	var byId = res.byId = {};
	var byName = res.byName = {};
	///
	for (var key in arr) {
		var list = arr[key];
		for (var n = 0, length = list.length; n < length; n++) {
			var instrument = list[n];
			if (instrument) {
				var id = parseInt(instrument.substr(0, instrument.indexOf(' ')), 10);
				var name = instrument.replace(id + ' ', '');
				var nameId = asId(name);
				var categoryId = asId(key);
				///
				var spec = {
					id: nameId,
					name: name,
					program: --id,
					category: key
				};
				///
				byId[id] = spec;
				byName[nameId] = spec;
				byCategory[categoryId] = byCategory[categoryId] || [];
				byCategory[categoryId].push(spec);
			}
		}
	}
	return res;
})({
	'Piano': ['1 Acoustic Grand Piano', '2 Bright Acoustic Piano', '3 Electric Grand Piano', '4 Honky-tonk Piano', '5 Electric Piano 1', '6 Electric Piano 2', '7 Harpsichord', '8 Clavinet'],
	'Chromatic Percussion': ['9 Celesta', '10 Glockenspiel', '11 Music Box', '12 Vibraphone', '13 Marimba', '14 Xylophone', '15 Tubular Bells', '16 Dulcimer'],
	'Organ': ['17 Drawbar Organ', '18 Percussive Organ', '19 Rock Organ', '20 Church Organ', '21 Reed Organ', '22 Accordion', '23 Harmonica', '24 Tango Accordion'],
	'Guitar': ['25 Acoustic Guitar (nylon)', '26 Acoustic Guitar (steel)', '27 Electric Guitar (jazz)', '28 Electric Guitar (clean)', '29 Electric Guitar (muted)', '30 Overdriven Guitar', '31 Distortion Guitar', '32 Guitar Harmonics'],
	'Bass': ['33 Acoustic Bass', '34 Electric Bass (finger)', '35 Electric Bass (pick)', '36 Fretless Bass', '37 Slap Bass 1', '38 Slap Bass 2', '39 Synth Bass 1', '40 Synth Bass 2'],
	'Strings': ['41 Violin', '42 Viola', '43 Cello', '44 Contrabass', '45 Tremolo Strings', '46 Pizzicato Strings', '47 Orchestral Harp', '48 Timpani'],
	'Ensemble': ['49 String Ensemble 1', '50 String Ensemble 2', '51 Synth Strings 1', '52 Synth Strings 2', '53 Choir Aahs', '54 Voice Oohs', '55 Synth Choir', '56 Orchestra Hit'],
	'Brass': ['57 Trumpet', '58 Trombone', '59 Tuba', '60 Muted Trumpet', '61 French Horn', '62 Brass Section', '63 Synth Brass 1', '64 Synth Brass 2'],
	'Reed': ['65 Soprano Sax', '66 Alto Sax', '67 Tenor Sax', '68 Baritone Sax', '69 Oboe', '70 English Horn', '71 Bassoon', '72 Clarinet'],
	'Pipe': ['73 Piccolo', '74 Flute', '75 Recorder', '76 Pan Flute', '77 Blown Bottle', '78 Shakuhachi', '79 Whistle', '80 Ocarina'],
	'Synth Lead': ['81 Lead 1 (square)', '82 Lead 2 (sawtooth)', '83 Lead 3 (calliope)', '84 Lead 4 (chiff)', '85 Lead 5 (charang)', '86 Lead 6 (voice)', '87 Lead 7 (fifths)', '88 Lead 8 (bass + lead)'],
	'Synth Pad': ['89 Pad 1 (new age)', '90 Pad 2 (warm)', '91 Pad 3 (polysynth)', '92 Pad 4 (choir)', '93 Pad 5 (bowed)', '94 Pad 6 (metallic)', '95 Pad 7 (halo)', '96 Pad 8 (sweep)'],
	'Synth Effects': ['97 FX 1 (rain)', '98 FX 2 (soundtrack)', '99 FX 3 (crystal)', '100 FX 4 (atmosphere)', '101 FX 5 (brightness)', '102 FX 6 (goblins)', '103 FX 7 (echoes)', '104 FX 8 (sci-fi)'],
	'Ethnic': ['105 Sitar', '106 Banjo', '107 Shamisen', '108 Koto', '109 Kalimba', '110 Bagpipe', '111 Fiddle', '112 Shanai'],
	'Percussive': ['113 Tinkle Bell', '114 Agogo', '115 Steel Drums', '116 Woodblock', '117 Taiko Drum', '118 Melodic Tom', '119 Synth Drum'],
	'Sound effects': ['120 Reverse Cymbal', '121 Guitar Fret Noise', '122 Breath Noise', '123 Seashore', '124 Bird Tweet', '125 Telephone Ring', '126 Helicopter', '127 Applause', '128 Gunshot']
});

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

var channels = (function() {
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

MIDI.keyToNote = {}; // C8  == 108
MIDI.noteToKey = {}; // 108 ==  C8

(function() {
	var A0 = 0x15; // first note
	var C8 = 0x6C; // last note
	var number2key = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
	for (var n = A0; n <= C8; n++) {
		var octave = (n - 12) / 12 >> 0;
		var name = number2key[n % 12] + octave;
		MIDI.keyToNote[name] = n;
		MIDI.noteToKey[n] = name;
	}
})();

MIDI.channels = channels;
MIDI.GM = GM;

const API = 'webaudio'; // 'webmidi', 'audiotag'
const FORMAT = 'ogg';

MIDI.loadPlugin = function(opts = {}) {
	return new Promise((resolve) => {
		connect[API](opts);

		resolve();
	});
};

const connect = {
	webaudio: function(opts) {
		const context = 'WebAudio';

		if (MIDI.Soundfont[opts.instrument]) { // already loaded
			MIDI[context].connect(opts);

			return;
		}

		// needs to be requested
		sendRequest(opts.instrument, FORMAT).then(() => {
			MIDI[context].connect(opts);

		}).catch((e) => {
			console.error(e);
		});
	}
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

MIDI.setDefaultPlugin = function(midi) {
	for (var key in midi) {
		MIDI[key] = midi[key];
	}
};

window.AudioContext && (function() {
	var audioContext = null; // new AudioContext();
	var midi = MIDI.WebAudio = {api: 'webaudio'};
	var ctx; // audio context
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
		if (delay < ctx.currentTime) {
			delay += ctx.currentTime;
		}

		var source = ctx.createBufferSource();
		source.buffer = buffer;

		/// add gain + pitchShift
		var gain = (velocity / 127) * (masterVolume / 127) * 2 - 1;
		source.connect(ctx.destination);
		source.playbackRate.value = 1; // pitch shift
		source.gainNode = ctx.createGain(); // gain
		source.gainNode.connect(ctx.destination);
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
			if (delay < ctx.currentTime) {
				delay += ctx.currentTime;
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

	midi.connect = function(opts) {
		MIDI.setDefaultPlugin(midi);
		midi.setContext(createAudioContext(), opts);
	};

	midi.setContext = function(newCtx) {
		ctx = newCtx;

		/// loading audio files
		var urls = [];
		var notes = MIDI.keyToNote;
		for (var key in notes) {
			urls.push(key);
		}
		///
		function waitForEnd(instrument) {
			for (var key in bufferPending) { // has pending items
				if (bufferPending[key]) {
					return;
				}
			}
		};

		function requestAudio(soundfont, programId, index, key) {
			var url = soundfont[key];
			if (!url) {
				return;
			}

			bufferPending[programId] ++;

			loadAudio(url).then((buffer) => {
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

			var spec = MIDI.GM.byName[instrument];
			if (spec) {
				var programId = spec.program;
				///
				bufferPending[programId] = 0;
				///
				for (var index = 0; index < urls.length; index++) {
					var key = urls[index];
					requestAudio(soundfont, programId, index, key);
				}
			}
		}
		///
		setTimeout(waitForEnd, 1);
	};

	function loadAudio(url) {
		return new Promise((resolve, reject) => {
			console.log('loadAudio');

			var base64 = url.split(',')[1];
			var buffer = Base64Binary.decodeArrayBuffer(base64);
			ctx.decodeAudioData(buffer, resolve, reject);
		});
	};

	function createAudioContext() {
		return new (window.AudioContext || window.webkitAudioContext)();
	};
})();
