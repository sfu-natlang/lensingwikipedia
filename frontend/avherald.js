/*
 * Things especially specific to the The Aviation Herald domain.
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
	$.each(descriptions, function (id, event) {
		var sentenceSpan = event.sentenceSpan.split(",").map(function (i) { return +i; });

		event.descriptionReplacements = JSON.parse(event.descriptionReplacements);
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

		// Find reference links and remove them from replacements
		var refLinks = [];
		$.each(event.descriptionReplacements, function (itemText, itemInfo) {
			if (itemText == itemInfo.url)
				refLinks.push(itemInfo.url);
		});
		$.each(refLinks, function (i, url) {
			delete event.descriptionReplacements[url];
		});
		// Clip to before the reference links
		var i = event.description.indexOf("http://");
		if (i > 0)
			event.description = event.description.substring(0, i);

		var tooltipText = "Event ID " + event.dbid + " in " + event.year;
		if (event.hasOwnProperty('eventRoot'))
			tooltipText += ", predicate stem '" + event.eventRoot + "'";
		tooltipText += ".";

		var shortDesc = applyReplacements(event.sentence, replacements, sentenceSpan[0]);
		var longDesc = applyReplacements(event.description, replacements);

		var refsElt = $("<ul class=\"eventrefs\"></ul>");
		$.each(refLinks, function (i, url) {
			$("<li><a href=\"" + url + "\" target=\"_blank\"><span class=\"icon-globe\"></span></a></li>").appendTo(refsElt);
		});

		var dtElt = $("<dt title=\"" + tooltipText + "\"><a href=\"" + event.url + "\">" + event.title + "</a></dt>").appendTo(listElt);
		var ddElt = $("<dd>" + shortDesc + "</dd>").appendTo(listElt);
		dtElt.find("a").attr('target', '_blank');
		ddElt.find("a").attr('target', '_blank');
		var expandFullElt = $("<span class=\"icon-plus\"></span>").appendTo(ddElt);
		var fullElt = $("<div class=\"eventfulldescription\">" + longDesc + "</div>").appendTo(ddElt);
		refsElt.appendTo(ddElt);
		expandFullElt.click(function () {
			$(this).toggleClass('icon-plus icon-minus');
			fullElt.toggleClass('expanded');
		});
	});
}
