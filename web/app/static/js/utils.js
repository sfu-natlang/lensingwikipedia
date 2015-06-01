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

/*
 * Class for simple sets of selected values.
 */

function SimpleSelection() {
	SimpleWatchable.call(this);
	this._selected = {};
	this._length = 0;
}

extendObject([SimpleWatchable.prototype], SimpleSelection.prototype);

SimpleSelection.prototype._hashValue = function(value) {
	return value;
}

SimpleSelection.prototype.mem = function(value) {
	return this._selected.hasOwnProperty(value);
}

SimpleSelection.prototype.add = function(value) {
	var valueHash = this._hashValue(value);
	if (!this._selected.hasOwnProperty(valueHash)) {
		this._selected[valueHash] = value;
		this._length += 1;
		this._triggerEvent('add', value);
	}
}

SimpleSelection.prototype.remove = function(value) {
	var valueHash = this._hashValue(value);
	if (this._selected.hasOwnProperty(valueHash)) {
		delete this._selected[valueHash];
		this._length -= 1;
		this._triggerEvent('remove', value);
		this._triggerEvent('remove-not-clear', value);
	}
}

SimpleSelection.prototype.toggle = function(value) {
	var valueHash = this._hashValue(value);
	if (!this._selected.hasOwnProperty(valueHash)) {
		this._selected[valueHash] = value;
		this._length += 1;
		this._triggerEvent('add', value);
	} else {
		delete this._selected[valueHash];
		this._length -= 1;
		this._triggerEvent('remove', value);
		this._triggerEvent('remove-not-clear', value);
	}
}

SimpleSelection.prototype.clear = function() {
	for (var valueHash in this._selected) {
		if (this._selected.hasOwnProperty(valueHash)) {
			var value = this._selected[valueHash];
			this._triggerEvent('remove', value);
		}
	}
	this._triggerEvent('clear');
	this._selected = {};
	this._length = 0;
}

SimpleSelection.prototype.each = function(f) {
	$.each(this._selected, f);
}

SimpleSelection.prototype.length = function(f) {
	return this._length;
}

SimpleSelection.prototype.isEmpty = function() {
	return this._length == 0;
}

setupSelectionClearButton = function (buttonElt, selection) {
	selection.on('add', function (value) {
		buttonElt.removeAttr('disabled');
	});
	selection.on('remove-not-clear', function (value) {
		if (selection.isEmpty())
			buttonElt.attr('disabled', 'disabled');
	});
	selection.on('clear', function() {
		buttonElt.attr('disabled', 'disabled');
	});

	buttonElt.click(function () {
		selection.clear();
	});
}

return {
	extendObject: extendObject,
	extendModule: extendModule,
	pairListToDict: pairListToDict,
	SimpleWatchable: SimpleWatchable,
	SimpleSelection: SimpleSelection,
	setupSelectionClearButton: setupSelectionClearButton
};
}());
