function setupConstraintList(container, globalQuery) {
	var clearAllElt = $("<button type=\"button\" class=\"btn btn-block btn-mini btn-warning\">Clear all constraints</button></ul>").appendTo(container);
	var listElt = $("<ul></ul>").appendTo(container);

	function removeConstraintElement(cnstrElt) {
		cnstrElt.slideUp(400, function() {
			container.trigger('changedSize');
		});
	};

	function addConstraintElement(cnstr) {
		var itemElt = $("<li></li>").appendTo(listElt);
		var cnstrElt = $("<div class=\"alert alert-info\"></div>").appendTo(itemElt);
		$("<button type=\"button\" class=\"close\">&times;</button>").appendTo(cnstrElt);
		var cnstrTextElt = $("<span></span>").appendTo(cnstrElt);
		cnstrTextElt.append(cnstr.value.name);
		cnstrElt.click(function() {
			cnstr.clear();
			globalQuery.update();
			removeConstraintElement(cnstrElt);
		});
		cnstr.onChange(function(changeType, query) {
			if (changeType =="removed") {
				removeConstraintElement(cnstrElt);
			} else if (changeType == "changed") {
				cnstrTextElt.html(cnstr.value.name);
			}
		});
	}

	globalQuery.onChange(function (changeType, cnstr) {
		if (changeType == "current" || changeType == "added") {
			addConstraintElement(cnstr)
			container.trigger('changedSize');
		}
	}, true);

	clearAllElt.click(function() {
		globalQuery.clearAll();
		globalQuery.update();
	});
}
