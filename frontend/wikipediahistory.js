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
		handleSingleSpans(event);
		var replacements = prepareReplacements(event, baseWikipediaUrl);
		var yearText = event.year > 0 ? event.year + " CE" : -event.year + " BCE";
		var sentenceSpan = event.sentenceSpan.split(",");
		var sentenceStartIndex = +sentenceSpan[0];

		var yearUrl = baseWikipediaUrl + "/wiki/" + (event.year > 0 ? event.year : -event.year + "BC");
		var tooltipText = "Event ID " + event.dbid + " in " + event.year;
		if (event.hasOwnProperty('eventRoot'))
			tooltipText += ", predicate stem '" + event.eventRoot + "'";
		tooltipText += ".";

		var shortDesc = replace(event.sentence, replacements, sentenceStartIndex);
		var longDesc = replace(event.description, replacements);

		var dtElt = $("<dt title=\"" + tooltipText + "\"><a href=\"" + yearUrl + "\">" + yearText + "</a>: " + event.event + "</dt>").appendTo(listElt);
		var ddElt = $("<dd>" + shortDesc + "</dd>").appendTo(listElt);
		dtElt.find("a").attr('target', '_blank');
		ddElt.find("a").attr('target', '_blank');

		// Expansion to long description
		if (event.description != event.sentence) {
			var expandFullElt = $("<span class=\"icon-plus\"></span>").appendTo(ddElt);
			var fullElt = $("<div class=\"eventfulldescription\">" + longDesc + "</div>").appendTo(ddElt);
			expandFullElt.click(function () {
				$(this).toggleClass('icon-plus icon-minus');
				fullElt.toggleClass('expanded');
			});
		}
	});
}
