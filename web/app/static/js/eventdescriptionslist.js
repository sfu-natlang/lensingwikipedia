/*
 * Control which lists event descriptions from a query.
 */

var EventDescriptionsList = (function () {

/*
 * Setup the control in some container element.
 * container: container element as a jquery selection
 * constraintSet: constraint set to watch
 */
function setup(container, constraintSet, connection) {
	var query = new Queries.Queries.PaginatedQuery(connection, constraintSet, {
		type: 'descriptions'
	});

	var outerElt = $("<div class=\"eventdescriptionslist\"></div>").appendTo(container);
	var loadingIndicator = new LoadingIndicator.LoadingIndicator(outerElt);
	var listElt = FrontendConfig.createDescriptionList(outerElt);
	var moreBoxElt = $("<div class=\"buttonbox\"></div>").appendTo(outerElt);
	var moreElt = $("<button type=\"button\" class=\"btn btn-primary\" disabled=\"true\">More</button>").appendTo(moreBoxElt);

	DataSource.setupLoadingIndicator(loadingIndicator, query);
	DataSource.setupNextPageButton(moreElt, query, connection);

	query.on('invalidated', function() {
		FrontendConfig.clearDescriptionList(listElt);
	});
	query.on('error', function() {
		loadingIndicator.error('descriptions', true);
		loadingIndicator.enabled(true);
	});
	query.on('result', function(result) {
		loadingIndicator.error('descriptions', false);
		loadingIndicator.enabled(false);
		FrontendConfig.addToDescriptionList(result.descriptions, listElt);
	});
}

return {
	setup: setup
};
}());
