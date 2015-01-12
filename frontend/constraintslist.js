/*
 * Control which shows all constraints and allows the user to remove them.
 */

/*
 * Setup the control in some container element.
 * container: container element as a jquery selection
 * globalQuery: the global query
 */
function setupConstraintList(container, globalQuery) {
	var outerElt = $('<div class="constraintslist">').appendTo(container);

	var clearAllElt = $('<button type="button" class="btn btn-block btn-mini btn-warning" title="Remove all current constraints.">Clear all constraints</button></ul>').appendTo(outerElt);
	var listElt = $('<ul></ul>').appendTo(outerElt);
	var errorBox = $('<div class="alert alert-error" style="display: none"></div>').appendTo(outerElt);

	function setClearEnabled(enabled) {
		if (enabled)
			clearAllElt.removeAttr('disabled');
		else
			clearAllElt.attr('disabled', 'disabled');
	}
	setClearEnabled(false);

	function removeElement(elt) {
		elt.slideUp(400, function() {
			container.trigger('changedSize');
		});
	};

	function addConstraintElement(cnstr) {
		var itemElt = $('<li></li>').appendTo(listElt);
		var cnstrElt = $('<div class="alert alert-constraint" title="Click to remove this constraint."></div>').appendTo(itemElt);
		$('<button type="button" class="close">&times;</button>').appendTo(cnstrElt);
		var cnstrTextElt = $("<span></span>").appendTo(cnstrElt);
		cnstrTextElt.append(cnstr.name());
		container.trigger('changedSize');
		cnstrElt.click(function() {
			cnstr.clear();
			globalQuery.update();
			removeElement(cnstrElt);
		});
		cnstr.onChange(function(changeType, query, cnstr) {
			if (query == globalQuery) {
				if (changeType =="removed")
					removeElement(cnstrElt);
				else if (changeType == "changed")
					cnstrTextElt.html(cnstr.name());
			}
		});
	}

	var alreadyError = true;
	var errorMessages = {};
	function setError(message) {
		if (message == null) {
			if (alreadyError) {
				alreadyError = false;
				errorMessages = {};
		 		errorBox.css('display', 'none');
			}
		} else {
			if (!alreadyError || message != true && !errorMessages.hasOwnProperty(message)) {
				if (message != true)
					errorMessages[message] = true;
				messagesStrs = $.map(errorMessages, function (value, key)  { return key; });
				var text = "The current constraints caused an error in processing the query";
				if (messagesStrs.length > 0)
					text += ": " + messagesStrs.join("; ");
				text += ".";
				errorBox.html(text);
				alreadyError = true;
		 		errorBox.css('display', '');
				container.trigger('changedSize');
			}
		}
	}
	setError(null);

	globalQuery.onChange(function (changeType, query, cnstr) {
		if (changeType == "current" || changeType == "added")
			addConstraintElement(cnstr)
		setClearEnabled(!globalQuery.isEmpty());
	}, true);

	clearAllElt.click(function() {
		$(".mapclear").click();
		$(".clusterclear").click();
		globalQuery.clearAll();
		globalQuery.update();
	});

	var numErrors = 0;
	globalQuery.onError(function (message, fromChild, onResolve) {
		numErrors += 1;
		setError(message);
		onResolve(function () {
			if (numErrors > 0) {
				numErrors -= 1;
				if (numErrors == 0)
					setError(null);
			}
		});
	});
}
