/*
 * Things especially specific to the Wikipedia history domain.
 */

var WikipediaHistoryDomain = (function () {

// Prefix for links to Wikipedia pages
baseWikipediaUrl = "https://en.wikipedia.org";

// List of data fields to include in help text (these don't necessarily have to be real field names, just text to show in a list)
var helpFieldsList = [
	"year",
	"predicate",
	"location",
	"currentcountry",
	"person",
	"description",
	"category",
	"role",
	"roleA0, roleA1, etc."
];

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
		var replacements = TextReplacements.makeURLReplacements(event.descriptionReplacements, baseWikipediaUrl);
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
		replacements = TextReplacements.normalize(replacements);

		var yearText = event.year > 0 ? event.year + " CE" : -event.year + " BCE";

		var yearUrl = baseWikipediaUrl + "/wiki/" + (event.year > 0 ? event.year : -event.year + "BC");
		var tooltipText = "Event ID " + event.id + " in " + event.year;
		if (event.hasOwnProperty('predicate'))
			tooltipText += ", predicate stem '" + event.predicate + "'";
		tooltipText += ".";

		var shortDesc = TextReplacements.apply(event.sentence, replacements, sentenceSpan[0]);
		var longDesc = TextReplacements.apply(event.description, replacements);

		var dtElt = $("<dt title=\"" + tooltipText + "\"><a href=\"" + yearUrl + "\">" + yearText + "</a>: " + event.predicate + "</dt>").appendTo(listElt);
		var ddElt = $("<dd>" + shortDesc + "</dd>").appendTo(listElt);
		dtElt.find("a").attr('target', '_blank');
		ddElt.find("a").attr('target', '_blank');

		// Expansion to long description
		if (event.description != event.sentence) {
			var expandFullElt = $("<span class=\"glyphicon glyphicon-plus-sign\"></span>").appendTo(ddElt);
			var fullElt = $("<div class=\"eventfulldescription\">" + longDesc + "</div>").appendTo(ddElt);
			expandFullElt.click(function () {
				$(this).toggleClass('glyphicon-plus-sign glyphicon-minus-sign');
				fullElt.toggleClass('expanded');
			});
		}
	});
}

return {
	helpFieldsList: helpFieldsList,
	createDescriptionList: createDescriptionList,
	clearDescriptionList: clearDescriptionList,
	addToDescriptionList: addToDescriptionList
};
}());
