var nextConstraintId = 0;
var nextViewId = 0;
var nextQueryId = 0;

/*
 * A single constraint that can be added to a query.
 */
function Constraint() {
	this._id = nextConstraintId;
	nextConstraintId++;
	this._value = null;
	this._queriesIn = {};
	this._changeWatchers = [];
}

Constraint.prototype._updateChangeWatchers = function(changeType) {
	for (i in this._changeWatchers)
		for (queryId in this._queriesIn)
			this._changeWatchers[i](changeType, this._queriesIn[queryId]);
	for (queryId in this._queriesIn) {
		var query = this._queriesIn[queryId];
		for (i in query._changeWatchers)
			query._changeWatchers[i](changeType, this);
	}
}

Constraint.prototype.set = function(value) {
	if (value == null) {
		this._clear()
	} else if (this._value != value) {
		var changeType = this._value == null ? 'added' : 'changed';
		this._value = value;
		this._updateChangeWatchers(changeType);
		for (queryId in this._queriesIn)
			this._queriesIn[queryId]._changedSinceUpdate = true;
	}
}

Constraint.prototype.clear = function() {
	if (this._value != null) {
		this._value = null;
		this._updateChangeWatchers('removed');
		for (queryId in this._queriesIn)
			this._queriesIn[queryId]._changedSinceUpdate = true;
	}
}

Constraint.prototype.onChange = function(callback) {
	this._changeWatchers.push(callback);
}

Constraint.prototype.value = function() {
	return this._value;
}

/*
 For continuing paginated queries.
 */
function Continuer(query, resultWatcher, limitParts, initialResultForWatcher, firstPageOffset) {
	this._query = query;
	this._resultWatcher = resultWatcher;
	this._limitParts = limitParts;
	this._pageOffset = firstPageOffset || 1;
	this._cb_queue = [];

	this._haveMore = false;
	for (localViewKey in this._resultWatcher.viewMap) {
		var viewResponse = initialResultForWatcher[localViewKey];
		if (viewResponse['more'] == true)
			this._haveMore = true;
	}
}

Continuer.prototype.hasMore = function() {
	return this._haveMore;
}

Continuer.prototype.fetchNext = function(callback) {
	// TODO: can we factor out more of the code shared with the main query sender?

	this._haveMore = false;

	var sendQuery = {};
	sendQuery.constraints = this._query._getConstraintJSON();
	sendQuery.views = {};
	for (localViewKey in this._resultWatcher.viewMap)
		if (this._limitParts == null || localViewKey in this._limitParts) {
			var queryViewKey = this._resultWatcher.viewMap[localViewKey];
			var oldView = this._query._views[queryViewKey];
			var newView = {};
			for (key in oldView)
				if (key != 'page')
					newView[key] = oldView[key];
			newView.page = (oldView.page || 0) + this._pageOffset;
			sendQuery.views[queryViewKey] = newView;
		}

	var continuer = this;
	var watcher = this._resultWatcher;
	$.post(this._query._backendUrl, JSON.stringify(sendQuery), 'json').done(function(response) {
		var resultForWatcher = {};
		for (localViewKey in watcher.viewMap) {
			var viewResponse = response[watcher.viewMap[localViewKey]];
			resultForWatcher[localViewKey] = viewResponse;
			if (viewResponse['more'] == true)
				continuer.haveMore = true;
		}
		callback(resultForWatcher);
	});

	this._pageOffset++;
}

/*
 * A query containing a set of constraints against a given backend.
 */
function Query(backendUrl, type, arg1, arg2) {
	if (type == null) type = 'base';

	this._backendUrl = backendUrl;
	this._type = type;
	this._changeWatchers = [];
	this._resultWatchers = [];
	this._constraints = {};
	this._views = {};
	this._changedSinceUpdate = true;
	this._viewsNeededAtLastUpdate = {};

	if (type == 'base')
		this._setupBase();
	else if (type == 'setminus')
		this._setupSetminus(arg1, arg2);
	else
		console.log("error: unknown query type \"" + type + "\"");
}

Query.prototype._setupBase = function () {
	this._id = nextQueryId;
	nextQueryId++;
}

