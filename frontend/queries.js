var nextConstraintId = 0;
var nextViewId = 0;
var nextQueryId = 0;

/*
 * A single constraint that can be added to a query.
 */
function Constraint() {
	this.id = nextConstraintId;
	nextConstraintId++;
	this.value = null;
	this.queriesIn = {};
	this.changeWatchers = [];
}

Constraint.prototype._updateChangeWatchers = function(changeType) {
	for (i in this.changeWatchers)
		for (queryId in this.queriesIn)
			this.changeWatchers[i](changeType, this.queriesIn[queryId]);
	for (queryId in this.queriesIn) {
		var query = this.queriesIn[queryId];
		for (i in query.changeWatchers)
			query.changeWatchers[i](changeType, this);
	}
}

Constraint.prototype.set = function(value) {
	if (value == null) {
		this.clear()
	} else if (this.value != value) {
		var changeType = this.value == null ? 'added' : 'changed';
		this.value = value;
		this._updateChangeWatchers(changeType);
	}
}

Constraint.prototype.clear = function() {
	if (this.value != null) {
		this.value = null;
		this._updateChangeWatchers('removed');
	}
}

Constraint.prototype.onChange = function(callback) {
	this.changeWatchers.push(callback);
}

/*
 For continuing paginated queries.
 */
function Continuer(query, resultWatcher, limitParts) {
	this.query = query;
	this.resultWatcher = resultWatcher;
	this.limitParts = limitParts;
	this.page = 0;
	this.cb_queue = [];
}

Continuer.prototype.watchNext = function(callback) {
	// TODO: can we factor out more of the code shared with the main query sender?

	var sendQuery = {};
	sendQuery.constraints = this.query.getConstraintJSON();
	sendQuery.views = {};
	for (localViewKey in this.resultWatcher.viewMap)
		if (this.limitParts == null || localViewKey in this.limitParts) {
			var queryViewKey = this.resultWatcher.viewMap[localViewKey];
			var oldView = this.query.views[queryViewKey];
			var newView = {};
			for (key in oldView)
				if (key != 'page')
					newView[key] = oldView[key];
			newView.page = (oldView.page || 0) + this.page;
			sendQuery.views[queryViewKey] = newView;
		}

	var watcher = this.resultWatcher;
	$.post(this.query.backendUrl, JSON.stringify(sendQuery), 'json').done(function(response) {
		var resultForWatcher = {};
		for (localViewKey in watcher.viewMap)
			resultForWatcher[localViewKey] = response[watcher.viewMap[localViewKey]];
		callback(resultForWatcher);
	});

	this.page++;
}

/*
 * A query containing a set of constraints against a given backend.
 */
function Query(backendUrl) {
	this.id = nextQueryId;
	nextQueryId++;
	this.backendUrl = backendUrl;
	this.constraints = {};
	this.views = {};
	this.changeWatchers = [];
	this.resultWatchers = [];
}

Query.prototype.addConstraint = function(constraint) {
	if (!this.constraints.hasOwnProperty(constraint.id)) {
		this.constraints[constraint.id] = constraint;
		constraint.queriesIn[this.id] = this;
		if (constraint.value != null) {
			for (i in this.changeWatchers)
				this.changeWatchers[i]('added', constraint);
			for (i in constraint.changeWatchers)
				constraint.changeWatchers[i]('added', this);
		}
	} else
		console.log("warning: constraint \"" + constraint.id + "\" already in query, can't add");
}

Query.prototype.removeConstraint = function(constraint) {
	if (this.constraints.hasOwnProperty(constraint.id)) {
		delete this.constraints[constraint.id];
		delete constraint.queriesIn[this.id];
		if (constraint.value != null) {
			for (i in this.changeWatchers)
				this.changeWatchers[i]('removed', constraint);
			for (i in constraint.changeWatchers)
				constraint.changeWatchers[i]('removed', this);
		}
	} else
		console.log("warning: constraint \"" + constraint.id + "\" not in query, can't remove");
}

Query.prototype.onChange = function(callback, getCurrent) {
	this.changeWatchers.push(callback);
	if (getCurrent)
		for (cnstrKey in this.constraints) {
			var cnstr = this.constraints[cnstrKey];
			if (cnstr.value != null)
				callback('current', cnstr);
		}
}

/*
 * Note: the keys given here don't have to be unique across the whole program; they get mapped to unique keys in the generated query.
 */
Query.prototype.onResult = function(views, callback) {
	var watcher = {};
	watcher.callback = callback;
	watcher.viewMap = {};
	for (localViewKey in views) {
		var queryViewKey = nextViewId;
		nextViewId++;
		watcher.viewMap[localViewKey] = queryViewKey;
		this.views[queryViewKey] = views[localViewKey];
	}
	this.resultWatchers.push(watcher);
}

Query.prototype.getConstraintJSON = function() {
	constraints = {};
	for (cnstrKey in this.constraints) {
		var cnstr = this.constraints[cnstrKey];
		if (cnstr.value != null)
			constraints[cnstrKey] = cnstr.value;
	}
	return constraints;
}

Query.prototype.update = function(postponeFinish) {
	var sendQuery = {};
	sendQuery.constraints = this.getConstraintJSON();
	sendQuery.views = this.views;
	//console.log("Q " + JSON.stringify(sendQuery));

	var query = this;
	var post = $.post(this.backendUrl, JSON.stringify(sendQuery), 'json');

	function finish() {
		post.done(function(response) {
			//console.log("R " + JSON.stringify(response));
			for (var i in query.resultWatchers) {
				var watcher = query.resultWatchers[i];
				var resultForWatcher = {};
				for (localViewKey in watcher.viewMap)
					resultForWatcher[localViewKey] = response[watcher.viewMap[localViewKey]];
				watcher.callback(resultForWatcher, function(limitParts) {
					return new Continuer(query, watcher, limitParts)
				});
			}
		});
	}

	if (postponeFinish)
		return finish;
	else
		finish();
}

Query.prototype.clearAll = function() {
	for (cnstrKey in this.constraints) {
		var cnstr = this.constraints[cnstrKey];
		cnstr.clear();
	}
};
