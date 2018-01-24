import base64js from 'base64-js';

var Base64Binary = {
	_keyStr : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

	/* will return a  Uint8Array type */
	decodeArrayBuffer: function(input) {
		var bytes = Math.ceil( (3*input.length) / 4.0);
		var ab = new ArrayBuffer(bytes);

		this.decode(input, ab);

		return ab;
	},

	decode: function(input, arrayBuffer) {
		//get last chars to see if are valid
		var lkey1 = this._keyStr.indexOf(input.charAt(input.length-1));
		var lkey2 = this._keyStr.indexOf(input.charAt(input.length-1));

		var bytes = Math.ceil( (3*input.length) / 4.0);
		if (lkey1 == 64) bytes--; //padding chars, so skip
		if (lkey2 == 64) bytes--; //padding chars, so skip

		var uarray;
		var chr1, chr2, chr3;
		var enc1, enc2, enc3, enc4;
		var i = 0;
		var j = 0;

		if (arrayBuffer)
			uarray = new Uint8Array(arrayBuffer);
		else
			uarray = new Uint8Array(bytes);

		input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

		for (i=0; i<bytes; i+=3) {
			//get the 3 octects in 4 ascii chars
			enc1 = this._keyStr.indexOf(input.charAt(j++));
			enc2 = this._keyStr.indexOf(input.charAt(j++));
			enc3 = this._keyStr.indexOf(input.charAt(j++));
			enc4 = this._keyStr.indexOf(input.charAt(j++));

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
	var isFunction = function (f) {
		return Object.prototype.toString.call(f) === "[object Function]" ||
			Object.prototype.toString.call(f) === "[object AudioContextConstructor]";
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
	///
	if (!isFunction(Context)) {
		return;
	}
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
			if (isFunction(this[name1])) {
				this[names.pop()] = this[name1];
			} else {
				name2 = names.pop();
				this[name1] = this[name2];
			}
		}
	}, proto);
})(window.AudioContext);

let MIDI;
if (typeof MIDI === 'undefined') {
	MIDI = window.MIDI = {};
}

