// Keep track of unique IDs for various objects
var nextConstraintId = 0;
var nextChangeWatcherId = 0;
var nextResultWatcherId = 0;
var nextQueryId = 0;
// Keep track of unique stringified JSON values
var nextViewValueId = 0;
var viewUniqueValues = {};

function _addViews(views) {
	var stringifiedViews = {};
	for (localViewId in views) {
		var viewStr = JSON.stringify(views[localViewId]);
		stringifiedViews[localViewId] = viewStr;
		var info = viewUniqueValues[viewStr];
		if (info == null) {
			info = {
				id: nextViewValueId,
				count: 1
			};
			nextViewValueId++;
			viewUniqueValues[viewStr] = info;
		} else
			info.count++;
	}
	return stringifiedViews;
}

function _removeViews(stringifiedViews) {
	for (localViewId in stringifiedViews) {
		var viewStr = stringifiedViews[localViewId];
		var info = viewUniqueValues[viewStr];
		if (info.count > 1)
			info.count--;
		else
			delete viewUniqueValues[viewStr];
	}
}

function _resultsForResultWatchers(resultWatchers, backendResponse, expectAll, onResult, onError) {
	for (var watcherId in resultWatchers) {
		var ok = true;
		var watcher = resultWatchers[watcherId];
		var result = {};
		for (var localViewId in watcher._value) {
			var globalViewId = viewUniqueValues[watcher._value[localViewId]].id;
			if (!backendResponse.hasOwnProperty(globalViewId)) {
				if (!expectAll)
					console.log("warning: didn't get anything for view \"" + localViewId + "\"");
				ok = false;
				break;
			}
			var viewResult = backendResponse[globalViewId];
			result[localViewId] = viewResult;
			if (viewResult.hasOwnProperty('error') && onError != null)
				onError(viewResult.error, watcher);
		}
		if (ok)
			onResult(watcher, result);
	}
}

/*
 * Watcher for constraint changes on a query or an individual constraint.
 */
function ChangeWatcher(callback, getCurrent) {
	this._id = nextChangeWatcherId;
	nextChangeWatcherId++;
	this._callback = callback;
	this._getCurrent = (getCurrent == true);
}

ChangeWatcher.prototype.setCallback = function(callback) {
	this._callback = callback;
}

/*
 * Watcher for query result changes.
 */
function ResultWatcher(callback) {
	this._id = nextResultWatcherId;
	nextResultWatcherId++;
	this._callback = callback;
	this._value = null;
	this._queriesIn = {};

	this._enabled = true;
	this._stored_value = null;
}

ResultWatcher.prototype.setCallback = function(callback) {
	this._callback = callback;
}

ResultWatcher.prototype._change = function () {
	for (var queryId in this._queriesIn) {
		var query = this._queriesIn[queryId];
		query._someResultWatcherChangedSinceUpdate = true;
		query._resultWatchersChangedSinceUpdate[this._id] = true;
	}
}

/*
 * Note: the keys given here don't have to be unique across the whole program; they get mapped to unique keys in the generated query.
 */
ResultWatcher.prototype.set = function (value) {
	if (value == null) {
		this.clear();
	} else if (value != this._value) {
		if (this._value != null)
			_removeViews(this._value);
		this._value = _addViews(value);
		this._change();
	}
}

ResultWatcher.prototype.clear = function () {
	if (this._value != null) {
		_removeViews(this._value);
		this._value = null;
		this._change();
	}
}

ResultWatcher.prototype.enabled = function (enabled) {
	if (enabled == null) {
		return this._enabled;
	} else {
		if (enabled) {
			if (!this._enabled) {
				if (this._value != null)
					console.log("warning: expected value to be null");
				if (this._stored_value == null)
					console.log("warning: expected stored value be non-null");
				this._value = this._stored_value;
				this._stored_value = null;
				this._change();
			}
		} else {
			if (this._enabled) {
				if (this._value == null)
					console.log("warning: expected value to be non-null");
				this._stored_value = this._value;
				this._value = null;
				this._change();
			}
		}
		this._enabled = enabled;
	}
}

/*
 * A single constraint that can be added to a query.
 */
function Constraint(name) {
	this._id = nextConstraintId;
	this._name = name;
	nextConstraintId++;
	this._value = null;
	this._queriesIn = {};
	this._changeWatchers = {};
}

Constraint.prototype.name = function(name) {
	if (name == null)
		return this._name;
	else
		this._name = name;
}

Constraint.prototype._updateChangeWatchers = function(changeType) {
	for (var queryId in this._queriesIn)
		this._queriesIn[queryId]._updateChangeWatchers(changeType, this);
}

Constraint.prototype.set = function(value) {
	if (value == null) {
		this._clear()
	} else if (this._value != value) {
		var changeType = this._value == null ? 'added' : 'changed';
		this._value = JSON.stringify(value);
		this._updateChangeWatchers(changeType);
	}
}

