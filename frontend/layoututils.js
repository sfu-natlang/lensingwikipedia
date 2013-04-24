function verticalFill(container, content) {
	function fit () {
		content.height(container.height());
	}
	$(window).resize(fit);
	fit();
}

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
	panel.bind('changedSize', fit);
	fit();
}

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

function setupSplitMakeElements(container, orient, contentMakers) {
	var contentElements = [];
	for (var i in contentMakers) {
		var box = $("<div class=\"splitpartbox\"></div>").appendTo(container);
		contentElements.push(box);
		contentMakers[i](box);
	}
	setupSplit(container, orient, contentElements);
}