(function(root) { 'use strict';

	var supports = {}; // object of supported file types
	var pending = 0; // pending file types to process
	///
	function canPlayThrough(src) { // check whether format plays through
		pending ++;
		///
		var body = document.body;
		var audio = new Audio();
		var mime = src.split(';')[0];
		audio.id = 'audio';
		audio.setAttribute('preload', 'auto');
		audio.setAttribute('audiobuffer', true);
		audio.addEventListener('error', function() {
			body.removeChild(audio);
			supports[mime] = false;
			pending --;
		}, false);
		audio.addEventListener('canplaythrough', function() {
			body.removeChild(audio);
			supports[mime] = true;
			pending --;
		}, false);
		audio.src = 'data:' + src;
		body.appendChild(audio);
	};

	root.audioDetect = function(onsuccess) {

		/// detect midi plugin
		if (navigator.requestMIDIAccess) {
			var toString = Function.prototype.toString;
			var isNative = toString.call(navigator.requestMIDIAccess).indexOf('[native code]') !== -1;
			if (isNative) { // has native midi support
				supports['webmidi'] = true;
			} else { // check for jazz plugin support
				for (var n = 0; navigator.plugins.length > n; n ++) {
					var plugin = navigator.plugins[n];
					if (plugin.name.indexOf('Jazz-Plugin') >= 0) {
						supports['webmidi'] = true;
					}
				}
			}
		}

		/// check whether <audio> tag is supported
		if (typeof Audio === 'undefined') {
			onsuccess(supports);
			return;
		} else {
			supports['audiotag'] = true;

			/// check for webaudio api support
			if (window.AudioContext || window.webkitAudioContext) {
				supports['webaudio'] = true;
			}

			/// check whether canPlayType is supported
			var audio = new Audio();
			if (audio.canPlayType) {

				/// see what we can learn from the browser
				var vorbis = audio.canPlayType('audio/ogg; codecs="vorbis"');
				vorbis = (vorbis === 'probably' || vorbis === 'maybe');
				var mpeg = audio.canPlayType('audio/mpeg');
				mpeg = (mpeg === 'probably' || mpeg === 'maybe');

				// maybe nothing is supported
				if (!vorbis && !mpeg) {
					onsuccess(supports);
					return;
				}

				/// or maybe something is supported
				if (vorbis) canPlayThrough('audio/ogg;base64,T2dnUwACAAAAAAAAAADqnjMlAAAAAOyyzPIBHgF2b3JiaXMAAAAAAUAfAABAHwAAQB8AAEAfAACZAU9nZ1MAAAAAAAAAAAAA6p4zJQEAAAANJGeqCj3//////////5ADdm9yYmlzLQAAAFhpcGguT3JnIGxpYlZvcmJpcyBJIDIwMTAxMTAxIChTY2hhdWZlbnVnZ2V0KQAAAAABBXZvcmJpcw9CQ1YBAAABAAxSFCElGVNKYwiVUlIpBR1jUFtHHWPUOUYhZBBTiEkZpXtPKpVYSsgRUlgpRR1TTFNJlVKWKUUdYxRTSCFT1jFloXMUS4ZJCSVsTa50FkvomWOWMUYdY85aSp1j1jFFHWNSUkmhcxg6ZiVkFDpGxehifDA6laJCKL7H3lLpLYWKW4q91xpT6y2EGEtpwQhhc+211dxKasUYY4wxxsXiUyiC0JBVAAABAABABAFCQ1YBAAoAAMJQDEVRgNCQVQBABgCAABRFcRTHcRxHkiTLAkJDVgEAQAAAAgAAKI7hKJIjSZJkWZZlWZameZaouaov+64u667t6roOhIasBACAAAAYRqF1TCqDEEPKQ4QUY9AzoxBDDEzGHGNONKQMMogzxZAyiFssLqgQBKEhKwKAKAAAwBjEGGIMOeekZFIi55iUTkoDnaPUUcoolRRLjBmlEluJMYLOUeooZZRCjKXFjFKJscRUAABAgAMAQICFUGjIigAgCgCAMAYphZRCjCnmFHOIMeUcgwwxxiBkzinoGJNOSuWck85JiRhjzjEHlXNOSuekctBJyaQTAAAQ4AAAEGAhFBqyIgCIEwAwSJKmWZomipamiaJniqrqiaKqWp5nmp5pqqpnmqpqqqrrmqrqypbnmaZnmqrqmaaqiqbquqaquq6nqrZsuqoum65q267s+rZru77uqapsm6or66bqyrrqyrbuurbtS56nqqKquq5nqq6ruq5uq65r25pqyq6purJtuq4tu7Js664s67pmqq5suqotm64s667s2rYqy7ovuq5uq7Ks+6os+75s67ru2rrwi65r66os674qy74x27bwy7ouHJMnqqqnqq7rmarrqq5r26rr2rqmmq5suq4tm6or26os67Yry7aumaosm64r26bryrIqy77vyrJui67r66Ys67oqy8Lu6roxzLat+6Lr6roqy7qvyrKuu7ru+7JuC7umqrpuyrKvm7Ks+7auC8us27oxuq7vq7It/KosC7+u+8Iy6z5jdF1fV21ZGFbZ9n3d95Vj1nVhWW1b+V1bZ7y+bgy7bvzKrQvLstq2scy6rSyvrxvDLux8W/iVmqratum6um7Ksq/Lui60dd1XRtf1fdW2fV+VZd+3hV9pG8OwjK6r+6os68Jry8ov67qw7MIvLKttK7+r68ow27qw3L6wLL/uC8uq277v6rrStXVluX2fsSu38QsAABhwAAAIMKEMFBqyIgCIEwBAEHIOKQahYgpCCKGkEEIqFWNSMuakZM5JKaWUFEpJrWJMSuaclMwxKaGUlkopqYRSWiqlxBRKaS2l1mJKqcVQSmulpNZKSa2llGJMrcUYMSYlc05K5pyUklJrJZXWMucoZQ5K6iCklEoqraTUYuacpA46Kx2E1EoqMZWUYgupxFZKaq2kFGMrMdXUWo4hpRhLSrGVlFptMdXWWqs1YkxK5pyUzDkqJaXWSiqtZc5J6iC01DkoqaTUYiopxco5SR2ElDLIqJSUWiupxBJSia20FGMpqcXUYq4pxRZDSS2WlFosqcTWYoy1tVRTJ6XFklKMJZUYW6y5ttZqDKXEVkqLsaSUW2sx1xZjjqGkFksrsZWUWmy15dhayzW1VGNKrdYWY40x5ZRrrT2n1mJNMdXaWqy51ZZbzLXnTkprpZQWS0oxttZijTHmHEppraQUWykpxtZara3FXEMpsZXSWiypxNhirLXFVmNqrcYWW62ltVprrb3GVlsurdXcYqw9tZRrrLXmWFNtBQAADDgAAASYUAYKDVkJAEQBAADGMMYYhEYpx5yT0ijlnHNSKucghJBS5hyEEFLKnINQSkuZcxBKSSmUklJqrYVSUmqttQIAAAocAAACbNCUWByg0JCVAEAqAIDBcTRNFFXVdX1fsSxRVFXXlW3jVyxNFFVVdm1b+DVRVFXXtW3bFn5NFFVVdmXZtoWiqrqybduybgvDqKqua9uybeuorqvbuq3bui9UXVmWbVu3dR3XtnXd9nVd+Bmzbeu2buu+8CMMR9/4IeTj+3RCCAAAT3AAACqwYXWEk6KxwEJDVgIAGQAAgDFKGYUYM0gxphhjTDHGmAAAgAEHAIAAE8pAoSErAoAoAADAOeecc84555xzzjnnnHPOOeecc44xxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY0wAwE6EA8BOhIVQaMhKACAcAABACCEpKaWUUkoRU85BSSmllFKqFIOMSkoppZRSpBR1lFJKKaWUIqWgpJJSSimllElJKaWUUkoppYw6SimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaVUSimllFJKKaWUUkoppRQAYPLgAACVYOMMK0lnhaPBhYasBAByAwAAhRiDEEJpraRUUkolVc5BKCWUlEpKKZWUUqqYgxBKKqmlklJKKbXSQSihlFBKKSWUUkooJYQQSgmhlFRCK6mEUkoHoYQSQimhhFRKKSWUzkEoIYUOQkmllNRCSB10VFIpIZVSSiklpZQ6CKGUklJLLZVSWkqpdBJSKamV1FJqqbWSUgmhpFZKSSWl0lpJJbUSSkklpZRSSymFVFJJJYSSUioltZZaSqm11lJIqZWUUkqppdRSSiWlkEpKqZSSUmollZRSaiGVlEpJKaTUSimlpFRCSamlUlpKLbWUSkmptFRSSaWUlEpJKaVSSksppRJKSqmllFpJKYWSUkoplZJSSyW1VEoKJaWUUkmptJRSSymVklIBAEAHDgAAAUZUWoidZlx5BI4oZJiAAgAAQABAgAkgMEBQMApBgDACAQAAAADAAAAfAABHARAR0ZzBAUKCwgJDg8MDAAAAAAAAAAAAAACAT2dnUwAEAAAAAAAAAADqnjMlAgAAADzQPmcBAQA=');
				if (mpeg) canPlayThrough('audio/mpeg;base64,/+MYxAAAAANIAUAAAASEEB/jwOFM/0MM/90b/+RhST//w4NFwOjf///PZu////9lns5GFDv//l9GlUIEEIAAAgIg8Ir/JGq3/+MYxDsLIj5QMYcoAP0dv9HIjUcH//yYSg+CIbkGP//8w0bLVjUP///3Z0x5QCAv/yLjwtGKTEFNRTMuOTeqqqqqqqqqqqqq/+MYxEkNmdJkUYc4AKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq');

				/// lets find out!
				var startTime = Date.now();
				var interval = setInterval(function() {
					var maxExecution = Date.now() - startTime > 5000;
					if (!pending || maxExecution) {
						clearInterval(interval);
						onsuccess(supports);
					}
				}, 1);
			} else {
				onsuccess(supports);
				return;
			}
		}
	};

})(MIDI);

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

	MIDI.getProgram = function(channelId) {
		return getParam('program', channelId);
	};

	MIDI.programChange = function(channelId, program, delay) {
		var spec = GM.getProgramSpec(program);
		if (spec && isFinite(program = spec.program)) {
			setParam('program', channelId, program, delay);
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

	MIDI.getOmni = function(channelId) {
		return getParam('omni', channelId);
	};

	MIDI.setOmni = function(channelId, truthy, delay) {
		if (isFinite(truthy)) {
			setParam('omni', channelId, truthy, delay);
		}
	};

	MIDI.getSolo = function(channelId) {
		return getParam('solo', channelId);
	};

	MIDI.setSolo = function(channelId, truthy, delay) {
		if (isFinite(truthy)) {
			setParam('solo', channelId, truthy, delay);
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
		if (console && console.error) {
			console.error(type, args);
		}
	};

})(MIDI);

if (typeof MIDI === 'undefined') MIDI = {};

MIDI.Soundfont = MIDI.Soundfont || {};
MIDI.player = MIDI.player || {};

(function(MIDI) { 'use strict';

	if (typeof console !== 'undefined' && console.log) {
		console.log('%câ™¥ MIDI.js 0.4.2 â™¥', 'color: red;');
	}

	MIDI.DEBUG = true;
	MIDI.soundfontUrl = './soundfont/';

	/*
	 * opts{}
	 * onsuccess
	 * onerror
	 * onprogress
	 */
	MIDI.loadPlugin = function(opts = {}, onsuccess, onerror, onprogress) {
		opts.api = opts.api || MIDI.__api;

		function onDetect(supports) {
			var hash = location.hash;
			var api = '';

			/// use the most appropriate plugin if not specified
			if (supports[opts.api]) {
				api = opts.api;
			} else if (supports[hash.substr(1)]) {
				api = hash.substr(1);
			} else if (supports.webmidi) {
				api = 'webmidi';
			} else if (window.AudioContext) { // Chrome
				api = 'webaudio';
			} else if (window.Audio) { // Firefox
				api = 'audiotag';
			}

			if (connect[api]) {
				/// use audio/ogg when supported
				if (opts.audioFormat) {
					var audioFormat = opts.audioFormat;
				} else { // use best quality
					var audioFormat = supports['audio/ogg'] ? 'ogg' : 'mp3';
				}

				/// load the specified plugin
				MIDI.__api = api;
				MIDI.__audioFormat = audioFormat;
				MIDI.supports = supports;
				MIDI.loadProgram(opts);
			}
		};

		///
		if (opts.soundfontUrl) {
			MIDI.soundfontUrl = opts.soundfontUrl;
		}

		/// Detect the best type of audio to use
		if (MIDI.supports) {
			onDetect(MIDI.supports);
		} else {
			MIDI.audioDetect(onDetect);
		}
	};

	/*
		MIDI.loadProgram('banjo', onsuccess, onerror, onprogress);
		MIDI.loadProgram({
			instrument: 'banjo',
			onsuccess: function(){},
			onerror: function(){},
			onprogress: function(state, percent){}
		})
	*/

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

		return function(opts, onsuccess, onerror, onprogress) {
			opts = opts || {};
			if (typeof opts !== 'object') opts = {instrument: opts};
			if (onerror) opts.onerror = onerror;
			if (onprogress) opts.onprogress = onprogress;
			if (onsuccess) opts.onsuccess = onsuccess;
			///
			opts.format = MIDI.__audioFormat;
			opts.instruments = asList(opts);
			///
			connect[MIDI.__api](opts);
		};
	})();

	var connect = {
		webmidi: function(opts) {
			// cant wait for this to be standardized!
			MIDI.WebMIDI.connect(opts);
		},
		audiotag: function(opts) {
			// works ok, kinda like a drunken tuna fish, across the board
			// http://caniuse.com/audio
			requestQueue(opts, 'AudioTag');
		},
		webaudio: function(opts) {
			// works awesome! safari, chrome and firefox support
			// http://caniuse.com/web-audio
			requestQueue(opts, 'WebAudio');
		}
	};

	function requestQueue(opts, context) {
		var audioFormat = opts.format;
		var instruments = opts.instruments;
		var onprogress = opts.onprogress;
		var onerror = opts.onerror;
		///
		var length = instruments.length;
		var pending = length;
		///
		function onEnd() {
			onprogress && onprogress('load', 1.0);
			MIDI[context].connect(opts);
		};
		///
		if (length) {
			for (var i = 0; i < length; i ++) {
				var programId = instruments[i];
				if (MIDI.Soundfont[programId]) { // already loaded
					!--pending && onEnd();
				} else { // needs to be requested
					sendRequest(instruments[i], audioFormat, function() {
						!--pending && onEnd();
					}, onerror);
				}
			}
		} else {
			onEnd();
		}
	};

	function sendRequest(programId, audioFormat, onsuccess, onerror) {
		const url = `${MIDI.soundfontUrl}${programId}-${audioFormat}.js`;

		fetch(url).then(function (res) {
			let script = document.createElement('script');
			script.language = 'javascript';
			script.type = 'text/javascript';
			res.text().then((text) => {
				script.text = text;
				document.body.appendChild(script);

				onsuccess();
			});
		}).catch(function (e) {
			if (onerror) {
				onerror();
			}

			console.log(e);
		});
	};

	MIDI.setDefaultPlugin = function(midi) {
		for (var key in midi) {
			MIDI[key] = midi[key];
		}
	};

})(MIDI);

