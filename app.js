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

(function (Context) {
	const isFunction = function (f) {
		return typeof f === 'function';
	};

	var contextMethods = [
		["createGainNode", "createGain"],
		["createDelayNode", "createDelay"],
		["createJavaScriptNode", "createScriptProcessor"]
	];
	///
	var proto;
	var instance;
	var sourceProto;

	instance = new Context();
	if (!instance.destination || !instance.sampleRate) {
		return;
	}
	proto = Context.prototype;
	sourceProto = Object.getPrototypeOf(instance.createBufferSource());

	if (!isFunction(sourceProto.start)) {
		if (isFunction(sourceProto.noteOn)) {
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

	if (!isFunction(sourceProto.noteOn)) {
		sourceProto.noteOn = sourceProto.start;
	}

	if (!isFunction(sourceProto.noteGrainOn)) {
		sourceProto.noteGrainOn = sourceProto.start;
	}

	if (!isFunction(sourceProto.stop)) {
		sourceProto.stop = sourceProto.noteOff;
	}

	if (!isFunction(sourceProto.noteOff)) {
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

let MIDI;
if (typeof MIDI === 'undefined') {
	MIDI = window.MIDI = {};
}

(function(MIDI) { 'use strict';

	function asId(name) {
		return name.replace(/[^a-z0-9_ ]/gi, '').
				    replace(/[ ]/g, '_').
				    toLowerCase();
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

	GM.getProgramSpec = function(program) {
		var spec;
		if (typeof program === 'string') {
			spec = GM.byName[asId(program)];
		} else {
			spec = GM.byId[program];
		}
		if (spec) {
			return spec;
		} else {
			MIDI.handleError('invalid program', arguments);
		}
	};

	MIDI.getMono = function(channelId) {
		return getParam('mono', channelId);
	};

	MIDI.setMono = function(channelId, truthy, delay) {
		if (isFinite(truthy)) {
			setParam('mono', channelId, truthy, delay);
		}
	};

	function getParam(param, channelId) {
		var channel = channels[channelId];
		if (channel) {
			return channel[param];
		}
	};

	function setParam(param, channelId, value, delay) {
		var channel = channels[channelId];
		if (channel) {
			if (delay) {
				setTimeout(function() { //- is there a better option?
					channel[param] = value;
				}, delay);
			} else {
				channel[param] = value;
			}
			///
			var wrapper = MIDI.messageHandler[param] || messageHandler[param];
			if (wrapper) {
				wrapper(channelId, value, delay);
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

	MIDI.messageHandler = {}; // overrides

	var messageHandler = { // defaults
		program: function(channelId, program, delay) {
			if (MIDI.__api) {
				if (MIDI.player.isPlaying) {
					MIDI.player.pause();
					MIDI.loadProgram(program, MIDI.player.play);
				} else {
					MIDI.loadProgram(program);
				}
			}
		}
	};

	MIDI.handleError = function(type, args) {
		console.error(type, args);
	};

})(MIDI);

if (typeof MIDI === 'undefined') MIDI = {};

MIDI.Soundfont = MIDI.Soundfont || {};
MIDI.player = MIDI.player || {};

(function(MIDI) {
	MIDI.loadPlugin = function(opts = {}) {
		opts.api = opts.api || MIDI.__api;

		return new Promise((resolve) => {
			const supports = {
				webmidi: true,
				audiotag: true,
				webaudio: true,
				'audio/ogg': true,
				'audio/mpeg': true,
			};

			const api = 'webaudio'; // 'webmidi', 'audiotag'

			if (connect[api]) {
				const audioFormat = 'ogg';

				/// load the specified plugin
				MIDI.__api = api;
				MIDI.__audioFormat = audioFormat;
				MIDI.supports = supports;
				MIDI.loadProgram(opts);
			}

			resolve();
		});
	};

	MIDI.loadProgram = (function() {

		function asList(opts) {
			var res = opts.instruments || opts.instrument || MIDI.channels[0].program;
			if (typeof res !== 'object') {
				if (res === undefined) {
					res = [];
				} else {
					res = [res];
				}
			}
			/// program number -> id
			for (var i = 0; i < res.length; i ++) {
				var instrument = res[i];
				if (instrument === +instrument) { // is numeric
					if (MIDI.GM.byId[instrument]) {
						res[i] = MIDI.GM.byId[instrument].id;
					}
				}
			}
			return res;
		};

		return function(opts, onsuccess, onerror) {
			opts = opts || {};
			if (typeof opts !== 'object') opts = {instrument: opts};
			if (onerror) opts.onerror = onerror;
			if (onsuccess) opts.onsuccess = onsuccess;
			///
			opts.format = MIDI.__audioFormat;
			opts.instruments = asList(opts);
			///
			connect[MIDI.__api](opts);
		};
	})();

	const connect = {
		webaudio: function(opts) {
			const context = 'WebAudio';

			var audioFormat = opts.format;
			var instruments = opts.instruments;
			var onerror = opts.onerror;
			var pending = instruments.length;

			function onEnd() {
				MIDI[context].connect(opts);
			};

			if (!instruments.length) {
				onEnd();
			}

			for (var i = 0; i < instruments.length; i ++) {
				var programId = instruments[i];
				if (MIDI.Soundfont[programId]) { // already loaded
					pending -= 1;

					if (pending === 0) {
						onEnd();
					}

					return;
				}

				// needs to be requested
				sendRequest(instruments[i], audioFormat).then(() => {
					pending -= 1;

					if (pending === 0) {
						onEnd();
					}
				}).catch((e) => {
					console.error(e);

					onerror();
				});
			}
		}
	};

	function sendRequest(programId, audioFormat) {
		const url = `./soundfont/${programId}-${audioFormat}.js`;

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

})(MIDI);

(function(MIDI) {

	window.AudioContext && (function() {

		var audioContext = null; // new AudioContext();
		var useStreamingBuffer = false; // !!audioContext.createMediaElementSource;
		var midi = MIDI.WebAudio = {api: 'webaudio'};
		var ctx; // audio context
		var sources = {};
		var effects = {};
		var masterVolume = 127;
		var audioBuffers = {};
		///
		midi.audioBuffers = audioBuffers;
		midi.messageHandler = {};
		///
		midi.send = function(data, delay) {

		};

		midi.setController = function(channelId, type, value, delay) {

		};

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
				MIDI.handleError('no buffer', arguments);

				return;
			}

			// convert relative delay to absolute delay
			if (delay < ctx.currentTime) {
				delay += ctx.currentTime;
			}

			/// create audio buffer
			if (useStreamingBuffer) {
				var source = ctx.createMediaElementSource(buffer);
			} else { // XMLHTTP buffer
				var source = ctx.createBufferSource();
				source.buffer = buffer;
			}

			/// add effects to buffer
			if (effects) {
				var chain = source;
				for (var key in effects) {
					chain.connect(effects[key].input);
					chain = effects[key];
				}
			}

			/// add gain + pitchShift
			var gain = (velocity / 127) * (masterVolume / 127) * 2 - 1;
			source.connect(ctx.destination);
			source.playbackRate.value = 1; // pitch shift
			source.gainNode = ctx.createGain(); // gain
			source.gainNode.connect(ctx.destination);
			source.gainNode.gain.value = Math.min(1.0, Math.max(-1.0, gain));
			source.connect(source.gainNode);
			///
			if (useStreamingBuffer) {
				if (delay) {
					return setTimeout(function() {
						buffer.currentTime = 0;
						buffer.play()
					}, delay * 1000);
				} else {
					buffer.currentTime = 0;
					buffer.play()
				}
			} else {
				source.start(delay || 0);
			}

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
					///
					if (useStreamingBuffer) {
						if (delay) {
							setTimeout(function() {
								buffer.pause();
							}, delay * 1000);
						} else {
							buffer.pause();
						}
					} else {
						if (source.noteOff) {
							source.noteOff(delay + 0.5);
						} else {
							source.stop(delay + 0.5);
						}
					}
					///
					delete sources[channelId + 'x' + noteId];
					///
					return source;
				}
			}
		};

		midi.connect = function(opts) {
			MIDI.setDefaultPlugin(midi);
			midi.setContext(ctx || createAudioContext(), opts.onsuccess);
		};

		midi.setContext = function(newCtx, onsuccess, onerror) {
			ctx = newCtx;

			/// tuna.js effects module - https://github.com/Dinahmoe/tuna
			if (typeof Tuna !== 'undefined') {
				if (!(ctx.tunajs instanceof Tuna)) {
					ctx.tunajs = new Tuna(ctx);
				}
			}

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
				if (onsuccess) { // run onsuccess once
					onsuccess();
					onsuccess = null;
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
					///
					if (--bufferPending[programId] === 0) {
						var percent = index / 87;
						soundfont.isLoaded = true;
						waitForEnd(instrument);
					}
				}).catch(() => {
					MIDI.handleError('audio could not load', arguments);
				});
			};
			///
			var bufferPending = {};
			var soundfonts = MIDI.Soundfont;
			for (var instrument in soundfonts) {
				var soundfont = soundfonts[instrument];
				if (soundfont.isLoaded) {
					continue;
				} else {
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
})(MIDI);
