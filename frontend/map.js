var mapClipId = 0;
var mapSphereId = 0;

var mapProjections = {
	hobodyer: {
		name: "Flat",
		longName: "Hobo-Dyer",
		moveType: 'pan',
		initialScaleFactor: 0.20,
		scaleFactorChange: 0.3,
		panMode: 'translate',
		proj: function() {
			return d3.geo.cylindricalEqualArea()
				.parallel(37.5);
		}
	},
	orthographic: {
		name: "Globe",
		longName: "Orthographic",
		moveType: 'origin',
		initialScaleFactor: 0.30,
		scaleFactorChange: 0.3,
		panMode: 'rotate',
		proj: function() {
			return d3.geo.orthographic()
				.clipAngle(90);
		}
	},
	waterman: {
		name: "Butterfly",
		longName: "Waterman Butterfly",
		initialScaleFactor: 0.20,
		scaleFactorChange: 0.3,
		panMode: 'translate',
		proj: function() {
			return d3.geo.polyhedron.waterman()
				.rotate([20, 0]);
		}
	},
}

function drawWorld(svg, worldData, projection) {
	// This is all from d3's Waterman Butterfly example

	var path = d3.geo.path()
		.projection(projection);

	var graticule = d3.geo.graticule()
		.extent([[-180, -90], [180, 90]]);

	var sphereId = "mapsphere" + mapSphereId;
	mapSphereId++;
	svg.append("defs").append("path")
		.datum({type: "Sphere"})
		.attr("id", sphereId)
		.attr("d", path);

	var clipId = "mapclip" + mapClipId;
	mapClipId++;
	svg.append("clipPath")
		.attr("id", clipId)
		.append("use")
		.attr("xlink:href", "#" + sphereId);

	var group = svg.append("g");

	group.append("use")
		.attr("class", "background")
		.attr("xlink:href", "#" + sphereId);
	group.append("use")
		.attr("class", "foreground")
		.attr("xlink:href", "#" + sphereId);

	group.insert("path", ".graticule")
		.datum(topojson.object(worldData, worldData.objects.land))
		.attr("clip-path", "url(#" + clipId + ")")
		.attr("class", "land")
		.attr("d", path);
	group.insert("path", ".graticule")
		.datum(topojson.object(worldData, worldData.objects.lakes))
		.attr("clip-path", "url(#" + clipId + ")")
		.attr("class", "lake")
		.attr("d", path);
	group.insert("path", ".graticule")
		.datum(topojson.object(worldData, worldData.objects.rivers))
		.attr("clip-path", "url(#" + clipId + ")")
		.attr("class", "river")
		.attr("d", path);
	group.append("g")
		.attr("class", "graticule")
		.attr("clip-path", "url(#" + clipId + ")")
		.selectAll("path")
		.data(graticule.lines)
		.enter().append("path")
		.attr("d", path);
	group.insert("path", ".graticule")
		.datum(topojson.mesh(worldData, worldData.objects.countries, function(a, b) { return a !== b; }))
		.attr("clip-path", "url(#" + clipId + ")")
		.attr("class", "currentcountryboundary")
		.attr("d", path);

	return { path: path, group: group };
}

