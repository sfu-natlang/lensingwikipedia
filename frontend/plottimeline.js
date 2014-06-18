/*
 * Entity timeline visualization similar to XKCD #657.
 */

// Number for generating unique clipping element IDs
var timelineClipNum = 0;

/*
 * Convert data from backend to data for Sankey plot.
 */
function resultToSankeyData(resultData, startYear, endYear) {
	console.log("result data", resultData) // TODO

	var linkBaseValue = 1000.0;
	function yearArrayOfTable(yearTable) {
		var array = [];
		$.each(yearTable, function (year, clusters) {
			array.push({ year: parseInt(year), clusters: clusters });
		});
		array.sort(function (p1, p2) { return p1.year - p2.year });
		return array;
	}
	function chooseNode(nodes, arbitraryNumber) {
		// With arbitraryNumber being an arbitrary but deterministic number, this is a way to choose nodes deterministically but (hopefully) without any visually obvious pattern
		var num = 0;
		for (var id in nodes)
			num++;
		var nodeI = arbitraryNumber % num;
		var nodeId = null;
		var i = 0;
		for (var id in nodes) {
			if (i == nodeI) {
				nodeId = nodes[id];
				break;
			}
			i++;
		}
		return nodeId;
	}
	var chooseColor = d3.scale.category10();
	var nodesLookup = {},
	    nodes = [],
	    links = [];
	$.each(resultData.timeline, function (field, valueTable) {
		$.each(valueTable, function (value, yearTable) {
			var entityLastNodeIds = {};
			var yearArray = yearArrayOfTable(yearTable);
			for (var pointI = 0; pointI < yearArray.length; pointI++) {
				var point = yearArray[pointI];
				if (startYear != null && point.year < startYear)
					continue;
				if (endYear != null && point.year > endYear)
					break;
				var entityNodeIds = {};
				for (var clusterI = 0; clusterI < point.clusters.length; clusterI++) {
					var cluster = point.clusters[clusterI];
					var node = "" + point.year + ":" + cluster;
					if (!nodesLookup.hasOwnProperty(node)) {
						nodesLookup[node] = nodes.length;
						nodes.push({
							name: node,
							cluster: cluster,
							date: jsDateOfYear(point.year),
						});
					}
					entityNodeIds[cluster] = nodesLookup[node];
				}
				if (!$.isEmptyObject(entityLastNodeIds)) {
					var newLinks = [];
					var seenLast = {};
					$.each(entityNodeIds, function (toCluster, toNodeId) {
						var fromNodeId = entityLastNodeIds.hasOwnProperty(toCluster)
							? entityLastNodeIds[toCluster]
							: chooseNode(entityLastNodeIds, newLinks.length + pointI + toNodeId);
						var link = {
							source: fromNodeId,
							target: toNodeId,
							title: "" + field + ":" + value,
							color: chooseColor((field + value).replace(/ /g, ""))
						};
						seenLast[fromNodeId] = true;
						links.push(link);
						newLinks.push(link);
					});
					$.each(entityLastNodeIds, function (fromCluster, fromNodeId) {
						if (!seenLast.hasOwnProperty(fromNodeId)) {
							var toNodeId = chooseNode(entityNodeIds, newLinks.length + pointI + fromNodeId);
							if (toNodeId != null) {
								var link = {
									source: fromNodeId,
									target: toNodeId,
									title: "" + field + ":" + value,
									color: chooseColor((field + value).replace(/ /g, ""))
								};
								links.push(link);
								newLinks.push(link);
							}
						}
					});
					for (var i = 0; i < newLinks.length; i++)
						//newLinks[i].value = linkBaseValue / newLinks.length;
						newLinks[i].value = 1;
				}
				if (!$.isEmptyObject(entityNodeIds))
					entityLastNodeIds = entityNodeIds;
			}
		});
	});
	return {
		"nodes": nodes,
		"links": links
	}
}

