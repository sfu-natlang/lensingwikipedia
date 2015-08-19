/*
 * Text search control.
 */

var TextSearch = (function () {

/*
 * Setup the control in some container element.
 * container: container element as a jquery selection
 * globalQuery: the global query
 */
function setup(container, globalQuery) {
	var outerElt = $('<div class="textsearch"></div>').appendTo(container);

	var formElt = $('<form></form>').appendTo(outerElt);
	var searchInputElt = $('<input type="text" title="Enter search term here."></input>').appendTo($('<div class="inputbox"></div>').appendTo(formElt));
	var btnBoxElt = $('<div class="buttonbox"></div>').appendTo(formElt);
	var clearElt = $('<button type="button" class="btn btn-warning" title="Clear the text search constraint.">Clear</button>').appendTo(btnBoxElt);
	var searchElt = $('<button type="submit" class="btn btn-primary" title="Add text search constraint.">Search</button>').appendTo(btnBoxElt);

	var helpTextElt = outerElt.append(' \
		<div class="alert alert-warning alert-dismissable"> \
			<button type="button" class="close" data-dismiss="alert" aria-hidden="true">&times;</button> \
			<strong>Some examples:</strong> \
			<ul> \
				<li>Search for a term, e.g. chernobyl</li> \
				<li>Search for terms, e.g. british gangs 1960</li> \
				<li>Search for a specific sequence of words, e.g. "gangs of new york"</li> \
				<li>Boolean combinations, e.g. inside AND outside, inside OR outside, inside NOT outside</li> \
				<li>Field searches: you can use a field type as a constraint on the search, e.g. location:germany, roleA0:decider, year:[1991 TO 2000]</li> \
				<li>List of fields:  \
					<ul class=\"fieldexamples\"> \
					</ul> \
				</li> \
			</ul> \
			See the <a href="http://pythonhosted.org/Whoosh/querylang.html" target="_blank">Whoosh documentation</a> for syntax details. \
		</div> \
	');

	var fieldExElt = helpTextElt.find('.fieldexamples');
	$.each(FrontendConfig.helpFieldsList, function (fieldI, field) {
		$("<li>" + field + "</li>").appendTo(fieldExElt);
	});

	LayoutUtils.fillElement(container, outerElt, 'vertical');

	var ownCnstrQuery = new Queries.Query(globalQuery.backendUrl());

	var selection = new Selections.SimpleSingleValueSelection();
	Selections.setupSelectionClearButton(clearElt, selection);
	Selections.syncSingleValueSelectionWithConstraint(selection, globalQuery, ownCnstrQuery, function () {
		return new Queries.Constraint();
	}, function (constraint, selection, searchTerm) {
		constraint.name("Text search: " + searchTerm);
		constraint.set({
			type: 'textsearch',
			value: searchTerm
		});
	});

	selection.on('empty', function () {
		if (searchInputElt.val() != "")
			searchInputElt.val("");
	});

	searchElt.bind('click', function() {
		var searchTerm = $.trim(searchInputElt.val());
		if (searchTerm.length > 0)
			selection.set(searchTerm);
		else
			selection.clear();
	});
	formElt.submit(function () {
		return false;
	});

	return {
		selection: selection
	};
}

return {
	setup: setup
}
}());