Constraint.prototype.clear = function() {
	if (this._value != null) {
		this._value = null;
		this._updateChangeWatchers('removed');
	}
}

Constraint.prototype.addChangeWatcher = function(watcher) {
	if (!this._changeWatchers.hasOwnProperty(watcher._id)) {
		this._changeWatchers[watcher._id] = watcher;
	} else
		console.log("warning: change watcher \"" + watacher._id + "\" already on query, can't add");
}

Constraint.prototype.removeChangeWatcher = function(watcher) {
	if (this._changeWatchers.hasOwnProperty(watcher._id)) {
		delete this._changeWatchers[watcher._id];
	} else
		console.log("warning: change watcher \"" + watacher._id + "\" not on constraint, can't remove");
}

Constraint.prototype.onChange = function(callback) {
	var watcher = new ChangeWatcher(callback);
	this.addChangeWatcher(watcher);
	return watcher;
}

Constraint.prototype.value = function() {
	return this._value;
}

/*
 For continuing paginated queries.
 */
function Continuer(query, resultWatcher, limitLocalViewIds, initialResultForWatcher, firstPageOffset) {
	this._query = query;
	this._resultWatcher = resultWatcher;
	this._pageOffset = firstPageOffset || 1;

	if (limitLocalViewIds != null) {
		this._views = {};
		for (var localViewId in limitLocalViewIds)
			this._views[localViewId] = resultWatcher._value[localViewId];
	} else
		this._views = resultWatcher._value;

	this._haveMore = false;
	for (localViewKey in this._resultWatcher._value) {
		var viewResponse = initialResultForWatcher[localViewKey];
		if (viewResponse['more'] == true)
			this._haveMore = true;
	}
}

Continuer.prototype.hasMore = function() {
	return this._haveMore;
}

Continuer.prototype.fetchNext = function(callback) {
	var contr = this;

	var cnstrsJson = this._query._getConstraintsJSON();
	var viewsJson = this._query._getViewsJSON(this._parts, function (localViewId, globalViewId, view) {
		view = JSON.parse(view);
		view.page = (view.page || 0) + contr._pageOffset;
		return JSON.stringify(view);
	});
	var queryJson = "{\"constraints\":" + cnstrsJson + ",\"views\":" + viewsJson + "}";

	$.post(this._query._backendUrl, queryJson, 'json').done(function(response) {
		contr._haveMore = false;
		_resultsForResultWatchers({ 0: contr._resultWatcher }, response, true, function (watcher, result) {
			for (var localViewId in result)
				if (result[localViewId].more) {
					contr._haveMore = true;
					break;
				}
			callback(result);
		});
		contr._pageOffset++;
	});
}

/*
 * A query containing a set of constraints against a given backend.
 */
function Query(backendUrl, type, arg1, arg2) {
	if (type == null) type = 'base';

	this._id = nextQueryId;
	nextQueryId++;
	this._backendUrl = backendUrl;
	this._type = type;
	this._constraints = {};
	this._changeWatchers = {};
	this._resultWatchers = {};
	this._someConstraintChangedSinceUpdate = true;
	this._someResultWatcherChangedSinceUpdate = true;
	this._resultWatchersChangedSinceUpdate = {};
	this._resultWatchersUpdatePremptivelyAt = {};
	this._resultWatchersWithErrors = {};
	this._errorWatchers = [];
	this._errorResolvedWatchers = {};

	if (type == 'base')
		this._setupBase();
	else if (type == 'setminus')
		this._setupSetminus(arg1, arg2);
	else
		console.log("error: unknown query type \"" + type + "\"");
}

Query.prototype._setupBase = function () {
	this._parents = [];
}

Query.prototype._setupSetminus = function (query1, query2) {
	var query = this;
	this._parents = [query1, query2];
	query1.onChange(function (changeType, _, cnstr) {
		if (changeType == 'added' || changeType == 'current') {
			if (!query2._constraints.hasOwnProperty(cnstr._id))
				query._addConstraint(cnstr);
		} else if (changeType == 'removed') {
			if (!query2._constraints.hasOwnProperty(cnstr._id))
				query._removeConstraint(cnstr);
		} else if (changeType == 'changed') {
			if (!query2._constraints.hasOwnProperty(cnstr._id))
				query._changeConstraint(cnstr);
		}
	}, true);
	query2.onChange(function (changeType, _, cnstr) {
		if (changeType == 'added' || changeType == 'current') {
			if (query1._constraints.hasOwnProperty(cnstr._id) && !query2._constraints.hasOwnProperty(cnstr._id))
				query._removeConstraint(cnstr);
		} else if (changeType == 'removed') {
			if (query1._constraints.hasOwnProperty(cnstr._id) && cnstr._value != null)
				query._addConstraint(cnstr);
		}
	}, true);
	query1.onResult({}, function () {
		query.update();
	});
	query2.onResult({}, function () {
		query.update();
	});
}