(function(MIDI) { 'use strict';

	window.Audio && (function() {
		var midi = MIDI.AudioTag = { api: 'audiotag' };
		var noteToKey = {};
		var volume = 127; // floating point
		var buffer_nid = -1; // current channel
		var audioBuffers = []; // the audio channels
		var notesOn = []; // instrumentId + noteId that is currently playing in each 'channel', for routing noteOff/chordOff calls
		var notes = {}; // the piano keys
		for (var nid = 0; nid < 12; nid ++) {
			audioBuffers[nid] = new Audio();
		}

		function playChannel(channel, note) {
			if (!MIDI.channels[channel]) return;
			var instrument = MIDI.channels[channel].program;
			var instrumentId = MIDI.GM.byId[instrument].id;
			var note = notes[note];
			if (note) {
				var instrumentNoteId = instrumentId + '' + note.id;
				var nid = (buffer_nid + 1) % audioBuffers.length;
				var audio = audioBuffers[nid];
				notesOn[ nid ] = instrumentNoteId;
				if (!MIDI.Soundfont[instrumentId]) {
					MIDI.DEBUG && console.log('404', instrumentId);
					return;
				}
				audio.src = MIDI.Soundfont[instrumentId][note.id];
				audio.volume = volume / 127;
				audio.play();
				buffer_nid = nid;
			}
		};

		function stopChannel(channel, note) {
			if (!MIDI.channels[channel]) return;
			var instrument = MIDI.channels[channel].program;
			var instrumentId = MIDI.GM.byId[instrument].id;
			var note = notes[note];
			if (note) {
				var instrumentNoteId = instrumentId + '' + note.id;
				for (var i = 0, len = audioBuffers.length; i < len; i++) {
				    var nid = (i + buffer_nid + 1) % len;
				    var cId = notesOn[nid];
				    if (cId && cId == instrumentNoteId) {
				        audioBuffers[nid].pause();
				        notesOn[nid] = null;
				        return;
				    }
				}
			}
		};
		///
		midi.audioBuffers = audioBuffers;
		midi.messageHandler = {};
		///
		midi.send = function(data, delay) { };
		midi.setController = function(channel, type, value, delay) { };
		midi.setVolume = function(channel, n) {
			volume = n; //- should be channel specific volume
		};

		midi.pitchBend = function(channel, program, delay) { };

		midi.noteOn = function(channel, note, velocity, delay) {
			var id = noteToKey[note];
			if (notes[id]) {
				if (delay) {
					return setTimeout(function() {
						playChannel(channel, id);
					}, delay * 1000);
				} else {
					playChannel(channel, id);
				}
			}
		};

		midi.noteOff = function(channel, note, delay) {
// 			var id = noteToKey[note];
// 			if (notes[id]) {
// 				if (delay) {
// 					return setTimeout(function() {
// 						stopChannel(channel, id);
// 					}, delay * 1000)
// 				} else {
// 					stopChannel(channel, id);
// 				}
// 			}
		};

		midi.chordOn = function(channel, chord, velocity, delay) {
			for (var idx = 0; idx < chord.length; idx ++) {
				var n = chord[idx];
				var id = noteToKey[n];
				if (notes[id]) {
					if (delay) {
						return setTimeout(function() {
							playChannel(channel, id);
						}, delay * 1000);
					} else {
						playChannel(channel, id);
					}
				}
			}
		};

		midi.chordOff = function(channel, chord, delay) {
			for (var idx = 0; idx < chord.length; idx ++) {
				var n = chord[idx];
				var id = noteToKey[n];
				if (notes[id]) {
					if (delay) {
						return setTimeout(function() {
							stopChannel(channel, id);
						}, delay * 1000);
					} else {
						stopChannel(channel, id);
					}
				}
			}
		};

		midi.stopAllNotes = function() {
			for (var nid = 0, length = audioBuffers.length; nid < length; nid++) {
				audioBuffers[nid].pause();
			}
		};

		midi.connect = function(opts) {
			MIDI.setDefaultPlugin(midi);
			///
			for (var key in MIDI.keyToNote) {
				noteToKey[MIDI.keyToNote[key]] = key;
				notes[key] = {id: key};
			}
			///
			opts.onsuccess && opts.onsuccess();
		};
	})();

})(MIDI);

