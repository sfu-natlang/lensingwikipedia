/*
 * Setup the control in some container element.
 * container: container element as a jquery selection
 * initialQuery: the initial (empty) query
 * globalQuery: the global query
 */
function setupCompare(container, globalQuery, facets) {
	var outerElt = $('<div class="compare"></div>').appendTo(container);
	fillElement(container, outerElt, 'vertical');
}
