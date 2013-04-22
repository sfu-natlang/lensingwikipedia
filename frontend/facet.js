function setupFacet(container, globalQuery, name, view, makeConstraint) {
	container.append("<h1>" + name + "</h1>");
	container.append("<button>Clear</button>");
	var clearElt = container.find("button");
	container.append("<div class=\"listbox\"></div>");
	var boxElt = container.find(".listbox");
	boxElt.append("<ul></ul>");
	var listElt = boxElt.find("ul");

	var constraint = new Constraint();
	globalQuery.addConstraint(constraint);
	function select(value) {
		console.log("select " + value);
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
		if (loadingElt == null) {
			listElt.find("li").remove();
			loadingElt = listElt.append("<li class=\"loading\">Loading&hellip;</li>");
		}
	});

	globalQuery.onResult({
		counts: view
	}, function(result) {
		listElt.find("li").remove();
		loadingElt = null;
		for (value in result.counts)
			listElt.append("<li class=\"" + value + "\">" + value + " [" + result.counts[value] + "]</li>");
	});

	listElt.click(function(event) {
		var on = event.target;
		if (Object.prototype.toString.call(on) == "[object HTMLLIElement]")
			select($(on).attr("class"));
	});
}
