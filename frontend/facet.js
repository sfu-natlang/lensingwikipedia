function setupFacet(container, globalQuery, name, view, makeConstraint) {
	var facetElt = $("<div class=\"facet\"></div>").appendTo(container);

	var topBoxElt = $("<div class=\"topbox\"></div>").appendTo(facetElt);
	$("<h1>" + name + "</h1>").appendTo(topBoxElt);
	var clearElt = $("<button type=\"button\" class=\"btn btn-block btn-mini btn-warning\">Clear selection</button></ul>").appendTo(topBoxElt);
	var searchBoxElt = $("<form class=\"searchbox\"></form>").appendTo(topBoxElt);
	var searchBtnElt = $("<button type=\"submit\" class=\"btn btn-primary btn-link\"></button>").appendTo(searchBoxElt);
	var searchElt = $("<input type=\"text\" autocomplete=\"off\" data-provide=\"typeahead\"></input>").appendTo($("<div class=\"inputbox\"></div>").appendTo(searchBoxElt));
	var search = searchElt.typeahead();

	var listBoxElt = $("<div class=\"listbox\"></div>").appendTo(facetElt);
	var loadingElt = makeLoadingIndicator().prependTo(listBoxElt);
	var listElt = $("<ul></ul>").appendTo(listBoxElt);

	var verticalMarginsSize = 25; // Pixel size to account for margins etc.
	function fit() {
		facetElt.height(container.height());
		listBoxElt.height(facetElt.height() - topBoxElt.height() - verticalMarginsSize);
	}
	$(window).resize(fit);
	fit();

	var selectedValue = null;
	var constraint = new Constraint();
	globalQuery.addConstraint(constraint);
	function select(value) {
		selectedValue = value;
		var cnstrVal = makeConstraint(value);
		cnstrVal.name = name + ": " + value;
		constraint.set(cnstrVal);
		globalQuery.update();
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
		searchElt.val("");
		if (values != null) {
			searchElt.removeAttr('disabled');
			search.data('typeahead').source = keyList(values);
			for (value in values)
				addValue(value, values[value]);
		} else {
			searchElt.removeAttr('data-source');
			searchElt.attr('disabled', 'disabled');
			listElt.find('li').remove();
		}
	}
	setData(null);

	function setLoadingIndicator(enabled) {
		if (enabled)
			loadingElt.show();
		else
			loadingElt.hide();
		loadingElt.attr('display', 'hidden');
	}
	setLoadingIndicator(false);

	clearElt.click(function() {
		constraint.clear();
		globalQuery.update();
	});
	globalQuery.onChange(function() {
		setData(null);
	});
	globalQuery.onResult({
		counts: view
	}, function(result) {
		setData(result.counts.counts);
	});
	searchBoxElt.submit(function () {
		var value = searchElt.val();
		if (curData != null && value in curData) {
			searchElt.removeClass('error');
			select(value);
		} else
			searchElt.addClass('error');
		return false;
	});
}
