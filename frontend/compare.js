var currentFacet;

/*
 * Setup the control in some container element.
 * container: container element as a jquery selection
 * initialQuery: the initial (empty) query
 * globalQuery: the global query
 */
function setupCompare(container, globalQuery, facets) {
    /************************* BEGIN BUILD UI *************************/

	var outerElt = $('<div class="compare"></div>').appendTo(container);

	var formElt = $("<form></form>").appendTo(outerElt);
	var clearSelElt = $('<button type="button" class="btn btn-mini btn-warning clear mapclear" title="Clear">Clear selection</button>').appendTo(formElt);
	var modeElt = $('<select class="btn btn-mini"></select>').appendTo(formElt);
	var updateElt = $('<button type="submit" class="btn btn-warning" title="Update the visualization">Update</button></ul>').appendTo(formElt);

	var contentElt = $('<div id="compare-content"></div>').appendTo(outerElt);

	var loadingIndicator = new LoadingIndicator(outerElt);

	function setLoadingIndicator(enabled) {
		//svgElt.css('display', !enabled ? '' : 'none');
		loadingIndicator.enabled(enabled);
	}

	$.each(facets, function(idx, facet) {
		$('<option value="' + idx + '">' + facet.title + ' facet</option>').appendTo(modeElt);
	});

	fillElement(container, outerElt, 'vertical');

	/************************* END BUILD UI **************************/

	/********************** BEGIN CALLBACKS **************************/

	clearSelElt.click(function(event) {
		clearElement(contentElt);
	});

	updateElt.click(function(event) {
		clearElement(contentElt);
		setLoadingIndicator(true);

		currentFacet = facets[Number(modeElt[0].value)];

		currentFacet.constraintsQuery.onResult({
			counts: {
				type: 'countbyfieldvalue',
				field: currentFacet.field
			}
		}, function(result) {
			// TODO: This function will be called once for each constraints.
			//		 It might be a good idea to check if it was already
			//		 executed so we don't reload too many times.
			var top5names = [];

			$.each(result.counts.counts, function(idx, count) {
				if (idx < 5)
					top5names.push(count[0]);
			});

			$.each(top5names, function(idx, name) {
				$('<p>' + name + '</p>').appendTo(contentElt);
				getYearlyCountsForName(currentFacet.field, name, function(res) {
					// TODO do something wih the yearly counts we get here.
					var pairs = buildYearCountObjects(res.counts.counts);
					var smoothed = smoothData(pairs, "count", 5);
				});
			});

			setLoadingIndicator(false);

			console.log(top5names);
		});

		currentFacet.constraintsQuery.update();
	});

	// disable form because we don't want to refresh the page
	formElt.submit(function() {
		return false;
	});

	/********************* END CALLBACKS ****************************/
}

/****************** HELPERS *****************************************/
function getYearlyCountsForName(field, name, callback) {
	var query = new Query(globalQuery.backendUrl());
	var nameConstraint = new Constraint();

	query.addConstraint(nameConstraint);

	nameConstraint.set({
		type: 'fieldvalue',
		field: field,
		value: name
	});

	query.onResult({
		counts: {
			type: 'countbyyear'
		}
	}, callback);

	query.update();
}

function buildYearCountObjects(data) {
	// data is assumed to be the result.counts.counts array returned by the
	// backend which objects with year == obj[0] and count == obj[1]

	objs = new Array();

	$.each(data, function(idx, obj) {
		objs.push({
			year: obj[0],
			count: obj[1]
		});
	});

	return objs;
}

function clearElement(element) {
	element.html("");
}


function smoothData(data, attribute, k) {
	if (k == 0) {
		return data;
	}

	var samples = [];

	for (i = 0; i < data.length; i++) {
		var start_at = (i-k) < 0 ? 0 : i - k;
		var end_at = (i+k) >= data.length ? data.length : i + k;

		var smooth_sum = 0;

		for (j = start_at; j < end_at; j++) {
			smooth_sum += data[j][attribute];
		}

		smooth_sum /= end_at - start_at;

		sample = data[i];
		sample[attribute] = smooth_sum;

		samples.push(sample);
	}

	return samples;
}
