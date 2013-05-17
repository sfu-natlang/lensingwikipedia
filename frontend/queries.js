/*
 * Queries against a backend.
 *
 * See the backend documentation for information on the query format we use to
 * send to the backend. In summary, the backend takes queries as JSON objects
 * which contain constraints and views. The sets of constraints and views are
 * both given as a objects where the keys are arbitrary identifiers and the
 * values are constraint or view specifications in particular formats.
 *
 * Here a query is treated as a set of constraints which can have result
 * watchers attached to it. The constraints correspond directly to the
 * constraints sent to the backend. Each result watcher contributes one or more
 * views (and a callback to receive them) which are collected to form the views
 * sent to the backend.
 */

// Keep track of unique IDs for various objects
var nextConstraintId = 0;
var nextChangeWatcherId = 0;
var nextResultWatcherId = 0;
var nextQueryId = 0;
// Keep track of unique stringified JSON values
var nextViewValueId = 0;
var viewUniqueValues = {};

/*
 * Add a view to the global index of unique views.
 */
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

/*
 * Remove a view from the global index.
 */
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

/*
 * Watcher for constraint changes on a query or an individual constraint.
 *
 * The callback function for a change watcher takes the arguments
 *	(changeType, query, constraint)
 * Here changeType is either 'added', 'removed', or 'changed'. The remaining two
 * arguments are the query and constraint concerned.
 *
 * Because of the constraint semantics (see the Constraint documentation), when
 * a constraint's value changes to null it will be considered to be removed from
 * all queries it is in, and similarly when the value changes to non-null after
 * having be null it will be considered to be re-added to any queries.
 *
 * This watcher can be applied either on a query or on a constraint. In the
 * later case the watcher will be called whenever the constraint's status
 * changes with respect to any query; thus a watcher on a single constraint may
 * receive multiple change updates for any single change (one for each query it
 * is part of) and the change type will not necessarily be the same for all
 * queries (eg in the case of a setminus query: if q=q1\q2, then q can gain a
 * constraint as q2 loses that same constraint).
 *
 * The callback for the watcher will be called asynchronously after update() is
 * called on any query it is part of. It may also be called at other times
 * (for example, with future improvements to query handling it could be called
 * if another query with the same constraints receives the needed results).
 * Therefore you should not assume that the watcher will be notified only after
 * calls to update().
 */
function ChangeWatcher(callback, getCurrent) {
	this._id = nextChangeWatcherId;
	nextChangeWatcherId++;
	this._callback = callback;
	this._getCurrent = (getCurrent == true);
}

/*
 * Change the callback function to be called when a change happens.
 */
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

/*
 * Change the callback function to be called when there is a result.
 */
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
 * Sets the views for this watcher. The value argument is an object where the
 * keys are local names for the views and the values are JSON views in the
 * format required by the backend. The local keys used here are just for this
 * watcher (they will be mapped to unique keys in the actual query submitted to
 * the backend).
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

/*
 * Clears the views for this watcher, effectively disabling it.
 */
ResultWatcher.prototype.clear = function () {
	if (this._value != null) {
		_removeViews(this._value);
		this._value = null;
		this._change();
	}
}

/*
 * Enables or disables the watcher, keeping the same views whenever it is
 * enabled. This is just a utility method; the same behaviour can be obtained
 * with set() and clear().
 */
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
 * Update result watchers based on results from the backend. Used in result
 * handling.
 */
