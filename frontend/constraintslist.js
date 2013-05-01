function setupConstraintList(container, globalQuery) {
	var outerElt = $("<div class=\"constraintslist\">").appendTo(container);

	var clearAllElt = $("<button type=\"button\" class=\"btn btn-block btn-mini btn-warning\">Clear all constraints</button></ul>").appendTo(outerElt);
	var listElt = $("<ul></ul>").appendTo(outerElt);

	function setClearEnabled(enabled) {
		if (enabled)
			clearAllElt.removeAttr('disabled');
		else
			clearAllElt.attr('disabled', 'disabled');
	}
	setClearEnabled(false);

	function removeConstraintElement(cnstrElt) {
		cnstrElt.slideUp(400, function() {
			container.trigger('changedSize');
		});
	};

	function addConstraintElement(cnstr) {
		var itemElt = $("<li></li>").appendTo(listElt);
		var cnstrElt = $("<div class=\"alert alert-constraint\"></div>").appendTo(itemElt);
		$("<button type=\"button\" class=\"close\">&times;</button>").appendTo(cnstrElt);
		var cnstrTextElt = $("<span></span>").appendTo(cnstrElt);
		cnstrTextElt.append(cnstr.name());
		cnstrElt.click(function() {
			cnstr.clear();
			globalQuery.update();
			removeConstraintElement(cnstrElt);
		});
		cnstr.onChange(function(changeType, query, cnstr) {
			if (changeType =="removed") {
				removeConstraintElement(cnstrElt);
			} else if (changeType == "changed") {
				cnstrTextElt.html(cnstr.name());
			}
		});
	}

	globalQuery.onChange(function (changeType, query, cnstr) {
		if (changeType == "current" || changeType == "added") {
			addConstraintElement(cnstr)
			container.trigger('changedSize');
		}
		setClearEnabled(!globalQuery.isEmpty());
	}, true);

	clearAllElt.click(function() {
		globalQuery.clearAll();
		globalQuery.update();
	});
}
