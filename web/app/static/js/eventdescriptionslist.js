/*
 * Control which lists event descriptions from a query.
 */

var EventDescriptionsList = (function () {

/*
 * Setup the control in some container element.
 * container: container element as a jquery selection
 * globalQuery: the global query
 */
function setup(container, globalQuery) {
	var outerElt = $("<div class=\"eventdescriptionslist\"></div>").appendTo(container);
	var loadingIndicator = new LoadingIndicator.LoadingIndicator(outerElt);
	var listElt = FrontendConfig.createDescriptionList(outerElt);
	var moreBoxElt = $("<div class=\"buttonbox\"></div>").appendTo(outerElt);
	var moreElt = $("<button type=\"button\" class=\"btn\" disabled=\"true\">More</button>").appendTo(moreBoxElt);

	loadingIndicator.enabled(true);

	function setMoreEnabled(enabled) {
		if (enabled) {
			moreElt.addClass('btn-primary');
			moreElt.removeAttr('disabled');
		} else {
			moreElt.removeClass('btn-primary');
			moreElt.attr('disabled', 'disabled');
		}
	}

	globalQuery.onChange(function() {
		loadingIndicator.enabled(true);
		setMoreEnabled(false);
		FrontendConfig.clearDescriptionList(listElt);
	});

	var continuer = null;
	globalQuery.onResult({
		descriptions: {
			type: 'descriptions',
			page: 0
		}
	}, function(result, getContinuer) {
		if (result.descriptions.hasOwnProperty('error')) {
			loadingIndicator.error('descriptions', true);
			loadingIndicator.enabled(true);
			setMoreEnabled(false);
		} else {
			loadingIndicator.error('descriptions', false);
			loadingIndicator.enabled(false);
			FrontendConfig.clearDescriptionList(listElt);
			FrontendConfig.addToDescriptionList(result.descriptions.descriptions, listElt);
			continuer = getContinuer();
			setMoreEnabled(continuer.hasMore());
		}
	});

	moreElt.click(function() {
		if (continuer != null)
			continuer.fetchNext(function(result) {
				FrontendConfig.addToDescriptionList(result.descriptions.descriptions, listElt);
				setMoreEnabled(continuer.hasMore());
			});
	});
}

return {
	setup: setup
};
}());
