/*
 * Map control.
 */

var Map = (function () {

// Maximum width of reference point link strokes. Set to one to be constant.
var mapRefPointMaxWidth = 8;

// Numbers for generating unique element IDs
var mapClipId = 0;
var mapSphereId = 0;

// Map projections to use
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

function makeRefPointLinkLookup(refPointResult) {
	var lookup = {};
	$.each(refPointResult.links, function (linkId, link) {
		for (var i = 0; i < 2; i++) {
			var refPoint1 = link.refpoints[i],
			    refPoint2 = link.refpoints[1 - i];
			if (!lookup.hasOwnProperty(refPoint1))
				lookup[refPoint1] = {};
			if (lookup[refPoint1].hasOwnProperty(refPoint2))
				console.log("warning: duplicate reference point link ", refPoint1, refPoint2);
			lookup[refPoint1][refPoint2] = { count: link.count };
		}
	});
	return lookup;
}

/*
 * Draw the world map.
 */
function drawWorld(svg, group, worldData, projection) {
	// This is from d3's Waterman Butterfly example

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
		.datum(topojson.feature(worldData, worldData.objects.land))
		.attr("clip-path", "url(#" + clipId + ")")
		.attr("class", "map land")
		.attr("d", path);
	group.insert("path", "map .graticule")
		.datum(topojson.feature(worldData, worldData.objects.lakes))
		.attr("clip-path", "url(#" + clipId + ")")
		.attr("class", "map lake")
		.attr("d", path);
	group.insert("path", ".graticule")
		.datum(topojson.feature(worldData, worldData.objects.rivers))
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
		.datum(topojson.feature(worldData, worldData.objects.countries, function(a, b) { return a !== b; }))
		.attr("clip-path", "url(#" + clipId + ")")
		.attr("class", "map currentcountryboundary")
		.attr("d", path);

	return path;
}

/*
 * Generate a class name for a map marker give it's point string.
 */
function classForMarker(pointStr) {
	return "p" + pointStr.replace(/[.,]/g, '_');
}

/*
 * Draw markers on the map.
 */
function drawMarkers(svg, group, proj, initialCounts, contextCounts, refPointLinkLookup) {
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
	var subgroup = group.selectAll("markers")
		.data(toDraw)
		.enter()
		.append("g")
		.attr("class", "marker")
		.on("mouseover", function () {
			// Bring group to front (see https://gist.github.com/trtg/3922684)
			var sel = d3.select(this);
			sel.each(function () {
				this.parentNode.appendChild(this);
			});
		});
	var arc = d3.geo.greatArc()
		.source(function (d) { return d[0].split(","); })
		.target(function (d) { return d[1].split(","); });
	subgroup.selectAll("refpointlinks")
		.data(function (p1) {
			var list = [];
			if (refPointLinkLookup.hasOwnProperty(p1))
				for (var p2 in refPointLinkLookup[p1])
					if (refPointLinkLookup.hasOwnProperty(p2))
						list.push([p1, p2]);
			return list;
		})
		.enter()
		.append("path")
		.attr("class", function (d) {
			var dst = d[1];
			var extra = contextCounts.hasOwnProperty(dst) && contextCounts[dst] > 0 ? "context" : "initial";
			return "refpointlink " + extra;
		})
		.style("stroke-width", function (d) {
			var scale = refPointLinkLookup[d[0]][d[1]].count / initialCounts[d[0]];
			return 1 + Math.round((mapRefPointMaxWidth - 1) * scale);
		})
		.attr("d", function(pair) { return path(arc(pair)); });
	subgroup.append("circle")
		.attr("cx", function(p) { return screenPoints[p][0]; })
		.attr("cy", function(p) { return screenPoints[p][1]; })
		.attr("r", function(p) { return initialCounts.hasOwnProperty(p) ? Math.sqrt(initialCounts[p] * countScale * proj.scale() / maxCount) : 0; })
		.attr("class", function(p) { return "marker initial " + classForMarker(p); })
		.on('mousedown', triggerDown)
		.on('mouseup', triggerUp);
	subgroup.append("circle")
		.attr("cx", function(p) { return screenPoints[p][0]; })
		.attr("cy", function(p) { return screenPoints[p][1]; })
		.attr("r", function(p) { return contextCounts.hasOwnProperty(p) ? Math.sqrt(contextCounts[p] * countScale * proj.scale() / maxCount) : 0; })
		.attr("class", function(p) { return "marker context " + classForMarker(p); })
		.on('mousedown', triggerDown)
		.on('mouseup', triggerUp);
	subgroup.append("text")
		.attr("x", function(p) { return screenPoints[p][0]; })
		.attr("y", function(p) { return screenPoints[p][1]; })
		.attr("dy", "0.35em")
		.attr("text-anchor", 'middle')
		.text(function (p) { return contextCounts[p] > 0 ? contextCounts[p] : ""; })
		.attr("class", function(p) { return "marker counttext " + classForMarker(p); })
		.on('mousedown', triggerDown)
		.on('mouseup', triggerUp);

	return {
		path: path,
		screenPoints: screenPoints
	}
}

/*
 * Make and manage the extra interface controls.
 */
function makeControls(container, projections, minZoom, maxZoom, defaults) {
	container.append(' \
		<div class="selbox"> \
			<button type="button" class="btn btn-mini btn-warning clear mapclear" title="Clear the map selection.">Clear selection</button> \
			<div class="btn-group mode" data-toggle="buttons-radio"></div> \
		</div> \
		<div class="viewbox"> \
			<div class="btn-group zoomcontrols"> \
				<button class="btn btn-mini zoomout" title="Zoom out.">-</button> \
				<a class="btn btn-mini dropdown-toggle zoomlevelbtn" data-toggle="dropdown" href="#"><span class="value"></span><span class="caret"></span></a> \
				<div class="dropdown-menu zoomlevelmenu"> \
					<div class="btn-group btn-group-vertical zoomlevel" data-toggle="buttons-radio"></div> \
				</div> \
				<button class="btn btn-mini zoomin" title="Zoom in.">+</button> \
			</div> \
			<button type="button" class="btn btn-mini centreview" title="Re-centre the view.">Centre</button> \
			<div class="btn-group"> \
				<a class="btn btn-mini dropdown-toggle view" data-toggle="dropdown" href="#" title="View settings.">View<span class="caret"></span></a> \
				<div class="dropdown-menu viewsettingsmenu"> \
					<div class="btn-group btn-group-vertical projection" data-toggle="buttons-radio"></div> \
					<ul class="viewoptionals"></ul> \
				</div> \
			</div> \
		</div> \
	');

	var modeElt = container.find(".selbox .mode");
	var inputModes = {
		toggle: { title: "Toggle", desc: "Input mode to toggle selection on individual markers." },
		drag: { title: "Drag", desc: "Input mode to drag-select markers." },
		pan: { title: "Pan", desc: "Input mode to pan the view without changing the selection." }
	};
	$.each(inputModes, function (key, value) {
		$('<button class="btn btn-mini" value="' + key + '" title="' + value.desc + '">' + value.title + '</button>').appendTo(modeElt);
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
		$('<button class="btn btn-mini" value="' + value + '" + title="Zoom level ' + value + '.">' + value + '</button>').appendTo(zoomElt);
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
		$('<button class="btn btn-mini" value="' + key + '" title="' + proj.longName + ' projection.">' + proj.name + '</button>').appendTo(projElt);
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

	var viewOptionalsElt = container.find(".viewoptionals");
	var viewOptionals = {
		graticule: { title: "Graticules", desc: "Toggle graticule lines." },
		currentcountryboundary: { title: "Current countries", desc: "Show boundaries of currently existing countries." }
	};
	$.each(viewOptionals, function (key, value) {
		$('<li><label class="checkbox" title="' + value.desc + '"><input type="checkbox" value="' + key + '">' + value.title + '</label></li>').appendTo(viewOptionalsElt);
	});
	// First pass to make the checkedness consistent
	$.each(defaults.viewOptionals, function (key, value) {
		if (!value)
			viewOptionalsElt.find("input[value=" + key + "]").trigger('click');
	});
	function updateViewOptionals() {
		var curOptionals = defaults.viewOptionals;
		$.each(curOptionals, function (key, value) {
			viewOptionalsElt.find("input[value=" + key + "]").trigger('click');
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
		updateViewOptionals();
	}
}

/*
 * Restore settings from cookies.
 */
function loadSettingsCookies(defaults) {
	var value = $.cookie("mapprojection");
	if (value != null && mapProjections.hasOwnProperty(value))
		defaults.projection = value;
	$.each(defaults.viewOptionals, function (setting, choice) {
		var value = $.cookie("mapviewchoice" + setting);
		if (value != null)
			defaults.viewOptionals[setting] = (value == 'true');
	});
}

/*
 * Save settings back to cookies.
 */
function saveSettingsCookie(name, value) {
	$.cookie(name, value, { expires: 7 });
}

/*
 * Update the SVG markers for points to match the selection one time.
 */
function styleSelectedMarkers(svg, selection) {
	if (selection.isEmpty())
		return;
	var classStr = "",
	    isFirst = true;
	selection.each(function (pointStr) {
		if (isFirst) 
			isFirst = false;
		else
			classStr += ",";
		classStr += ".marker." + classForMarker(pointStr);
	});
	svg.selectAll(classStr).classed("selected", true);
}

/*
 * Make the SVG markers for points match the selection as it changes.
 */
function syncMarkerStylesWithSelection(svg, selection) {
	selection.on('change', function (added, removed, newLength) {
		if (newLength > 0) {
			if (added.length > 0)
				svg.selectAll(added.map(function (ps) { return ".marker." + classForMarker(ps); }).join(",")).classed("selected", true);
			if (removed.length > 0)
				svg.selectAll(removed.map(function (ps) { return ".marker." + classForMarker(ps); }).join(",")).classed("selected", false);
		} else {
			svg.selectAll(".marker").classed("selected", false);
		}
	});
}

/*
 * Setup the control in some container element.
 * container: container element as a jquery selection
 * parameters: shared view control parameters
 */
function setup(container, parameters) {
	// The view space for SVG; this doesn't have to correspond to screen units.
	var viewBox = { x: 0, y : 0, width: 1024, height: 768 };
	// Margins for the map.
	var margins = { left: 10, right: 10, top: 10, bottom: 10, between: 10 };

	var outerElt = $('<div class="map"></div>').appendTo(container);
	var topBoxElt = $('<div class="topbox"></div>').appendTo(outerElt);
	var svgElt = $('<svg viewBox="' + viewBox.x + " " + viewBox.y + " " + viewBox.width + " " + viewBox.height + '" preserveAspectRatio="xMidYMid meet"></svg>').appendTo(outerElt);
	var loadingIndicator = new LoadingIndicator.LoadingIndicator(outerElt);

	var defaultSettings = {
		selectionMode: 'toggle',
		zoomLevel: 1,
		projection: defaultMapProjection,
		viewOptionals: {
			graticule: false,
			currentcountryboundary: false
		}
	};
	loadSettingsCookies(defaultSettings);
	var initControls = makeControls(topBoxElt, mapProjections, parameters.minMapZoom, parameters.maxMapZoom, defaultSettings);

	LayoutUtils.fillElement(container, outerElt, 'vertical');
	LayoutUtils.setupPanelled(outerElt, topBoxElt, svgElt, 'vertical', 0, false);

	var svg = D3Utils.jqueryToD3(svgElt);
	var box = { x: viewBox.x + margins.left, y: viewBox.y + margins.top, width: viewBox.width - margins.left - margins.right, height: viewBox.height - margins.top - margins.bottom };

	var localConstraintSet = new Queries.ConstraintSets.ConstraintSet();

	var selection = new Selections.SimpleSetSelection();
	Selections.syncSetSelectionWithConstraint(selection, parameters.connection, parameters.globalConstraintSet, [localConstraintSet], function (selection) {
		if (selection.isEmpty())
			return null;
		var selPointStrs = [];
		selection.each(function (pointStr) {
			selPointStrs.push(pointStr);
		});
		return new Queries.Constraint({
			type: 'referencepoints',
			points: selPointStrs
		}, "Map: " + selPointStrs.length + (selPointStrs.length == 1 ? " marker" : " markers"));
	});
	setupSelectionClearButton(topBoxElt.find(".selbox .clear"), selection);
	syncMarkerStylesWithSelection(svg, selection);

	// This state that needs to leak out of the drawing code or needs to be shared both ways
	var allPointStrs = {},
	    curState = null,
	    curProj = null,
	    panFactor = 1.0;

	var projectionSel = new Selections.SimpleSingleValueSelection(),
	    zoomLevelSel = new Selections.SimpleSingleValueSelection(),
	    viewOptionalsSel = new Selections.SimpleSingleValueSelection(),
	    panSel = new Selections.SimpleSingleValueSelection([0, 0]),
	    selModeSel = new Selections.SimpleSingleValueSelection();
	var emptyConstraintSet = new Queries.ConstraintSets.ConstraintSet();
	var data = new DataSource.Merged({
			mapData: new DataSource.Json(parameters.mapDataUrl),
			links: new DataSource.Map(
					new Queries.Queries.Query(
						parameters.connection,
						emptyConstraintSet,
						{ type: 'referencepointlinks' }
					),
					function (result) { return makeRefPointLinkLookup(result); }
				),
			initialCounts: new Queries.Queries.Query(
					parameters.connection,
					emptyConstraintSet,
					{ type: 'countbyreferencepoint' }
				),
			contextCounts: new Queries.Queries.Query(
					parameters.connection,
					new Queries.ConstraintSets.SetMinus(parameters.globalConstraintSet, localConstraintSet),
					{ type: 'countbyreferencepoint' }
				),
			projection: new DataSource.OfSingleValueSelection(projectionSel),
			zoomLevel: new DataSource.OfSingleValueSelection(zoomLevelSel),
			viewOptionals: new DataSource.OfSingleValueSelection(viewOptionalsSel),
			pan: new DataSource.OfSingleValueSelection(panSel),
		});

	DataSource.setupMergedDataLoadingIndicator(loadingIndicator, data, [svgElt]);

	data.on('result', function (results, changes) {
		var initialCounts = Utils.pairListToDict(results.initialCounts.counts);
		var contextCounts = Utils.pairListToDict(results.contextCounts.counts);
		for (var pointStr in initialCounts)
			allPointStrs[pointStr] = true;

		svgElt.css('display', '');

		var quick = curProj != null;
		for (var dataSource in changes)
			quick = quick && (dataSource == 'pan' || !changes[dataSource]);

		if (curProj == null) {
			curProj = results.projection.proj();
			curProj.translate([viewBox.x + viewBox.width / 2, viewBox.y + viewBox.height / 2]);
		}

		var totalScaleFactorChange = results.projection.scaleFactorChange * (results.zoomLevel - 1);
		var newScale = viewBox.width * (results.projection.initialScaleFactor + totalScaleFactorChange);
		var oldScale = curProj.scale();
		curProj.scale(newScale);

		if (curState == null) {
			svgElt.find(".map").remove();
			curState = {};
			curState.group = svg.append("g");
			curState.path = drawWorld(svg, curState.group, results.mapData, curProj);
		} else if (!quick) {
			curState.path.projection(curProj);
		}

		if (results.projection.panMode == 'translate') {
			var f = newScale / oldScale;
			var usePan = [results.pan[0] * f, results.pan[1] * f];
			panFactor = 1.0;				
			curState.group.attr("transform", "translate(" + usePan[0] + "," + usePan[1] + ")");
		} else if (results.projection.panMode == 'rotate') {
			panFactor = 0.7 / (0.85 * results.zoomLevel);
			curState.group.attr("transform", "");
			curProj.rotate([results.pan[0], -results.pan[1]]);
		} else
			console.log('warning: unknown projection pan mode "' + results.projection.panMode + '"');

		if (!quick || results.projection.panMode == 'rotate') {
			svg.selectAll("path").attr("d", curState.path);
			$.each(results.viewOptionals, function (setting, choice) {
				svg.select("." + setting).style('display', choice ? '' : 'none');
			});
			svgElt.find(".marker").remove();
			var ret = drawMarkers(svg, curState.group, curProj, initialCounts, contextCounts, results.links);
			curState.markersPath = ret.path;
			curState.screenPoints = ret.screenPoints;
		}

		styleSelectedMarkers(svg, selection);
	});

	function resetProjection() {
		panSel.set([0, 0]);
		curProj = null;
	}

	topBoxElt.find(".selbox .mode button").bind('click', function () {
		selModeSel.set($(this).val());
	});
	topBoxElt.find(".viewbox .zoomlevel button").bind('click', function () {
		zoomLevelSel.set(+$(this).val());
	});
	topBoxElt.find(".viewbox .projection button").bind('click', function () {
		var name = $(this).val();
		saveSettingsCookie("mapprojection", name);
		resetProjection();
		projectionSel.set(mapProjections[name]);
	});
	topBoxElt.find(".viewbox .centreview").bind('click', function () {
		resetProjection();
	});
	topBoxElt.find(".viewbox .viewoptionals input").bind('click', function () {
		var setting = $(this).val();
		var choice = $(this).prop('checked');
		var viewOptionals = {};
		if (!viewOptionalsSel.isEmpty())
			$.extend(true, viewOptionals, viewOptionalsSel.get());
		viewOptionals[setting] = choice;
		saveSettingsCookie("mapviewchoice" + setting, choice);
		viewOptionalsSel.set(viewOptionals);
	});

	var drag = d3.behavior.drag();
	var mouseDownOnMarker = false;
	$(svg).bind('clickmarkerdown', function (event, pointStr) {
		if (d3.event.button == 0)
			mouseDownOnMarker = true;
	});
	$(svg).bind('clickmarkerup', function (event, pointStr) {
		if (mouseDownOnMarker && selModeSel.get() == 'toggle') {
			selection.toggle(pointStr);
		}
	});
	D3Utils.makeDragEndWatcher(drag, function () {
		mouseDownOnMarker = false;
	});
	D3Utils.makeDragPan(drag, function (movement) {
		panSel.set(movement);
	}, function () { var p = panSel.get(); return [p[0], p[1]]; }, function () { return panFactor; }, function () {
		return (selModeSel.get() == 'toggle' && !mouseDownOnMarker) || selModeSel.get() == 'pan';
	});
	D3Utils.makeDragSelector(drag, svg, "dragselectextent", function (extent) {
		if (curState.screenPoints != null) {
			var offset = projectionSel.get().panMode == 'translate' ? panSel.get() : [0, 0];
			var toSel = [];
			selection.modify(function (selMod) {
				for (var pointStr in allPointStrs)
					if (curState.screenPoints.hasOwnProperty(pointStr)) {
						var x = curState.screenPoints[pointStr][0], y = curState.screenPoints[pointStr][1];
						if (x >= extent[0][0] - offset[0] && y >= extent[0][1] - offset[1] && x <= extent[1][0] - offset[0] && y <= extent[1][1] - offset[1])
							selMod.add(pointStr);
					}
			});
		}
	}, function () {
		return selModeSel.get() == 'drag';
	});
	svg.call(drag);

	function onMouseWheel(event) {
		var dir = event.wheelDelta != null ? event.wheelDelta : -event.detail;
		if (dir != 0 ) {
			var btnClass = dir < 0 ? ".zoomout" : ".zoomin";
			topBoxElt.find(".viewbox " + btnClass).trigger('click');
		}
		return false;
	}
	if (svgElt[0].addEventListener)
		svgElt[0].addEventListener('DOMMouseScroll', onMouseWheel, false);
	svgElt[0].onmousewheel = onMouseWheel;

	initControls();

	return {
		selection: selection
	};
}

return {
	setup: setup
};
}());
