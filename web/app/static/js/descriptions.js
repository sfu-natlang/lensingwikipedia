/*
 * Things especially specific to the The Aviation Herald domain.
 */

/*
 * Build URL link replacements from Json data.
 * replacementsInfo: parsed Json data for replacements
 * baseUrl: URL prefix for links that don't look like an absolute URL
 */
function makeURLReplacements(replacementsInfo, baseUrl) {
	function isAbsoluteUrl(url) {
		return url.search(/^[a-z][a-z0-9+.-]+:/i) == 0;
	}

	var replacementsList = [];
	$.each(replacementsInfo, function (itemText, itemInfo) {
		$.each(itemInfo.span, function (spanI, span) {
			var url = itemInfo.url;
			if (!isAbsoluteUrl(url))
				url = baseUrl + url;
			var link = "<a href=\"" + url + "\">" + itemText + "</a>";
			replacementsList.push({
				src: itemText,
				pre: "<a href=\"" + url + "\">",
				post: "</a>",
				span: span
			});
		});
	});

	return replacementsList;
}

/*
 * Normalize a list of replacements to be applied.
 * replacements: List of replacements. The order of the list gives priority;
 *	later replacements are split up into multiple spans as needed to resolve
 *	any non-nesting overlaps with earlier spans. The function may change the
 *	order of elements in the list it is given.
 */
function normalizeReplacements(replacements) {
	function dupRep(rep, span) {
		return {
			src: rep.src,
			pre: rep.pre,
			post: rep.post,
			span: span,
			_priority: rep._priority
		}
	}

	function listToLinkedList(list) {
		if (list.length == 0)
			return null;
		var root = { rep: list[0], next: null },
		    node = root;
		for (var i = 1; i < list.length; i++) {
			var newNode = { rep: list[i], next: null };
			node.next = newNode;
			node = newNode;
		}
		return root;
	}

	function linkedListToList(linkedList) {
		var node = linkedList,
		    list = [];
		while (node != null) {
			list.push(node.rep);
			node = node.next;
		}
		return list;
	}

	// Here we first sort the replacements by span starting index and then traverse them in that order. As we traverse we maintain a stack of elements that contain the starting position of the replacement we are looking at. Since we are traversing in order and resolve non-nesting overlaps as we see them, if the current replacement overlaps any other replacement without nesting it must be the one on the top of the stack (and possibly also others later in the stack). Thus we check for a conflict with the replacement on the top of the stack, and if we find one split either the current replacement or the one on the top of the stack (depending on relative priority) to resolve the conflict. Either way we then insert the added span into the list as a new replacement and continue; if the current span also conflicts with other replacements later in the stack, those conflicts are resolved in their turn. When we split the current replacement we can't immediately insert the added span (because there may be other replacements that need to go first), but defer it until we pop the containing span that was in conflict.

	for (var repI = 0; repI < replacements.length; repI++)
		replacements[repI]._priority = repI;
	replacements.sort(function (repA, repB) {
		return repA.span[0] - repB.span[0];
	});
	var normalized = listToLinkedList(replacements);

	var node = normalized,
	    containing = [];
	while (true) {
		// Advance to next node in the list
		while (containing.length > 0 && (node.next == null || node.next.rep.span[0] >= containing[containing.length - 1].rep.span[1])) {
			var popped = containing.pop();
			for (var i = 0; i < popped._addAfter.length; i++)
				node.next = { rep: popped._addAfter[i], next: node.next };
		}
		if (node.next == null)
			break;
		if (node.next.rep.span[0] < node.rep.span[1]) {
			node._addAfter = [];
			containing.push(node);
		}
		node = node.next;

		// Check if this span sticks out of the current containing span
		topContaining = containing[containing.length - 1];
		if (containing.length > 0 && node.rep.span[1] > topContaining.rep.span[1]) {
			if (topContaining.rep._priority < node.rep._priority) {
				// Split the new node span
				var firstPart = dupRep(node.rep, [node.rep.span[0], topContaining.rep.span[1]]);
				var secondPart = dupRep(node.rep, [topContaining.rep.span[1], node.rep.span[1]]);
				node.rep = firstPart;
				topContaining._addAfter.push(secondPart);
			} else {
				// Split the current containing span
				var firstPart = dupRep(topContaining.rep, [topContaining.rep.span[0], node.rep.span[0]]);
				var secondPart = dupRep(topContaining.rep, [node.rep.span[0], topContaining.rep.span[1]]);
				topContaining.rep = firstPart;
				node.next = { rep: secondPart, next: node.next };
				containing.pop();
			}
		}
	}

	return linkedListToList(normalized);
}

/*
 * Apply replacements to text.
 * text: The text to replace on.
 * replacements: The list of normalized replacements.
 * indexOffset: Index of the substring provided as text, relative to whatever
 *	longer string the spans are for.
 * clipSpans: If set, spans that go outside the substring are clipped to fit;
 *	otherwise they are ignored.
 * onlyFirst: If set, only the first of any identical replacement for the same
 *	text is applied.
 */
function applyReplacements(text, replacements, initIndexOffset, clipSpans, onlyFirst) {
	function clean(text) {
		var escapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
		return text.replace(/\[[0-9]+\]|[&<>]/g, function (old) {
			return escapes.hasOwnProperty(old) ? escapes[old] : "";
		});
	}

	if (initIndexOffset == null)
		initIndexOffset = 0;
	if (clipSpans == null)
		clipSpans = true;
	if (onlyFirst == null)
		onlyFirst = false;
	var endIndexOffset = initIndexOffset + text.length;

	// Index all the insertions that we want to apply
	var inserts = [],
	    seen = {};
	for (var repI = 0; repI < replacements.length; repI++) {
		var rep = replacements[repI];
		var i = rep.span[0], j = rep.span[1];
		if (j <= initIndexOffset || i >= endIndexOffset)
			continue;
		if (clipSpans) {
			if (i < initIndexOffset)
				i = initIndexOffset;
			if (j > endIndexOffset)
				j = endIndexOffset;
		} else if (i < initIndexOffset || j > endIndexOffset)
			continue;
		if (onlyFirst) {
			var key = [rep.src, rep.pre, rep.post];
			if (seen.hasOwnProperty(key))
				continue;
			seen[key] = true;
		}
		if (rep.pre != null) {
			var i2 = i - initIndexOffset;
			if (inserts[i2] == null)
				inserts[i2] = [[], []];
			inserts[i2][0].push(rep.pre);
		}
		if (rep.post != null) {
			var j2 = j - initIndexOffset;
			if (inserts[j2] == null)
				inserts[j2] = [[], []];
			inserts[j2][1].push(rep.post);
		}
	}

	// Reverse the order of all the posts being inserted
	for (var index = 0; index < inserts.length; index++)
		if (inserts[index] != null)
			inserts[index][1].reverse();

	// Do all the inserts
	var lastEndIndex = 0,
	    indexOffset = -initIndexOffset,
	    output = [];
	for (var index = 0; index < inserts.length; index++) {
		var insertsHere = inserts[index];
		if (insertsHere == null)
			continue;
		var oldLen = text.length;
		output.push(clean(text.substring(lastEndIndex, index)));
		for (var partI = 1; partI >= 0; partI--)
			for (var insertI = 0; insertI < insertsHere[partI].length; insertI++)
				output.push(insertsHere[partI][insertI]);
		lastEndIndex = index;
		indexOffset += text.length - oldLen;
	}
	output.push(clean(text.substring(lastEndIndex, text.length)));

	return output.join('');
}
