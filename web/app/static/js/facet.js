/*
 * Facet control.
 */

var Facet = (function () {

function FacetListBox(container, query, field, selection) {
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

	this.viewValue = {
		counts: {
			type: 'countbyfieldvalue',
			field: field,	
			requiredkeys: []
		}
	};

	this.loadingIndicator.enabled(true);
	this._watchSelection(this.viewValue, selection);
	this._watchQuery(query, this.viewValue);
}

Utils.extendObject([Utils.SimpleWatchable.prototype], FacetListBox.prototype);

FacetListBox.prototype._watchSelection = function (viewValue, selection) {
	var listBox = this;
	selection.on('add', function (value) {
		listBox.viewValue.counts.requiredkeys.push(value);
		if (listBox._dataElts.hasOwnProperty(value))
			listBox._dataElts[value].addClass('selected');
		else
			console.log("warning: no element for '" + value + "'");
	});
	selection.on('remove-not-clear', function (value) {
		listBox.viewValue.counts.requiredkeys = listBox.viewValue.counts.requiredkeys.splice($.inArray(value, listBox.viewValue.counts.requiredkeys), 1);
		if (listBox._dataElts.hasOwnProperty(value))
			listBox._dataElts[value].removeClass('selected');
		else
			console.log("warning: no element for '" + value + "'");
	});
	selection.on('clear', function() {
		listBox.listElt.find('li').removeClass('selected');
	});
}

FacetListBox.prototype._watchQuery = function (query, viewValue) {
	var listBox = this,
	    continuer = null;

	var resultWatcher = new Queries.ResultWatcher(function () {});
	resultWatcher.set(viewValue);
	query.addResultWatcher(resultWatcher);

	resultWatcher.setCallback(function(result, getContinuer) {
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

	listBox.moreElt.click(function(fromEvent) {
		listBox._triggerEvent('more', null, fromEvent, listBox.moreElt);
		if (continuer != null)
			continuer.fetchNext(function(result) {
				listBox.dataCounts = listBox.dataCounts.concat(result.counts.counts);
				listBox._setData(listBox.dataCounts);
			});
		fromEvent.stopPropagation();
	});

	query.onChange(function () {
		listBox.loadingIndicator.enabled(true);
	});
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
			listBox.query.update();
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

function setupTest(container, globalQuery, name, field) {
	var facetElt = $("<div class=\"facet\"></div>").appendTo(container);
	var listBox = new FacetListBox(facetElt, globalQuery, field);
	LayoutUtils.fillElement(container, facetElt, 'vertical');
	LayoutUtils.fillElement(facetElt, listBox.outerElt, 'vertical');
	globalQuery.update();
}

/*
 * Setup the control in some container element.
 * container: container element as a jquery selection
 * globalQuery: the global query
 * name: name for the facet, to show the user
 * field: field name to use in requesting views from the backend
 */
function setup(container, globalQuery, name, field) {
	var globalQueryResultWatcher = new Queries.ResultWatcher(function () {});
	globalQuery.addResultWatcher(globalQueryResultWatcher);
	var ownCnstrQuery = new Queries.Query(globalQuery.backendUrl());
	var contextQuery = new Queries.Query(globalQuery.backendUrl(), 'setminus', globalQuery, ownCnstrQuery);
	var contextQueryResultWatcher = new Queries.ResultWatcher(function () {});
	contextQuery.addResultWatcher(contextQueryResultWatcher);

	var selection = new Utils.SimpleSelection();

	var facetElt = $("<div class=\"facet\"></div>").appendTo(container);
	var topBoxElt = $("<div class=\"topbox\"></div>").appendTo(facetElt);
	$("<h1>" + name + "</h1>").appendTo(topBoxElt);
	var clearElt = $("<button type=\"button\" class=\"btn btn-block btn-mini btn-warning\" title=\"Clear the facet selection.\">Clear selection</button></ul>").appendTo(topBoxElt);
	var listBox = new FacetListBox(facetElt, contextQuery, field, selection);
	var searchElt = listBox.makeSearchElement();
	searchElt.appendTo(topBoxElt);

	Utils.setupSelectionClearButton(clearElt, listBox.selection);

	LayoutUtils.fillElement(container, facetElt, 'vertical');
	LayoutUtils.setupPanelled(facetElt, topBoxElt, listBox.outerElt, 'vertical', 0, false);

	var constraints = {};
	function clearConstraints() {
		var oldConstraints = constraints;
		constraints = {};
		$.each(oldConstraints, function (value, constraint) {
			globalQuery.removeConstraint(constraint);
			ownCnstrQuery.removeConstraint(constraint);
			listBox.selection.add(value, false);
		});
		listBox.outerElt.removeClass('selected');
	}
	function removeConstraint(value) {
		var constraint = constraints[value];
		delete constraints[value];
		globalQuery.removeConstraint(constraint);
		ownCnstrQuery.removeConstraint(constraint);
		listBox.selection.remove(value);
		if ($.isEmptyObject(constraints)) {
			listBox.outerElt.removeClass('selected');
		}
	}
	function addConstraint(value) {
		var constraint = new Queries.Constraint();
		constraint.name(name + ": " + value);
		constraint.set({
			type: 'fieldvalue',
			field: field,
			value: value
		});
		listBox.outerElt.addClass('selected');
		constraint.onChange(function (changeType, query) {
			if (changeType == 'removed' && query == ownCnstrQuery && constraints.hasOwnProperty(value))
				removeConstraint(value);
		});
		if (constraints.hasOwnProperty(value))
			console.log("warning: duplicate constraint for value '" + value + "'");
		constraints[value] = constraint;
		globalQuery.addConstraint(constraint);
		ownCnstrQuery.addConstraint(constraint);
	}
	function changeConstraint(value, oldValue, constraint) {
		constraint.name(name + ": " + value);
		constraint.set({
			type: 'fieldvalue',
			field: field,
			value: value
		});
		delete constraints[oldValue];
		constraints[value] = constraint;
		listBox.outerElt.addClass('selected');
	}

	listBox.selection.on('add', function (value) {
		if (!constraints.hasOwnProperty(value))
			addConstraint(value);
		globalQuery.update();
	});
	listBox.selection.on('remove', function (value) {
		if (constraints.hasOwnProperty(value))
			removeConstraint(value);
		globalQuery.update();
	});

	listBox.selection.on('clear', function () {
		clearConstraints();
		globalQuery.update();
	});

	return {
		ownCnstrQuery: ownCnstrQuery
	}
}

return {
	setup: setup,
	setupTest: setupTest,
	FacetListBox: FacetListBox
};
}());
