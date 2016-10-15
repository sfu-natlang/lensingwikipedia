/*
 * Miscellaneous utilities.
 */

var Utils = (function () {

function extendObject(toExtend, module) {
	for (var i = 0; i < toExtend.length; i++) {
		var extending = toExtend[i];
		for (var attr in extending)
			if (extending.hasOwnProperty(attr) && !module.hasOwnProperty(attr))
				module[attr] = extending[attr];
	}
	return module;
}

var extendModule = extendObject;

function log(message) {
	$.post("/log", {'message': message});
}

/*
 * Convert a list of pairs to a dictionary object.
 */
function pairListToDict(list) {
	var dict = {};
	for (var i in list) {
		var pair = list[i];
		dict[pair[0]] = pair[1];
	}
	return dict;
}

/*
 * Mixin for things that can have watchers on events.
 */
function SimpleWatchable() {
	this._watchers = {};
}

SimpleWatchable.prototype.on = function (eventType, callback) {
	if (!this._watchers.hasOwnProperty(eventType))
		this._watchers[eventType] = [];
	this._watchers[eventType].push(callback);
	return this;
}

SimpleWatchable.prototype.removeOn = function (eventType, callback) {
	if (this._watchers.hasOwnProperty(eventType)) {
		var i = this._watchers[eventType].indexOf(callback);
		if (i >= 0)
			this._watchers[eventType].splice(i, 1);
	}
	return this;
}

SimpleWatchable.prototype._triggerEvent = function(eventType) {
	if (!this._watchers.hasOwnProperty(eventType))
		return;
	var args = Array.prototype.slice.call(arguments, 1);
	var callbacks = this._watchers[eventType];
	for (var callbackI = 0; callbackI < callbacks.length; callbackI++) {
		var callback = callbacks[callbackI];
		callback.apply(callback, args);
	}
}

/*
 * Log time taken to run something to the console.
 */
var logTimeRecords = {};
function logTime(f, title) {
	var start = new Date().getTime();
	f();
	var time = new Date().getTime() - start;
	var record = null;
	if (title != null) {
		if (!logTimeRecords.hasOwnProperty(title)) {
			record = {
				mean: time,
				numSamples: 1
			};
			logTimeRecords[title] = record;
		} else {
			record = logTimeRecords[title];
			var numSamples = record.numSamples + 1;
			record.mean = record.mean * (record.numSamples / numSamples) + time / numSamples;
			record.numSamples = numSamples;
		}
	}
	console.log("timing: " + (title != null ? title + ": " : ""), time, (record != null ? record.mean : ""), (record != null ? record.numSamples : ""));
}

return {
	extendObject: extendObject,
	extendModule: extendModule,
	pairListToDict: pairListToDict,
	SimpleWatchable: SimpleWatchable,
	logTime: logTime,
	log: log
};
}());
