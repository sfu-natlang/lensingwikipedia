/*
 * Loading indicator control.
 */

var LoadingIndicator = (function () {

/*
 * Make a loading indicator on a container element.
 * container: container element as a jquery selection
 */
function LoadingIndicator(container) {
	this._elt = $("<div class=\"loadingindicator\"></div>").appendTo(container);
	this._enabled = false;
	this._errors = {};
}

/*
 * Sets an error status with a given key and boolean value.
 *
 * The indicator will show an error as long as any error value is set to true.
 */
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

/*
 * Sets or gets the enabled status.
 */
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

return {
	LoadingIndicator: LoadingIndicator
};
}());
