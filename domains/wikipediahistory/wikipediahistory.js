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
		var sentenceSpan = event.sentenceSpan.split(",").map(function (i) { return +i; });

		handleSingleSpans(event);
		var replacements = makeURLReplacements(event.descriptionReplacements, baseWikipediaUrl);
		replacements = replacements.concat([
			{
				src: event.event,
				span: event.eventSpan.split(",").map(function (i) { return +i; }),
				pre: "<emph class=\"predicate\">",
				post: "</emph>"
			},
			{
				src: event.sentence,
				span: sentenceSpan,
				pre: "<emph class=\"sentence\">",
				post: "</emph>"
			}
		]);
		replacements = normalizeReplacements(replacements);

		var yearText = event.year > 0 ? event.year + " CE" : -event.year + " BCE";

		var yearUrl = baseWikipediaUrl + "/wiki/" + (event.year > 0 ? event.year : -event.year + "BC");
		var tooltipText = "Event ID " + event.id + " in " + event.year;
		if (event.hasOwnProperty('predicate'))
			tooltipText += ", predicate stem '" + event.predicate + "'";
		tooltipText += ".";

		var shortDesc = applyReplacements(event.sentence, replacements, sentenceSpan[0]);
		var longDesc = applyReplacements(event.description, replacements);

		var dtElt = $("<dt title=\"" + tooltipText + "\"><a href=\"" + yearUrl + "\">" + yearText + "</a>: " + event.predicate + "</dt>").appendTo(listElt);
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
