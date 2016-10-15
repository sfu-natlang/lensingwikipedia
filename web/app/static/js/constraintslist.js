/*
 * Control which shows all constraints and allows the user to remove them.
 */

var ConstraintsList = (function () {

/*
 * Setup the control in some container element.
 * container: container element as a jquery selection
 * constraintSet: constraint set to show
 * connection: connection to server
 */
function setup(container, constraintSet, connection) {
	var outerElt = $('<div class="constraintslist">').appendTo(container);
	var clearAllElt = $('<button type="button" class="btn btn-block btn-mini btn-warning" title="Remove all current constraints.">Clear all constraints</button></ul>').appendTo(outerElt);
	var listElt = $('<ul></ul>').appendTo(outerElt);
	var loadingIndicator = new LoadingIndicator.LoadingIndicator(outerElt);

	Selections.setupSelectionClearButton(clearAllElt, constraintSet);
	clearAllElt.click(function() {
		Utils.log("clear, all");
	});

	loadingIndicator.baseErrorMessage("The current constraints caused an error in processing the query");
	connection.on('error', function () {
		loadingIndicator.error('connection', true);
		loadingIndicator.enabled(true);
	});
	connection.on('no-error', function () {
		loadingIndicator.enabled(false);
		loadingIndicator.error('connection', false);
	});

	var itemElts = {};
	globalConstraintSet.on('change', function (added, removed, newLength) {
		added.forEach(function (cnstr) {
			var itemElt = $('<li></li>').appendTo(listElt);
			var cnstrElt = $('<div class="alert alert-constraint" title="Click to remove this constraint."></div>').appendTo(itemElt);
			$('<button type="button" class="close">&times;</button>').appendTo(cnstrElt);
			var cnstrTextElt = $("<span></span>").appendTo(cnstrElt);
			cnstrTextElt.append(cnstr.name());
			cnstrElt.click(function() {
				Utils.log("clear, " + JSON.stringify(cnstr._value));
				constraintSet.remove(cnstr);
				connection.update();
			});
			itemElts[cnstr.id()] = itemElt;
		});
		removed.forEach(function (cnstr) {
			var elt = itemElts[cnstr.id()];
			elt.slideUp(400);
		});
		if (removed.length > 0)
			setTimeout(function () {
				container.trigger('changedSize');
			}, 450);
		else
			container.trigger('changedSize');
	});
}

return {
	setup: setup
};
}());