Query.prototype._updateChangeWatchers = function(changeType, constraint) {
	var query = this;
	for (var watcherId in this._changeWatchers)
		this._changeWatchers[watcherId]._callback(changeType, query, constraint);
	for (var watcherId in constraint._changeWatchers)
		constraint._changeWatchers[watcherId]._callback(changeType, query, constraint);
	this._someConstraintChangedSinceUpdate = true;
}

Query.prototype._updateErrorWatchers = function(message, isFromChild, resultWatcher, onResolve) {
	var query = this;
	if (onResolve == null)
		onResolve = function (resolveCallback) {
			if (!query._errorResolvedWatchers.hasOwnProperty(resultWatcher._id))
				query._errorResolvedWatchers[resultWatcher._id] = [];
			query._errorResolvedWatchers[resultWatcher._id].push(resolveCallback);
		};
	for (var i = 0; i < this._errorWatchers.length; i++) {
		var watcher = this._errorWatchers[i];
		if (!isFromChild || watcher.getFromChildren)
			watcher.callback(message, isFromChild, onResolve);
	}
	for (var i = 0; i < this._parents.length; i++)
		this._parents[i]._updateErrorWatchers(message, true, resultWatcher, onResolve);
}

Query.prototype._updateErrorResolvedWatchers = function(currentResultWatchersWithErrors) {
	for (var watcherId in this._errorResolvedWatchers)
		if (!currentResultWatchersWithErrors[watcherId]) {
			for (var i = 0; i < this._errorResolvedWatchers[watcherId].length; i++)
				this._errorResolvedWatchers[watcherId][i]();
			delete this._errorResolvedWatchers[watcherId];
		}
	this._resultWatchersWithErrors = currentResultWatchersWithErrors;
}

Query.prototype._addConstraint = function(constraint) {
	this._someConstraintChangedSinceUpdate = true;
	this._constraints[constraint._id] = constraint;
	constraint._queriesIn[this._id] = this;
	if (constraint._value != null) {
		this._updateChangeWatchers('added', constraint);
	}
}

Query.prototype._removeConstraint = function(constraint) {
	this._someConstraintChangedSinceUpdate = true;
	delete this._constraints[constraint._id];
	delete constraint._queriesIn[this._id];
	var query = this;
	this._updateChangeWatchers('removed', constraint);
}

Query.prototype._changeConstraint = function(constraint) {
	this._someConstraintChangedSinceUpdate = true;
	var query = this;
	this._updateChangeWatchers('changed', constraint);
}

Query.prototype.addConstraint = function(constraint) {
	if (this._type != 'base') {
		console.log("error: can't add to a non-base query");
		return;
	}
	if (!this._constraints.hasOwnProperty(constraint._id)) {
		this._addConstraint(constraint);
	} else
		console.log("warning: constraint \"" + constraint._id + "\" already in query, can't add");
}

Query.prototype.removeConstraint = function(constraint) {
	if (this._type != 'base') {
		console.log("error: can't remove from a non-base query");
		return;
	}
	if (this._constraints.hasOwnProperty(constraint._id)) {
		this._removeConstraint(constraint);
	} else
		console.log("warning: constraint \"" + constraint._id + "\" not in query, can't remove");
}

Query.prototype.addChangeWatcher = function(watcher) {
	if (!this._changeWatchers.hasOwnProperty(watcher._id)) {
		this._changeWatchers[watcher._id] = watcher;
		if (watcher._getCurrent)
			$.each(this._constraints, function (cnstrKey, cnstr) {
				if (cnstr._value != null)
					watcher._callback('current', cnstr);
			});
	} else
		console.log("warning: change watcher \"" + watacher._id + "\" already on query, can't add");
}

Query.prototype.removeChangeWatcher = function(watcher) {
	if (this._changeWatchers.hasOwnProperty(watcher._id)) {
		delete this._changeWatchers[watcher._id];
	} else
		console.log("warning: change watcher \"" + watacher._id + "\" not on query, can't remove");
}

Query.prototype.addResultWatcher = function(watcher) {
	if (!this._resultWatchers.hasOwnProperty(watcher._id)) {
		this._resultWatchers[watcher._id] = watcher;
		watcher._queriesIn[this._id] = this;
	} else
		console.log("warning: result watcher \"" + watacher._id + "\" already on query, can't add");
}

Query.prototype.removeResultWatcher = function(watcher) {
	if (this._resultWatchers.hasOwnProperty(watcher._id)) {
		delete this._resultWatchers[watcher._id];
		delete watcher._queriesIn[this._id];
	} else
		console.log("warning: result watcher \"" + watacher._id + "\" not on query, can't remove");
}

