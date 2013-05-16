function setupFacet(container, globalQuery, name, field) {
	var facetElt = $("<div class=\"facet\"></div>").appendTo(container);

	var topBoxElt = $("<div class=\"topbox\"></div>").appendTo(facetElt);
	$("<h1>" + name + "</h1>").appendTo(topBoxElt);
	var clearElt = $("<button type=\"button\" class=\"btn btn-block btn-mini btn-warning\" title=\"Clear the facet selection.\">Clear selection</button></ul>").appendTo(topBoxElt);
	var searchBoxElt = $("<form class=\"searchbox\"></form>").appendTo(topBoxElt);
	var searchBtnElt = $("<button type=\"submit\" class=\"btn btn-primary btn-link\" title=\"Search.\"></button>").appendTo(searchBoxElt);
	var searchInputElt = $("<input type=\"text\" autocomplete=\"off\" data-provide=\"typeahead\" title=\"Enter search term here.\"></input>").appendTo($("<div class=\"inputbox\"></div>").appendTo(searchBoxElt));
	var search = searchInputElt.typeahead();

	var listBoxElt = $("<div class=\"listbox\"></div>").appendTo(facetElt);
	var loadingIndicator = new LoadingIndicator(listBoxElt);
	var listElt = $("<ul></ul>").appendTo(listBoxElt);
	var moreBoxElt = $("<div class=\"buttonbox\"></div>").appendTo(listBoxElt);
	var moreElt = $("<button type=\"button\" class=\"btn\" disabled=\"true\">More</button>").appendTo(moreBoxElt);

	fillElement(container, facetElt, 'vertical');
	setupPanelled(facetElt, topBoxElt, listBoxElt, 'vertical', 0, false);

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

	var selectedValue = null;
	var constraint = new Constraint();
	globalQuery.addConstraint(constraint);
	var ownCnstrQuery = new Query(globalQuery.backendUrl());
	ownCnstrQuery.addConstraint(constraint);
	var contextQuery = new Query(globalQuery.backendUrl(), 'setminus', globalQuery, ownCnstrQuery);
	var contextQueryResultWatcher = new ResultWatcher(function () {});
	contextQuery.addResultWatcher(contextQueryResultWatcher);
	function select(value) {
		setClearEnabled(value != null);
		contextQueryResultWatcher.enabled(value != null);
		selectedValue = value;
		if (value != null) {
			constraint.name(name + ": " + value);
			constraint.set({
				type: 'fieldvalue',
				field: field,
				value: value
			});
			listBoxElt.addClass('selected');
			globalQuery.update();
		} else {
			listBoxElt.removeClass('selected');
		}
	}
	function haveSelection() {
		return selectedValue != null;
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
			var classStr = value == selectedValue ? " class=\"selected\"" : "";
			var bracketedCountStr =  count == null ? "" : " [" + count + "]";
			var countStr =  count == null ? "no" : count;
			var itemElt = $("<li" + classStr + " title=\"Value '" + value + "' is in " + countStr + " events under current constraints. Click to select it.\">" + value + bracketedCountStr + "</li>").appendTo(listElt);
			itemElt.click(function() {
				select(value);
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
			for (i in sortedValues) {
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
		for (var i in counts) {
			var pair = counts[i];
			curData[pair[0]] = pair[1];
		}
		if (haveSelection() && !(selectedValue in curData))
			curData[selectedValue] = 0;
		setData(curData);
		setMoreEnabled(continuer.hasMore());
	};
	clearElt.click(function () {
		constraint.clear();
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
	constraint.onChange(function (changeType) {
		if (changeType == 'removed')
			select(null);
	});
	globalQuery.onResult({
		counts: {
			type: 'countbyfieldvalue',
			field: field
		}
	}, function(result, getContinuer) {
		if (result.counts.hasOwnProperty('error')) {
			loadingIndicator.error('counts', true);
			loadingIndicator.enabled(true);
		} else if (!haveSelection()) {
			loadingIndicator.error('counts', false);
			loadingIndicator.enabled(false);
			curData = {};
			continuer = getContinuer();
			addData(result.counts.counts);
		}
	});
	contextQueryResultWatcher.set({
		counts: {
			type: 'countbyfieldvalue',
			field: field
		}
	});
	contextQueryResultWatcher.enabled(false);
	contextQueryResultWatcher.setCallback(function(result, getContinuer) {
		if (result.counts.hasOwnProperty('error')) {
			loadingIndicator.error('counts', true);
			loadingIndicator.enabled(true);
		} else if (haveSelection()) {
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
			select(value, curData[value]);
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
}
