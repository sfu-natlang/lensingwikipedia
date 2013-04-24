function setupFacet(container, globalQuery, name, view, makeConstraint) {
	var facetElt = $("<div class=\"facet\"></div>").appendTo(container);
	var topBoxElt = $("<div class=\"topbox\"></div>").appendTo(facetElt);
	var listBoxElt = $("<div class=\"listbox\"></div>").appendTo(facetElt);
	var listElt = $("<ul></ul>").appendTo(listBoxElt);

	$("<h1>" + name + "</h1>").appendTo(topBoxElt);
	var clearElt = $("<button type=\"button\" class=\"btn btn-block btn-mini btn-warning\">Clear selection</button></ul>").appendTo(topBoxElt);

	var verticalMarginsSize = 25; // Pixel size to account for margins etc.
	function fit() {
		facetElt.height(container.height());
		listBoxElt.height(facetElt.height() - topBoxElt.height() - verticalMarginsSize);
	}
	$(window).resize(fit);
	fit();

	var constraint = new Constraint();
	globalQuery.addConstraint(constraint);
	function select(value) {
		var cnstrVal = makeConstraint(value);
		cnstrVal.name = name + ": " + value;
		constraint.set(cnstrVal);
		globalQuery.update();
	}
	clearElt.click(function() {
		constraint.clear();
		globalQuery.update();
	});

	var loadingElt = null;
	globalQuery.onChange(function() {
		listElt.find("li").remove();
		if (loadingElt == null)
			loadingElt = makeLoadingIndicator().prependTo(listBoxElt);
	});

	function addRole(role, count) {
		var itemElt = $("<li class=\"" + role + "\">" + role + " [" + count + "]</li>").appendTo(listElt);
		itemElt.click(function() {
			var cnstrVal = makeConstraint(role);
			cnstrVal.name = name + ": " + role;
			constraint.set(cnstrVal);
			globalQuery.update();
		});
	}

	globalQuery.onResult({
		counts: view
	}, function(result) {
		if (loadingElt != null) {
			listBoxElt.find(".loadingindicator").remove();
			loadingElt = null;
		}
		for (value in result.counts.counts)
			addRole(value, result.counts.counts[value]);
	});
}
