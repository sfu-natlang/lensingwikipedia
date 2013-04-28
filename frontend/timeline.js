var timelineClipNum = 0;

function resultToPlotData(initialCounts, contextCounts) {
	var allYears = {};
	for (year in initialCounts)
		allYears[year] = true;
	for (year in contextCounts)
		allYears[year] = true;

	var samples = [];
	for (year in allYears) {
		var date = new Date(0, 0, 1);
		date.setFullYear(year);
		sample = {
			year: +year,
			date: date,
			initialCount: +initialCounts[year] || 0,
			contextCount: +contextCounts[year] || 0
		};
		sample.count = Math.max(sample.initialCount, sample.contextCount);
		samples.push(sample);
	}

	samples.sort(function (a, b) { return a.year - b.year; });
	return samples;
}

function drawCounts(data, box, draw, scales, classStr, clipId) {
	var initialArea = d3.svg.area()
		.interpolate('step-after')
		.x(function(s) { return scales.x(s.date); })
		.y0(box.height)
		.y1(function(s) { return scales.y(s.initialCount); });
	var contextArea = d3.svg.area()
		.interpolate('step-after')
		.x(function(s) { return scales.x(s.date); })
		.y0(box.height)
		.y1(function(s) { return scales.y(s.contextCount); });

	var initialPath = draw.append('path')
		.datum(data)
		.attr('class', "bar " + classStr + " initial");
	var contextPath = draw.append('path')
		.datum(data)
		.attr('class', "bar " + classStr + " context");
	if (clipId != null) {
		initialPath.attr('clip-path', "url(#" + clipId + ")");
		contextPath.attr('clip-path', "url(#" + clipId + ")");
	}

	function update () {
		initialPath.attr('d', initialArea);
		contextPath.attr('d', contextArea);
	}
	update();

	return update;
}

function drawPlot(svg, box, data, classStr, matchScales, clipId) {
	var draw = svg.append('g')
		.attr('transform', "translate(" + box.x + "," + box.y + ")");
	var scales = {
		x: d3.time.scale().range([0, box.width]),
		y: d3.scale.linear().range([box.height, 0])
	};
	if (matchScales != null) {
		scales.x.domain(matchScales.x.domain());
		scales.y.domain(matchScales.y.domain());
	} else {
		scales.x.domain(d3.extent(data, function (s) { return s.date; }));
		scales.y.domain([0, d3.max(data, function (s) { return s.count; })]);
	}
	var axes = {
		x: d3.svg.axis().scale(scales.x).orient('bottom'),
		y: d3.svg.axis().scale(scales.y).orient('left')
	};
	var updatePlot = drawCounts(data, box, draw, scales, classStr, clipId);
	draw.append('g')
		.attr('class', "x axis " + classStr)
		.attr('transform', "translate(0," + box.height + ")")
		.call(axes.x);
	draw.append('g')
		.attr('class', "y axis " + classStr)
		.call(axes.y);
	function updateX(newXDomain) {
		scales.x.domain(newXDomain);
		updatePlot();
		draw.select('.x.axis').call(axes.x);
	}
	return {
		draw: draw,
		scales: scales,
		updateX: updateX
	};
}

function drawTimeline(svg, detailBox, selectBox, data, initialBrushExtent, brushCallback) {
	var clipId = "timelineclip" + timelineClipNum;
	timelineClipNum++;
	svg.append('defs')
		.append('clipPath')
		.attr('id', clipId)
		.append('rect')
		.attr('width', detailBox.width)
		.attr('height', detailBox.height);
	var detailPlot = drawPlot(svg, detailBox, data, 'detail', null, clipId);

	var selectPlot = drawPlot(svg, selectBox, data, 'selection', detailPlot.scales);
	function onBrush() {
		detailPlot.updateX(brush.empty() ? selectPlot.scales.x.domain() : brush.extent());
		brushCallback(brush.empty() ? null : brush.extent());
	}
	var brush = d3.svg.brush()
		.x(selectPlot.scales.x)
		.on('brush', onBrush);
	if (initialBrushExtent != null)
		brush.extent(initialBrushExtent);
	selectPlot.draw.append('g')
		.attr('class', 'x brush')
		.call(brush)
		.selectAll('rect')
		.attr('y', -2)
		.attr('height', selectBox.height + 6);

	return function() { d3.select('g.brush').call(brush.clear()); onBrush(); };
}

