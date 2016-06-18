/*
 * Facet control.
 */

var Facets = (function () {

/*
 * UI list of values for a field.
 *
 * event 'element-selection-change': triggered when the visual selection status of an item element is changed; can be used to apply extra styles to the element
 */
function FacetListBox(container, query, field, selection) {
	var listBox = this;

	Utils.SimpleWatchable.call(this);
	
	this.query = query;
	this.field = field;
	this.selection = selection;

	this.dataCounts = null;
	this.dataElts = {};

	this.outerElt = $('<div class="facetlistbox"></div>').appendTo(container);
	this.loadingIndicator = new LoadingIndicator.LoadingIndicator(this.outerElt);
	this.listElt = $('<ul></ul>').appendTo(this.outerElt);
	var moreBoxElt = $('<div class="buttonbox"></div>').appendTo(this.outerElt);
	this.moreElt = $('<button type="button" class="btn" disabled="true">More</button>').appendTo(moreBoxElt);
	this.loadingIndicator.enabled(true);

	this.viewValue = {
		counts: {
			type: 'countbyfieldvalue',
			field: field,	
			requiredkeys: []
		}
	};

	this._watchSelection(this.viewValue, selection);

	this.watchQueryResultWatcher = null;
	this.onMore = function () {};
	listBox.moreElt.click(function(fromEvent) {
		listBox.onMore();
		fromEvent.stopPropagation();
	});

	this._reset();
}

Utils.extendObject([Utils.SimpleWatchable.prototype], FacetListBox.prototype);

FacetListBox.prototype._watchSelection = function (viewValue, selection) {
	var listBox = this;
	selection.on('change', function (added, removed, newLength) {
		if (newLength > 0) {
			for (var valueI = 0; valueI < added.length; valueI++) {
				var value = added[valueI];
				listBox.viewValue.counts.requiredkeys.push(value);
				if (listBox._dataElts.hasOwnProperty(value)) {
					listBox.outerElt.addClass('selected');
					var elt = listBox._dataElts[value];
					elt.addClass('selected');
					listBox._triggerEvent('element-selection-change', value, elt, true);
				}
			}
			for (var valueI = 0; valueI < removed.length; valueI++) {
				var value = removed[valueI];
				listBox.viewValue.counts.requiredkeys = listBox.viewValue.counts.requiredkeys.splice($.inArray(value, listBox.viewValue.counts.requiredkeys), 1);
				if (listBox._dataElts.hasOwnProperty(value)) {
					var elt = listBox._dataElts[value];
					elt.removeClass('selected');
					listBox._triggerEvent('element-selection-change', value, elt, false);
					if (selection.isEmpty())
						listBox.outerElt.removeClass('selected');
				}
			}
		} else {
			for (var valueI = 0; valueI < removed.length; valueI++) {
				var value = removed[valueI],
				    elt = listBox._dataElts[value];
				listBox._triggerEvent('element-selection-change', value, elt, false);
			}
			listBox.listElt.find('li').removeClass('selected');
			listBox.outerElt.removeClass('selected');
		}
	});
}

FacetListBox.prototype.setupWatchQuery = function (query) {
	var listBox = this,
	    continuer = null;

	this._reset();

	if (this.watchQueryResultWatcher != null)
		this.watchQueryResultWatcher.enabled(false);

	this.watchQueryResultWatcher = new Queries.ResultWatcher(function () {});
	this.watchQueryResultWatcher.set(this.viewValue);
	query.addResultWatcher(this.watchQueryResultWatcher);

	this.watchQueryResultWatcher.setCallback(function(result, getContinuer) {
		listBox.dataCounts = [];
		if (result.counts.hasOwnProperty('error')) {
			listBox.loadingIndicator.error('counts', true);
			listBox.loadingIndicator.enabled(true);
			listBox._setMoreEnabled(false);
		} else {
			listBox.loadingIndicator.error('counts', false);
			listBox.loadingIndicator.enabled(false);
			continuer = getContinuer();
			listBox._setMoreEnabled(continuer.hasMore());
			listBox.dataCounts = listBox.dataCounts.concat(result.counts.counts);
		}
		listBox._setData(listBox.dataCounts);
	});

	this.onMore = function (fromEvent) {
		if (continuer != null)
			continuer.fetchNext(function(result) {
				listBox.dataCounts = listBox.dataCounts.concat(result.counts.counts);
				listBox._setData(listBox.dataCounts);
			});
	};

	query.onChange(function () {
		listBox.loadingIndicator.enabled(true);
	});
}

FacetListBox.prototype._reset = function () {
	this.listElt.find('li').remove();
	this.loadingIndicator.enabled(true);
	this.dataCounts = null;
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

FacetListBox.prototype.makeSearchElement = function () {
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

	searchBoxElt.submit(function () {
		var value = listBox.searchInputElt.val();
		if (listBox._dataElts.hasOwnProperty(value)) {
			setSearchErrorStatus(false);
			listBox.selection.add(value);
		} else
			setSearchErrorStatus(true);
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

FacetListBox.prototype._setMoreEnabled = function (enabled) {
	if (enabled) {
		this.moreElt.addClass('btn-primary');
		this.moreElt.removeAttr('disabled');
	} else {
		this.moreElt.removeClass('btn-primary');
		this.moreElt.attr('disabled', 'disabled');
	}
}

/*
* Manage per-field selections, with synchronization to constraints.
*/
function FieldSelections(globalQuery) {
	this._globalQuery = globalQuery;
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
		var ownCnstrQuery = new Queries.Query(this._globalQuery.backendUrl());
		var contextQuery = new Queries.Query(this._globalQuery.backendUrl(), 'setminus', this._globalQuery, ownCnstrQuery);
		var selection = new Selections.SimpleSetSelection();
		var name = this._names.hasOwnProperty(field) ? this._names[field] : field;
		Selections.syncSetSelectionWithConstraints(selection, fieldSelections._globalQuery, ownCnstrQuery, function (value) {
			var constraint = new Queries.Constraint();
			constraint.name(name + ": " + value);
			constraint.set({
				type: 'fieldvalue',
				field: field,
				value: value
			});
			return constraint;
		});
		this._cache[field] = {
			selection: selection,
			ownCnstrQuery: ownCnstrQuery,
			contextQuery: contextQuery
		};
	}
	return this._cache[field];
}

/*
 * Setup the control in some container element.
 * container: container element as a jquery selection
 * globalQuery: the global query
 * name: name for the facet, to show the user
 * field: field name to use in requesting views from the backend
 */
function setup(container, globalQuery, name, field, fieldSelection) {
	var facetElt = $("<div class=\"facet\"></div>").appendTo(container);
	var topBoxElt = $("<div class=\"topbox\"></div>").appendTo(facetElt);
	$("<h1>" + name + "</h1>").appendTo(topBoxElt);
	var clearElt = $("<button type=\"button\" class=\"btn btn-block btn-mini btn-warning\" title=\"Clear the facet selection.\">Clear selection</button></ul>").appendTo(topBoxElt);
	var listBox = new FacetListBox(facetElt, fieldSelection.contextQuery, field, fieldSelection.selection);
	listBox.setupWatchQuery(globalQuery);
	if (AdminConfig.show_facet_search) {
		var searchElt = listBox.makeSearchElement();
		searchElt.appendTo(topBoxElt);
	}
	LayoutUtils.fillElement(container, facetElt, 'vertical');
	LayoutUtils.setupPanelled(facetElt, topBoxElt, listBox.outerElt, 'vertical', 0, false);
	setupSelectionClearButton(clearElt, fieldSelection.selection);

	return {
		ownCnstrQuery: fieldSelection.ownCnstrQuery,
		contextQuery: fieldSelection.contextQuery,
		selection: fieldSelection.selection
	}
}

return {
	setup: setup,
	FacetListBox: FacetListBox,
	FieldSelections: FieldSelections
};
}());
