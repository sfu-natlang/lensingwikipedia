/*
 * Things especially specific to the Wikipedia history domain.
 */

function createDescriptionList(container) {
	return $("<dl></dl>").appendTo(container);
}
function clearDescriptionList(listElt) {
	listElt.find("dt,dd").remove();
}
function addToDescriptionList(descriptions, listElt) {
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
