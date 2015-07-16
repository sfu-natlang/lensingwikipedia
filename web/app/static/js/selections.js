/*
 * Selection interface tools.
 */

var Selections = (function () {

/*
 * Class for simple sets of selected values.
 */

function SimpleSetSelection() {
	Utils.SimpleWatchable.call(this);
	this._selected = {};
	this._length = 0;
}

Utils.extendObject([Utils.SimpleWatchable.prototype], SimpleSetSelection.prototype);

SimpleSetSelection.prototype._hashValue = function(value) {
	return value;
}

SimpleSetSelection.prototype.mem = function(value) {
	return this._selected.hasOwnProperty(value);
}

SimpleSetSelection.prototype.add = function(value) {
	var valueHash = this._hashValue(value);
	if (!this._selected.hasOwnProperty(valueHash)) {
		this._selected[valueHash] = value;
		this._length += 1;
		this._triggerEvent('add', value);
	}
}

SimpleSetSelection.prototype.remove = function(value) {
	var valueHash = this._hashValue(value);
	if (this._selected.hasOwnProperty(valueHash)) {
		delete this._selected[valueHash];
		this._length -= 1;
		this._triggerEvent('remove', value);
		this._triggerEvent('remove-not-clear', value);
	}
}

SimpleSetSelection.prototype.toggle = function(value) {
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

SimpleSetSelection.prototype.clear = function() {
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

SimpleSetSelection.prototype.each = function(f) {
	$.each(this._selected, f);
}

SimpleSetSelection.prototype.length = function(f) {
	return this._length;
}

SimpleSetSelection.prototype.isEmpty = function() {
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

	if (selection.isEmpty())
		buttonElt.attr('disabled', 'disabled');
	else
		buttonElt.removeAttr('disabled');
}

function syncSelectionWithConstraints(selection, globalQuery, ownCnstrQuery, makeConstraint) {
	var constraints = {};
	selection.on('add', function (value) {
		if (!constraints.hasOwnProperty(value)) {
			var constraint = makeConstraint(value);
			constraint.onChange(function (changeType, query) {
				if (changeType == 'removed' && query == ownCnstrQuery && constraints.hasOwnProperty(value))
					selection.remove(value);
			});
			globalQuery.addConstraint(constraint);
			ownCnstrQuery.addConstraint(constraint);
			constraints[value] = constraint;
			globalQuery.update();
		} else
			console.log("error: duplicate constraint for value '" + value + "'");
	});
	selection.on('remove-not-clear', function (value) {
		var constraint = constraints[value];
		delete constraints[value];
		globalQuery.removeConstraint(constraint);
		ownCnstrQuery.removeConstraint(constraint);
		globalQuery.update();
	});
	selection.on('clear', function() {
		$.each(constraints, function (value, constraint) {
			globalQuery.removeConstraint(constraint);
			ownCnstrQuery.removeConstraint(constraint);
		});
		constraints = {};
		globalQuery.update();
	});
}


return {
	SimpleSetSelection: SimpleSetSelection,
	setupSelectionClearButton: setupSelectionClearButton,
	syncSelectionWithConstraints: syncSelectionWithConstraints
};
}());
