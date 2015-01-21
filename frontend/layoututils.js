/*
 * Utilities for layout.
 *
 * Elements here are given as jquery selection.
 */

var LayoutUtils = (function () {

/*
 * Set an element to fill its container whenever the window size changes.
 * container: container element
 * elt: element to fit
 * orient: 'vertical', 'horizontal', or 'both, for the direction to resize in
 * extraSpace or extraHorizontalSpace, extraVerticalSpace: amount extra space
 *	to leave between elt's size and container's size
 */
function fillElement(container, elt, orient, extraSpaceSize1, extraSpaceSize2) {
	if (extraSpaceSize1 == null) extraSpaceSize1 = 0;
	if (extraSpaceSize2 == null) extraSpaceSize2 = 0;
	var fit = {
		vertical: function () {
			elt.height(container.height() - extraSpaceSize1);
		},
		horizontal: function () {
			elt.width(container.width() - extraSpaceSize1);
		},
		both: function () {
			elt.width(container.width() - extraSpaceSize1).height(container.height() - extraSpaceSize2);
		}
	}[orient];
	$(window).resize(fit);
	fit();
}

/*
 * Setup a panel and content area to fit in a container. The panel may change
 * size and the content area will be sized to fit.
 * container: container element
 * panel: panel element
 * content: content element
 * orient: 'vertical' or 'horizontal", for the direction to resize in
 * extraSpaceSize: amount of extra space to leave between the size of the panel
 *	and content area and the size of the container
 * watchPanel: set (default) to watch the panel for sizes changes and re-fit as
 *	needed
 */
function setupPanelled(container, panel, content, orient, extraSpaceSize, watchPanel) {
	if (extraSpaceSize == null) extraSpaceSize = 0;
	if (watchPanel == null) watchPanel = true;

	var fit = {
		horizontal: function () {
			content.width(container.width() - panel.width() - extraSpaceSize);
		},
		vertical: function () {
			content.height(container.height() - panel.height() - extraSpaceSize);
		}
	}[orient];
	$(window).resize(fit);
	if (watchPanel)
		panel.bind('changedSize', fit);
	fit();
}

/*
 * Setup several elements to take equal space in a row or column in a container.
 * container: container element
 * orient: 'vertical' or 'horizontal", for the direction to resize in
 * contentElements: array of elements to fit
 */
function setupSplit(container, orient, contentElements) {
	var fit = {
		horizontal: function () {
			var boxWidth = (container.width() - 1) / contentElements.length;
			for (i in contentElements) {
				var elt = contentElements[i];
				elt.width(boxWidth).height(container.height());
			}
		},
		vertical: function () {
			var boxHeight = (container.height() - 1) / contentElements.length;
			for (i in contentElements) {
				var elt = contentElements[i];
				elt.height(boxHeight);
			}
		}
	}[orient];
	$(window).resize(fit);
	fit();
}

/*
 * Like setupSplit(), but takes a list of set up functions instead of the child
 * elements themselves.
 * container, orient: as for setupSplit()
 * contentMakers: array of functions to call to set up each component element
 *
 * A div will be created for each element in contentMakers, and then the
 * functions in contentMakers will be called and passed their respective div
 * elements.
 */
function setupSplitMakeElements(container, orient, contentMakers) {
	var contentElements = [];
	for (var i in contentMakers) {
		var box = $("<div class=\"splitpartbox\"></div>").appendTo(container);
		contentElements.push(box);
		contentMakers[i](box);
	}
	setupSplit(container, orient, contentElements);
}

return {
	fillElement: fillElement,
	setupPanelled: setupPanelled,
	setupSplit: setupSplit,
	setupSplitMakeElements: setupSplitMakeElements
};
}());
