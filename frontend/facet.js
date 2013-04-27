function setupFacet(container, globalQuery, name, view, makeConstraint) {
	var facetElt = $("<div class=\"facet\"></div>").appendTo(container);

	var topBoxElt = $("<div class=\"topbox\"></div>").appendTo(facetElt);
	$("<h1>" + name + "</h1>").appendTo(topBoxElt);
	var clearElt = $("<button type=\"button\" class=\"btn btn-block btn-mini btn-warning\">Clear selection</button></ul>").appendTo(topBoxElt);
	var searchBoxElt = $("<form class=\"searchbox\"></form>").appendTo(topBoxElt);
	var searchBtnElt = $("<button type=\"submit\" class=\"btn btn-primary btn-link\"></button>").appendTo(searchBoxElt);
	var searchInputElt = $("<input type=\"text\" autocomplete=\"off\" data-provide=\"typeahead\"></input>").appendTo($("<div class=\"inputbox\"></div>").appendTo(searchBoxElt));
	var search = searchInputElt.typeahead();

	var listBoxElt = $("<div class=\"listbox\"></div>").appendTo(facetElt);
	var loadingElt = makeLoadingIndicator().prependTo(listBoxElt);
	var listElt = $("<ul></ul>").appendTo(listBoxElt);

	fillElement(container, facetElt, 'vertical');
	setupPanelled(facetElt, topBoxElt, listBoxElt, 'vertical', 0, false);

	function setLoadingIndicator(enabled) {
		loadingElt.css('display', enabled ? '' : 'none');
	}
	setLoadingIndicator(true);

	function setClearEnabled(enabled) {
		if (enabled)
			clearElt.removeAttr('disabled');
		else
			clearElt.attr('disabled', 'disabled');
	}
	setClearEnabled(false);

	function setSearchErrorStatus(isError) {
		if (isError)
			searchInputElt.addClass('error');
		else
			searchInputElt.removeClass('error');
	}

	var curData = null;
	function setData(data, onClick, itemClass) {
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
			var classStr = value == itemClass != null ? " class=\"" + itemClass + "\"" : "";
			var countStr =  count == null ? "" : " [" + count + "]";
			var itemElt = $("<li" + classStr + ">" + value + countStr + "</li>").appendTo(listElt);
			if (onClick != null)
				itemElt.click(function() {
					onClick(value, data[value]);
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

	function setSelectedData(value) {
		var data = {};
		data[value] = null;
		setData(data, null, "selected");
	}

	var selectedValue = null;
	var constraint = new Constraint();
	globalQuery.addConstraint(constraint);
	function select(value, count) {
		setClearEnabled(value != null);
		selectedValue = value;
		if (value != null) {
			var cnstrVal = makeConstraint(value);
			cnstrVal.name = name + ": " + value;
			constraint.set(cnstrVal);
			globalQuery.update();
			setSelectedData(value);
		}
	}
	function haveSelection() {
		return selectedValue != null;
	}

	function setQueryData(data) {
		setData(data, select);
	}

	clearElt.click(function () {
		constraint.clear();
		globalQuery.update();
	});
	globalQuery.onChange(function () {
		if (!haveSelection()) {
			setData(null);
			setLoadingIndicator(true);
		}
	});
	constraint.onChange(function (changeType) {
		if (changeType == 'removed')
			select(null);
	});
	globalQuery.onResult({
		counts: view
	}, function(result) {
		if (!haveSelection()) {
			setLoadingIndicator(false);
			setQueryData(result.counts.counts);
		}
	});
	searchBoxElt.submit(function () {
		if (!haveSelection()) {
			var value = searchInputElt.val();
			if (curData != null && value in curData) {
				setSearchErrorStatus(false);
				select(value, curData[value]);
			} else
				setSearchErrorStatus(true);
		}
		return false;
	});
}
