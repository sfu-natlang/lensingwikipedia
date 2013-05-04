function setupEventDescriptionsList(container, globalQuery) {
	var outerElt = $("<div class=\"eventdescriptionslist\"></div>").appendTo(container);
	var loadingElt = makeLoadingIndicator().prependTo(outerElt);
	var listElt = $("<dl></dl>").appendTo(outerElt);
	var moreBoxElt = $("<div class=\"buttonbox\"></div>").appendTo(outerElt);
	var moreElt = $("<button type=\"button\" class=\"btn\" disabled=\"true\">More</button>").appendTo(moreBoxElt);

	function setLoadingIndicator(enabled) {
		loadingElt.css('display', enabled ? '' : 'none');
	}
	setLoadingIndicator(true);

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
			var descElt = $("<dt title=\"Event in " + event.year + ".\"><a href=\"" + yearUrl + "\">" + yearText + "</a></dt>" + "<dd>" + event.descriptionHtml + "</dd>").appendTo(listElt);
			descElt.find("a").attr('target', '_blank');
		});
	}

	globalQuery.onChange(function() {
		setLoadingIndicator(true);
		setMoreEnabled(false);
		resetList();
	});

	var continuer = null;
	globalQuery.onResult({
		descriptions: {
			type: 'descriptions',
			page: 0
		}
	}, function(result, getContinuer) {
		setLoadingIndicator(false);
		resetList();
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
