/*
 * Control which lists event descriptions from a query.
 */

/*
 * Setup the control in some container element.
 * container: container element as a jquery selection
 * globalQuery: the global query
 */
function setupEventDescriptionsList(container, globalQuery) {
	var outerElt = $("<div class=\"eventdescriptionslist\"></div>").appendTo(container);
	var loadingIndicator = new LoadingIndicator(outerElt);
	var listElt = $("<dl></dl>").appendTo(outerElt);
	var moreBoxElt = $("<div class=\"buttonbox\"></div>").appendTo(outerElt);
	var moreElt = $("<button type=\"button\" class=\"btn\" disabled=\"true\">More</button>").appendTo(moreBoxElt);

	loadingIndicator.enabled(true);

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
	function formatDescription(text, replacements) {
		function clean(text) {
			var escapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
			return text.replace(/\[[0-9]+\]|[&<>]/g, function (old) {
				return escapes.hasOwnProperty(old) ? escapes[old] : "";
			});
		}

		var replacementsOrder = [];
		$.each(replacements, function (itemText, itemInfo) {
			replacementsOrder.push(itemText);
		});
		replacementsOrder.sort(function (repA, repB) { return replacements[repA].span[0] - replacements[repB].span[0] });

		var lastEndIndex = 0,
		    indexOffset = 0;
		$.each(replacementsOrder, function (id, itemText) {
			var itemInfo = replacements[itemText];
			var i = itemInfo.span[0], j = itemInfo.span[1];
			if (i < lastEndIndex) {
				console.log("warning: span " + i + ":" + j + " \"" + itemText + "\" overlaps previous span, not making a link");
			} else if (itemInfo.hasOwnProperty('url')) {
				var link = "<a href=\"" + baseWikipediaUrl + itemInfo.url + "\">" + itemText + "</a>";
				var oldLen = text.length;
				text = text.substring(0, lastEndIndex + indexOffset) + clean(text.substring(lastEndIndex + indexOffset, i + indexOffset)) + link + text.substring(j + indexOffset, text.length);
				lastEndIndex = j;
				indexOffset += text.length - oldLen;
			}
		});
		text = text.substring(0, lastEndIndex + indexOffset) + clean(text.substring(lastEndIndex + indexOffset, text.length));
		return text;
	}
	function addToList(descriptions) {
		$.each(descriptions, function (i, event) {
			var yearText = event.year > 0 ? event.year + " CE" : -event.year + " BCE";
			var yearUrl = baseWikipediaUrl + "/wiki/" + (event.year > 0 ? event.year : -event.year + "BC");
			var tooltipText = "Event ID " + event.dbid + " in " + event.year;
			if (event.hasOwnProperty('eventRoot'))
				tooltipText += ", predicate stem '" + event.eventRoot + "'";
			tooltipText += ".";
			var descHtml = formatDescription(event.description, JSON.parse(event.descriptionReplacements));
			var descElt = $("<dt title=\"" + tooltipText + "\"><a href=\"" + yearUrl + "\">" + yearText + "</a></dt>" + "<dd>" + descHtml + "</dd>").appendTo(listElt);
			descElt.find("a").attr('target', '_blank');
		});
	}

	globalQuery.onChange(function() {
		loadingIndicator.enabled(true);
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
		if (result.descriptions.hasOwnProperty('error')) {
			loadingIndicator.error('descriptions', true);
			loadingIndicator.enabled(true);
			setMoreEnabled(false);
		} else {
			loadingIndicator.error('descriptions', false);
			loadingIndicator.enabled(false);
			resetList();
			addToList(result.descriptions.descriptions);
			continuer = getContinuer();
			setMoreEnabled(continuer.hasMore());
		}
	});

	moreElt.click(function() {
		if (continuer != null)
			continuer.fetchNext(function(result) {
				addToList(result.descriptions.descriptions);
				setMoreEnabled(continuer.hasMore());
			});
	});
}
