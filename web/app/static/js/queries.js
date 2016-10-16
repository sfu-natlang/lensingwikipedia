/*
 * Queries against a backend.
 */

var Queries = (function () {

function makeConstraintSetJson(constraintSet) {
	var cnstrJsons = [],
	    seen = {};
	constraintSet.each(function (cnstr) {
		if (!seen.hasOwnProperty(cnstr._json)) {
			seen[cnstr._json] = true;
			cnstrJsons.push(cnstr._json);
		}
	});

	var json = '{';
	if (cnstrJsons.length > 0) {
		cnstrJsons.sort();
		json += '"' + 0 + '":' + cnstrJsons[0];
		for (var cnstrI = 1; cnstrI < cnstrJsons.length; cnstrI++) {
			if (cnstrI == 0)
				isFirst = false;
			else
				json += ",";
			json += '"' + cnstrI + '":' + cnstrJsons[cnstrI];
		}
	}
	json += '}';

	return json;
}

function prepareUpdates(needUpdateQueries) {
	var table = {};
	var nextLocalIds = {};
	for (var queryId in needUpdateQueries) {
		var queryInfo = needUpdateQueries[queryId];
		var csJson = makeConstraintSetJson(queryInfo.query._constraintSet);
		var viewJson = JSON.stringify(queryInfo.query._effectiveView());
		if (!table.hasOwnProperty(csJson))
			table[csJson] = {};
		var queriesTable = table[csJson];
		if (!queriesTable.hasOwnProperty(viewJson)) {
			if (!nextLocalIds.hasOwnProperty(csJson))
				nextLocalIds[csJson] = 0;
			queriesTable[viewJson] = {
				localId: nextLocalIds[csJson],
				queries: []
			};
			nextLocalIds[csJson]++;
		}
		queriesTable[viewJson].queries.push(queryInfo);
	}
	return table;
}

function makeBackendQueryJson(csJson, queriesTable) {
	var json = '{"constraints":' + csJson + ',"views": {';
	var isFirst = true;
	for (viewJson in queriesTable) {
		var viewInfo = queriesTable[viewJson];
		if (isFirst)
			isFirst = false;
		else
			json += ",";
		json += '"' + viewInfo.localId + '":' + viewJson;
	}
	json += "}}";
	return json;
}

function dispatchResults(response, queriesTable) {
	for (viewJson in queriesTable) {
		var viewInfo = queriesTable[viewJson];
		if (response.hasOwnProperty(viewInfo.localId)) {
			var viewResult = response[viewInfo.localId];
			viewInfo.queries.forEach(function (queryInfo) { queryInfo.query._handleResult(viewResult, queryInfo.token); });
		} else
			console.log("warning: didn't get anything for query '" + query._id + "'");
	}
}

function doRequest(url, updateTable, csJson, backendQueryJson, outstandingPosts, onFinish) {
	var startTime = (new Date()).getTime();
	if (typeof FrontendConfig.verboseLog != 'undefined' && FrontendConfig.verboseLog.hasOwnProperty('outgoingQuery') && FrontendConfig.verboseLog.outgoingQuery)
		console.log("outgoing query", backendQueryJson);
	var sendTime = (new Date()).getTime();
	var post = $.post(url, backendQueryJson, null, 'json');
	post.done(function (response) {
		var replyTime = (new Date()).getTime();
		if (typeof FrontendConfig.verboseLog != 'undefined' && FrontendConfig.verboseLog.hasOwnProperty('incomingReply') && FrontendConfig.verboseLog.incomingReply)
			console.log("incoming reply", response);
		dispatchResults(response, updateTable[csJson]);
		var doneTime = (new Date()).getTime();
		if (typeof FrontendConfig.verboseLog != 'undefined' && FrontendConfig.verboseLog.hasOwnProperty('queryTiming') && FrontendConfig.verboseLog.queryTiming)
			console.log("query timing", "prepare", (sendTime - startTime) / 1000, "wait on backend", (replyTime - sendTime) / 1000, "handle", (doneTime - replyTime) / 1000, "total", (doneTime - startTime) / 1000);
		outstandingPosts.count--;
		if (outstandingPosts.count == 0)
			onFinish();
	});
}

function handleUpdates(url, updateTable, onFinish) {
	var outstandingPosts = { count: Object.keys(updateTable).length };
	for (var csJson in updateTable) {
		var backendQueryJson = makeBackendQueryJson(csJson, updateTable[csJson]);
		doRequest(url, updateTable, csJson, backendQueryJson, outstandingPosts, onFinish)
	}
}

/*
 * Constraint.
 *
 * json: Object to use as JSON, in the backend protocol's constraint format.
 * name: Optional text name (for UI purposes).
 */
function Constraint(json, name) {
	this._json = JSON.stringify(json);
	this._name = name;
	this._id = Constraint.nextId++;
}

Constraint.nextId = 0;

/*
 * Unique integer ID for this constraint object.
 */
Constraint.prototype.id = function () {
	return this._id;
}

/*
 * Optional name assigned to this constraint.
 */
Constraint.prototype.name = function () {
	return this._name;
}

/*
 * Equality check for constraints.
 */
Constraint.prototype.equals = function (other) {
	return this._json == other._json;
}

/*
 * Connection.
 *
 * url: URL of backend.
 */
function Connection(url) {
	Utils.SimpleWatchable.call(this);

	this._url = url;
	this._needUpdateQueries = {};
	this._haveErrorQueries = {};
}

Utils.extendObject([Utils.SimpleWatchable.prototype], Connection.prototype);

/*
 * URL of backend.
 */
Connection.prototype.url = function () {
	return this._url;
}

/*
 * Check if there are outstanding errors on the connection.
 */
Connection.prototype.hasErrors = function () {
	return Object.keys(this._haveErrorQueries).length > 0;
}

/*
 * Update the connection now, triggering updates to queries.
 */
Connection.prototype.update = function () {
	var updateTable = prepareUpdates(this._needUpdateQueries);
	this._needUpdateQueries = {};
	var conn = this;
	handleUpdates(this._url, updateTable, function () {
		if (conn.hasErrors())
			conn._triggerEvent('error');
		else
			conn._triggerEvent('no-error');
		conn._triggerEvent('update');
	});
}

var ConstraintSets = (function () {
	/*
	 * Constraint sets.
	 *
	 * Note: The global constraint set needs to support the full selections interface. Other constraint sets currently only support the parts needed for the query system itself. However, it is quite possible to extend them to support the full interface.
	 */

	/*
	 * Basic constraint set.
	 * Supports full selections interface.
	 */
	function ConstraintSet(otherSet) {
		Utils.SimpleWatchable.call(this);
		Selections.SimpleSetSelection.call(this, otherSet);
	}

	Utils.extendObject([Utils.SimpleWatchable.prototype, Selections.SimpleSetSelection.prototype], ConstraintSet.prototype);

	ConstraintSet.prototype.valueHash = function (value) {
		return value._id;
	}

	/*
	 * Set minus constraint set.
	 */
	function SetMinus(parent1, parent2) {
		Utils.SimpleWatchable.call(this);

		this.parent1 = parent1;
		this.parent2 = parent2;

		var cs = this;
		parent1.on('change', function (added, removed) {
			var changed = false;
			for (var cnstrI = 0; cnstrI < added.length; cnstrI++)
				if (!parent2.mem(added[cnstrI]))
					changed = true;
			for (var cnstrI = 0; cnstrI < removed.length; cnstrI++)
				if (!parent2.mem(removed[cnstrI]))
					changed = true;
			if (changed)
				cs._triggerEvent('change');
		});
		parent2.on('change', function (added, removed) {
			var changed = false;
			for (var cnstrI = 0; cnstrI < added.length; cnstrI++)
				if (parent1.mem(added[cnstrI]))
					changed = true;
			for (var cnstrI = 0; cnstrI < removed.length; cnstrI++)
				if (parent1.mem(removed[cnstrI]))
					changed = true;
			if (changed)
				cs._triggerEvent('change');
		});
	}

	SetMinus.prototype.each = function (f) {
		var cs = this;
		cs.parent1.each(function (cnstr) {
			if (!cs.parent2.mem(cnstr))
				f(cnstr);
		});
	}

	Utils.extendObject([Utils.SimpleWatchable.prototype], SetMinus.prototype);

	return {
		ConstraintSet: ConstraintSet,
		SetMinus: SetMinus,
	};
}());

var Queries = (function () {
	/*
	 * Query.
	 *
	 * connection: Connection to use.
	 * constraintSet: Constraint set for constraint part of the query.
	 * viewJson: Object to use as JSON for the view part of the query.
	 *
	 * Note: Although queries in the backend's protocol take multiple
	 * views, here each query only takes one view. Queries with the same
	 * constraints will automatically get batched into single requests to
	 * the backend, so if you want multiple views, just use multiple query
	 * objects.
	 */
	function Query(connection, constraintSet, viewJson) {
		Utils.SimpleWatchable.call(this);

		this._id = Query.nextId++;
		this._connection = connection;
		this._constraintSet = constraintSet;
		this._view = viewJson;
		this._version = 0;

		var query = this;
		this._invalidator = function () {
			query._invalidate();
		};
		constraintSet.on('change', this._invalidator);
		if (viewJson != null)
			query._flagNeedsUpdate();
	}

	Query.nextId = 0;

	Utils.extendObject([Utils.SimpleWatchable.prototype], Query.prototype);

	Query.prototype._flagNeedsUpdate = function () {
		if (this._constraintSet != null && this._view != null)
			this._connection._needUpdateQueries[this._id] = { query: this, token: this._version };
	}

	Query.prototype._invalidate = function () {
		this._flagNeedsUpdate();
		this._triggerEvent('invalidated');
	}

	Query.prototype._handleResult = function (result, version, isDone) {
		if (version == this._version) {
			if (result.hasOwnProperty('error')) {
				this._connection._haveErrorQueries[this._id] = this;
				this._triggerEvent('error', result.error);
			} else {
				delete this._connection._haveErrorQueries[this._id];
				this._triggerEvent('result', result);
				if (isDone == null || isDone)
					this._triggerEvent('done');
			}
		}
	}

	Query.prototype._effectiveView = function () {
		return this._view;
	}

	/*
	 * Forget any outstanding results for this query.
	 *
	 * This ensures that results for a query which has already been sent to a server don't get received.
	 */
	Query.prototype.forget = function (newConstraintSet) {
		delete this._connection._needUpdateQueries[this._id];
		this._version++;
	}

	/*
	 * Get/set constraint set.
	 */
	Query.prototype.constraintSet = function (newConstraintSet) {
		if (newConstraintSet != null)
			this.setConstraintSet(newConstraintSet);
		else
			return this._constraintSet;
	}

	/*
	 * Set constraint set.
	 *
	 * Changing the constraint set will effect future results but won't stop any results for a query that has already been sent to the server.
	 */
	Query.prototype.setConstraintSet = function (newConstraintSet) {
		if (newConstraintSet != this._constraintSet) {
			var query = this;
			if (this._constraintSet != null)
				this._constraintSet.removeOn('change', query._invalidator);
			if (newConstraintSet != null)
				newConstraintSet.on('change', query._invalidator);
			this._constraintSet = newConstraintSet;
			this._invalidate();
		}
	}

	/*
	 * Get/set view JSON.
	 */
	Query.prototype.view = function (newViewJson) {
		if (newViewJson != null)
			this.setView(newViewJson);
		else
			return this._view;
	}

	/*
	 * Set view JSON.
	 *
	 * Changing the view will effect future results but won't stop any results for a query that has already been sent to the server.
	 */
	Query.prototype.setView = function (newViewJson) {
		if (newViewJson != this._view) {
			this._view = newViewJson;
			this._invalidate();
		}
	}

	/*
	 * Query with paginated results.
	 */
	function PaginatedQuery(connection, constraintSet, viewJson) {
		Query.call(this, connection, constraintSet, viewJson);
		this._page = viewJson.hasOwnProperty('page') ? viewJson.page : 0;
		this._hasMorePages = true;
	}

	PaginatedQuery.prototype = Object.create(Query);
	PaginatedQuery.prototype.constructor = PaginatedQuery;
	Utils.extendObject([Query.prototype], PaginatedQuery.prototype);

	PaginatedQuery.prototype._effectiveView = function () {
		var view = {};
		for (var prop in this._view)
			if (this._view.hasOwnProperty(prop))
				view[prop] = this._view[prop];
		if (this._page != 0)
			view.page = this._page;
		return view;
	}

	PaginatedQuery.prototype._handleResult = function (result, version) {
		Query.prototype._handleResult.call(this, result, version, false);
		if (result.hasOwnProperty('more') && !result.more)
			this._triggerEvent('done');
	}

	/*
	 * Request next page.
	 */
	PaginatedQuery.prototype.nextPage = function () {
		this._page++;
		this._flagNeedsUpdate();
	}

	/*
	 * Check if this query has more pages of results that haven't been seen yet.
	 */
	PaginatedQuery.prototype.hasMorePages = function () {
		return this._hasMorePages;
	}

	return {
		Query: Query,
		PaginatedQuery: PaginatedQuery
	};
}());

return {
	Constraint: Constraint,
	Connection: Connection,
	ConstraintSets: ConstraintSets,
	Queries: Queries
};
}());
