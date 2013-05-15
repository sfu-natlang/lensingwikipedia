var mapClipId = 0;
var mapSphereId = 0;

var mapProjections = {
	winkel3: {
		name: "Flat",
		longName: "Winkel Tripel",
		moveType: 'pan',
		initialScaleFactor: 0.20,
		scaleFactorChange: 0.3,
		panMode: 'translate',
		proj: function() {
			return d3.geo.winkel3();
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
	}
}
defaultMapProjection = 'winkel3';

function drawWorld(svg, group, worldData, projection) {
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

	group.append("use")
		.attr("class", "map background")
		.attr("xlink:href", "#" + sphereId);
	group.append("use")
		.attr("class", "map foreground")
		.attr("xlink:href", "#" + sphereId);

	group.insert("path", ".graticule")
		.datum(topojson.object(worldData, worldData.objects.land))
		.attr("clip-path", "url(#" + clipId + ")")
		.attr("class", "map land")
		.attr("d", path);
	group.insert("path", "map .graticule")
		.datum(topojson.object(worldData, worldData.objects.lakes))
		.attr("clip-path", "url(#" + clipId + ")")
		.attr("class", "map lake")
		.attr("d", path);
	group.insert("path", ".graticule")
		.datum(topojson.object(worldData, worldData.objects.rivers))
		.attr("clip-path", "url(#" + clipId + ")")
		.attr("class", "map river")
		.attr("d", path);
	group.append("g")
		.attr("class", "map graticule")
		.attr("clip-path", "url(#" + clipId + ")")
		.selectAll("path")
		.data(graticule.lines)
		.enter().append("path")
		.attr("d", path);
	group.insert("path", ".graticule")
		.datum(topojson.mesh(worldData, worldData.objects.countries, function(a, b) { return a !== b; }))
		.attr("clip-path", "url(#" + clipId + ")")
		.attr("class", "map currentcountryboundary")
		.attr("d", path);

	return path;
}

function uniqClassForMarker(pointStr) {
	return "p" + pointStr.replace(/[.,]/g, '_');
}

function drawMarkers(svg, group, proj, initialCounts, contextCounts) {
	var points = {};
	var allCounts = [initialCounts, contextCounts];
	for (var i = 0; i < allCounts.length; i++) {
		var counts = allCounts[i];
		for (var pointStr in counts)
			points[pointStr] = pointStr.split(",");
	}

	var maxCount = 0;
	for (var pointStr in points) {
		if (initialCounts[pointStr] > maxCount)
			maxCount = initialCounts[pointStr];
		if (contextCounts[pointStr] > maxCount)
			maxCount = contextCounts[pointStr];
	}

	var toDraw = [];
	var screenPoints = {};
	var path = d3.geo.path().projection(proj);
	for (var pointStr in points) {
		var point = points[pointStr];
		var screenPoint = path({ type: "Point", coordinates: point });
		if (screenPoint != undefined) {
			toDraw.push(pointStr);
			screenPoints[pointStr] = proj(point);
		}
	}

	// Custom events to communicate clicks
	function triggerDown(pointStr) {
		$(svg).trigger('clickmarkerdown', [pointStr]);
	}
	function triggerUp(pointStr) {
		$(svg).trigger('clickmarkerup', [pointStr]);
	}

	var countScale = 10.81;
	group.selectAll("marker")
		.data(toDraw)
		.enter()
		.append("circle")
		.attr("cx", function(p) { return screenPoints[p][0]; })
		.attr("cy", function(p) { return screenPoints[p][1]; })
		.attr("r", function(p) { return initialCounts.hasOwnProperty(p) ? Math.sqrt(initialCounts[p] * countScale * proj.scale() / maxCount) : 0; })
		.attr("class", function(p) { return "marker initial " + uniqClassForMarker(p); })
		.on('mousedown', triggerDown)
		.on('mouseup', triggerUp);
	group.selectAll("marker")
		.data(toDraw)
		.enter()
		.append("circle")
		.attr("cx", function(p) { return screenPoints[p][0]; })
		.attr("cy", function(p) { return screenPoints[p][1]; })
		.attr("r", function(p) { return contextCounts.hasOwnProperty(p) ? Math.sqrt(contextCounts[p] * countScale * proj.scale() / maxCount) : 0; })
		.attr("class", function(p) { return "marker context " + uniqClassForMarker(p); })
		.on('mousedown', triggerDown)
		.on('mouseup', triggerUp);
	group.selectAll("markercount")
		.data(toDraw)
		.enter()
		.append("text")
		.attr("x", function(p) { return screenPoints[p][0]; })
		.attr("y", function(p) { return screenPoints[p][1]; })
		.attr("dy", "0.35em")
		.attr("text-anchor", 'middle')
		.text(function (p) { return contextCounts[p] > 0 ? contextCounts[p] : ""; })
		.attr("class", function(p) { return "marker counttext " + uniqClassForMarker(p); })
		.on('mousedown', triggerDown)
		.on('mouseup', triggerUp);

	return {
		path: path,
		screenPoints: screenPoints
	}
}

function makeMapControls(container, projections, minZoom, maxZoom, defaults) {
	container.append(" \
		<div class=\"selbox\"> \
			<button type=\"button\" class=\"btn btn-mini btn-warning clear\" title=\"Clear the map selection.\">Clear selection</button> \
			<div class=\"btn-group mode\" data-toggle=\"buttons-radio\"></div> \
		</div> \
		<div class=\"viewbox\"> \
			<div class=\"btn-group zoomcontrols\"> \
				<button class=\"btn btn-mini zoomout\" title=\"Zoom out.\">-</button> \
				<a class=\"btn btn-mini dropdown-toggle zoomlevelbtn\" data-toggle=\"dropdown\" href=\"#\"><span class=\"value\"></span><span class=\"caret\"></span></a> \
				<div class=\"dropdown-menu zoomlevelmenu\"> \
					<div class=\"btn-group btn-group-vertical zoomlevel\" data-toggle=\"buttons-radio\"></div> \
				</div> \
				<button class=\"btn btn-mini zoomin\" title=\"Zoom in.\">+</button> \
			</div> \
			<button type=\"button\" class=\"btn btn-mini centreview\" title=\"Re-centre the view.\">Centre</button> \
			<div class=\"btn-group\"> \
				<a class=\"btn btn-mini dropdown-toggle view\" data-toggle=\"dropdown\" href=\"#\" title=\"View settings.\">View<span class=\"caret\"></span></a> \
				<div class=\"dropdown-menu viewsettingsmenu\"> \
					<div class=\"btn-group btn-group-vertical projection\" data-toggle=\"buttons-radio\"></div> \
					<ul class=\"viewchoices\"></ul> \
				</div> \
			</div> \
		</div> \
	");

	var modeElt = container.find(".selbox .mode");
	var inputModes = {
		toggle: { title: "Toggle", desc: "Input mode to toggle selection on individual markers." },
		drag: { title: "Drag", desc: "Input mode to drag-select markers." },
		pan: { title: "Pan", desc: "Input mode to pan the view without changing the selection." }
	};
	$.each(inputModes, function (key, value) {
		$("<button class=\"btn btn-mini\" value=\"" + key + "\" title=\"" + value.desc + "\">" + value.title + "</button>").appendTo(modeElt);
	});
	function updateSelMode() {
		var defBtn = modeElt.find("button[value=" + defaults.selectionMode + "]");
		defBtn.button('toggle');
		defBtn.trigger('click');
	}

	var curZoom = defaults.zoomLevel;
	var zoomBtnElt = container.find(".zoomlevelbtn");
	var zoomElt = container.find(".zoomlevel");
	$.each([1, 2, 3, 4, 5], function (key, value) {
		$("<button class=\"btn btn-mini\" value=\"" + value + "\" + title=\"Zoom level " + value + ".\">" + value + "</button>").appendTo(zoomElt);
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
		$("<button class=\"btn btn-mini\" value=\"" + key + "\" title=\"" + proj.longName + " projection.\">" + proj.name + "</button>").appendTo(projElt);
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
	var viewChoices = {
		graticule: { title: "Graticules", desc: "Toggle graticule lines." },
		currentcountryboundary: { title: "Current countries", desc: "Show boundaries of currently existing countries." }
	};
	$.each(viewChoices, function (key, value) {
		$("<li><label class=\"checkbox\" title=\"" + value.desc + "\"><input type=\"checkbox\" value=\"" + key + "\">" + value.title + "</label></li>").appendTo(choicesElt);
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
		updateSelMode();
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
	// The view space for SVG; this doesn't have to correspond to screen units.
	var viewBox = { x: 0, y : 0, width: 1024, height: 768 };
	// Margins for the map.
	var margins = { left: 10, right: 10, top: 10, bottom: 10, between: 10 };

	var outerElt = $("<div class=\"map\"></div>").appendTo(container);
	var topBoxElt = $("<div class=\"topbox\"></div>").appendTo(outerElt);
	var svgElt = $("<svg viewBox=\"" + viewBox.x + " " + viewBox.y + " " + viewBox.width + " " + viewBox.height + "\" preserveAspectRatio=\"xMidYMid meet\"></svg>").appendTo(outerElt);
	var loadingElt = makeLoadingIndicator().appendTo(outerElt);

	var defaultSettings = {
		selectionMode: 'toggle',
		zoomLevel: 1,
		projection: defaultMapProjection,
		viewChoices: {
			graticule: false,
			currentcountryboundary: false
		}
	};
	loadSettingsCookies(defaultSettings);
	var initControls = makeMapControls(topBoxElt, mapProjections, minZoom, maxZoom, defaultSettings);

	fillElement(container, outerElt, 'vertical');
	setupPanelled(outerElt, topBoxElt, svgElt, 'vertical', 0, false);

	var svg = jqueryToD3(svgElt);
	var box = { x: viewBox.x + margins.left, y: viewBox.y + margins.top, width: viewBox.width - margins.left - margins.right, height: viewBox.height - margins.top - margins.bottom };

	var ownCnstrQuery = new Query(globalQuery.backendUrl());
	var constraint = new Constraint();
	globalQuery.addConstraint(constraint);
	ownCnstrQuery.addConstraint(constraint);
	var contextQuery = new Query(globalQuery.backendUrl(), 'setminus', globalQuery, ownCnstrQuery);

	var mapData = null,
	    initialCounts = null,
	    contextCounts = null,
	    projection = null,
	    zoomLevel = null,
	    viewChoices = {},
	    pan = null;
	var curState = null,
	    curProj = null,
	    panFactor = 1.0;
	var selMode = null,
	    allPointStrs = {};
	var selection = {};

	var clearElt = topBoxElt.find(".clear");
	var lastSelection = {};
	function updateSelection(dontChangeConstraint) {
		if (initialCounts != null && contextCounts != null) {
			if (curState.markersPath == null)
				update();

			var newSelection = {};
			var allCounts = [initialCounts, contextCounts];
			for (var pointStr in allPointStrs) {
				if (!newSelection.hasOwnProperty(pointStr) && selection[pointStr] != lastSelection[pointStr])
					svg.selectAll(".marker." + uniqClassForMarker(pointStr)).classed("selected", selection[pointStr]);
				newSelection[pointStr] = selection[pointStr];
			}
			lastSelection = newSelection;

			var selPointStrs = [];
			for (var pointStr in selection)
				if (selection[pointStr])
						selPointStrs.push(pointStr);

			if (selPointStrs.length > 0)
				clearElt.removeAttr('disabled');
			else
				clearElt.attr('disabled', 'disabled');

			if (!dontChangeConstraint) {
				if (selPointStrs.length > 0) {
					constraint.name("Map: " + selPointStrs.length + (selPointStrs.length == 1 ? " marker" : " markers"));
					constraint.set({
						type: 'referencepoints',
						points: selPointStrs
					});
				} else
					constraint.clear();
				globalQuery.update();
			}
		}
	}
	function selectAll(value) {
		if (initialCounts != null && contextCounts != null) {
			for (var pointStr in initialCounts)
				selection[pointStr] = value;
			for (var pointStr in contextCounts)
				selection[pointStr] = value;
		}
	}
	clearElt.attr('disabled', 'disabled');

	function update(quick) {
		if (mapData == null || initialCounts == null || contextCounts == null || projection == null || zoomLevel == null || viewChoices == null || pan == null) {
			svgElt.css('display', 'none');
			loadingElt.css('display', '');
		} else {
			loadingElt.css('display', 'none');
			svgElt.css('display', '');
			if (curProj == null) {
				curProj = projection.proj();
				curProj.translate([viewBox.x + viewBox.width / 2, viewBox.y + viewBox.height / 2]);
			}
			var totalScaleFactorChange = projection.scaleFactorChange * (zoomLevel - 1);
			var newScale = viewBox.width * (projection.initialScaleFactor + totalScaleFactorChange);
			var oldScale = curProj.scale();
			curProj.scale(newScale);
			if (curState == null) {
				svgElt.find(".map").remove();
				curState = {};
				curState.group = svg.append("g");
				curState.path = drawWorld(svg, curState.group, mapData, curProj);
				newPath = true;
			} else if (!quick) {
				curState.path.projection(curProj);
			}
			if (projection.panMode == 'translate') {
				var f = newScale / oldScale;
				pan = [pan[0] * f, pan[1] * f];
				panFactor = 1.0;				
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
				svgElt.find(".marker").remove();
				var ret = drawMarkers(svg, curState.group, curProj, initialCounts, contextCounts);
				curState.markersPath = ret.path;
				curState.screenPoints = ret.screenPoints;
			}
			lastSelection = {};
			updateSelection(true);
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
		selectAll(false);
		updateSelection();
	});
	topBoxElt.find(".selbox .mode button").bind('click', function () {
		selMode = $(this).val();
	});
	topBoxElt.find(".viewbox .zoomlevel button").bind('click', function () {
		var zoom = +$(this).val();
		if (zoom != zoomLevel) {
			zoomLevel = zoom;
			update();
		}
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

	var drag = d3.behavior.drag();
	var mouseDownOnMarker = false;
	pan = [0, 0];
	$(svg).bind('clickmarkerdown', function (event, pointStr) {
		if (d3.event.button == 0)
			mouseDownOnMarker = true;
	});
	$(svg).bind('clickmarkerup', function (event, pointStr) {
		if (mouseDownOnMarker && selMode == 'toggle') {
			selection[pointStr] = !(selection[pointStr] == true);
			updateSelection();
		}
	});
	makeDragEndWatcher(drag, function () {
		mouseDownOnMarker = false;
	});
	makeDragPan(drag, function (movement) {
		pan = movement;
		update(true);
	}, function () { return [pan[0], pan[1]]; }, function () { return panFactor; }, function () {
		return (selMode == 'toggle' && !mouseDownOnMarker) || selMode == 'pan';
	});
	makeDragSelector(drag, svg, "dragselectextent", function (extent) {
		if (curState.screenPoints != null) {
			var offset = projection.panMode == 'translate' ? pan : [0, 0];
			for (var pointStr in allPointStrs)
				if (curState.screenPoints.hasOwnProperty(pointStr)) {
					var x = curState.screenPoints[pointStr][0], y = curState.screenPoints[pointStr][1];
					if (x >= extent[0][0] - offset[0] && y >= extent[0][1] - offset[1] && x <= extent[1][0] - offset[0] && y <= extent[1][1] - offset[1])
						selection[pointStr] = true;
				}
			updateSelection();
		}
	}, function () {
		return selMode == 'drag';
	});
	svg.call(drag);

	constraint.onChange(function (changeType) {
		if (changeType == 'removed') {
			selectAll(false);
			updateSelection(true);
		}
	});
	initialQuery.onChange(function () {
		initialCounts = null;
		update();
	});
	initialQuery.onResult({
		counts: {
			type: 'countbyreferencepoint'
		}
	}, function (result) {
		initialCounts = pairListToDict(result.counts.counts);
		for (var pointStr in initialCounts)
			allPointStrs[pointStr] = true;
		update();
	});
	contextQuery.onChange(function () {
		contextCounts = null;
		for (var pointStr in contextCounts)
			allPointStrs[pointStr] = true;
		update();
	});
	contextQuery.onResult({
		counts: {
			type: 'countbyreferencepoint'
		}
	}, function (result) {
		contextCounts = pairListToDict(result.counts.counts);
		update();
	});

	function onMouseWheel(event) {
		var dir = event.wheelDelta != null ? event.wheelDelta : -event.detail;
		if (dir != 0 ) {
			var btnClass = dir < 0 ? ".zoomout" : ".zoomin";
			topBoxElt.find(".viewbox " + btnClass).trigger('click');
		}
	}
	if (window.addEventListener) {
		document.addEventListener('DOMMouseScroll', onMouseWheel, false);
	}
	document.onmousewheel = onMouseWheel;

	initControls();
}
