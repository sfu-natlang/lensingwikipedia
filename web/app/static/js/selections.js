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
 *
 * Additionally, selections should generally implement a 'change' event which
 * indicates that the selected value(s) has/have changed and provides
 * information about the change.
 */

var Selections = (function () {

/*
 * Class for selection of single value.
 */

function SimpleSingleValueSelection(value) {
	Utils.SimpleWatchable.call(this);
	this._value = null;
	if (value != null)
		this.set(value);
}

Utils.extendObject([Utils.SimpleWatchable.prototype], SimpleSingleValueSelection.prototype);

SimpleSingleValueSelection.prototype.valueHash = function(value) {
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

SimpleSingleValueSelection.prototype.each = function(f) {
	if (this._value != null)
		f(this._value);
}

/*
 * Class for simple sets of selected values.
 */

function SimpleSetSelection(otherSet) {
	Utils.SimpleWatchable.call(this);
	this._selected = {};
	this._length = 0;

	if (otherSet != null) {
		for (var key in otherSet._selected)
			this._selected[key] = otherSet._selected[key];
		this._length = otherSet._length;
	}
}

Utils.extendObject([Utils.SimpleWatchable.prototype], SimpleSetSelection.prototype);

SimpleSetSelection.prototype.valueHash = function(value) {
	return value;
}

SimpleSetSelection.prototype.mem = function(value) {
	return this._selected.hasOwnProperty(value);
}

// Add a single item and immediately trigger a change event
SimpleSetSelection.prototype.add = function(value) {
	var valueHash = this.valueHash(value);
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
	var valueHash = this.valueHash(value);
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
	var valueHash = this.valueHash(value);
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
			toAdd = {};
		},
		add: function (value) {
			var valueHash = selection.valueHash(value);
			toAdd[valueHash] = value;
			delete toRemove[valueHash];
		},
		remove: function (value) {
			var valueHash = selection.valueHash(value);
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

	if (added.length > 0 || removed.length > 0) {
		this._triggerEvent('change', added, removed, this._length);
		if (this._length == 0) {
			if (oldLength != 0)
				this._triggerEvent('empty');
		} else {
			if (oldLength == 0)
				this._triggerEvent('not-empty');
		}
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
 * Flattens a single-value selection of (any kind of) selection.
 */

function FlattenSingle(selection) {
	Utils.SimpleWatchable.call(this);

	this._value = null;
	var flatten = this;

	function makeHandlers(value) {
		return {
			'empty': function () { flatten._triggerEvent('empty'); },
			'not-empty': function () { flatten._triggerEvent('not-empty'); },
			'change': function (a1, a2, a3) { flatten._triggerEvent('change', a1, a2, a3); }
		};
	}
	function installHandlers(value, handlers) {
		for (var key in handlers)
			value.on(key, handlers[key]);
	}
	function removeHandlers(value, handlers) {
		for (var key in handlers)
			value.removeOn(key, handlers[key]);
	}

	var curHandlers = null;
	selection.on('change', function (value) {
		if (flatten._value != null)
			removeHandlers(flatten._value, curHandlers);
		var wasEmpty = flatten._value == null ? true : flatten._value.isEmpty();
		flatten._value = value;
		curHandlers = makeHandlers(value);
		installHandlers(value, curHandlers);
		var isEmpty = flatten._value.isEmpty();
		flatten._triggerEvent('change');
		if (isEmpty != wasEmpty)
			flatten._triggerEvent(isEmpty ? 'empty' : 'not-empty');
	});
}

Utils.extendObject([Utils.SimpleWatchable.prototype], FlattenSingle.prototype);

FlattenSingle.prototype.mem = function(value) {
	return this._value != null && this._value.mem(value);
}

FlattenSingle.prototype.isEmpty = function() {
	return this._value == null || this._value.isEmpty();
}

FlattenSingle.prototype.each = function(f) {
	if (this._value != null)
		this._value.each(f);
}

FlattenSingle.prototype.map = function(f) {
	if (this._value != null)
		return this._value.map(f);
}

FlattenSingle.prototype.clear = function() {
	if (this._value != null)
		this._value.clear();
}

FlattenSingle.prototype.length = function() {
	if (this._value != null)
		return this._value.length();
}

/*
 *	mem(x): checks if x is in the selection
 *	isEmpty(): checks if the selection is empty
 *	event 'empty': the selection becomes empty
 *	event 'not-empty': the selection becomes non-empty
 */

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

	buttonElt.click(function (fromEvent) {
		fromEvent.stopPropagation();
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
function syncSingleValueSelectionWithConstraint(selection, connection, globalConstraintSet, otherConstraintSets, makeConstraint) {
	var selCnstr = null;
	function remove() {
		var toRemove = selCnstr;
		selCnstr = null;
		if (toRemove != null) {
			globalConstraintSet.remove(toRemove);
			otherConstraintSets.forEach(function (cs) { cs.remove(toRemove); });
		}
	}
	globalConstraintSet.on('change', function (added, removed) {
		for (var cnstrI = 0; cnstrI < removed.length; cnstrI++)
			if (selCnstr != null && removed[cnstrI].equals(selCnstr))
				selection.clear();
	});
	selection.on('change', function (value) {
		remove();
		selCnstr = makeConstraint(value);
		globalConstraintSet.add(selCnstr);
		otherConstraintSets.forEach(function (cs) { cs.add(selCnstr); });
		connection.update();
	});
	selection.on('empty', function () {
		remove();
		connection.update();
	});
}

/*
 * Update a single constraint from a set selection.
 */
function syncSetSelectionWithConstraint(selection, connection, globalConstraintSet, otherConstraintSets, makeConstraint) {
	var constraint = null;
	selection.on('change', function (added, removed, newLength) {
		if (constraint != null) {
			var cnstr = constraint;
			constraint = null;
			globalConstraintSet.remove(cnstr);
			otherConstraintSets.forEach(function (cs) { cs.remove(cnstr); });
		}
		var cnstr = makeConstraint(selection);
		if (cnstr != null) {
			globalConstraintSet.add(cnstr);
			otherConstraintSets.forEach(function (cs) { cs.add(cnstr); });
			constraint = cnstr;
		}
		connection.update();
	});
	globalConstraintSet.on('change', function (added, removed, newLength) {
		if (constraint != null)
			for (var removedI = 0; removedI < removed.length; removedI++) {
				var cnstr = removed[removedI];
				if (cnstr.equals(constraint))
					selection.clear();
			}
	});
}

/*
 * Generate multiple constraints from a set selection, one constraint for each item.
 */
function syncSetSelectionWithConstraints(selection, connection, globalConstraintSet, otherConstraintSets, makeConstraint) {
	var constraintsByValue = {},
	    valuesById = {};
	selection.on('change', function (added, removed, newLength) {
		if (newLength > 0) {
			for (var valueI = 0; valueI < added.length; valueI++) {
				var value = added[valueI];
				if (!constraintsByValue.hasOwnProperty(value)) {
					var cnstr = makeConstraint(value);
					globalConstraintSet.add(cnstr);
					otherConstraintSets.forEach(function (cs) { cs.add(cnstr); });
					constraintsByValue[value] = cnstr;
					valuesById[cnstr.id()] = value;
				} else
					console.log("error: duplicate constraint for value '" + value + "'");
			}
			for (var valueI = 0; valueI < removed.length; valueI++) {
				var value = removed[valueI];
				var cnstr = constraintsByValue[value];
				delete constraintsByValue[value];
				delete valuesById[cnstr.id()];
				globalConstraintSet.remove(cnstr);
				otherConstraintSets.forEach(function (cs) { cs.remove(cnstr); });
			}
			connection.update();
		} else if (Object.keys(constraintsByValue).length > 0) {
			for (value in constraintsByValue) {
				var cnstr = constraintsByValue[value];
				globalConstraintSet.remove(cnstr);
				otherConstraintSets.forEach(function (cs) { cs.remove(cnstr); });
			}
			constraintsByValue = {};
			valuesById = {};
			connection.update();
		}
	});
	globalConstraintSet.on('change', function (added, removed, newLength) {
		selection.modify(function (modifySel) {
			for (var removedI = 0; removedI < removed.length; removedI++) {
				var cnstr = removed[removedI];
				if (valuesById.hasOwnProperty(cnstr.id())) {
					modifySel.remove(valuesById[cnstr.id()]);
				}
			}
		});
	});
}

return {
	SimpleSingleValueSelection: SimpleSingleValueSelection,
	SimpleSetSelection: SimpleSetSelection,
	FlattenSingle: FlattenSingle,
	setupSelectionClearButton: setupSelectionClearButton,
	syncSingleValueSelectionWithConstraint: syncSingleValueSelectionWithConstraint,
	syncSetSelectionWithConstraint: syncSetSelectionWithConstraint,
	syncSetSelectionWithConstraints: syncSetSelectionWithConstraints
};
}());
