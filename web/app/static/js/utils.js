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

return {
	extendObject: extendObject,
	extendModule: extendModule,
	pairListToDict: pairListToDict,
	SimpleWatchable: SimpleWatchable
};
}());
