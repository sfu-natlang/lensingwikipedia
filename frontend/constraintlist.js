function setupConstraintList(container, globalQuery, name, view, makeConstraint) {
	container.append("<h1>Constraints</h1>");
	container.append("<button>Clear all</button>");
	var clearElt = container.find("button");
	container.append("<div class=\"listbox\"></div>");
	var boxElt = container.find(".listbox");
	boxElt.append("<ul></ul>");
	var listElt = boxElt.find("ul");

	clearElt.click(function() {
		globalQuery.clearAll();
	});

	var lookup = {};
	globalQuery.onChange(function (changeType, constraint) {
		if (changeType == "current" || changeType == "added") {
			listElt.append("<li class=\"" + constraint.id + "\">" + constraint.value.name + " <span class=\"remove\">[X]</span></li>");
			lookup[constraint.id] = constraint;
		} else if (changeType == "removed") {
			listElt.find("li." + constraint.id).remove();
			delete lookup[constraint.id];
		} else if (changeType == "change") {
			listElt.find("li." + constraint.id).html(constraint.value.name);
		}
	}, true);

	function select(cnstrId) {
		var cnstr = lookup[cnstrId];
		if (cnstr != null)
			cnstr.clear();
		globalQuery.update();
	}

	listElt.click(function(event) {
		var on = event.target;
		if (Object.prototype.toString.call(on) == "[object HTMLSpanElement]")
			select($(on).parent().attr("class"));
	});
}