function maxEntitiesInAYear(resultData) {
	var countByYear = {};
	$.each(resultData.timeline, function (field, valueTable) {
		$.each(valueTable, function (value, yearTable) {
			$.each(yearTable, function (year, clusters) {
				if (!countByYear.hasOwnProperty(year))
					countByYear[year] = clusters.length;
				else
					countByYear[year] += clusters.length;
			});
		});
	});
	var max = 1;
	$.each(countByYear, function (year, count) {
		if (count > max)
			max = count;
	});
	return max;
}

/*
 * Draw the whole visualization.
 */
function drawPlotTimeline(svg, box, data, maxEntitiesAtOnce) {
	console.log("plot", data); // TODO
	var linkWidth = 10;
	var nodeWidth = 10;

	var clipId = "timelineclip" + timelineClipNum;
	timelineClipNum++;
	svg.append('defs')
		.append('clipPath')
		.attr('id', clipId)
		.append('rect')
		.attr('width', box.width)
		.attr('height', box.height);

	var draw = svg.append('g')
		.attr('transform', "translate(" + box.x + "," + box.y + ")");

	var xScale = d3.time.scale()
		.range([0, box.width])
		.domain(d3.extent(data.nodes, function (n) { return n.date; }));
	var xAxis = d3.svg.axis()
		.scale(xScale)
		.orient('bottom')
		.tickFormat(timeAxisTickFormater)
		.tickValues(timeAxisTickValues(xScale));
	var xAxisSpace = 100;

	var sankey = d3.sankey()
		.nodeWidth(10)
		.size([box.width, box.height - xAxisSpace])
		.nodes(data.nodes)
		.links(data.links)
		.layout(2);
	for (var i = 0; i < data.nodes.length; i++) {
		var node = data.nodes[i];
		node.x = xScale(node.date);
		node.minY = node.dy;
		node.maxY = 0;
		function touchLink(link, p) {
			var linkY = link[p] + link.dy / 2;
			if (linkY < node.minY)
				node.minY = linkY;
			if (linkY > node.maxY)
				node.maxY = linkY;
		}
		for (var j = 0; j < node.sourceLinks.length; j++)
			touchLink(node.sourceLinks[j], 'sy');
		for (var j = 0; j < node.targetLinks.length; j++)
			touchLink(node.targetLinks[j], 'ty');
	}

	var node = draw.append("g")
		.selectAll(".node")
		.data(data.nodes)
		.enter()
		.append("rect")
		.attr("class", "node")
		.attr("transform", function(d) { return "translate(" + d.x + "," + (d.y + d.minY - linkWidth) + ")"; })
		.attr("height", function(d) { return d.maxY - d.minY + linkWidth * 2; })
		.attr("width", sankey.nodeWidth())
		.append("title")
		.text(function(d) { return "" + timeAxisTickFormater(d.date) + " " + d.cluster });
	var link = draw.append("g")
		.selectAll(".link")
		.data(data.links)
		.enter()
		.append("path")
		.attr("class", "link")
		.attr("d", sankey.link())
		.style("stroke-width", linkWidth)
		.style("stroke", function(d) { return d.color; })
		.sort(function(a, b) { return b.dy - a.dy; })
		.append("title")
		.text(function(d) { return "" + d.title });

	draw.append('g')
		.attr('class', "x axis ")
		.attr('transform', "translate(0," + (box.height - xAxisSpace) + ")")
		.call(xAxis);
}

/*
 * Setup the control in some container element.
 * container: container element as a jquery selection
 * initialQuery: the initial (empty) query
 * globalQuery: the global query
 */
