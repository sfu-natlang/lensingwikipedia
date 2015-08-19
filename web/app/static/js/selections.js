/*
 * Selection interface tools.
 *
 * The purpose of selections is to provide a standard interface for representing
 * selections from data, especially selections made by the user. The actual
 * classes here cover obvious cases but it isn't necessary to use them.
 *
 * All selections should implement the following:
 *	mem(x): checks if x is in the selection
 *	isEmpty(): checks if the selection is empty
 *	event 'empty': the selection becomes empty
 *	event 'not-empty': the selection becomes non-empty
 */

var Selections = (function () {

/*
 * Class for selection of single value.
 */

function SimpleSingleValueSelection() {
	Utils.SimpleWatchable.call(this);
	this._value = null;
}

Utils.extendObject([Utils.SimpleWatchable.prototype], SimpleSingleValueSelection.prototype);

SimpleSingleValueSelection.prototype.hashValue = function(value) {
	return value;
}

SimpleSingleValueSelection.prototype.mem = function(value) {
	return this._value != null && value == this._value;
}

SimpleSingleValueSelection.prototype.set = function(value) {
	if (value == null)
		return;
	if (value != this._value) {
		var wasEmpty = this._value == null;
		var oldValue = this._value;
		this._value = value;
		this._triggerEvent('change', value, oldValue);
		if (wasEmpty)
			this._triggerEvent('not-empty');
	}
}

SimpleSingleValueSelection.prototype.get = function() {
	return this._value;
}

SimpleSingleValueSelection.prototype.clear = function() {
	if (this._value != null) {
		this._value = null;
		this._triggerEvent('empty');
	}
}

SimpleSingleValueSelection.prototype.isEmpty = function() {
	return this._value == null;
}

/*
 * Class for simple sets of selected values.
 */

function SimpleSetSelection() {
	Utils.SimpleWatchable.call(this);
	this._selected = {};
	this._length = 0;
}

Utils.extendObject([Utils.SimpleWatchable.prototype], SimpleSetSelection.prototype);

SimpleSetSelection.prototype.hashValue = function(value) {
	return value;
}

SimpleSetSelection.prototype.mem = function(value) {
	return this._selected.hasOwnProperty(value);
}

// Add a single item and immediately trigger a change event
SimpleSetSelection.prototype.add = function(value) {
	var valueHash = this.hashValue(value);
	if (!this._selected.hasOwnProperty(valueHash)) {
		var oldLength = this._length;
		this._selected[valueHash] = value;
		this._length += 1;
		this._triggerEvent('change', [value], [], this._length);
		if (oldLength == 0)
			this._triggerEvent('not-empty');
	}
}

// Remove a single item and immediately trigger a change event
SimpleSetSelection.prototype.remove = function(value) {
	var valueHash = this.hashValue(value);
	if (this._selected.hasOwnProperty(valueHash)) {
		delete this._selected[valueHash];
		this._length -= 1;
		this._triggerEvent('change', [], [value], this._length);
		if (this._length == 0)
			this._triggerEvent('empty');
	}
}

// Toggle (add or remove) a single item and immediately trigger a change event
SimpleSetSelection.prototype.toggle = function(value) {
	var valueHash = this.hashValue(value);
	if (!this._selected.hasOwnProperty(valueHash))
		this.add(value);
	else
		this.remove(value);
}

// Clear the selection and immediately trigger a change event
SimpleSetSelection.prototype.clear = function() {
	if (this._length == 0)
		return;
	var removed = [];
	for (var valueHash in this._selected) {
		if (this._selected.hasOwnProperty(valueHash)) {
			var value = this._selected[valueHash];
			removed.push(value);
		}
	}
	this._selected = {};
	this._length = 0;
	this._triggerEvent('change', [], removed, 0);
	this._triggerEvent('empty');
}

// Make an atomic series of changes to the selection which will together trigger one change event
SimpleSetSelection.prototype.modify = function(f) {
	var selection = this;
	var oldLength = this._length;

	var toAdd = {},
	    toRemove = {};
	f({
		clear: function () {
			for (var valueHash in selection._selected)
				if (selection._selected.hasOwnProperty(valueHash))
					toRemove[valueHash] = selection._selected[valueHash];
		},
		add: function (value) {
			var valueHash = selection.hashValue(value);
			toAdd[valueHash] = value;
			delete toRemove[valueHash];
		},
		remove: function (value) {
			var valueHash = selection.hashValue(value);
			toRemove[valueHash] = value;
			delete toAdd[valueHash];
		}
	});

	var added = [],
	    removed = [];
	for (var valueHash in toAdd) {
		if (toAdd.hasOwnProperty(valueHash) && !this._selected.hasOwnProperty(valueHash)) {
			var value = toAdd[valueHash];
			this._selected[valueHash] = value;
			this._length += 1;
			added.push(value);
		}
	}
	for (var valueHash in toRemove) {
		if (toRemove.hasOwnProperty(valueHash) && this._selected.hasOwnProperty(valueHash)) {
			value = toRemove[valueHash];
			delete this._selected[valueHash];
			this._length -= 1;
			removed.push(value);
		}
	}

	this._triggerEvent('change', added, removed, this._length);
	if (this._length == 0) {
		if (oldLength != 0)
			this._triggerEvent('empty');
	} else {
		if (oldLength == 0)
			this._triggerEvent('not-empty');
	}
}

SimpleSetSelection.prototype.each = function(f) {
	for (var valueHash in this._selected) {
		if (this._selected.hasOwnProperty(valueHash)) {
			var value = this._selected[valueHash];
			f(value, valueHash);
		}
	}
}

SimpleSetSelection.prototype.map = function(f) {
	var list = [];
	for (var valueHash in this._selected) {
		if (this._selected.hasOwnProperty(valueHash)) {
			var value = this._selected[valueHash];
			list.push(f(value, valueHash));
		}
	}
	return list;
}

SimpleSetSelection.prototype.length = function(f) {
	return this._length;
}

SimpleSetSelection.prototype.isEmpty = function() {
	return this._length == 0;
}

/*
 * Setup a button to clear a selection and update its disabled status automatically.
 */
setupSelectionClearButton = function (buttonElt, selection) {
	selection.on('not-empty', function (value) {
		buttonElt.removeAttr('disabled');
	});
	selection.on('empty', function() {
		buttonElt.attr('disabled', 'disabled');
	});

	buttonElt.click(function () {
		selection.clear();
	});

	if (selection.isEmpty())
		buttonElt.attr('disabled', 'disabled');
	else
		buttonElt.removeAttr('disabled');
}

/*
 * Update a single constraint from a single-value selection.
 */ 
function syncSingleValueSelectionWithConstraint(selection, globalQuery, ownCnstrQuery, makeConstraint, updateConstraint) {
	var constraint = makeConstraint();
	globalQuery.addConstraint(constraint);
	if (ownCnstrQuery != null)
		ownCnstrQuery.addConstraint(constraint);
	constraint.onChange(function (changeType, query) {
		if (changeType == 'removed' && (ownCnstrQuery == null || query == ownCnstrQuery))
			selection.clear();
	});
	selection.on('change', function (start, end) {
		updateConstraint(constraint, selection, start, end);
		globalQuery.update();
	});
	selection.on('empty', function () {
		constraint.clear();
		globalQuery.update();
	});
}

/*
 * Update a single constraint from a set selection.
 */
function syncSetSelectionWithConstraint(selection, globalQuery, ownCnstrQuery, makeConstraint, updateConstraint) {
	var constraint = makeConstraint();
	globalQuery.addConstraint(constraint);
	if (ownCnstrQuery != null)
		ownCnstrQuery.addConstraint(constraint);
	constraint.onChange(function (changeType, query) {
		if (changeType == 'removed' && (ownCnstrQuery == null || query == ownCnstrQuery))
			selection.clear();
	});
	selection.on('change', function (added, removed, newLength) {
		if (newLength > 0)
			updateConstraint(constraint, selection, added, removed);
		else
			constraint.clear();
		globalQuery.update();
	});
}

/*
 * Generate multiple constraints from a set selection, one constraint for each item.
 */
function syncSetSelectionWithConstraints(selection, globalQuery, ownCnstrQuery, makeConstraint) {
	var constraints = {};
	selection.on('change', function (added, removed, newLength) {
		if (newLength > 0) {
			for (var valueI = 0; valueI < added.length; valueI++) {
				var value = added[valueI];
				if (!constraints.hasOwnProperty(value)) {
					var constraint = makeConstraint(value);
					constraint.onChange(function (changeType, query) {
						if (changeType == 'removed' && query == ownCnstrQuery && constraints.hasOwnProperty(value))
							selection.remove(value);
					});
					globalQuery.addConstraint(constraint);
					ownCnstrQuery.addConstraint(constraint);
					constraints[value] = constraint;
				} else
					console.log("error: duplicate constraint for value '" + value + "'");
			}
			for (var valueI = 0; valueI < removed.length; valueI++) {
				var value = removed[valueI];
				var constraint = constraints[value];
				delete constraints[value];
				globalQuery.removeConstraint(constraint);
				ownCnstrQuery.removeConstraint(constraint);
			}
			globalQuery.update();
		} else {
			var hadConstraints = false;
			for (var value in constraints) {
				if (constraints.hasOwnProperty(value)) {
					var constraint = constraints[value];
					globalQuery.removeConstraint(constraint);
					ownCnstrQuery.removeConstraint(constraint);
					hadConstraints = true;
				}
			}
			constraints = {};
			if (hadConstraints)
				globalQuery.update();
		}
	});
}

return {
	SimpleSingleValueSelection: SimpleSingleValueSelection,
	SimpleSetSelection: SimpleSetSelection,
	setupSelectionClearButton: setupSelectionClearButton,
	syncSingleValueSelectionWithConstraint: syncSingleValueSelectionWithConstraint,
	syncSetSelectionWithConstraint: syncSetSelectionWithConstraint,
	syncSetSelectionWithConstraints: syncSetSelectionWithConstraints
};
}());
