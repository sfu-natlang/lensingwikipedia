var currentFacet;
var topCount = 5;
var smooth_k = 5;

// contains {name, counts} objects
var data_allPairs = [];
var data_allNames = [];

/*
 * Setup the control in some container element.
 * container: container element as a jquery selection
 * initialQuery: the initial (empty) query
 * globalQuery: the global query
 */
function setupCompare(container, globalQuery, facets) {
	/************************** CONSTANTS *****************************/
	// The view space for SVG; this doesn't have to correspond to screen units.
	var viewBox = { x: 0, y : 0, width: 1024, height: 768 };
	// Margins for the main graphs (but not for the axes and axes labels, which go in the margin space).
	var margins = { left: 50, right: 30, top: 40, bottom: 35, between: 40 };
	var split = 0.8;

	var width = viewBox.width - margins.left - margins.right;
	var height = viewBox.height - margins.top - margins.bottom - margins.between;
	var detailBox = {
		x: viewBox.x + margins.left,
		y: viewBox.y + margins.top,
		width: width,
		height: height * split
	};
	var selectBox = {
		x: viewBox.x + margins.left,
		y: viewBox.y + margins.top + detailBox.height + margins.between,
		width: width,
		height: height * (1.0 - split)
	};

	/************************* BEGIN BUILD UI *************************/

	var outerElt = $('<div class="compare"></div>').appendTo(container);

	var controlsElt = $('<div class="controls"></div>').appendTo(outerElt);
	var clearSelElt = $('<button type="button" class="btn btn-mini btn-warning clear mapclear" title="Clear">Clear selection</button>').appendTo(controlsElt);
	var modeElt = $('<select class="btn btn-mini"></select>').appendTo(controlsElt);
	var numElt = $('<select class="btn btn-mini"> \
										<option value="1">1</option> \
										<option value="2">2</option> \
										<option value="3">3</option> \
										<option value="5" selected>5</option> \
										<option value="-1">All</option> \
								 </select>').appendTo(controlsElt);
	var updateBtn = $('<button type="submit" class="btn btn-warning" title="Update the visualization">Update</button></ul>').appendTo(controlsElt);

	var smoothSel = $('<select class="btn btn-mini"> \
												<option value="0">0</option> \
												<option value="1">1</option> \
												<option value="5" selected>5</option> \
												<option value="10">10</option> \
												<option value="20">20</option> \
												<option value="50">50</option> \
												<option value="100">100</option> \
										</select>'
										).appendTo(controlsElt);
	var smoothBtn = $('<button class="btn btn-warning" title="Update smoothing">Smooth</button></ul>').appendTo(controlsElt);

	var outerSvgElt = $('<svg class="outersvg"></svg>').appendTo(outerElt);
	var svgElt = $('<svg id="comparesvg"</svg>').appendTo(outerSvgElt);

	var loadingIndicator = new LoadingIndicator(outerElt);

	function setLoadingIndicator(enabled) {
		//svgElt.css('display', !enabled ? '' : 'none');
		loadingIndicator.enabled(enabled);
	}

	$.each(facets, function(idx, facet) {
		$('<option value="' + idx + '">' + facet.title + ' facet</option>').appendTo(modeElt);
	});

	fillElement(container, outerElt, 'vertical');
	setupPanelled(outerElt, controlsElt, outerSvgElt, 'vertical', 0, false);
	var scaleSvg = dontScaleSvgParts(outerSvgElt, 'text,.tick');

	/************************* END BUILD UI **************************/

	/********************** BEGIN CALLBACKS **************************/

	clearSelElt.click(function(event) {
		//clearElement(contentElt);
	});

	smoothBtn.click(function(event) {
		setLoadingIndicator(true);
		smooth_k = Number(smoothSel[0].value);
		drawCompare(viewBox, detailBox, selectBox, margins, data_allNames,
								data_allPairs, smooth_k, container);
		setLoadingIndicator(false);
	});

	updateBtn.click(function(event) {
		//clearElement(contentElt);
		setLoadingIndicator(true);

		currentFacet = facets[Number(modeElt[0].value)];
		topCount = Number(numElt[0].value);

		if (topCount < 0) {
			// topCount == -1 means we want all the items in the facet

		}

		currentFacet.constraintsQuery.onResult({
			counts: {
				type: 'countbyfieldvalue',
				field: currentFacet.field
			}
		}, function(result) {
			// TODO: This function will be called once for each constraints.
			//		 It might be a good idea to check if it was already
			//		 executed so we don't reload too many times.
			var topNames = [];

			if (topCount < 0) {
				topCount = result.counts.counts.length;
			}

			$.each(result.counts.counts, function(idx, count) {
				if (idx < topCount)
					topNames.push(count[0]);
			});

			data_allPairs = [];
			data_allNames = [];
			$.each(topNames, function(idx, name) {
				//$('<p>' + name + '</p>').appendTo(contentElt);
				console.log("Got new name: " + name);
				data_allNames.push(name);
				getYearlyCountsForName(currentFacet.field, name, function(res) {
					// TODO do something wih the yearly counts we get here.
					var data_pairs = buildYearCountObjects(res.counts.counts);
					console.log("Got counts!");

					data_allPairs.push({name: name, counts: data_pairs});

					// check if we've gotten counts for all top X names
					// This is a callback, so this is the only way we can do
					// this
					if (data_allPairs.length == topCount) {
						var first_year = d3.min(data_allPairs, function(c) { return d3.min(c.counts, function(v) { return v.year; }); }) - 100;
						var last_year = d3.max(data_allPairs, function(c) { return d3.max(c.counts, function(v) { return v.year; }); }) + 100;
						add_zeroes(data_allPairs, first_year, last_year);

						drawCompare(viewBox, detailBox, selectBox, margins,
									data_allNames, data_allPairs, smooth_k, container);
						setLoadingIndicator(false);
					}
				});
			});
		});
		currentFacet.constraintsQuery.update();
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

	var objs = new Array();
	var years = new Array();

	$.each(data, function(idx, obj) {
		objs.push({
			year: Number(obj[0]),
			count: Number(obj[1])
		});

		years.push(Number(obj[0]));
	});

	// add zero counts for years that don't have counts in the data
	// NOTE: this will only add zeroes between first and last encountered years
	var first = d3.min(years);
	var last = d3.max(years);

	for (var i = first; i <= last; i++) {
		if ($.inArray(i, years) == -1) {
			objs.push({
				year: i,
				count: 0
			});
		}
	}

	// since we added the zeros after the real data, we have to sort it (so
	// smoothing will work properly later)
	objs.sort(function(a, b) {
		return a.year - b.year;
	});

	return objs;
}

function clearElement(element) {
	element.html("");
}

function smoothData(data, attribute, k) {
	if (k == 0) {
		return $.extend({}, data);
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

		sample = $.extend({}, data[i]);
		sample[attribute] = smooth_sum;

		samples.push(sample);
	}

	return samples;
}

function mergeCounts(data) {
	// This function expects data as an array.
	// Each element is an object {name: "Augustus", counts: Array()}.
	// Counts is the array returned by buildYearCountObjects.
	// It will return a single array of each of these arrays merged together,
	// [{year: X, "Augustus": C1, "Name2": C2},...]

	// perYearCounts will contains {2001: {"Augustus": 0, "Name2": 3}, 2002: ...}
	var perYearCounts = {};

	$.each(data, function(i, d) {
		$.each(d.counts, function(j, count) {
			if (!(count.year in perYearCounts)) {
				perYearCounts[count.year] = {};
			}

			perYearCounts[count.year][d.name] = count.count;
		});
	});

	var ret = new Array();

	for (var year in perYearCounts) {
		var flat_year = {year: year};

		for (var name in perYearCounts[year]) {
			flat_year[name] = perYearCounts[year][name];
		}

		ret.push(flat_year);
	}

	return ret;
}

function add_zeroes(data, first_year, last_year) {
	// We expect zeroes to be already added in between real data for each facet,
	// so we only need to add between first_year and first piece of data in each
	// facet
	//
	// MODIFIES INPLACE

	for (name_idx in data) {
		var first_year_data = data[name_idx].counts[0].year;
		for (var i = 0; i < first_year_data - first_year; i++) {
			data[name_idx].counts.splice(0, 0, {count: 0, year: (first_year_data - (i+1))});
		}

		var last_year_data = data[name_idx].counts.slice(-1)[0].year;
		for (var i = last_year_data; i <= last_year; i++) {
			data[name_idx].counts.push({count: 0, year: (i+1)});
		}
	}
}

function createYearlyCounts(data, names) {
	// stores data in {year: {name1: count1, name2: count2...}...}
	var yearly_data = {};

	for (idx in data) {
		yearly_data[data[idx].year] = data[idx];
	}

	return yearly_data;
}

function processData(data, names, smooth_k) {
	// will give us multiple ways of representing that data so we can use it
	// however we like
	//
	// data is allPairs
	var smoothed_data = [];
	for (name_idx in data) {
		smoothed_data.push({
			name: data[name_idx].name,
			counts: smoothData(data[name_idx].counts, "count", smooth_k)
		});
	}
	var updated_data = mergeCounts(smoothed_data);
	var yearly_data = createYearlyCounts(mergeCounts(data));

	updated_data.forEach(function(d) {
		var jsYear = +d.year;
		// The input data represents n BCE as -n whereas Javascript uses 1-n
		if (jsYear < 0)
			jsYear += 1;
		var date = new Date(0, 0, 1);
		date.setFullYear(jsYear);
		d.date = date;
	});

	updated_data.sort(function(a, b) {
		return a.date - b.date;
	});

	var persons = names.map(function(name) {
		return {
			name: name,
			values: updated_data.map(function(d) {
				var c = +d[name];
				if (isNaN(c))
					c = 0.0;
				return {date: d.date, count: c};
			})
		};
	});

	return {merged: updated_data, persons: persons, yearly: yearly_data};
}

function drawCompare(viewBox, detailBox, selectBox, margins, names, data, smooth_k, container) {
	var processed = processData(data, names, smooth_k);

	var persons = processed.persons;
	var merged_data = processed.merged;
	var yearly_data = processed.yearly;

	var parseDate = d3.time.format("%Y").parse;

	d3.select("#comparesvg").selectAll("*").remove();

	var svg = d3.select("#comparesvg")
			.attr("viewBox", [viewBox.x, viewBox.y, viewBox.width, viewBox.height].join(" "))
			.attr("preserveAspectRatio", "none")

	svg.append("defs").append("clipPath")
			.attr("id", "clip")
		.append("rect")
			.attr('width', detailBox.width)
			.attr('height', detailBox.height)
			.attr('x', 0)
			.attr('y', 0);

	var legend = svg.append("g")
		.attr("class", "legend")
		.attr("transform", "translate(" + margins.left + "," + (margins.top/2) + ")");

	var focus = svg.append("g")
			.attr("transform", "translate(" + margins.left + "," + detailBox.y + ")")
			.attr("id", "compare-focus");

	var context = svg.append("g")
			.attr("transform", "translate(" + margins.left + "," + selectBox.y + ")")
			.attr("id", "compare-context");

	var x = d3.time.scale().range([0, detailBox.width]);
	var x2 = d3.time.scale().range([0, selectBox.width]);
	var y = d3.scale.linear().range([detailBox.height, 0]);
	var y2 = d3.scale.linear().range([selectBox.height, 0]);

	var color = d3.scale.category10();

	var xAxis = d3.svg.axis()
		.scale(x)
		.orient("bottom");

	var xAxis2 = d3.svg.axis()
		.scale(x2)
		.orient("bottom");

	var yAxis = d3.svg.axis()
		.scale(y)
		.orient("left");

	hoverLineXOffset = margins.left+$(container).offset().left;
	hoverLineYOffset = margins.top+$(container).offset().top;
	hoverLineGroup = focus.append("g")
		.attr("class", "hover-line");
		// add the line to the group
		hoverLine = hoverLineGroup
			.append("line")
				.attr("x1", 10).attr("x2", 10) // vertical line so same value on each
				.attr("y1", 0).attr("y2", detailBox.height); // top to bottom

		// hide it by default
		hoverLine.classed("hide", true);

	var line = d3.svg.line()
		.interpolate("monotone")
		.tension(0.85)
		.x(function(d) { return x(d.date); })
		.y(function(d) { return y(d.count); });

	var line2 = d3.svg.line()
		.interpolate("monotone")
		.tension(0.85)
		.x(function(d) { return x2(d.date); })
		.y(function(d) { return y2(d.count); });

	color.domain(names);

	x.domain(d3.extent(merged_data, function(d) { return d.date; }));

	y.domain([
		d3.min(persons, function(c) { return d3.min(c.values, function(v) { return v.count; }); }),
		d3.max(persons, function(c) { return d3.max(c.values, function(v) { return v.count; }); })
	]);

	x2.domain(x.domain());
	y2.domain(y.domain());

	focus.append("g")
			.attr("class", "x axis")
			.attr("transform", "translate(0," + detailBox.height + ")")
			.call(xAxis);

	context.append("g")
			.attr("class", "x axis")
			.attr("transform", "translate(0," + selectBox.height + ")")
			.call(xAxis2);

	focus.append("g")
			.attr("class", "y axis")
			.call(yAxis)
		.append("text")
			.attr("transform", "rotate(-90)")
			.attr("y", 6)
			.attr("dy", ".71em")
			.style("text-anchor", "end")
			.text("Count");

	focus.selectAll()
			.data(persons)
		.enter()
			.append("path")
				.attr("class", "line")
				.attr("clip-path", "url(#clip)")
				.attr("d", function(d) { return line(d.values); })
				.attr("name", function(d) { return d.name; })
				.style("stroke", function(d) { return color(d.name); });

	context.selectAll()
			.data(persons)
		.enter()
			.append("path")
				.attr("class", "line")
				.attr("d", function(d) { return line2(d.values); })
				.attr("name", function(d) { return d.name; })
				.style("stroke", function(d) { return color(d.name); });

	legend.selectAll()
			.data(persons)
		.enter().append("text")
			.attr("transform", function(d, i) { return "translate(" + (i*(detailBox.width / topCount)) + "," + 0 + ")"; })
			.attr("x", 3)
			.attr("dy", ".35em")
			.attr("class", "legend")
			.style("fill", function(d) {
				return color(d.name);
			})
			.text(function(d) { return d.name; })
			.on("click", function(d) {
				$('path.line[name="' + d.name + '"]').toggle();

				if (this.style.textDecoration == "")
					this.style.textDecoration = "line-through";
				else
					this.style.textDecoration = "";
			});

	legend.append("text")
		.attr("transform", function(d, i) { return "translate(" + (-margins.left) + "," + 0 + ")"; })
		.attr("x", 3)
		.attr("dy", ".35em")
		.attr("id", "legend-year")
		.style("fill", "black")

	var brush = d3.svg.brush()
		.x(x2)
		.on("brush", brushed);

	context.append("g")
		.attr("class", "x brush")
			.call(brush)
		.selectAll("rect")
			.attr("y", -6)
			.attr("height", selectBox.height + 7);

	function brushed() {
		x.domain(brush.empty() ? x2.domain() : brush.extent());

		var filtered = persons.map(function(d) {
			return {
				name: d.name,
				values: d.values.filter(function(d, i) {
					if ((d.date >= x.domain()[0]) && (d.date <= x.domain()[1])) {
						return true;
					}
				})
			};
		});

		y.domain([
			d3.min(filtered, function(c) { return d3.min(c.values, function(v) { return v.count; }); }),
			d3.max(filtered, function(c) { return d3.max(c.values, function(v) { return v.count; }); })
		]);

		focus.selectAll(".line").attr("d", function(d) { return line(d.values); });
		focus.select(".x.axis").call(xAxis);
		focus.select(".y.axis").call(yAxis);
	}

	var handleMouseOverLine = function(lineData, index) {
	}

	var currentUserPositionX = 0;

	var handleMouseOverGraph = function(event) {
		var mouseX = event.pageX-hoverLineXOffset;
		var mouseY = event.pageY-hoverLineYOffset;

		if(mouseX >= 0 && mouseX <= detailBox.width && mouseY >= detailBox.y && mouseY <= detailBox.height + detailBox.y) {
			// show the hover line
			hoverLine.classed("hide", false);

			// set position of hoverLine
			hoverLine.attr("x1", mouseX).attr("x2", mouseX)

			currentUserPositionX = mouseX;

			var year = x.invert(mouseX).getFullYear();
			updateLegendValues(year);
		} else {
			// proactively act as if we've left the area since we're out of the bounds we want
			handleMouseOutGraph(event)
		}
	}

	var handleMouseOutGraph = function(event) {
		// hide the hover-line
		hoverLine.classed("hide", true);

		currentUserPositionX = -1;
		d3.select("#legend-year").text("");
	}

	$(container).mouseleave(function(event) {
		handleMouseOutGraph(event);
	});

	$(container).mousemove(function(event) {
		handleMouseOverGraph(event);
	});

	var updateLegendValues = function(year) {
		// find element with the right year.
		d3.selectAll("text.legend")
			.text(function(d, i) {
				return d.name  + " - " + yearly_data[year][d.name];
			});

		d3.select("#legend-year").text(year);
	};
}
