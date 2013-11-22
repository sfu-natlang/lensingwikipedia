/*
 * Text search control.
 */

/*
 * Setup the control in some container element.
 * container: container element as a jquery selection
 * globalQuery: the global query
 */
function setupTextSearch(container, globalQuery) {
	var outerElt = $("<div class=\"textsearch\"></div>").appendTo(container);

	var formElt = $("<form></form>").appendTo(outerElt);
	var searchInputElt = $("<input type=\"text\" title=\"Enter search term here.\"></input>").appendTo($("<div class=\"inputbox\"></div>").appendTo(formElt));
	var btnBoxElt = $("<div class=\"buttonbox\"></div>").appendTo(formElt);
	var clearElt = $("<button type=\"button\" class=\"btn btn-warning\" title=\"Clear the text search constraint.\">Clear</button>").appendTo(btnBoxElt);
	var searchElt = $("<button type=\"submit\" class=\"btn btn-primary\" title=\"Add text search constraint.\">Search</button>").appendTo(btnBoxElt);

	outerElt.append(" \
		<div class=\"alert alert-warning alert-dismissable\"> \
			<button type=\"button\" class=\"close\" data-dismiss=\"alert\" aria-hidden=\"true\">&times;</button> \
			<strong>Some examples:</strong> \
			<ul> \
				<li>Search for a term, e.g. chernobyl</li> \
				<li>Search for terms, e.g. british gangs 1960</li> \
				<li>Search for a specific sequence of words, e.g. \"gangs of new york\"</li> \
				<li>Boolean combinations, e.g. inside AND outside, inside OR outside, inside NOT outside</li> \
				<li>Field searches: you can use a field type as a constraint on the search, e.g. location:germany, roleA0:decider, year:[1991 TO 2000]</li> \
				<li>List of fields:  \
					<ul> \
					<li>year</li> \
					<li>predicate</li> \
					<li>location</li> \
					<li>currentcountry</li> \
					<li>person</li> \
					<li>description</li> \
					<li>category</li> \
					<li>role</li> \
					<li>roleA0, roleA0, etc.</li> \
					</ul> \
				</li> \
			</ul> \
		</div> \
	");

	fillElement(container, outerElt, 'vertical');

	var constraint = new Constraint();
	globalQuery.addConstraint(constraint);

	var currentSearchTerm = null;
	function update(searchTerm) {
		if (searchTerm == null) {
			if (currentSearchTerm != null) {
				constraint.clear();
				clearElt.attr('disabled', 'disabled');
				globalQuery.update();
				currentSearchTerm = null;
			}
		} else {
			searchTerm = $.trim(searchTerm);
			if (searchTerm.length > 0) {
				constraint.name("Text search: " + searchTerm);
				constraint.set({
					type: 'textsearch',
					value: searchTerm
				});
				globalQuery.update();
				clearElt.removeAttr('disabled');
				currentSearchTerm = searchTerm;
			}
		}
	}
	update(null);

	clearElt.bind('click', function() {
		update(null);
	});
	searchElt.bind('click', function() {
		update(searchInputElt.val());
	});
	formElt.submit(function () {
		return false;
	});
}