function makeMapControls(container, projections, minZoom, maxZoom, defaults) {
	container.append(" \
		<div class=\"selbox\"> \
			<button type=\"button\" class=\"btn btn-mini btn-warning clear\">Clear selection</button> \
			<div class=\"btn-group mode\" data-toggle=\"buttons-radio\"></div> \
		</div> \
		<div class=\"viewbox\"> \
			<div class=\"btn-group zoomcontrols\"> \
				<button class=\"btn btn-mini zoomout\">-</button> \
				<a class=\"btn btn-mini dropdown-toggle zoomlevelbtn\" data-toggle=\"dropdown\" href=\"#\"><span class=\"value\"></span><span class=\"caret\"></span></a> \
				<div class=\"dropdown-menu zoomlevelmenu\"> \
					<div class=\"btn-group btn-group-vertical zoomlevel\" data-toggle=\"buttons-radio\"></div> \
				</div> \
				<button class=\"btn btn-mini zoomin\">+</button> \
			</div> \
			<button type=\"button\" class=\"btn btn-mini centreview\">Centre</button> \
			<div class=\"btn-group\"> \
				<a class=\"btn btn-mini dropdown-toggle view\" data-toggle=\"dropdown\" href=\"#\">View<span class=\"caret\"></span></a> \
				<div class=\"dropdown-menu viewsettingsmenu\"> \
					<div class=\"btn-group btn-group-vertical projection\" data-toggle=\"buttons-radio\"></div> \
					<ul class=\"viewchoices\"></ul> \
				</div> \
			</div> \
		</div> \
	");

	var modeElt = container.find(".selbox .mode");
	$.each({ toggle: "Toggle", drag: "Drag", pan: "Pan" }, function (key, value) {
		$("<button class=\"btn btn-mini\" value=\"" + key + "\">" + value + "</button>").appendTo(modeElt);
	});
	modeElt.find("button[value=" + defaults.selectionMode + "]").button('toggle');

	var curZoom = defaults.zoomLevel;
	var zoomBtnElt = container.find(".zoomlevelbtn");
	var zoomElt = container.find(".zoomlevel");
	$.each([1, 2, 3, 4, 5], function (key, value) {
		$("<button class=\"btn btn-mini\" value=\"" + value + "\">" + value + "</button>").appendTo(zoomElt);
	});
	zoomElt.find("button").bind('click', function () {
		var value = $(this).val();
		zoomBtnElt.find(".value").html(value);
		$(this).button('toggle');
		curZoom = +value;
	});
	function updateZoom() {
		var btn = zoomElt.find("button[value=" + curZoom + "]");
		btn.button('toggle');
		btn.trigger('click');
	}

	var zoomOutEnt = container.find(".zoomout");
	var zoomInElt = container.find(".zoomin");
	zoomOutEnt.on('click', function () {
		if (curZoom > minZoom) {
			curZoom -= 1;
			updateZoom();
		}
	});
	zoomInElt.on('click', function () {
		if (curZoom < maxZoom) {
			curZoom += 1;
			updateZoom();
		}
	});

	var projElt = container.find(".projection");
	$.each(projections, function (key, proj) {
		$("<button class=\"btn btn-mini\" value=\"" + key + "\">" + proj.name + "</button>").appendTo(projElt);
	});
	projElt.find("button").bind('click', function () {
		$(this).button('toggle');
	});
	function updateProj() {
		var curProj = defaults.projection;
		var btn = projElt.find("button[value=" + curProj + "]");
		btn.button('toggle');
		btn.trigger('click');
	}

	var choicesElt = container.find(".viewchoices");
	$.each({ graticule: "Graticules", currentcountryboundary: "Current countries" }, function (key, name) {
		$("<li><label class=\"checkbox\"><input type=\"checkbox\" value=\"" + key + "\">" + name + "</label></li>").appendTo(choicesElt);
	});
	// First pass to make the checkedness consistent
	$.each(defaults.viewChoices, function (key, value) {
		if (!value)
			choicesElt.find("input[value=" + key + "]").trigger('click');
	});
	function updateViewChoices() {
		var curChoices = defaults.viewChoices;
		$.each(curChoices, function (key, value) {
			choicesElt.find("input[value=" + key + "]").trigger('click');
		});
	}

	// Have our dropdown menus not close on a click inside them. This means that we
	// have to manually call button('toggle') in a couple of places above to keep
	// the visuals working.
	container.find(".dropdown-menu").bind('click', function (event) {
		event.stopPropagation();
	});

	return function () {
		updateZoom();
		updateProj();
		updateViewChoices();
	}
}

function loadSettingsCookies(defaults) {
	var value = $.cookie("mapprojection");
	if (value != null)
		defaults.projection = value;
	$.each(defaults.viewChoices, function (setting, choice) {
		var value = $.cookie("mapviewchoice" + setting);
		if (value != null)
			defaults.viewChoices[setting] = (value == 'true');
	});
}

function saveSettingsCookie(name, value) {
	$.cookie(name, value, { expires: 7 });
}

