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

	verticalFill(container, facetElt);
	setupPanelled(facetElt, topBoxElt, listBoxElt, 'vertical', 0, false);

	function setLoadingIndicator(enabled) {
		loadingElt.css('display', enabled ? '' : 'none');
	}
	setLoadingIndicator(true);

	function setSearchErrorStatus(isError) {
		if (isError)
			searchInputElt.addClass('error');
		else
			searchInputElt.removeClass('error');
	}

	var selectedValue = null;
	var constraint = new Constraint();
	globalQuery.addConstraint(constraint);
	function select(value) {
		selectedValue = value;
		if (value != null) {
			var cnstrVal = makeConstraint(value);
			cnstrVal.name = name + ": " + value;
			constraint.set(cnstrVal);
			globalQuery.update();
		}
	}

	var curData = null;
	function setData(values) {
		function keyList(dict) {
			var list = [];
			for (key in dict)
				list.push(key);
			return list;
		}
		function addValue(value, count) {
			var classStr = value == selectedValue ? " class=\"selected\"" : "";
			var itemElt = $("<li" + classStr + ">" + value + " [" + count + "]</li>").appendTo(listElt);
			itemElt.click(function() {
				select(value);
			});
		}
		curData = values;
		searchInputElt.val("");
		setSearchErrorStatus(false);
		if (values != null) {
			searchInputElt.removeAttr('disabled');
			search.data('typeahead').source = keyList(values);
			for (value in values)
				addValue(value, values[value]);
		} else {
			searchInputElt.removeAttr('data-source');
			searchInputElt.attr('disabled', 'disabled');
			listElt.find('li').remove();
		}
	}
	setData(null);

	clearElt.click(function () {
		constraint.clear();
		globalQuery.update();
	});
	globalQuery.onChange(function () {
		setData(null);
		setLoadingIndicator(true);
	});
	constraint.onChange(function (changeType) {
		if (changeType == 'removed')
			select(null);
	});
	globalQuery.onResult({
		counts: view
	}, function(result) {
		setLoadingIndicator(false);
		setData(result.counts.counts);
	});
	searchBoxElt.submit(function () {
		var value = searchInputElt.val();
		if (curData != null && value in curData) {
			setSearchErrorStatus(false);
			select(value);
		} else
			setSearchErrorStatus(true);
		return false;
	});
}