Query.prototype._setupSetminus = function (query1, query2) {
	var query = this;
	query1.onChange(function (changeType, cnstr) {
		if (changeType == 'added' || changeType == 'current') {
			if (!query1._constraints.hasOwnProperty(cnstr.id) && !query2._constraints.hasOwnProperty(cnstr._id))
				query._addConstraint(cnstr);
		} else if (changeType == 'removed') {
			if (query1._constraints.hasOwnProperty(cnstr.id))
				query._removeConstraint(cnstr);
		} else if (changeType == 'changed') {
			if (!query2._constraints.hasOwnProperty(cnstr._id))
				query._changeConstraint(cnstr);
		}
	}, true);
	query2.onChange(function (changeType, cnstr) {
		if (changeType == 'added' || changeType == 'current') {
			if (query1._constraints.hasOwnProperty(cnstr.id) && !query2._constraints.hasOwnProperty(cnstr._id))
				query._removeConstraint(cnstr);
		} else if (changeType == 'removed') {
			if (query1._constraints.hasOwnProperty(cnstr.id))
				query._addConstraint(cnstr);
		}
	}, true);
	query1.onResult(null, function () {
		query.update();
	});
	query2.onResult(null, function () {
		query.update();
	});
}

Query.prototype._addConstraint = function(constraint) {
	this._changedSinceUpdate = true;
	this._constraints[constraint._id] = constraint;
	constraint._queriesIn[this._id] = this;
	if (constraint._value != null) {
		for (i in this._changeWatchers)
			this._changeWatchers[i]('added', constraint);
		for (i in constraint._changeWatchers)
			constraint._changeWatchers[i]('added', this);
	}
}

Query.prototype._removeConstraint = function(constraint) {
	this._changedSinceUpdate = true;
	delete this._constraints[constraint._id];
	delete constraint._queriesIn[this._id];
	if (constraint._value != null) {
		for (i in this._changeWatchers)
			this._changeWatchers[i]('removed', constraint);
		for (i in constraint._changeWatchers)
			constraint._changeWatchers[i]('removed', this);
	}
}

Query.prototype._changeConstraint = function(constraint) {
	this._changedSinceUpdate = true;
	for (i in this._changeWatchers)
		this._changeWatchers[i]('changed', constraint);
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

Query.prototype.onChange = function(callback, getCurrent) {
	this._changeWatchers.push(callback);
	if (getCurrent)
		for (cnstrKey in this._constraints) {
			var cnstr = this._constraints[cnstrKey];
			if (cnstr._value != null)
				callback('current', cnstr);
		}
}

/*
 * Note: the keys given here don't have to be unique across the whole program; they get mapped to unique keys in the generated query.
 */
Query.prototype.onResult = function(views, callback, neededContition) {
	this._changedSinceUpdate = true;
	var watcher = {};
	watcher.callback = callback;
	watcher.neededContition = neededContition;
	if (views == null) {
		watcher.viewMap = null;
	} else {
		watcher.viewMap = {};
		for (localViewKey in views) {
			var queryViewKey = nextViewId;
			nextViewId++;
			watcher.viewMap[localViewKey] = queryViewKey;
			this._views[queryViewKey] = views[localViewKey];
		}
	}
	this._resultWatchers.push(watcher);
}

Query.prototype._getConstraintJSON = function() {
	constraints = {};
	for (cnstrKey in this._constraints) {
		var cnstr = this._constraints[cnstrKey];
		if (cnstr._value != null)
			constraints[cnstrKey] = cnstr._value;
	}
	return constraints;
}

Query.prototype.update = function(postponeFinish) {
	// Only need to go to the backend if
	// 1. there has been a change to the constraints or result watchers; or
	// 2. one of the watchers is now needed but was not at the last update.
	var needed = this._changedSinceUpdate;
	var viewsNeeded = {};
	for (var i in this._resultWatchers) {
		var watcher = this._resultWatchers[i];
		if (watcher.neededContition == null || watcher.neededContition()) {
			if (!this._viewsNeededAtLastUpdate[i])
				needed = true;
			viewsNeeded[i] = true;
		}
	}
	this._changedSinceUpdate = false;

	var finish = null;
	if (!needed) {
		finish = function () {};
	} else {
		this._viewsNeededAtLastUpdate = viewsNeeded;

		var sendQuery = {};
		sendQuery.constraints = this._getConstraintJSON();
		sendQuery.views = this._views;
		//console.log("Q " + JSON.stringify(sendQuery));

		var query = this;
		var post = $.post(this._backendUrl, JSON.stringify(sendQuery), 'json');

		finish = function () {
			post.done(function(response) {
				//console.log("R " + JSON.stringify(response));
				for (var i in query._resultWatchers) {
					var watcher = query._resultWatchers[i];
					if (watcher.viewMap == null) {
						watcher.callback();
					} else {
						var resultForWatcher = {};
						for (localViewKey in watcher.viewMap)
							resultForWatcher[localViewKey] = response[watcher.viewMap[localViewKey]];
						watcher.callback(resultForWatcher, function(limitParts) {
							return new Continuer(query, watcher, limitParts, resultForWatcher);
						});
					}
				}
			});
		}
	}

	if (postponeFinish)
		return finish;
	else
		finish();
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
