/*
 * Data sources.
 *
 * Data sources are a standard interface to watch for data that we need to wait on.
 *
 * All data sources should implement the following:
 *	event 'invalidated': any previous data from the source is now invalid
 *	event 'error': there was an error getting the data, callback may get information about the error
 *	event 'result': new data available, passed to the callback
 *
 * Paginated data sources should also implement the following:
 *	nextPage(): request the next page of data
 *	event 'done': all data pages have been seen (as 'result' events)
 *
 * Data sources that store their result value should implement the following:
 *	result(): the current result value, or null if invalidated or has error
 */

var DataSource = (function () {

/*
 * Source which can be controlled manually.
 */
function Emitter() {
	Utils.SimpleWatchable.call(this);
}

Utils.extendObject([Utils.SimpleWatchable.prototype], Emitter.prototype);

Emitter.prototype.invalidate = function () {
	this._triggerEvent('invalidated');
}

Emitter.prototype.result = function (result) {
	this._triggerEvent('result', result);
}

/*
 * Functional map on data source results.
 *
 * Note: This will do the map on every result, so consider the tradeoffs of
 * using it versus doing the mapping when handling the result.
 */
function Map(dataSource, f) {
	Utils.SimpleWatchable.call(this);

	var source = this;
	dataSource.on('result', function (result) {
		source._triggerEvent('result', f(result));
	});
}

Utils.extendObject([Utils.SimpleWatchable.prototype], Map.prototype);

/*
 * JSON resource loading source.
 */
function Json(url) {
	Utils.SimpleWatchable.call(this);

	var source = this;
	d3.json(mapDataUrl, function(error, incoming) {
		if (error)
			source._triggerEvent('error', error);
		else
			source._triggerEvent('result', incoming);
	});
}

Utils.extendObject([Utils.SimpleWatchable.prototype], Json.prototype);

/*
 * Adapts a singleton selection to a data source, where the single value of the selection is the desired data.
 */
function OfSingleValueSelection(selection) {
	Utils.SimpleWatchable.call(this);

	this._selection = selection;

	var source = this;
	selection.on('empty', function () {
		source._triggerEvent('invalidated');
	});
	selection.on('change', function () {
		source._triggerEvent('result', selection.get());
	});
}

Utils.extendObject([Utils.SimpleWatchable.prototype], OfSingleValueSelection.prototype);

OfSingleValueSelection.prototype.result = function () {
	return this._selection.isEmpty() ? null : this._selection.get();
}

/*
 * Adapts a set selection to a data source, where the whole selection is the desired data.
 *
 * allowEmpty: consider the empty set as valid data
 */
function OfSetSelection(selection, allowEmpty) {
	Utils.SimpleWatchable.call(this);

	if (allowEmpty == null)
		allowEmpty = true;

	this._selection = selection;
	this._allowEmpty = allowEmpty;

	var source = this;
	if (!allowEmpty)
		selection.on('empty', function () {
			source._triggerEvent('invalidated');
		});
	selection.on('change', function () {
		if (allowEmpty || selection.length() > 0)
			source._triggerEvent('result', selection);
	});
}

Utils.extendObject([Utils.SimpleWatchable.prototype], OfSetSelection.prototype);

OfSetSelection.prototype.result = function () {
	return (this._allowEmpty || !this._selection.isEmpty()) ? this._selection : null;
}

/*
 * Merges multiple data sources into a single data source that is ready only when all inputs are ready.
 *
 * dataSources: Object of data sources by arbitrary keys.
 *
 * Output data: An object with data results keyed to correspond to the inputs.
 */
function Merged(dataSources) {
	Utils.SimpleWatchable.call(this);

	var results = {};
	var changes = {};
	var ready = {};
	var errors = {};
	var valid = false;
	for (var dataKey in dataSources)
		results[dataKey] = null;

	var merged = this;

	function tryReady() {
		var isReady = true;
		for (var dataKey in results)
			if (results[dataKey] == null) {
				isReady = false;
				break;
			}
		if (isReady) {
			merged._triggerEvent('result', results, changes, ready);
			changes = {};
		}
	}

	function setupWatchers(dataKey, dataSource) {
		dataSource.on('invalidated', function () {
			results[dataKey] = null;
			changes[dataKey] = true;
			delete ready[dataKey];
			merged._triggerEvent('invalidated', ready);
		});
		dataSource.on('error', function (error) {
			errors[dataKey] = error;
			changes[dataKey] = true;
			delete ready[dataKey];
			merged._triggerEvent('error', errors, ready);
		});
		dataSource.on('result', function (result) {
			delete errors[dataKey];
			results[dataKey] = result;
			changes[dataKey] = true;
			ready[dataKey] = true;
			tryReady();
		});
	}

	for (var dataKey in dataSources) {
		var dataSource = dataSources[dataKey];
		setupWatchers(dataKey, dataSource);
		if (typeof dataSource.result == 'function') {
			var result = dataSource.result();
			if (result != null) {
				results[dataKey] = result;
				changes[dataKey] = true;
				ready[dataKey] = true;
			}
		}
	}
	tryReady();
}

Utils.extendObject([Utils.SimpleWatchable.prototype], Merged.prototype);

/*
 * Setup a button to manage pages on paginated data source.
 */  
function setupNextPageButton(buttonElt, query, connection) {
	function enable() {
		buttonElt.addClass('btn-primary');
		buttonElt.removeAttr('disabled');
	}
	function disable() {
		buttonElt.attr('disabled', 'disabled');
		buttonElt.removeClass('btn-primary');
	}

	query.on('invalidated', function () {
		disable();
	});
	query.on('error', function () {
		disable();
	});
	query.on('result', function () {
		enable();
	});
	query.on('done', function () {
		disable();
	});
	buttonElt.click(function (fromEvent) {
		fromEvent.stopPropagation();
		query.nextPage();
		connection.update();
	});

	disable();
}

function showElts(elts) {
	elts.forEach(function (e) { e.css('display', ''); });
}

/*
 * Setup a loading indicator to show the loading and error status of a data source.
 *
 * displayElts: Optional list of DOM elements that should be disabled while the loading indicator is on.
 */
function setupLoadingIndicator(loadingIndicator, dataSource, displayElts) {
	if (displayElts == null)
		displayElts = [];

	function show() {
		loadingIndicator.enabled(true);
	}
	function hide() {
		loadingIndicator.enabled(false);
		showElts(displayElts);
	}

	dataSource.on('invalidated', function () {
		show();
	});
	dataSource.on('error', function () {
		loadingIndicator.error('error', true);
		show();
	});
	dataSource.on('result', function () {
		loadingIndicator.error('error', false);
		hide();
	});
}

/*
 * Setup a loading indicator to show the loading and error status of a merged data source using the format of Merged.
 *
 * displayElts: Optional list of DOM elements that should be disabled while the loading indicator is on.
 * errorMessages: Optional error messages keyed for each input data sources.
 * invalidElts: Optional elements to display instead of the loading indicator when a data source is invalidated.
 */
function setupMergedDataLoadingIndicator(loadingIndicator, dataSource, displayElts, errorMessages, invalidElts) {
	if (displayElts == null)
		displayElts = [];
	if (errorMessages == null)
		errorMessages = {};
	if (invalidElts == null)
		invalidElts = {};

	var outstandingErrors = {};

	function clearErrors() {
		for (dataKey in outstandingErrors)
			loadingIndicator.error(dataKey, false);
		outstandingErrors = {};
	}

	function show(ready) {
		var useLoading = true;
		for (var dataKey in invalidElts) {
			if (!ready.hasOwnProperty(dataKey)) {
				invalidElts[dataKey].forEach(function (e) { e.css('display', ''); });
				useLoading = false;
			}
		}
		loadingIndicator.enabled(useLoading);
	}
	function hide() {
		loadingIndicator.enabled(false);
		for (var dataKey in invalidElts)
			invalidElts[dataKey].forEach(function (e) { e.css('display', 'none'); });
		showElts(displayElts);
	}

	dataSource.on('invalidated', function (ready) {
		clearErrors();
		show(ready);
	});
	dataSource.on('error', function (errors, ready) {
		for (dataKey in outstandingErrors) {
			if (!errors.hasOwnProperty(dataKey)) {
				delete outstandingErrors[dataKey];
				loadingIndicator.error(dataKey, false);
			}
		}
		for (dataKey in errors) {
			if (!outstandingErrors.hasOwnProperty(dataKey)) {
				outstandingErrors[dataKey] = true;
				var msg = errorMessages.hasOwnProperty(dataKey) ? errorMessages[dataKey] : null;
				loadingIndicator.error(dataKey, true, msg);
			}
		}
		show(ready);
	});
	dataSource.on('result', function (result, changes, ready) {
		clearErrors();
		hide();
	});

	show({});
}

return {
	Emitter: Emitter,
	Map: Map,
	Json: Json,
	OfSingleValueSelection: OfSingleValueSelection,
	OfSetSelection: OfSetSelection,
	Merged: Merged,
	setupNextPageButton: setupNextPageButton,
	setupLoadingIndicator: setupLoadingIndicator,
	setupMergedDataLoadingIndicator: setupMergedDataLoadingIndicator
};
}());