function _resultsForResultWatchers(resultWatchers, backendResponse, expectAll, onResult, onError) {
	for (var watcherId in resultWatchers) {
		var watcher = resultWatchers[watcherId];
		if (watcher._value != null) {
			var ok = true;
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
}

/*
 * A single constraint that can be added to a query.
 *
 * A constraint is part of one or more queries. It's value (the JSON constraint
 * specification in the format used by the backend) can be changed at any time,
 * or cleared (set to null). For the purposes of query results and watchers, a
 * constraint is considered part of a query only when its value is set to
 * non-null.
 */
function Constraint(name) {
	this._id = nextConstraintId;
	this._name = name;
	nextConstraintId++;
	this._value = null;
	this._queriesIn = {};
	this._changeWatchers = {};
}

/*
 * Sets a name for this constraint. This is just for the frontend's convenience
 * in identifying particular constraints.
 */
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

/*
 * Sets the value (JSON in the format the backend requires for a single
 * constraint) for this constraint. If the value is null then it is cleared.
 * If the value is set to non-null after previously being null then the
 * constraint is effectively added back to any queries it has been added to.
 */
Constraint.prototype.set = function(value) {
	if (value == null) {
		this._clear()
	} else if (this._value != value) {
		var changeType = this._value == null ? 'added' : 'changed';
		this._value = JSON.stringify(value);
		this._updateChangeWatchers(changeType);
	}
}

/*
 * Clears the constraint to a null value, effectively removing it from any
 * queries it is in.
 */
Constraint.prototype.clear = function() {
	if (this._value != null) {
		this._value = null;
		this._updateChangeWatchers('removed');
	}
}

/*
 * Adds a watcher for changes on this individual constraint.
 */
Constraint.prototype.addChangeWatcher = function(watcher) {
	if (!this._changeWatchers.hasOwnProperty(watcher._id)) {
		this._changeWatchers[watcher._id] = watcher;
	} else
		console.log("warning: change watcher \"" + watacher._id + "\" already on query, can't add");
}

/*
 * Remove a change watcher.
 */
Constraint.prototype.removeChangeWatcher = function(watcher) {
	if (this._changeWatchers.hasOwnProperty(watcher._id)) {
		delete this._changeWatchers[watcher._id];
	} else
		console.log("warning: change watcher \"" + watacher._id + "\" not on constraint, can't remove");
}

/*
 * Sets a change watcher with a callback. This is a utility method for the
 * common case.
 */
Constraint.prototype.onChange = function(callback) {
	var watcher = new ChangeWatcher(callback);
	this.addChangeWatcher(watcher);
	return watcher;
}

/*
 * Get the current value.
 */
Constraint.prototype.value = function() {
	return this._value;
}

/*
 * For continuing paginated queries.
 *
 * This is mostly intended for continuing exactly one view (from a result
 * watcher that might have been watching for other views as well). It should
 * handle multiple views but the behaviour might be strange.
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

/*
 * Checks if there are more pages.
 */
Continuer.prototype.hasMore = function() {
	return this._haveMore;
}

/*
 * Gets the next page for the result. The callback will be called when the new
 * page is received. The callback gets view results just like a result watcher
 * callback does.
 */
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
 *
 * The constraints are explicitly added or removed for a base query. For a
 * setminus query the constraints are determined by which constraints the
 * parent queries have.
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

/*
 * Initialize a base query.
 */
Query.prototype._setupBase = function () {
	this._parents = [];
}

/*
 * Initialize a setminus query.
 * Basically we set a bunch of watchers on the parent queries and trigger updates
 * on this query accordingly.
 */
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

/*
 * Trigger change watchers on both the query itself and its constraints.
 */
Query.prototype._updateChangeWatchers = function(changeType, constraint) {
	var query = this;
	for (var watcherId in this._changeWatchers)
		this._changeWatchers[watcherId]._callback(changeType, query, constraint);
	for (var watcherId in constraint._changeWatchers)
		constraint._changeWatchers[watcherId]._callback(changeType, query, constraint);
	this._someConstraintChangedSinceUpdate = true;
}

/*
 * Notify error watchers of any new errors.
 */
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

/*
 * Notify error resolved watchers of any resolved errors.
 */
Query.prototype._updateErrorResolvedWatchers = function(currentResultWatchersWithErrors) {
	for (var watcherId in this._errorResolvedWatchers)
		if (!currentResultWatchersWithErrors[watcherId]) {
			for (var i = 0; i < this._errorResolvedWatchers[watcherId].length; i++)
				this._errorResolvedWatchers[watcherId][i]();
			delete this._errorResolvedWatchers[watcherId];
		}
	this._resultWatchersWithErrors = currentResultWatchersWithErrors;
}

/*
 * Add a constraint to the internal list.
 */
Query.prototype._addConstraint = function(constraint) {
	this._someConstraintChangedSinceUpdate = true;
	this._constraints[constraint._id] = constraint;
	constraint._queriesIn[this._id] = this;
	if (constraint._value != null) {
		this._updateChangeWatchers('added', constraint);
	}
}

/*
 * Remove a constraint from the internal list.
 */
Query.prototype._removeConstraint = function(constraint) {
	this._someConstraintChangedSinceUpdate = true;
	delete this._constraints[constraint._id];
	delete constraint._queriesIn[this._id];
	var query = this;
	this._updateChangeWatchers('removed', constraint);
}

/*
 * Update on a constraint change.
 */
Query.prototype._changeConstraint = function(constraint) {
	this._someConstraintChangedSinceUpdate = true;
	var query = this;
	this._updateChangeWatchers('changed', constraint);
}

/*
 * Add a constraint to this query. The constraint will only considered a real
 * part of the query when its value is non-null.
 */
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

/*
 * Remove a constraint from this query.
 */
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

/*
 * Add a change watcher which will be notified on any change to a constraint
 * that is part of the query.
 */
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

/*
 * Remove a change watcher.
 */
Query.prototype.removeChangeWatcher = function(watcher) {
	if (this._changeWatchers.hasOwnProperty(watcher._id)) {
		delete this._changeWatchers[watcher._id];
	} else
		console.log("warning: change watcher \"" + watacher._id + "\" not on query, can't remove");
}

/*
 * Add a result watcher which will be notified whenever there is a new result
 * from the backend.
 */
Query.prototype.addResultWatcher = function(watcher) {
	if (!this._resultWatchers.hasOwnProperty(watcher._id)) {
		this._resultWatchers[watcher._id] = watcher;
		watcher._queriesIn[this._id] = this;
	} else
		console.log("warning: result watcher \"" + watacher._id + "\" already on query, can't add");
}

/*
 * Remove a result watcher.
 */
Query.prototype.removeResultWatcher = function(watcher) {
	if (this._resultWatchers.hasOwnProperty(watcher._id)) {
		delete this._resultWatchers[watcher._id];
		delete watcher._queriesIn[this._id];
	} else
		console.log("warning: result watcher \"" + watacher._id + "\" not on query, can't remove");
}

/*
 * Adds a change watcher as a simple callback. This is a utility method for the
 * common case.
 */
Query.prototype.onChange = function(callback, getCurrent) {
	var watcher = new ChangeWatcher(callback, getCurrent);
	this.addChangeWatcher(watcher);
	return watcher;
}

/*
 * Adds a result watcher as a simple callback. This is a utility method for the
 * common case.
 */
Query.prototype.onResult = function(views, callback) {
	var watcher = new ResultWatcher(callback);
	this.addResultWatcher(watcher);
	watcher.set(views);
	return watcher;
}

/*
 * Add an error watcher. The callback will be called whenever there is an error
 * in a result for this query.
 * callback(message, isFromChild, onResolve): callback function where
 *	message: error message as a string, or a boolean true value if there is
 *		no specific message
 *	isFromChild: set if the error was in a query derived from this one
 *	onResolve(resolveCallback): set a callback function of no arguments to be
 *		called when this error is resolved
 * getFromChildren: if false, only get errors from this query itself; otherwise
 *	(and by default) also get errors from queries derived from this one
 */
Query.prototype.onError = function (callback, getFromChildren) {
	if (getFromChildren == null) getFromChildren = true;
	this._errorWatchers.push({ callback: callback, getFromChildren: getFromChildren });
}

/*
 * Remove all constraints (setting their values to null).
 */
Query.prototype.clearAll = function() {
	for (cnstrKey in this._constraints) {
		var cnstr = this._constraints[cnstrKey];
		cnstr.clear();
	}
};

/*
 * Check if this query has no constraints.
 */
Query.prototype.isEmpty = function() {
	for (var cnstrKey in this._constraints)
		if (this._constraints[cnstrKey]._value != null)
			return false;
	return true;
}

/*
 * Get the backend URL thus query is communicating on.
 */
Query.prototype.backendUrl = function() {
	return this._backendUrl;
}

/*
 * Make complete JSON in the backend's format for all constraints.
 */
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

/*
 * Make complete JSON in the backend's format for all views required by the
 * change watchers.
 */
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

/*
 * Trigger an update, asking the backend for all needed results and passing the
 * results (when they arrive) off to the result watchers.
 */
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
