function jqueryToD3(querySel) {
	return d3.select(querySel[0]);
}

/*
 * Setup non-scaling elements in an SVG (which should probably have
 * preserveAspectRatio set) so that if the SVG element changes size these
 * elements are not distorted. For this to work the SVG element being draw to
 * needs to be wrapped inside another SVG element, which is the one passed to
 * this function.
 *
 * This idea is from:
 * http://phrogz.net/svg/libraries/SVGPanUnscale.js
 * http://meloncholy.com/blog/making-responsive-svg-graphs.
 */
function dontScaleSvgParts(svg, eltPat, fixDelay) {
	if (fixDelay == null) fixDelay = 100;
	var rawSvg = svg[0];

	function unscale(elt) {
		var xform = elt.scaleIndependentXForm;
		if (xform == null) {
			xform = elt.scaleIndependentXForm = rawSvg.createSVGTransform();
			elt.transform.baseVal.appendItem(xform);
		}
		var trans = rawSvg.getTransformToElement(elt.parentNode);
		trans.e = trans.f = 0;
		xform.setMatrix(trans);
	}

	function unscaleAll() {
		svg.find(eltPat).each(function () {
			unscale(this);
		});
	}
	unscaleAll();

	var fixTimer = null;
	$(window).resize(function () {
		if (fixTimer != null)
			clearTimeout(fixTimer);
		updateTimer = setTimeout(unscaleAll, fixDelay);
	});

	return unscaleAll;
}
