/*
 * Facet control.
 */

var Facet = (function () {

var facetDefaultIsConjunctive = true;

/*
 * Setup the control in some container element.
 * container: container element as a jquery selection
 * globalQuery: the global query
 * name: name for the facet, to show the user
 * field: field name to use in requesting views from the backend
 */
function setup(container, globalQuery, name, field, isConjunctive) {
	function useIsConjunctive() {
		return isConjunctive == null ? facetDefaultIsConjunctive : isConjunctive;
	}

	var facetElt = $("<div class=\"facet\"></div>").appendTo(container);

	var topBoxElt = $("<div class=\"topbox\"></div>").appendTo(facetElt);
	$("<h1>" + name + "</h1>").appendTo(topBoxElt);
	var clearElt = $("<button type=\"button\" class=\"btn btn-block btn-mini btn-warning\" title=\"Clear the facet selection.\">Clear selection</button></ul>").appendTo(topBoxElt);
	var searchBoxElt = $("<form class=\"searchbox\"></form>").appendTo(topBoxElt);
	var searchBtnElt = $("<button type=\"submit\" class=\"btn btn-primary btn-link\" title=\"Search.\"></button>").appendTo(searchBoxElt);
	var searchInputElt = $("<input type=\"text\" autocomplete=\"off\" data-provide=\"typeahead\" title=\"Enter search term here.\"></input>").appendTo($("<div class=\"inputbox\"></div>").appendTo(searchBoxElt));
	var search = searchInputElt.typeahead();

	var listBoxElt = $("<div class=\"listbox\"></div>").appendTo(facetElt);
	var loadingIndicator = new LoadingIndicator.LoadingIndicator(listBoxElt);
	var listElt = $("<ul></ul>").appendTo(listBoxElt);
	var moreBoxElt = $("<div class=\"buttonbox\"></div>").appendTo(listBoxElt);
	var moreElt = $("<button type=\"button\" class=\"btn\" disabled=\"true\">More</button>").appendTo(moreBoxElt);

	LayoutUtils.fillElement(container, facetElt, 'vertical');
	LayoutUtils.setupPanelled(facetElt, topBoxElt, listBoxElt, 'vertical', 0, false);

	loadingIndicator.enabled(true);

	function setClearEnabled(enabled) {
		if (enabled)
			clearElt.removeAttr('disabled');
		else
			clearElt.attr('disabled', 'disabled');
	}
	setClearEnabled(false);

	function setMoreEnabled(enabled) {
		if (enabled) {
			moreElt.addClass('btn-primary');
			moreElt.removeAttr('disabled');
		} else {
			moreElt.removeClass('btn-primary');
			moreElt.attr('disabled', 'disabled');
		}
	}

	function setSearchErrorStatus(isError) {
		if (isError)
			searchInputElt.addClass('error');
		else
			searchInputElt.removeClass('error');
	}

	var viewValue = {
			counts: {
				type: 'countbyfieldvalue',
				field: field
			}
		};
	var constraints = {};
	var globalQueryResultWatcher = new Queries.ResultWatcher(function () {});
	globalQuery.addResultWatcher(globalQueryResultWatcher);
	var ownCnstrQuery = new Queries.Query(globalQuery.backendUrl());
	var contextQuery = new Queries.Query(globalQuery.backendUrl(), 'setminus', globalQuery, ownCnstrQuery);
	var contextQueryResultWatcher = new Queries.ResultWatcher(function () {});
	contextQuery.addResultWatcher(contextQueryResultWatcher);
	function clearConstraints() {
		var oldConstraints = constraints;
		constraints = {};
		$.each(oldConstraints, function (value, constraint) {
			globalQuery.removeConstraint(constraint);
			ownCnstrQuery.removeConstraint(constraint);
		});
		delete viewValue.counts['requiredkeys'];
		listBoxElt.removeClass('selected');
	}
	function removeConstraint(value) {
		var constraint = constraints[value];
		delete constraints[value];
		globalQuery.removeConstraint(constraint);
		ownCnstrQuery.removeConstraint(constraint);
		viewValue.counts.requiredkeys = viewValue.counts.requiredkeys.splice($.inArray(value, viewValue.counts.requiredkeys), 1);
		if ($.isEmptyObject(constraints)) {
			delete viewValue.counts['requiredkeys'];
			listBoxElt.removeClass('selected');
		}
	}
	function addConstraint(value) {
		setClearEnabled(value != null);
		contextQueryResultWatcher.enabled(value != null);

		var constraint = new Queries.Constraint();
		constraint.name(name + ": " + value);
		constraint.set({
			type: 'fieldvalue',
			field: field,
			value: value
		});
		listBoxElt.addClass('selected');
		constraint.onChange(function (changeType, query) {
			if (changeType == 'removed' && query == ownCnstrQuery && constraints.hasOwnProperty(value))
				removeConstraint(value);
		});
		if (constraints.hasOwnProperty(value))
			console.log("warning: duplicate constraint for value '" + value + "'");
		constraints[value] = constraint;
		globalQuery.addConstraint(constraint);
		ownCnstrQuery.addConstraint(constraint);

		if (!viewValue.counts.hasOwnProperty('requiredkeys'))
			viewValue.counts.requiredkeys = [];
		viewValue.counts.requiredkeys.push(value)

		globalQueryResultWatcher.set(viewValue);
		contextQueryResultWatcher.set(viewValue);
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
		listBoxElt.addClass('selected');
		viewValue.counts.requiredkeys = [value];
		globalQueryResultWatcher.set(viewValue);
		contextQueryResultWatcher.set(viewValue);
	}
	function select(value) {
		if (!useIsConjunctive() && !$.isEmptyObject(constraints)) {
			$.each(constraints, function (oldValue, constraint) {
				changeConstraint(value, oldValue, constraint);
			});
		} else if (!constraints.hasOwnProperty(value)) {
			addConstraint(value);
		} else {
			removeConstraint(value);
		}
	}
	function haveSelection() {
		return !$.isEmptyObject(constraints);
	}

	var curData = null;
	function setData(data) {
		function getSortedValues() {
			var sortedValues = [];
			for (value in data)
				sortedValues.push(value);
			sortedValues.sort(function (v1, v2) { return data[v2] - data[v1]; });
			return sortedValues;
		}
		function keyList(dict) {
			var list = [];
			for (key in dict)
				list.push(key);
			return list;
		}
		function addValue(value, count) {
			var classStr = constraints.hasOwnProperty(value) ? " class=\"selected\"" : "";
			var bracketedCountStr =  count == null ? "" : " [" + count + "]";
			var countStr =  count == null ? "no" : count;
			var itemElt = $("<li" + classStr + " title=\"Value '" + value + "' is in " + countStr + " events under current constraints. Click to select it.\">" + value + bracketedCountStr + "</li>").appendTo(listElt);
			itemElt.click(function() {
				select(value);
				globalQuery.update();
			});
		}
		curData = data;
		searchInputElt.val("");
		setSearchErrorStatus(false);
		listElt.find('li').remove();
		if (data != null) {
			searchInputElt.removeAttr('disabled');
			search.data('typeahead').source = keyList(data);
			var sortedValues = getSortedValues();
			for (var i in sortedValues) {
				var value = sortedValues[i];
				addValue(value, data[value]);
			}
		} else {
			searchInputElt.removeAttr('data-source');
			searchInputElt.attr('disabled', 'disabled');
		}
	}
	setData(null);

	var continuer = null;
	function addData(counts) {
		if (curData != null) {
			for (var i in counts) {
				var pair = counts[i];
				curData[pair[0]] = pair[1];
			}
			$.each(constraints, function (value, constraint) {
				if (!(value in curData))
					curData[value] = 0;
			});
			setData(curData);
			setMoreEnabled(continuer.hasMore());
		}
	};
	clearElt.click(function () {
		setClearEnabled(false);
		clearConstraints();
		globalQuery.update();
	});
	globalQuery.onChange(function () {
		if (!haveSelection()) {
			setData(null);
			loadingIndicator.enabled(true);
		}
	});
	contextQuery.onChange(function () {
		if (haveSelection()) {
			setData(null);
			loadingIndicator.enabled(true);
		}
	});
	ownCnstrQuery.onChange(function () {
		// If our own constraint changes we don't get any new result,
		// but still want to change the selection.
		if (haveSelection())
			setData(curData);
	});
	globalQueryResultWatcher.set(viewValue);
	globalQueryResultWatcher.setCallback(function(result, getContinuer) {
		if (result.counts.hasOwnProperty('error')) {
			setData(null);
			loadingIndicator.error('counts', true);
			loadingIndicator.enabled(true);
			setMoreEnabled(false);
		} else if (useIsConjunctive() || !haveSelection()) {
			loadingIndicator.error('counts', false);
			loadingIndicator.enabled(false);
			curData = {};
			continuer = getContinuer();
			addData(result.counts.counts);
		}
	});
	contextQueryResultWatcher.set(viewValue);
	contextQueryResultWatcher.enabled(false);
	contextQueryResultWatcher.setCallback(function(result, getContinuer) {
		if (result.counts.hasOwnProperty('error')) {
			setData(null);
			loadingIndicator.error('counts', true);
			loadingIndicator.enabled(true);
			setMoreEnabled(false);
		} else if (!useIsConjunctive() || false) {
			loadingIndicator.error('counts', false);
			loadingIndicator.enabled(false);
			curData = {};
			continuer = getContinuer();
			addData(result.counts.counts);
		}
	});
	searchBoxElt.submit(function () {
		var value = searchInputElt.val();
		if (curData != null && value in curData) {
			setSearchErrorStatus(false);
			select(value);
			globalQuery.update();
		} else
			setSearchErrorStatus(true);
		return false;
	});

	moreElt.click(function() {
		if (continuer != null)
			continuer.fetchNext(function(result) {
				addData(result.counts.counts);
			});
	});

	return ownCnstrQuery;
}

return {
	setup: setup
};
}());
