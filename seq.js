const TICKS_IN_PATTERN = 16;
const TICKS_PER_BEAT = 4;

const GRACE_PERIOD = 0.1; // (secs) how long to wait after "play" pressed to start playing sounds.
const PROCESS_COOLDOWN = 0.1; // (secs) how often to process the sequence 
const WINDOW_OVERLAP = 0.05; // (secs) how far past the end of the expected sequence process window to include.

ko.bindingHandlers.analyser = (function(){

	var analysisNode = null;
	var data = new Float32Array(256);
	var target = null;
	var audioContext = null;

	var process = function() {

	};

	var init = function(element, valueAccessor) {
		var params = ko.unwrap(valueAccessor());
		console.log("init", element, params);
		target = params.target;
		audioContext = params.audioContext;
	};

	var update = function(element, valueAccessor) {
		
	}

	return {
		init: init,
		update: update
	}

})();

function Note(note, length, velocity) {

}

Note.notes = 'C C#D D#E F F#G G#A A#B '.split(
	/([A-G][# ])/
).filter(function(x) {
	return x.length
}).map(function(x){
	return x.trim();
});

Note.noteValues = Note.notes.reduce(function(memo, x,i) {
	memo[x] = i;
	return memo;
}, {});

Note.parse = function(noteString) {
	//C4 = 60
	//C-1 = 0
	var parsedNote = noteString.match(/([A-G]#?)(-?\d+)/);
	if (parsedNote === null) {
		throw new Error("Invalid note string: " + noteString);
	}
	var note = parsedNote[1];
	var octave = parseInt(parsedNote[2]);

	var value =
		Note.noteValues[note] +
		(octave+1) * Note.notes.length;

	return value;
}

Note.pitchToFreq = function(pitch) {
	return 440 * Math.pow(2, (pitch-69)/12);
}

function TickNote(noteName) {
	this.pitch = ko.observable( Note.parse(noteName) );
	this.on = ko.observable(false);
	this.onClick = function() {
		this.on(!this.on());
	}.bind(this);
}

function Tick() {
	this.notes = ko.observableArray([
		new TickNote("C6"),
		new TickNote("A#5"),
		new TickNote("G5"),
		new TickNote("F5"),
		new TickNote("D#5"),
		new TickNote("C5"),
		new TickNote("A#4"),
		new TickNote("G4"),
		new TickNote("F4"),
		new TickNote("D#4"),
		new TickNote("C4")
	]);
	this.current = ko.observable(false);
}

function Sequence(length) {
	this.ticks = new Array();
	while (this.ticks.length < TICKS_IN_PATTERN) {
		this.ticks.push( new Tick() );
	}

	this.currentTick = ko.observable(null); // "read only", updated by app
	this.currentTick.subscribe(this.onCurrentTickChanged, this);
}

Sequence.prototype.onCurrentTickChanged = function(currentTick) {
	if (currentTick === null || currentTick < 0) return;

	this.ticks.forEach(tick => tick.current(false));
	this.ticks[currentTick].current(true);
}

function Instrument(context) {
	this.a = context;
	this.synths = [];

	this.synths.push(this.a.createOscillator());
	this.synths.push(this.a.createOscillator());
	this.synths.push(this.a.createOscillator());

	this.synths.forEach((synth,i) => { 
		synth.type = 'sawtooth';
		synth.detune.value = (i-1)*(10+Math.random()*0.01);
	});

	this.filter = this.a.createBiquadFilter();
	this.filter.type = "lowpass";
	this.filter.Q.value = 1;
	this.filter.frequency.value = 44100;
	this.synths.forEach(synth => { 
		synth.connect(this.filter);
	});
	this.out = this.a.createGain();
	this.filter.connect(this.out);
	
	this.out.gain.value = 0;
	this.synths.forEach(synth => { 
		synth.start();
	});

	this.filterStart = 6000;
	this.filterEnd = 50;
	this.filterSpeed = 0.082;

	this.transpose = 0;
}
Instrument.prototype.note = function(pitch, time) {
	const freq = Note.pitchToFreq(pitch + this.transpose);

	this.synths.forEach(synth => { 
		synth.frequency.setTargetAtTime(freq, time, 0.005);
	});

	this.filter.frequency.setTargetAtTime(this.filterStart, time,        0.0005);
	this.filter.frequency.setTargetAtTime(this.filterEnd,   time + 0.02, this.filterSpeed);

	this.out.gain.setTargetAtTime(1.0, time,         0.002);
	this.out.gain.setTargetAtTime(0.0, time + 0.002, 0.3);
}

function SequencerApp() {
	this.sequence = new Sequence(TICKS_IN_PATTERN);
	this.playClicked = function() {
		if (this.playing()) {
			this.stop();
		} else {
			this.start();
		}
	}.bind(this);
 
	this.a = new AudioContext();
	this.out = this.a.createGain();

	this.out.connect(this.a.destination);

	this.instrument = new Instrument(this.a);
	this.instrument.out.connect(this.out);

	setInterval( this.process.bind(this), PROCESS_COOLDOWN * 1000 );

	this.playing = ko.observable(false);
	this.tempo = ko.observable(100);
	this.tickLength = ko.computed( () => 60 / this.tempo() / TICKS_PER_BEAT );
	this.startTime = this.a.currentTime;

	window.requestAnimationFrame(this.animate.bind(this));
}

SequencerApp.prototype.animate = function() {

	var currentTick;
	if (this.playing()) {
		currentTick = Math.floor(this.tickFromTime(this.a.currentTime) ) % TICKS_IN_PATTERN;
	} else {
		currentTick = null;
	}

	this.sequence.currentTick( currentTick );

	window.requestAnimationFrame(this.animate.bind(this));
}

SequencerApp.prototype.start = function() {
	this.playing(true);
	this.startTime = this.a.currentTime + GRACE_PERIOD;
	this.sequencedTo = this.a.currentTime;

	this.process();
}

SequencerApp.prototype.stop = function() {
	this.playing(false);
}

SequencerApp.prototype.tickFromTime = function(time) {
	return (time - this.startTime) / this.tickLength();
}

SequencerApp.prototype.timeFromTick = function(tick) {
	return tick * this.tickLength() + this.startTime;
}

SequencerApp.prototype.getEventsInWindow = function(startTime, endTime) {
	var result = [];

	var startTick = this.tickFromTime(startTime);
	var startTickQuantized = Math.max(
		0, Math.ceil(startTick)
	);
	var endTickQuantized = Math.ceil(this.tickFromTime(endTime));
	var numTicks = endTickQuantized - startTickQuantized;

	for (var i=0; i<numTicks; i++) {
		var tickNumber = (startTickQuantized + i) % TICKS_IN_PATTERN;
		var tickInfo = this.sequence.ticks[tickNumber];

		var events = tickInfo.notes().filter(x => x.on()).forEach(x => {
			result.push({
				pitch: x.pitch(),
				time: this.timeFromTick(startTickQuantized + i)
			});
		});
	}

	return result;
}

SequencerApp.prototype.process = function() {
	if (!this.playing()) return;
	
	var windowStartTime = this.sequencedTo;
	var windowEndTime =
		this.a.currentTime +
		PROCESS_COOLDOWN + 
		WINDOW_OVERLAP;

	var events = this.getEventsInWindow(windowStartTime, windowEndTime);

	events.forEach(e => {
		this.instrument.note(e.pitch, e.time);
	});

	this.sequencedTo = windowEndTime;

	// console.log("Processed", windowStartTime, windowEndTime);
}

var app = new SequencerApp();
ko.applyBindings(app);