Query.prototype.onChange = function(callback, getCurrent) {
	var watcher = new ChangeWatcher(callback, getCurrent);
	this.addChangeWatcher(watcher);
	return watcher;
}

Query.prototype.onResult = function(views, callback) {
	var watcher = new ResultWatcher(callback);
	this.addResultWatcher(watcher);
	watcher.set(views);
	return watcher;
}

Query.prototype.onError = function (callback, getFromChildren) {
	if (getFromChildren == null) getFromChildren = true;
	this._errorWatchers.push({ callback: callback, getFromChildren: getFromChildren });
}

Query.prototype.clearAll = function() {
	for (cnstrKey in this._constraints) {
		var cnstr = this._constraints[cnstrKey];
		cnstr.clear();
	}
};

Query.prototype.isEmpty = function() {
	for (var cnstrKey in this._constraints)
		if (this._constraints[cnstrKey]._value != null)
			return false;
	return true;
}

Query.prototype.backendUrl = function() {
	return this._backendUrl;
}

Query.prototype._getConstraintsJSON = function() {
	var jsonStr = "{";
	var first = true;
	for (var cnstrId in this._constraints) {
		var cnstr = this._constraints[cnstrId];
		if (cnstr._value != null) {
			if (first)
				first = false;
			else
				jsonStr += ",";
			jsonStr += "\"" + cnstrId + "\":";
			jsonStr += cnstr._value;
		}
	}
	jsonStr += "}";
	return jsonStr;
}

Query.prototype._getViewsJSON = function(resultWatchers, viewRewriter) {
	if (resultWatchers == null) resultWatchers = this._resultWatchers;
	var seenGlobalIds = {};
	var jsonStr = "{";
	var first = true;
	for (var resultWatcherId in resultWatchers) {
		var watcher = resultWatchers[resultWatcherId];
		for (var localViewId in watcher._value) {
			var view = watcher._value[localViewId];
			var globalViewId = viewUniqueValues[view].id;
			if (viewRewriter != null)
				view = viewRewriter(localViewId, globalViewId, view);
			if (!seenGlobalIds.hasOwnProperty(globalViewId)) {
				if (first)
					first = false;
				else
					jsonStr += ",";
				jsonStr += "\"" + globalViewId + "\":";
				jsonStr += view;
				seenGlobalIds[view] = true;
			}
		}
	}
	jsonStr += "}";
	return jsonStr;
}

Query.prototype.update = function(postponeFinish) {
	var query = this;

	// We only go the backend if something changed and there is at least one view that needs updating.
	var finish = null;
	if (query._someConstraintChangedSinceUpdate || query._someResultWatcherChangedSinceUpdate) {
		var resultWatchersToUpdate = {};
		var toForceResolve = {};
		for (var watcherId in query._resultWatchers) {
			var watcher = query._resultWatchers[watcherId];
			if (query._someConstraintChangedSinceUpdate || query._resultWatchersChangedSinceUpdate[watcher._id])
				(watcher._value != null ? resultWatchersToUpdate : toForceResolve)[watcher._id] = watcher;
					
		}

		// We resolve any errors on watchers that are no longer active, because otherwise they are stuck in an error state
		var currentResultWatchersWithErrors = {};
		for (var watcherId in this._resultWatchersWithErrors)
			currentResultWatchersWithErrors[watcherId] = this._resultWatchersWithErrors[watcherId];
		for (var watcherId in toForceResolve)
			currentResultWatchersWithErrors[watcherId] = false;
		query._updateErrorResolvedWatchers(currentResultWatchersWithErrors);

		if (!$.isEmptyObject(resultWatchersToUpdate)) {
			var queryJson = "{\"constraints\":" + query._getConstraintsJSON() + ",\"views\":" + query._getViewsJSON(resultWatchersToUpdate) + "}";
			//console.log("Q", query._id, queryJson);
			var post = $.post(query._backendUrl, queryJson, null, 'json');
			query._someConstraintChangedSinceUpdate = false;
			query._someResultWatcherChangedSinceUpdate = false;
			query._resultWatchersChangedSinceUpdate = {};
			finish = function () {
				post.done(function (response) {
					//console.log("R", query._id, response);
					var currentResultWatchersWithErrors = {};
					_resultsForResultWatchers(resultWatchersToUpdate, response, true, function (watcher, result) {
						watcher._callback(result, function (limitLocalViewIds) {
							return new Continuer(query, watcher, limitLocalViewIds, result);
						});
					}, function (message, watcher) {
						query._updateErrorWatchers(message, false, watcher);
						currentResultWatchersWithErrors[watcher._id] = true;
					});
					query._updateErrorResolvedWatchers(currentResultWatchersWithErrors);
				});
			}
		}
	}
	if (finish == null)
		finish = function () {};

	if (postponeFinish)
		return finish;
	else
		finish();
}
