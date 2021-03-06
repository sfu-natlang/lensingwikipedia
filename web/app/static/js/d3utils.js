/*
 * Utilities for d3.
 */

var D3Utils = (function () {

/*
 * Convert a jquery selection to a d3 selection.
 */
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
 *
 * svg: svg element as a jquery selection
 * eltPat: jquery pattern string to match the children to not scale
 * fixDelay: delay before applying scales after window resizes
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
		try {
			svg.find(eltPat).each(function () {
				unscale(this);
			});
		} catch (e) {
			console.log("warning: error scaling svg elements");
		}
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

/*
 * Utility to implement panning without using the d3 automatic panning
 * behaviour.
 * drag: d3 drag behaviour object
 * doPan: function called with the current panning offset when ready to pan 
 * getOrigin: function to get the origin of the coordinates for panning
 * getPanFactor: function to get a scale factor for pan movements
 * startPredicate: function called with a location to determine if we can start
 *	panning at that location
 */
function makeDragPan(drag, doPan, getOrigin, getPanFactor, startPredicate) {
	var mouseDownAt = null,
	    mouseOrigin = [0, 0],
	    pan = [0, 0],
	    factor = 1.0,
	    scale = 1.0;
	drag.on('dragstart.pan', function () {
		var at = d3.mouse(this);
		if (startPredicate(at)) {
			mouseOrigin = getOrigin();
			factor = getPanFactor();
			mouseDownAt = at;
		}
	}).on('drag.pan', function () {
		if (mouseDownAt != null) {
			var at = d3.mouse(this);
			pan = [mouseOrigin[0] + (at[0] - mouseDownAt[0]) * factor, mouseOrigin[1] + (at[1] - mouseDownAt[1]) * factor];
			doPan(pan);
		}
	}).on('dragend.pan', function () {
		if (mouseDownAt != null)
			mouseDownAt = null;
	});
}

/*
 * Setup a drag-select that selects rectangular areas.
 * drag: d3 drag behaviour object
 * drawOn: d3 selection to draw the extent on
 * classStr: class string for the extent rectangle
 * selectionCallback: called with the extent when selection is done
 * startPredicate: called with the starting position to determine if we can
 *	start a drag there
 */
function makeDragSelector(drag, drawOn, classStr, selectionCallback, startPredicate) {
	var extentBox = null;
	var dragStart = null;
	function getBox(event) {
		var at = d3.mouse(event);
		var d = [at[0] - dragStart[0], at[1] - dragStart[1]];
		var p = [dragStart[0], dragStart[1]];
		for (var i = 0; i < 2; i++)
			if (d[i] < 0) {
				p[i] += d[i];
				d[i] = -d[i];
			}
		return [p, d];
	}
	drag.on('dragstart.dragselect', function () {
		var at = d3.mouse(this);
		if (startPredicate == null || startPredicate(at)) {
			if (extentBox != null)
				extentBox.remove();
			dragStart = at;
			extentBox = drawOn.append("rect")
				.attr("x", dragStart[0])
				.attr("y", dragStart[1])
				.attr("width", 0)
				.attr("height", 0)
				.attr("class", classStr);
		}
	}).on('drag.dragselect', function () {
		if (dragStart != null) {
			var box = getBox(this);
			extentBox.attr("x", box[0][0]).attr("y", box[0][1]).attr("width", box[1][0]).attr("height", box[1][1]);
		}
	}).on('dragend.dragselect', function () {
		if (dragStart != null) {
			var box = getBox(this);
			selectionCallback([box[0], [box[0][0] + box[1][0], box[0][1] + box[1][1]]]);
			dragStart = null;
			extentBox.remove();
		}
	});
}

/*
 * Set a callback to notify when any dragging ends.
 * drag: d3 drag behaviour object
 * onEnd: callback that takes no arguments
 * try to differentiate whether the event is corresponding to mouse or touch devices
 */
function makeDragEndWatcher(drag, onEnd) {
	var startDrag = null;
	
	drag.on('dragstart.watchend', function () {
			startDrag = d3.mouse(this);		
	}).on('dragend.watchend', function () {
			var at = d3.mouse(this);
		if (at[0] != startDrag[0] || at[1] != startDrag[1])
			onEnd();
		startDrag = null;
	});
}

return {
	jqueryToD3: jqueryToD3,
	dontScaleSvgParts: dontScaleSvgParts,
	makeDragPan: makeDragPan,
	makeDragSelector: makeDragSelector,
	makeDragEndWatcher: makeDragEndWatcher
};
}());
