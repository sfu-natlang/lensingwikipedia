/*
 * Loading indicator control.
 */

var LoadingIndicator = (function () {

/*
 * Make a loading indicator on a container element.
 * container: container element as a jquery selection
 */
function LoadingIndicator(container) {
	this._container = container;
	this._outerElt = $("<div class=\"loadingindicator\"></div>").appendTo(container);
	this._elt = $("<div class=\"alert\"></div>").appendTo(this._outerElt);
	this._baseErrorMessage = "Error";
	this._enabled = false;
	this._errors = {};
	this._messages = {};
}

LoadingIndicator.prototype.baseErrorMessage = function(newMessage) {
	if (newMessage != null)
		this._baseErrorMessage = newMessage;
	else
		return this._baseErrorMessage;
}

/*
 * Sets an error status with a given key and boolean value.
 *
 * The indicator will show an error as long as any error value is set to true.
 */
LoadingIndicator.prototype.error = function(key, value, message) {
	if (key == null) {
		for (var key in this._errors)
			if (this._errors[key])
				return true;
		return false;
	} else {
		var changed = this._errors[key] != value || this._messages[key] != message;
		this._errors[key] = value;
		this._messages[key] = message;
		if (changed)
			this._update();
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
		if (isEnabled) {
			this._update();
			this._outerElt.width(this._container.innerWidth());
		}
		this._outerElt.css('display', isEnabled ? '' : 'none');
	}
}

LoadingIndicator.prototype._update = function() {
	var html = "Loading&hellip;";
	if (this.error()) {
		html = this._baseErrorMessage;
		var htmlMessages = [];
		for (key in this._messages)
			if (this._messages[key] != null)
				htmlMessages.push("<li>" + this._messages[key] + "</li>");
		if (htmlMessages.length > 0)
			html += "\n" + htmlMessages;
	}
	this._elt.html(html);
}

return {
	LoadingIndicator: LoadingIndicator
};
}());
