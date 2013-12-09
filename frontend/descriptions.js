/*
 * Things especially specific to the The Aviation Herald domain.
 */

/*
 * Prepare replacements for an event structure to be used by the other functions.
 */
function prepareReplacements(event, baseUrl, extraReplacements) {
	function isAbsoluteUrl(url) {
		return url.search(/^[a-z][a-z0-9+.-]+:/i) == 0;
	}

	if (extraReplacements == null)
		extraReplacements = [];
	
	descriptionReplacements = typeof(event.descriptionReplacements) == 'string' ?  JSON.parse(event.descriptionReplacements) : event.descriptionReplacements;

	var replacements = [].concat(extraReplacements);
	$.each(descriptionReplacements, function (itemText, itemInfo) {
		$.each(itemInfo.span, function (spanId, span) {
			var url = itemInfo.url;
			if (!isAbsoluteUrl(url))
				url = baseUrl + url;
			var link = "<a href=\"" + url + "\">" + itemText + "</a>";
			replacements.push({ src: itemText, dst: link, span: span });
		});
	});

	replacements.sort(function (repA, repB) { return repA.span[0] - repB.span[0] });

	return replacements;
}

// Apply replacements to text.
// indexOffset: Index of the substring provided as text, relative to whatever longer string the spans are for.
function replace(text, replacements, initIndexOffset) {
	if (initIndexOffset == null)
		initIndexOffset = 0;

	function clean(text) {
		var escapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
		return text.replace(/\[[0-9]+\]|[&<>]/g, function (old) {
			return escapes.hasOwnProperty(old) ? escapes[old] : "";
		});
	}

	var lastEndIndex = 0,
	    endIndexOffset = initIndexOffset + text.length,
	    indexOffset = -initIndexOffset,
	    seen = {};
	$.each(replacements, function (id, item) {
		var i = item.span[0], j = item.span[1];
		if (i < initIndexOffset || j > endIndexOffset) {
			// continue
		} else if (seen.hasOwnProperty(item.src)) {
			// continue
		} else if (i < lastEndIndex) {
			console.log("warning: span " + i + ":" + j + " \"" + item.src + "\" overlaps previous span, not making a link");
		} else {
			var oldLen = text.length;
			text = text.substring(0, lastEndIndex + indexOffset) + clean(text.substring(lastEndIndex + indexOffset, i + indexOffset)) + item.dst + text.substring(j + indexOffset, text.length);
			lastEndIndex = j;
			indexOffset += text.length - oldLen;
			seen[item.src] = true;
		}
	});

	text = text.substring(0, lastEndIndex + indexOffset) + clean(text.substring(lastEndIndex + indexOffset, text.length));

	return text;
}
