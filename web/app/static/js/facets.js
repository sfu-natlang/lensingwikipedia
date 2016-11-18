/*
 * Facet control.
 */

var Facets = (function () {

/*
 * UI list of values for a field.
 *
 * event 'element-selection-change': triggered when the visual selection status of an item element is changed; can be used to apply extra styles to the element
 */
function FacetListBox(container, connection, field, selection, constraintSet) {
	var listBox = this;

	Utils.SimpleWatchable.call(this);
	
	this.connection = connection;
	this.field = field;
	this.selection = selection;

	this.dataCounts = [];
	this.dataElts = {};

	this.viewValue = {
		type: 'countbyfieldvalue',
		field: field
	};

	this.outerElt = $('<div class="facetlistbox"></div>').appendTo(container);
	this.loadingIndicator = new LoadingIndicator.LoadingIndicator(this.outerElt);
	this.listElt = $('<ul></ul>').appendTo(this.outerElt);
	var moreBoxElt = $('<div class="buttonbox"></div>').appendTo(this.outerElt);
	this.moreElt = $('<button type="button" class="btn btn-primary" disabled="true">More</button>').appendTo(moreBoxElt);

	this._watchSelection(this.viewValue, selection);
	if (constraintSet != null)
		this.constraintSet(constraintSet);
}

Utils.extendObject([Utils.SimpleWatchable.prototype], FacetListBox.prototype);

FacetListBox.prototype._watchSelection = function (viewValue, selection) {
	var listBox = this;
	selection.on('change', function (added, removed, newLength) {
		if (!listBox.viewValue.hasOwnProperty('requiredkeys'))
			listBox.viewValue.requiredkeys = [];
		if (newLength > 0) {
			for (var valueI = 0; valueI < added.length; valueI++) {
				var value = added[valueI];
				listBox.viewValue.requiredkeys.push(value);
				if (listBox._dataElts.hasOwnProperty(value)) {
					listBox.outerElt.addClass('selected');
					var elt = listBox._dataElts[value];
					elt.addClass('selected');
					listBox._triggerEvent('element-selection-change', value, elt, true);
				}
			}
			for (var valueI = 0; valueI < removed.length; valueI++) {
				var value = removed[valueI];
				listBox.viewValue.requiredkeys.splice($.inArray(value, listBox.viewValue.requiredkeys), 1);
				if (listBox._dataElts.hasOwnProperty(value)) {
					var elt = listBox._dataElts[value];
					elt.removeClass('selected');
					listBox._triggerEvent('element-selection-change', value, elt, false);
					if (selection.isEmpty())
						listBox.outerElt.removeClass('selected');
				}
			}
		} else {
			listBox.viewValue.requiredkeys = [];
			for (var valueI = 0; valueI < removed.length; valueI++) {
				var value = removed[valueI],
				    elt = listBox._dataElts[value];
				listBox._triggerEvent('element-selection-change', value, elt, false);
			}
			listBox.listElt.find('li').removeClass('selected');
			listBox.outerElt.removeClass('selected');
		}
		if (listBox.viewValue.requiredkeys.length == 0)
			delete listBox.viewValue['requiredkeys'];
	}, true);
}

FacetListBox.prototype._watchQuery = function (query) {
	var listBox = this;
	DataSource.setupLoadingIndicator(listBox.loadingIndicator, query);
	query.on('invalidated', function (result) {
		listBox.dataCounts = [];
		listBox._setData(listBox.dataCounts);
	});
	query.on('error', function (result) {
		listBox.dataCounts = [];
		listBox._setData(listBox.dataCounts);
	});
	query.on('result', function (result) {
		listBox.dataCounts = listBox.dataCounts.concat(result.counts);
		listBox._setData(listBox.dataCounts);
	});
}

FacetListBox.prototype.constraintSet = function(newConstraintSet) {
	if (newConstraintSet == null) {
		if (this.query == null)
			return null;
		else
			return this.query.constraintSet();
	} else {
		if (this.query != null) {
			this.query.forget();
			this.query.setConstraintSet(newConstraintSet);
		} else {
			this.query = new Queries.Queries.PaginatedQuery(this.connection, newConstraintSet, this.viewValue);
			this._watchQuery(this.query);
			DataSource.setupNextPageButton(this.moreElt, this.query, this.connection);
		}
	}
}

FacetListBox.prototype._setData = function (dataCounts) {
	var listBox = this;

	this._dataElts = {};
	listBox.listElt.find('li').remove();

	function addValue(value, count) {
		var isSelected = listBox.selection.mem(value);
		var classStr = isSelected ? ' class="selected"' : '';
		var bracketedCountStr = count == null ? '' : ' [' + count + ']';
		var countStr = count == null ? 'no' : count;
		var itemElt = $('<li' + classStr + ' title="Value \'' + value + '\' is in ' + countStr + ' events under current constraints. Click to select it.">' + value + bracketedCountStr + '</li>').appendTo(listBox.listElt);
		listBox._dataElts[value] = itemElt;
		itemElt.click(function(fromEvent) {
			listBox.selection.toggle(value);
			fromEvent.stopPropagation();
		});
		listBox._triggerEvent('element-selection-change', value, itemElt, isSelected);
	}

	var extraToAdd = {};
	this.selection.each(function (value) {
		extraToAdd[value] = true;
	});

	$.each(dataCounts, function (itemI, item) {
		var value = item[0],
		    count = +item[1];
		addValue(value, count);
		if (extraToAdd.hasOwnProperty(value))
			delete extraToAdd[value];
	});

	$.each(extraToAdd, function (value) {
		addValue(value, 0);
	});

	if (this.hasOwnProperty('search'))
		this._setSearchData(dataCounts);
}

FacetListBox.prototype.elementForValue = function (value) {
	return this._dataElts[value];
}

FacetListBox.prototype.makeSearchElement = function (facetName, globalConstraintSet) {
	var listBox = this;

	var outerElt = $('<div class="topbox"></div>');
	var searchBoxElt = $("<form class=\"searchbox\"></form>").appendTo(outerElt);
	var searchBtnElt = $("<button type=\"submit\" class=\"btn btn-primary btn-link\" title=\"Search.\"></button>").appendTo(searchBoxElt);
	this.searchInputElt = $("<input type=\"text\" autocomplete=\"off\" data-provide=\"typeahead\" title=\"Enter search term here.\"></input>").appendTo($("<div class=\"inputbox\"></div>").appendTo(searchBoxElt));
	this.search = this.searchInputElt.typeahead();

	function setSearchErrorStatus(isError) {
		if (isError)
			listBox.searchInputElt.addClass('error');
		else
			listBox.searchInputElt.removeClass('error');
	}

	var localConstraintSet = new Queries.ConstraintSets.ConstraintSet();
	var selection = new Selections.SimpleSingleValueSelection();

	Selections.syncSingleValueSelectionWithConstraint(selection, this.connection, globalConstraintSet, [localConstraintSet], function (searchTerm) {
		Utils.log("facet search, " + searchTerm);
		return new Queries.Constraint({
			type: 'textsearch',
			value: searchTerm
		}, "Text search: " + searchTerm);
	});

	searchBoxElt.submit(function () {
		var searchTerm = $.trim(listBox.searchInputElt.val());
		if (searchTerm.length > 0) {
			// TODO Determine the search prefix in a more reliable way since we may
			// want to change the facet name.
			selection.set(facetName.toLowerCase() + ":" + searchTerm);
		} else {
			selection.clear();
		}
		return false;
	});

	return outerElt;
}

FacetListBox.prototype._setSearchData = function (dataCounts) {
	function keyList(pairs) {
		var list = [];
		for (i in pairs)
			list.push(pairs[i][0]);
		return list;
	}
	this.searchInputElt.val("");
	if (dataCounts != null) {
		this.searchInputElt.removeAttr('disabled');
		this.search.data('typeahead').source = keyList(dataCounts);
	}
}

/*
* Manage per-field selections, with synchronization to constraints.
*/
function FieldSelections(connection, globalConstraintSet) {
	this.connection = connection;
	this.globalConstraintSet = globalConstraintSet;
	this._cache = {};
	this._names = {};
}

/*
 * Set an (optional) name for a field, for constraint UI purposes.
 */
FieldSelections.prototype.setName = function (field, name) {
	this._names[field] = name;
}

/*
* Get the selection information for values on a particular field.
*/
FieldSelections.prototype.get = function (field) {
	if (!this._cache.hasOwnProperty(field)) {
		var fieldSelections = this;
		var ownConstraintSet = new Queries.ConstraintSets.ConstraintSet();
		var contextConstraintSet = new Queries.ConstraintSets.SetMinus(this.globalConstraintSet, ownConstraintSet);
		var selection = new Selections.SimpleSetSelection();
		var name = this._names.hasOwnProperty(field) ? this._names[field] : field;
		Selections.syncSetSelectionWithConstraints(selection, this.connection, fieldSelections.globalConstraintSet, [ownConstraintSet], function (value) {
			Utils.log("facet filter, " + name + ":" + value);
			return new Queries.Constraint({
					type: 'fieldvalue',
					field: field,
					value: value
				}, name + ": " + value);
		});
		this._cache[field] = {
			selection: selection,
			ownConstraintSet: ownConstraintSet,
			contextConstraintSet: contextConstraintSet
		};
	}
	return this._cache[field];
}

/*
 * Setup the control in some container element.
 * container: container element as a jquery selection
 * globalConstraintSet: the global set of all constraints
 * name: name for the facet, to show the user
 * field: field name to use in requesting views from the backend
 */
function setup(container, connection, globalConstraintSet, name, field, fieldSelection) {
	var facetElt = $("<div class=\"facet\"></div>").appendTo(container);
	var topBoxElt = $("<div class=\"topbox\"></div>").appendTo(facetElt);
	$("<h1>" + name + "</h1>").appendTo(topBoxElt);
	var clearElt = $("<button type=\"button\" class=\"btn btn-block btn-mini btn-warning\" title=\"Clear the facet selection.\">Clear selection</button></ul>").appendTo(topBoxElt);
	var listBox = new FacetListBox(facetElt, connection, field, fieldSelection.selection, globalConstraintSet);
	if (TabConfig["facets"]["hide-search"] != "true") {
		var searchElt = listBox.makeSearchElement(name, globalConstraintSet);
		searchElt.appendTo(topBoxElt);
	}
	LayoutUtils.fillElement(container, facetElt, 'vertical');
	LayoutUtils.setupPanelled(facetElt, topBoxElt, listBox.outerElt, 'vertical', 0, false);
	setupSelectionClearButton(clearElt, fieldSelection.selection);

	clearElt.click(function() {
		Utils.log("clear, " + name);
	});

	return {
		ownConstraintSet: fieldSelection.ownConstraintSet,
		contextConstraintSet: fieldSelection.contextConstraintSet,
		selection: fieldSelection.selection
	}
}

return {
	setup: setup,
	FacetListBox: FacetListBox,
	FieldSelections: FieldSelections
};
}());