function setupMap(container, initialQuery, globalQuery, minZoom, maxZoom) {
	// The view space for SVG; this doesn't have to correspond to screen units
	// (since we're using preserveAspectRatio).
	var viewBox = { x: 0, y : 0, width: 1024, height: 768 };
	// Margins for the map.
	var margins = { left: 10, right: 10, top: 10, bottom: 10, between: 10 };

	var outerElt = $("<div class=\"map\"></div>").appendTo(container);
	var topBoxElt = $("<div class=\"topbox\"></div>").appendTo(outerElt);
	var outerSvgElt = $("<svg class=\"outersvg\"></svg>").appendTo(outerElt);
	var svgElt = $("<svg class=\"innersvg\" viewBox=\"" + viewBox.x + " " + viewBox.y + " " + viewBox.width + " " + viewBox.height + "\" preserveAspectRatio=\"xMidYMid meet\"></svg>").appendTo(outerSvgElt);
	var loadingElt = makeLoadingIndicator().appendTo(outerElt);

	var defaultSettings = {
		selectionMode: 'toggle',
		zoomLevel: 1,
		projection: 'hobodyer',
		viewChoices: {
			graticule: false,
			currentcountryboundary: false
		}
	};
	loadSettingsCookies(defaultSettings);
	var initControls = makeMapControls(topBoxElt, mapProjections, minZoom, maxZoom, defaultSettings);

	fillElement(container, outerElt, 'vertical');
	setupPanelled(outerElt, topBoxElt, outerSvgElt, 'vertical', 0, false);
	var scaleSvg = dontScaleSvgParts(outerSvgElt, 'text,.tick');

	var svg = jqueryToD3(svgElt);
	var box = { x: viewBox.x + margins.left, y: viewBox.y + margins.top, width: viewBox.width - margins.left - margins.right, height: viewBox.height - margins.top - margins.bottom };
	var draw = svg.append('g')
		.attr('transform', "translate(" + box.x + "," + box.y + ")");

	var scales = {
		x: d3.scale.linear().range([0, box.width]),
		y: d3.scale.linear().range([box.height, 0])
	};
	scales.x.domain([0, 1]);
	scales.y.domain([0, 1]);
/*
	var axes = {
		x: d3.svg.axis().scale(scales.x).orient('bottom'),
		y: d3.svg.axis().scale(scales.y).orient('left')
	};
	draw.append('g')
		.attr('class', "x axis " + "")
		.attr('transform', "translate(0," + box.height + ")")
		.call(axes.x);
	draw.append('g')
		.attr('class', "y axis " + "")
		.call(axes.y);
*/

	makeDragSelector(draw, scales, "brush", function (extent) {
		var a = extent;
		var b = [
			[scales.x(a[0][0]), scales.y(a[0][1])],
			[scales.x(a[1][0]), scales.y(a[1][1])]
		];
		console.log("brush a " + a);
		console.log("brush b " + b);
	});


	var mapData = null,
	    projection = null,
	    zoomLevel = null,
	    viewChoices = {},
	    pan = null;
	var curState = null,
	    curProj = null,
	    panFactor = 1.0;
	function update(quick) {
		if (mapData == null || projection == null || zoomLevel == null || viewChoices == null || pan == null) {
			outerSvgElt.css('display', 'none');
			loadingElt.css('display', '');
		} else {
			loadingElt.css('display', 'none');
			outerSvgElt.css('display', '');
			if (curProj == null) {
				curProj = projection.proj();
				curProj.translate([viewBox.x + viewBox.width / 2, viewBox.y + viewBox.height / 2]);
			}
			var totalScaleFactorChange = projection.scaleFactorChange * (zoomLevel - 1);
			curProj.scale(viewBox.width * (projection.initialScaleFactor + totalScaleFactorChange));
			if (curState == null) {
				svgElt.children().remove();
				curState = drawWorld(svg, mapData, curProj);
				newPath = true;
			} else if (!quick) {
				curState.path.projection(curProj);
			}
			if (projection.panMode == 'translate') {
				curState.group.attr("transform", "translate(" + pan[0] + "," + pan[1] + ")");
			} else if (projection.panMode == 'rotate') {
				panFactor = 0.7 / (0.85 * zoomLevel);
				curState.group.attr("transform", "");
				curProj.rotate([pan[0], -pan[1]]);
			} else
				console.log("warning: unknown projection pan mode \"" + projection.panMode + "\"");
			if (!quick || projection.panMode == 'rotate') {
				svg.selectAll("path").attr("d", curState.path);
				$.each(viewChoices, function (setting, choice) {
					svg.select("." + setting).style('display', choice ? '' : 'none');
				});
			}
		}
	}
	function resetProjection() {
		pan = [0, 0];
		curProj = null;
	}

	d3.json("map.json", function(error, incoming) {
		mapData = incoming;
		update();
	});

	topBoxElt.find(".selbox .clear").bind('click', function () {
		console.log("clear selection");
	});
	topBoxElt.find(".selbox .mode button").bind('click', function () {
		console.log("selection mode " + $(this).val());
	});
	topBoxElt.find(".viewbox .zoomlevel button").bind('click', function () {
		zoomLevel = $(this).val();
		update();
	});
	topBoxElt.find(".viewbox .projection button").bind('click', function () {
		var name = $(this).val();
		resetProjection();
		projection = mapProjections[name];
		saveSettingsCookie("mapprojection", name);
		update();
	});
	topBoxElt.find(".viewbox .centreview").bind('click', function () {
		resetProjection();
		update();
	});
	topBoxElt.find(".viewbox .viewchoices input").bind('click', function () {
		var setting = $(this).val();
		var choice = $(this).prop('checked');
		viewChoices[setting] = choice;
		saveSettingsCookie("mapviewchoice" + setting, choice);
		update();
	});

	var mouseDownAt = null,
	    mouseOrigin = [0, 0];
	pan = [0, 0];
	svg.on('mousedown', function () {
		mouseDownAt = d3.mouse(this);
	}).on('mousemove', function () {
		if (mouseDownAt != null) {
			var at = d3.mouse(this);                                                                                                                                                                    
			pan = [mouseOrigin[0] + (at[0] - mouseDownAt[0]) * panFactor, mouseOrigin[1] + (at[1] - mouseDownAt[1]) * panFactor];
			update(true);
		}
	});
	d3.select(window).on('mouseup', function () {
		if (mouseDownAt != null) {
			mouseOrigin = [pan[0], pan[1]];
			mouseDownAt = null;
		}
	});

	initControls();
}
