function LoadingIndicator(container) {
	this._elt = $("<div class=\"loadingindicator\"></div>").appendTo(container);
	this._enabled = false;
	this._errors = {};
}

LoadingIndicator.prototype.error = function(key, value) {
	if (key == null) {
		for (var key in this._errors)
			if (this._errors[key])
				return true;
		return false;
	} else {
		this._errors[key] = value;
	}
}

LoadingIndicator.prototype.enabled = function(isEnabled) {
	if (isEnabled == null) {
		return this._enabled;
	} else {
		this._enabled = isEnabled;
		if (isEnabled)
			this._elt.html(this.error() ? "Error" : "Loading&hellip;");
		this._elt.css('display', isEnabled ? '' : 'none');
	}
}
