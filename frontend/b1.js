function setupEventDescriptionsList(container, globalQuery) {
	container.append("<h1>Events</h1>");
	container.append("<dl></dl>");
	container.append("<button class=\"more\">More</button>");
	var listElt = container.find("dl"),
	    moreElt = container.find(".more");

	function resetList() {
		listElt.find("dt,dd").remove();
	}
	function addToList(descriptions) {
		$.each(descriptions, function (i, event) {
			listElt.append("<dt>" + event.year + "</dt>" + "<dd>" + event.descriptionHtml + "</dd>");
		});
	}

	var loadingElt = null;
	globalQuery.onChange(function() {
		if (loadingElt == null) {
			resetList();
			loadingElt = listElt.append("<dt></dt><dd class=\"loading\">Loading&hellip;</a></dd>");
		}
	});

	var continuer = null;
	globalQuery.onResult({
		descriptions: {
			type: 'descriptions',
			page: 0
		}
	}, function(result, getContinuer) {
		loadingElt = null;
		resetList();
		addToList(result.descriptions.descriptions);
		continuer = getContinuer();
	});
	moreElt.click(function() {
		if (continuer != null)
			continuer.watchNext(function(result) {
				addToList(result.descriptions.descriptions);
			});
	});
}