(function(MIDI) { 'use strict';

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
			if (buffer) {
				/// convert relative delay to absolute delay
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
				///
				sources[channelId + 'x' + noteId] = source;
				///
				return source;
			} else {
				MIDI.handleError('no buffer', arguments);
			}
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

		midi.chordOn = function(channel, chord, velocity, delay) {
			var res = {};
			for (var n = 0, note, len = chord.length; n < len; n++) {
				res[note = chord[n]] = midi.noteOn(channel, note, velocity, delay);
			}
			return res;
		};

		midi.chordOff = function(channel, chord, delay) {
			var res = {};
			for (var n = 0, note, len = chord.length; n < len; n++) {
				res[note = chord[n]] = midi.noteOff(channel, note, delay);
			}
			return res;
		};

		midi.stopAllNotes = function() {
			for (var sid in sources) {
				var delay = 0;
				if (delay < ctx.currentTime) {
					delay += ctx.currentTime;
				}
				var source = sources[sid];
				source.gain.linearRampToValueAtTime(1, delay);
				source.gain.linearRampToValueAtTime(0, delay + 0.3);
				if (source.noteOff) { // old api
					source.noteOff(delay + 0.3);
				} else { // new api
					source.stop(delay + 0.3);
				}
				delete sources[sid];
			}
		};

		midi.setEffects = function(list) {
			if (ctx.tunajs) {
				for (var n = 0; n < list.length; n ++) {
					var data = list[n];
					var effect = new ctx.tunajs[data.type](data);
					effect.connect(ctx.destination);
					effects[data.type] = effect;
				}
			} else {
				MIDI.handleError('effects not installed.', arguments);
				return;
			}
		};

		midi.connect = function(opts) {
			MIDI.setDefaultPlugin(midi);
			midi.setContext(ctx || createAudioContext(), opts.onsuccess);
		};

		midi.getContext = function() {
			return ctx;
		};

		midi.setContext = function(newCtx, onsuccess, onprogress, onerror) {
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
				if (url) {
					bufferPending[programId] ++;
					loadAudio(url, function(buffer) {
						buffer.id = key;
						var noteId = MIDI.keyToNote[key];
						audioBuffers[programId + 'x' + noteId] = buffer;
						///
						if (--bufferPending[programId] === 0) {
							var percent = index / 87;
							soundfont.isLoaded = true;
							MIDI.DEBUG && console.log('loaded: ', instrument);
							waitForEnd(instrument);
						}
					}, function() {
						MIDI.handleError('audio could not load', arguments);
					});
				}
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


		/* Load audio file: streaming | base64 | arraybuffer
		---------------------------------------------------------------------- */
		function loadAudio(url, onsuccess, onerror) {
			if (useStreamingBuffer) {
				var audio = new Audio();
				audio.src = url;
				audio.controls = false;
				audio.autoplay = false;
				audio.preload = false;
				audio.addEventListener('canplay', function() {
					onsuccess && onsuccess(audio);
				});
				audio.addEventListener('error', function(err) {
					onerror && onerror(err);
				});
				document.body.appendChild(audio);
			} else if (url.indexOf('data:audio') === 0) { // Base64 string
				var base64 = url.split(',')[1];
				var buffer = Base64Binary.decodeArrayBuffer(base64);
				ctx.decodeAudioData(buffer, onsuccess, onerror);
			} else { // XMLHTTP buffer
				var request = new XMLHttpRequest();
				request.open('GET', url, true);
				request.responseType = 'arraybuffer';
				request.onload = function() {
					ctx.decodeAudioData(request.response, onsuccess, onerror);
				};
				request.send();
			}
		};

		function createAudioContext() {
			return new (window.AudioContext || window.webkitAudioContext)();
		};
	})();
})(MIDI);

