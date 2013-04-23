function setupEventDescriptionsList(container, globalQuery) {
	var listElt = $("<dl></dl>").appendTo(container);
	var moreBoxElt = $("<div class=\"buttonbox\"></div>").appendTo(container);
	var moreElt = $("<button type=\"button\" class=\"btn\" disabled=\"true\">More</button>").appendTo(moreBoxElt);

	function setMoreEnabled(enabled) {
		if (enabled) {
			moreElt.addClass('btn-primary');
			moreElt.removeAttr('disabled');
		} else {
			moreElt.removeClass('btn-primary');
			moreElt.attr('disabled', 'disabled');
		}
	}

	function resetList() {
		listElt.find("dt,dd").remove();
	}
	function addToList(descriptions) {
		$.each(descriptions, function (i, event) {
			var yearText = event.year > 0 ? event.year + " CE" : -event.year + " BCE";
			var yearUrl = baseWikipediaUrl + "/wiki/" + (event.year > 0 ? event.year : -event.year + "BC");
			var descElt = $("<dt><a href=\"" + yearUrl + "\">" + yearText + "</a></dt>" + "<dd>" + event.descriptionHtml + "</dd>").appendTo(listElt);
			descElt.find("a").attr('target', '_blank');
		});
	}

	var loadingElt = null;
	globalQuery.onChange(function() {
		if (loadingElt == null) {
			setMoreEnabled(false);
			resetList();
			loadingElt = listElt.append("<dt><dd class=\"loading\">Loading&hellip;</dd>");
		}
	});

	var continuer = null;
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
		setMoreEnabled(continuer.hasMore());
	});

	moreElt.click(function() {
		if (continuer != null)
			continuer.fetchNext(function(result) {
				addToList(result.descriptions.descriptions);
				setMoreEnabled(continuer.hasMore());
			});
	});
}
