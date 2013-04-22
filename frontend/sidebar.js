
function setupSidebar(container, globalQuery) {
	var cnstrBoxElt = $("<div class=\"constraintslist\"></div>").appendTo(container);
	var eventDescListElt = $("<div class=\"eventdescriptionslist\"></div>").appendTo(container);

	setupConstraintList(cnstrBoxElt, globalQuery);
	setupEventDescriptionsList(eventDescListElt, globalQuery);

	var verticalMarginsSize = 20; // Pixel size to account for margins
	function fit() {
		eventDescListElt.height(container.height() - cnstrBoxElt.height() - verticalMarginsSize);
	}
	$(window).resize(fit);
	cnstrBoxElt.bind('changedSize', fit);
	globalQuery.onResult({}, fit);
}