function setupTimeline(container, initialQuery, globalQuery) {
	// The view space for SVG; this doesn't have to correspond to screen units
	// (since we're using preserveAspectRatio).
	var viewBox = { x: 0, y : 0, width: 1024, height: 768 };
	// Margins for the main graphs (but not for the axes and axes labels,
	// which go in the margin space).
	var margins = { left: 50, right: 30, top: 20, bottom: 35, between: 40 };
	// Vertical size of the detail area as a fraction of the total.
	var split = 0.6;
	// Delay before updating the query after a selection change (to avoid
	// sending queries to the backend at each mouse movement).
	var updateDelay = 500;

	var outerElt = $("<div class=\"timeline\"></div>").appendTo(container);
	var topBoxElt = $("<div class=\"topbox\"></div>").appendTo(outerElt);
	var clearElt = $("<button type=\"button\" class=\"btn btn-block btn-mini btn-warning\">Clear selection</button></ul>").appendTo(topBoxElt);
	var loadingElt = makeLoadingIndicator().appendTo(outerElt);
	var outerSvgElt = $("<svg class=\"outersvg\"></svg>").appendTo(outerElt);
	var svgElt = $("<svg class=\"innersvg\" viewBox=\"" + viewBox.x + " " + viewBox.y + " " + viewBox.width + " " + viewBox.height + "\" preserveAspectRatio=\"none\"></svg>").appendTo(outerSvgElt);

	fillElement(container, outerElt, 'vertical');
	setupPanelled(outerElt, topBoxElt, outerSvgElt, 'vertical', 0, false);
	var scaleSvg = dontScaleSvgParts(outerSvgElt, 'text,.tick');

	var width = viewBox.width - margins.left - margins.right,
	    height = viewBox.height - margins.top - margins.bottom - margins.between;
	var detailBox = { x: viewBox.x + margins.left, y: viewBox.y + margins.top, width: width, height: height * split },
	    selectBox = { x: viewBox.x + margins.left, y: viewBox.y + margins.top + detailBox.height + margins.between, width: width, height: height * (1.0 - split) };

	function setLoadingIndicator(enabled) {
		svgElt.css('display', !enabled ? '' : 'none');
		loadingElt.css('display', enabled ? '' : 'none');
	}
	setLoadingIndicator(true);

	function setClearEnabled(enabled) {
		if (enabled)
			clearElt.removeAttr('disabled');
		else
			clearElt.attr('disabled', 'disabled');
	}
	setClearEnabled(false);

	var constraint = new Constraint();
	globalQuery.addConstraint(constraint);
	var ownCnstrQuery = new Query(globalQuery.backendUrl());
	ownCnstrQuery.addConstraint(constraint);
	var contextQuery = new Query(globalQuery.backendUrl(), 'setminus', globalQuery, ownCnstrQuery);
	var updateTimer = null;
	var isSelection = true;
	var lastSelection = null;
	function setSelection(selection, forceUpdate) {
		if (forceUpdate)
			isSelection = !isSelection;
		if (selection == null) {
			setClearEnabled(false);
			constraint.clear();
			globalQuery.update();
			if (isSelection) {
				$('.bar.detail.initial').css('display', 'none');
				$('.bar.detail.context').css('display', 'none');
				$('.axis.detail').children().css('fill-opacity', '0.25');
				$('.axis.detail').children().css('stroke-opacity', '0.25');
			}
		} else {
			setClearEnabled(true);
			function getYear(date) {
				return Math.round(date.getFullYear() + date.getMonth() / 12.0);
			}
			function formatYear(year) {
				return (year >= 0 ? year : -year) + (year >= 0 ? "CE" : "BCE");
			}
			if (updateTimer != null)
				clearTimeout(updateTimer);
			updateTimer = setTimeout(function () {
				var low = getYear(selection[0]),
				    high = getYear(selection[1]);
				constraint.set({
					name: "Timeline: " + formatYear(low) + " - " + formatYear(high),
					type: 'timerange',
					low: low,
					high: high
				});
				globalQuery.update();
				updateTimer = null;
				scaleSvg();
			}, updateDelay);
			if (!isSelection) {
				$('.bar.detail').css('display', '');
				$('.axis.detail').children().css('fill-opacity', '');
				$('.axis.detail').children().css('stroke-opacity', '');
			}
		}
		lastSelection = selection;
		isSelection = (selection != null);
	}
	setSelection(null);

	var clearBrush = null;
	clearElt.click(function () {
		if (clearBrush != null)
			clearBrush();
		constraint.clear();
		globalQuery.update();
	});
	constraint.onChange(function (changeType) {
		if (changeType == 'removed' && clearBrush != null)
			clearBrush();
	});

	var initialData = null,
	    contextData = null;
	function draw() {
		if (initialData != null && contextData != null) {
			svgElt.children().remove();
			var svg = jqueryToD3(svgElt);
			var plotData = resultToPlotData(initialData, contextData);
			setLoadingIndicator(false);
			clearBrush = drawTimeline(svg, detailBox, selectBox, plotData, lastSelection, setSelection);
			setSelection(lastSelection, true);
			scaleSvg();
		}
	}

	initialQuery.onChange(function () {
		setLoadingIndicator(true);
	});
	initialQuery.onResult({
		counts: {
			type: 'countbyyear'
		}
	}, function(result) {
		initialData = result.counts.counts;
		draw();
	});
	contextQuery.onChange(function () {
		setLoadingIndicator(true);
	});
	contextQuery.onResult({
		counts: {
			type: 'countbyyear'
		}
	}, function(result) {
		contextData = result.counts.counts;
		draw();
	});
	contextData = {};
}
