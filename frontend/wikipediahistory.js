/*
 * Things especially specific to the Wikipedia history domain.
 */

// Prefix for links to Wikipedia pages
baseWikipediaUrl = "https://en.wikipedia.org";

function createDescriptionList(container) {
	return $("<dl></dl>").appendTo(container);
}
function clearDescriptionList(listElt) {
	listElt.find("dt,dd").remove();
}
function addToDescriptionList(descriptions, listElt) {
	// This is to handle data that contains a single span per item rather than a list
	function handleSingleSpans(event) {
		event.descriptionReplacements = JSON.parse(event.descriptionReplacements);
		$.each(event.descriptionReplacements, function (itemText, itemInfo) {
			itemInfo.span = [itemInfo.span];
		});
	}

	$.each(descriptions, function (i, event) {
		var yearText = event.year > 0 ? event.year + " CE" : -event.year + " BCE";
		var yearUrl = baseWikipediaUrl + "/wiki/" + (event.year > 0 ? event.year : -event.year + "BC");
		var tooltipText = "Event ID " + event.dbid + " in " + event.year;
		if (event.hasOwnProperty('eventRoot'))
			tooltipText += ", predicate stem '" + event.eventRoot + "'";
		tooltipText += ".";
		handleSingleSpans(event);
		var replacements = prepareReplacements(event, baseWikipediaUrl);
		var descHtml = replace(event.description, replacements);
		var descElt = $("<dt title=\"" + tooltipText + "\"><a href=\"" + yearUrl + "\">" + yearText + "</a>: " + event.event + "</dt>" + "<dd>" + descHtml + "</dd>").appendTo(listElt);
		descElt.find("a").attr('target', '_blank');
	});
}
