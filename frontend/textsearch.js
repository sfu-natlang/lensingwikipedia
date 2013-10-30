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

	$("<div class=\"infobox\">See the <a href=\"http://pythonhosted.org/Whoosh/querylang.html\" target=\"_blank\">Whoosh documentation</a> for help.</div>").appendTo(outerElt);

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
