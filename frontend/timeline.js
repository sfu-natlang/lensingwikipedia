function resultToPlotData(counts) {
	var samples = [];
	for (year in counts) {
		var date = new Date(0, 0, 1);
		date.setFullYear(year);
		samples.push({
			year: +year,
			date: date,
			count: +counts[year]
		});
	}
	samples.sort(function (a, b) { return a.year - b.year; });
	return samples;
}

function drawDetail(svg, box, data) {
	svg.append('defs')
		.append('clipPath')
		.attr('id', 'clip')
		.append('rect')
		.attr('width', box.width)
		.attr('height', box.height);
	var draw = svg.append('g')
		.attr('transform', "translate(" + box.x + "," + box.y + ")");
	var scales = {
		x: d3.time.scale().range([0, box.width]),
		y: d3.scale.linear().range([box.height, 0])
	};
	scales.x.domain(d3.extent(data, function (s) { return s.date; }));
	scales.y.domain([0, d3.max(data, function (s) { return s.count; })]);
	var axes = {
		x: d3.svg.axis().scale(scales.x).orient('bottom'),
		y: d3.svg.axis().scale(scales.y).orient('left')
	};
	var area = d3.svg.area()
		.interpolate('step-after')
		.x(function(s) { return scales.x(s.date); })
		.y0(box.height)
		.y1(function(s) { return scales.y(s.count); });
	draw.append('path')
		.datum(data)
		.attr('class', 'bar detail')
		.attr('clip-path', 'url(#clip)')
		.attr('d', area);
	draw.append('g')
		.attr('class', 'x axis detail')
		.attr('transform', "translate(0," + box.height + ")")
		.call(axes.x);
	draw.append('g')
		.attr('class', 'y axis detail')
		.call(axes.y);
	scales.updateX = function(newXDomain) {
		scales.x.domain(newXDomain);
		draw.select('path').attr('d', area);
		draw.select('.x.axis').call(axes.x);
	}
	return scales;
}

function drawSelector(svg, box, data, detailScales, brushCallback) {
	var scales = {
		x: d3.time.scale().range([0, box.width]),
		y: d3.scale.linear().range([box.height, 0])
	};
	var axes = {
		x: d3.svg.axis().scale(scales.x).orient('bottom'),
		y: d3.svg.axis().scale(scales.y).orient('left')
	};
	var draw = svg.append('g')
		.attr('transform', "translate(" + box.x + "," + box.y + ")");
	scales.x.domain(detailScales.x.domain());
	scales.y.domain(detailScales.y.domain());
	var area = d3.svg.area()
		.interpolate('step-after')
		.x(function(s) { return scales.x(s.date); })
		.y0(box.height)
		.y1(function(s) { return scales.y(s.count); });
	draw.append('path')
		.datum(data)
		.attr('class', 'bar selection')
		.attr('clip-path', 'url(#clip)')
		.attr('d', area);
	draw.append('g')
		.attr('class', 'x axis selection')
		.attr('transform', "translate(0," + box.height + ")")
		.call(axes.x);
	draw.append('g')
		.attr('class', 'y axis selection')
		.call(axes.y);
	function onBrush() {
		detailScales.updateX(brush.empty() ? scales.x.domain() : brush.extent());
		brushCallback(brush.empty() ? null : brush.extent());
	}
	var brush = d3.svg.brush()
		.x(scales.x)
		.on('brush', onBrush);
	draw.append('g')
		.attr('class', 'x brush')
		.call(brush)
		.selectAll('rect')
		.attr('y', -6)
		.attr('height', box.height + 7);
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
	var outerSvgElt = $("<svg id=\"graphwraptest\"></svg>").appendTo(outerElt);
	var svgElt = $("<svg id=\"innersvgtest\" viewBox=\"" + viewBox.x + " " + viewBox.y + " " + viewBox.width + " " + viewBox.height + "\" preserveAspectRatio=\"none\"></svg>").appendTo(outerSvgElt);

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
	var updateTimer = null;
	var isSelection = false;
	function setSelection(selection) {
		if (selection == null) {
			setClearEnabled(false);
			constraint.clear();
			globalQuery.update();
			if (isSelection) {
				$('.bar.detail').css('display', 'none');
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
		isSelection = (selection != null);
	}

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

	initialQuery.onChange(function () {
		setLoadingIndicator(true);
	});
	initialQuery.onResult({
		counts: {
			type: 'countbyyear'
		}
	}, function(result) {
		var svg = d3.select(svgElt[0]);
		var plotData = resultToPlotData(result.counts.counts);
		setLoadingIndicator(false);
		setSelection(null);
		var detailScales = drawDetail(svg, detailBox, plotData);
		clearBrush = drawSelector(svg, selectBox, plotData, detailScales, setSelection);
		scaleSvg();
	});
}