function setupPlotTimeline(container, globalQuery) {
	// TODO: this is just for testing
	var defaultEntityString = "person:Hannibal, person:Scipio Africanus";

	// The view space for SVG; this doesn't have to correspond to screen units.
	var viewBox = { x: 0, y : 0, width: 1024, height: 768 };
	// Margins for the graph
	var margins = { left: 50, right: 30, top: 60, bottom: 60 };

	var outerElt = $("<div class=\"plottimeline\"></div>").appendTo(container);
	var topBoxElt = $("<div class=\"topbox\"></div>").appendTo(outerElt);
	var loadingIndicator = new LoadingIndicator(outerElt);
	var outerSvgElt = $("<svg class=\"outersvg\"></svg>").appendTo(outerElt);
	var svgElt = $("<svg class=\"innersvg\" viewBox=\"" + viewBox.x + " " + viewBox.y + " " + viewBox.width + " " + viewBox.height + "\" preserveAspectRatio=\"none\"></svg>").appendTo(outerSvgElt);

	var formElt = $("<form></form>").appendTo(topBoxElt);
	var updateElt = $("<button type=\"submit\" class=\"btn btn-warning\" title=\"Update the visualization\">Update</button></ul>").appendTo(formElt);
	var startYearElt = $("<input type=\"text\" class=\"year\" title=\"Starting year\"></input>").appendTo(formElt);
	var endYearElt = $("<input type=\"text\" class=\"year\" title=\"End year\"></input>").appendTo(formElt);
	var entitiesElt = $("<input type=\"text\" class=\"entities\" title=\"Entities\"></input>").appendTo($("<div class=\"inputbox\"></div>").appendTo(formElt));
	entitiesElt.val(defaultEntityString);

	fillElement(container, outerElt, 'vertical');
	setupPanelled(outerElt, topBoxElt, outerSvgElt, 'vertical', 0, false);
	var scaleSvg = dontScaleSvgParts(outerSvgElt, 'text,.tick');

	var width = viewBox.width - margins.left - margins.right,
	    height = viewBox.height - margins.top - margins.bottom;
	var graphBox = { x: viewBox.x + margins.left, y: viewBox.y + margins.top, width: width, height: height };

	var globalQueryResultWatcher = new ResultWatcher(function () {});
	globalQuery.addResultWatcher(globalQueryResultWatcher);

	function setLoadingIndicator(enabled) {
		svgElt.css('display', !enabled ? '' : 'none');
		loadingIndicator.enabled(enabled);
	}
	setLoadingIndicator(true);

	var startYear = null,
	    endYear = null;

	function parseEntitiesString(entitiesString) {
		return entitiesString.split(",").map(function (entityString) {
			return entityString.split(":").map(function (p) { return p.replace(/^\s+|\s+$/g, "") });
		});
	} 
	function organizeEntities(entities) {
		var entitiesLookup = {};
		for (var i = 0; i < entities.length; i++) {
			var field = entities[i][0],
			    value = entities[i][1];
			if (!entitiesLookup.hasOwnProperty(field))
				entitiesLookup[field] = [];
			entitiesLookup[field].push(value);
		}
		return entitiesLookup;
	}
	function setEntityString(entityString) {
		var entities = parseEntitiesString(entityString);
		if (entities.length > 0) {
			globalQueryResultWatcher.set({
				"plottimeline": {
					"type": "plottimeline",
					"clusterField": "referencePoints",
					"entities": organizeEntities(entities)
				}
			});
			globalQuery.update();
		} else {
			globalQueryResultWatcher.clear();
			setLoadingIndicator(true);
		}
	}
	setEntityString(defaultEntityString);
	updateElt.bind('click', function() {
		setLoadingIndicator(true);
		startYear = startYearElt.val() != "" ? parseInt(startYearElt.val()) : null;
		endYear = endYearElt.val() != "" ? parseInt(endYearElt.val()) : null;
		setEntityString(entitiesElt.val());
	});
	formElt.submit(function () {
		return false;
	});

	var data = null;
	function draw() {
		if (data != null) {
			svgElt.children().remove();
			var svg = jqueryToD3(svgElt);
			setLoadingIndicator(false);
			drawPlotTimeline(svg, graphBox, resultToSankeyData(data, startYear, endYear), maxEntitiesInAYear(data));
			scaleSvg();
		} else {
			setLoadingIndicator(false);
		}
	}

	globalQueryResultWatcher.setCallback(function(result, getContinuer) {
		if (result.plottimeline.hasOwnProperty('error')) {
			data = null;
			loadingIndicator.error('plottimeline', true);
			loadingIndicator.enabled(true);
		} else {
			loadingIndicator.error('plottimeline', false);
			data = result.plottimeline;
			draw();
		}
	});
}
