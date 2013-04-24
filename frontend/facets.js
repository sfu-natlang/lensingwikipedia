function setupFacets(container, globalQuery, facetMakers) {
	var facetElts = [];
	for (var i in facetMakers) {
		var facetBoxElt = $("<div class=\"facetbox\"></div>").appendTo(container);
		facetElts.push(facetBoxElt);
		facetMakers[i](facetBoxElt);
	}

	function fit() {
		var boxWidth = (container.width() - 1) / 3; // The -1 keeps the boxs on the same horizontal line
		for (i in facetElts) {
			var facetElt = facetElts[i];
			facetElt.width(boxWidth).height(container.height());
		}
	}
	$(window).resize(fit);
	fit();
}