/*
	----------------------------------------------------------------------
	Web MIDI API - Native Soundbanks
	----------------------------------------------------------------------
	http://webaudio.github.io/web-midi-api/
	----------------------------------------------------------------------
*/

(function(MIDI) { 'use strict';

	var output = null;
	var channels = [];
	var midi = MIDI.WebMIDI = {api: 'webmidi'};

	midi.messageHandler = {};
	midi.messageHandler.program = function(channelId, program, delay) { // change patch (instrument)
		output.send([0xC0 + channelId, program], delay * 1000);
	};

	midi.send = function(data, delay) {
		output.send(data, delay * 1000);
	};

	midi.setController = function(channelId, type, value, delay) {
		output.send([channelId, type, value], delay * 1000);
	};

	midi.setVolume = function(channelId, volume, delay) { // set channel volume
		output.send([0xB0 + channelId, 0x07, volume], delay * 1000);
	};

	midi.pitchBend = function(channelId, program, delay) { // pitch bend
		output.send([0xE0 + channelId, program], delay * 1000);
	};

	midi.noteOn = function(channelId, note, velocity, delay) {
		output.send([0x90 + channelId, note, velocity], delay * 1000);
	};

	midi.noteOff = function(channelId, note, delay) {
		output.send([0x80 + channelId, note, 0], delay * 1000);
	};

	midi.chordOn = function(channelId, chord, velocity, delay) {
		for (var n = 0; n < chord.length; n ++) {
			var note = chord[n];
			output.send([0x90 + channelId, note, velocity], delay * 1000);
		}
	};

	midi.chordOff = function(channelId, chord, delay) {
		for (var n = 0; n < chord.length; n ++) {
			var note = chord[n];
			output.send([0x80 + channelId, note, 0], delay * 1000);
		}
	};

	midi.stopAllNotes = function() {
		output.cancel();
		for (var channelId = 0; channelId < 16; channelId ++) {
			output.send([0xB0 + channelId, 0x7B, 0]);
		}
	};

	midi.connect = function(opts) {
		var onsuccess = opts.onsuccess;
		var onerror = opts.onerror;
		///
		MIDI.setDefaultPlugin(midi);
		///
		function errFunction(err) { // well at least we tried!
			onerror && onerror(err);
			///
			if (window.AudioContext) { // Chrome
				opts.api = 'webaudio';
			} else if (window.Audio) { // Firefox
				opts.api = 'audiotag';
			} else { // no support
				return;
			}
			///
			MIDI.loadPlugin(opts);
		};
		///
		navigator.requestMIDIAccess().then(function(access) {
			var pluginOutputs = access.outputs;
			if (typeof pluginOutputs == 'function') { // Chrome pre-43
				output = pluginOutputs()[0];
			} else { // Chrome post-43
				output = pluginOutputs[0];
			}
			if (output === undefined) { // no outputs
				errFunction();
			} else {
				onsuccess && onsuccess();
			}
		}, onerror);
	};

})(MIDI);
