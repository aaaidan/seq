var failedTests = 0;

var assert = function(name, func, expected) {
	var result = func();
	if (result !== expected) {
		console.warn("Test Failed: ", name, "Expected " + expected + " but", result);
	}
};

var assertTrue = function(name, func) {
	var result = func();
	if (result !== true) {
		console.warn("Test Failed: ", name, "Expected true but", result);
	}
};


// Note.parse
assert("C4 is 60", function(){ return Note.parse("C4"); }, 60);
assert("F#4 is 66", function(){ return Note.parse("F#4"); }, 66);
assert("C-1 is 0", function(){ return Note.parse("C-1"); }, 0);

// Note.pitchToFrequency
assert("A4 is 440Hz", function() { return Note.pitchToFreq(69) }, 440);
assert("A3 is 220Hz", function() { return Note.pitchToFreq(69-12) }, 220);

if (failedTests === 0) {
	console.log("All tests passed.");
}