function setupEventDescriptionsList(container, globalQuery) {
	var listElt = $("<dl></dl>").appendTo(container);

	function resetList() {
		listElt.find("dt,dd").remove();
	}
	function addToList(descriptions) {
		$.each(descriptions, function (i, event) {
			var yearText = event.year > 0 ? event.year + " CE" : -event.year + " BCE";
			var yearUrl = baseWikipediaUrl + "/wiki/" + (event.year > 0 ? event.year : -event.year + "BC");
			$("<dt><a href=\"" + yearUrl + "\">" + yearText + "</a></dt>" + "<dd>" + event.descriptionHtml + "</dd>").appendTo(listElt);
		});
	}

	var loadingElt = null;
	globalQuery.onChange(function() {
		if (loadingElt == null) {
			resetList();
			loadingElt = listElt.append("<dt><dd class=\"loading\">Loading&hellip;</dd>");
		}
	});

	globalQuery.onResult({
		descriptions: {
			type: 'descriptions',
			page: 0
		}
	}, function(result, getContinuer) {
		resetList();
		loadingElt = null;
		addToList(result.descriptions.descriptions);
		continuer = getContinuer();
	});
}
