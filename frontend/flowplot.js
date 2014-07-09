/*
 * Entity timeline visualization similar to XKCD #657.
 */

// Number for generating unique clipping element IDs
var timelineClipNum = 0;

function yearsArrayOfTable(yearsTable) {
	var years = [];
	$.each(yearsTable, function (year, clusters) {
		years.push(year);
	});
	years.sort(function (y1, y2) { return y1 - y2 });
	return years;
}

/*
 * Convert data from backend to data for Sankey plot.
 */
function resultToSankeyData(resultData, startYear, endYear) {
	console.log("result data", resultData) // TODO

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

	var nodes = [],
	    links = [];

	var byYear = {};
	var entities = [];
	var nextEntityId = 0;
	$.each(resultData.timeline, function (field, valueTable) {
		$.each(valueTable, function (value, yearsTable) {
			var addedEntity = false;
			$.each(yearsTable, function (year, clusters) {
				year = parseInt(year);
				if (!((startYear != null && year < startYear) || (endYear != null && year > endYear))) {
					if (!byYear.hasOwnProperty(year))
						byYear[year] = {};
					var forYear = byYear[year];
					$.each(clusters, function (clusterI, cluster) {
						if (!forYear.hasOwnProperty(cluster))
							forYear[cluster] = [];
						addedEntity = true;
						forYear[cluster].push(nextEntityId);
					});
				}
			});
			if (addedEntity) {
				entities.push({ field: field, value: value });
				nextEntityId++;
			}
		});
	});

	var visClusters = {};
	var visClustersByYear = {};
	var nextVisClusterId = 0;
	$.each(byYear, function (year, clusters) {
		year = parseInt(year);
		var inVisCluster = {};
		var yearVisClusters = {};
		visClustersByYear[year] = yearVisClusters;
		$.each(clusters, function (cluster, entityIds) {
			var assignedVisCluster = null;
			for (var entityIdI = 0; entityIdI < entityIds.length; entityIdI++) {
				var entityId = entityIds[entityIdI];
				if (inVisCluster.hasOwnProperty(entityId)) {
					assignedVisCluster = inVisCluster[entityId];
					break;
				}
			}
			if (assignedVisCluster == null) {
				assignedVisCluster = nextVisClusterId;
				visClusters[assignedVisCluster] = {
					year: year,
					clusters: {}
				};
				nextVisClusterId++;
			}
			visClusters[assignedVisCluster].clusters[cluster] = true;
			if (!yearVisClusters.hasOwnProperty(assignedVisCluster))
				yearVisClusters[assignedVisCluster] = [];
			$.each(entityIds, function (entityIdI, entityId) {
				inVisCluster[entityId] = assignedVisCluster;
				yearVisClusters[assignedVisCluster].push(entityId);
			});
		});
	});
	console.log("visClustersByYear", visClustersByYear);

	var nodes = [];
	$.each(visClusters, function (visClusterId, visCluster) {
		visCluster.date = jsDateOfYear(visCluster.year);
		nodes.push(visCluster);
	});

	var yearsOrder = yearsArrayOfTable(visClustersByYear);

	var lastSeen = {};
	$.each(yearsOrder, function (yearI, year) {
		$.each(visClustersByYear[year], function (visCluster, entityIds) {
			visCluster = parseInt(visCluster);
			visClusters[visCluster].entityIds = [];
			$.each(entityIds, function (entityIdI, entityId) {
				if (lastSeen.hasOwnProperty(entityId)) {
					var lastVisCluster = lastSeen[entityId];
					if (lastVisCluster != visCluster) {
						visClusters[visCluster].entityIds.push(entityId);
						links.push({
							source: lastSeen[entityId],
							target: visCluster,
							entity: entities[entityId]
						});
					}
				} else
					visClusters[visCluster].entityIds.push(entityId);
				lastSeen[entityId] = visCluster;
			});
		});
	});

	// TODO: what do we actually need to return in this function?
	return {
		nodes: nodes,
		links: links,
		entities: entities
	}
}

function layout(data, size, nodeHeightPerEntity, nodeHeightGap, relaxationIters, yearDistWeight) {
	var byYear = {};
	$.each(data.nodes, function (nodeI, node) {
		if (!byYear.hasOwnProperty(node.year))
			byYear[node.year] = [];
		node.id = nodeI;
		byYear[node.year].push(node);
	});

	$.each(byYear, function (year, nodesThisYear) {
		var totalEntities = 0;
		var nodeNumEntities = {};
		$.each(nodesThisYear, function (nodeI, node) {
			nodeNumEntities[nodeI] = 0;
			$.each(node.entityIds, function (entityId) {
				nodeNumEntities[nodeI] += 1;
			});
			totalEntities += nodeNumEntities[nodeI];
		});
		var gapSpace = (size[1] - totalEntities * nodeHeightPerEntity) / (nodesThisYear.length + 1);
		$.each(nodesThisYear, function (nodeI, node) {
			node.y = gapSpace * (nodeI + 1);
			node.dy = nodeNumEntities[nodeI] * nodeHeightPerEntity;
			node.neighbours = {};
			node.lineIntersections = [];
			node.toAdjustY = 0;
		});
	});

	var entityPaths = {};
	var yearsOrder = yearsArrayOfTable(byYear);
	$.each(yearsOrder, function (yearI, year) {
		$.each(byYear[year], function (nodeI, node) {
			$.each(node.entityIds, function (entityIdI, entityId) {
				if (!entityPaths.hasOwnProperty(entityId))
					entityPaths[entityId] = [];
				var entityPath = entityPaths[entityId];
				if (entityPath.length > 0) {
					var prevNode = entityPath[entityPath.length - 1];
					if (!prevNode.neighbours.hasOwnProperty(node.id))
						prevNode.neighbours[node.id] = 1;
					else
						prevNode.neighbours[node.id] += 1;
					if (!node.neighbours.hasOwnProperty(prevNode.id))
						node.neighbours[prevNode.id] = 1;
					else
						node.neighbours[prevNode.id] += 1;
				}
				entityPaths[entityId].push(node);
			});
		});
	});

	if (relaxationIters > 0)
		$.each(data.nodes, function (nodeI, node) {
			var weights = {};
			node.neighbourWeightsTotal = 0;
			$.each(node.neighbours, function (neighbourId, count) {
				var neighbour = data.nodes[neighbourId];
				var dYear = Math.abs(node.year - neighbour.year)
				var weight = count / ((dYear - 1) * yearDistWeight + 1);
				node.neighbourWeightsTotal += weight;
				weights[neighbourId] = weight;
			});
			node.neighbours = weights;
		});

	for (var iter = 0; iter < relaxationIters; iter++) {
		console.log("relaxation iteration", iter);
		$.each(yearsOrder, function (yearI, year) {
			var nodesHere = byYear[year];
			$.each(nodesHere, function (nodeI, node) {
				var sumY = 0;
				$.each(node.neighbours, function (neighbourId, weight) {
					sumY += data.nodes[neighbourId].y * weight;
				});
				node.y = sumY / node.neighbourWeightsTotal;
				
			});
			nodesHere.sort(function (n1, n2) { return n1.y - n2.y });
			var carryYOffset = 0;
			for (var nodeI = 0; nodeI < nodesHere.length - 1; nodeI++) {
				var node1 = nodesHere[nodeI];
				var node2 = nodesHere[nodeI + 1];
				var d = node1.y + node1.dy + nodeHeightGap - node2.y;
				if (d > 0) {
					node1.toAdjustY = d / 2;
					carryYOffset += d / 2;
					node2.y += carryYOffset;
				} else
					node1.toAdjustY = 0;
			}
			carryYOffset = 0;
			for (var nodeI = nodesHere.length - 1; nodeI >= 0; nodeI--) {
				var node = nodesHere[nodeI];
				carryYOffset += node.toAdjustY;
				node.y -= carryYOffset;
			}
			for (var nodeI = nodesHere.length - 1; nodeI >= 0; nodeI--) {
				var node = nodesHere[nodeI];
				if (node.y < 0)
					node.y = 0;
				if (node.y + node.dy > size[1])
					node.y = size[1] - node.dy;
			}
		});
	}

	var entityLines = [];
	$.each(entityPaths, function (entityPathI, entityPath) {
		var entityLine = [];
		entityLines.push(entityLine);
		var from = null;
		$.each(entityPath, function (nodeI, node) {
			node.lineIntersections.push({
				lineId: entityPathI,
				from: from,
				pos: entityLine.length
			});
			entityLine.push({
				node: node
			});
			from = node;
		});
	});

	$.each(data.nodes, function (nodeI, node) {
		node.lineIntersections.sort(function (li1, li2) { return li1.y - li2.y });
		$.each(node.lineIntersections, function (lineIntersectionI, lineIntersection) {
			var point = entityLines[lineIntersection.lineId][lineIntersection.pos];
			point.y = node.y + (lineIntersectionI + 0.5) * (nodeHeightPerEntity);
		});
	});

	data.entityLines = entityLines;
}

/*
 * Draw the whole visualization.
 */
function drawFlowPlot(svg, box, data, relaxIters) {
	console.log("plot", data); // TODO
	var nodeWidth = box.width * 0.01;
	var nodeHeightPerEntity = box.height * 0.06;
	var nodeHeightGap = nodeHeightPerEntity * 2;
	var yearDistWeight = 1;

	var chooseColor = d3.scale.category10();
	$.each(data.links, function (linkI, link) {
		link.value = 1.0;
		link.colour = chooseColor((link.entity.field + link.entity.value).replace(/ /g, ""));
	});

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

	layout(data, [box.width, box.height - xAxisSpace], nodeHeightPerEntity, nodeHeightGap, relaxIters, yearDistWeight);

	function classEnitityLines(entityIds, value) {
		d3.selectAll(entityIds.map(function (eid) { return ".line" + eid; }).join(', '))
			.classed('highlight', value);
	}

	var linesColor = d3.scale.category10();
	var linesLine = d3.svg.line()
		.x(function (p) { return xScale(p.node.date); })
		.y(function (p) { return p.y; })
.tension(0.9)
		.interpolate('cardinal');
	draw.append("g")
		.selectAll(".line")
		.data(data.entityLines)
		.enter()
		.append("path")
		.attr("d", linesLine)
		.attr("class", function (l, i) { return "line line" + i; })
		.style("stroke", function(l, i) { return linesColor(i); })
		.on("mouseover", function () {
			d3.select(this).classed('highlight', true);
		})
		.on("mouseout", function () {
			d3.select(this).classed('highlight', false);
		})
		.append("title")
		.text(function (l, i) { var e = data.entities[i]; return "" + e.field + ":" + e.value; });

	draw.append('g')
		.attr('class', "x axis ")
		.attr('transform', "translate(0," + (box.height - xAxisSpace) + ")")
		.call(xAxis);

	var node = draw.append("g")
		.selectAll(".node")
		.data(data.nodes)
		.enter()
		.append("rect")
		.attr("class", "node")
		.attr("x", function (n) { return xScale(n.date) - nodeWidth / 2; })
		.attr("y", function (n) { return n.y; })
		.attr("height", function(n) { return n.dy; })
		.attr("width", nodeWidth)
		.on("mouseover", function (n) {
			d3.select(this).classed('highlight', true);
			classEnitityLines(n.entityIds, true);
		})
		.on("mouseout", function (n) {
			d3.select(this).classed('highlight', false);
			classEnitityLines(n.entityIds, false);
		})
		.append("title")
		.text(function(d) { return "" + timeAxisTickFormater(d.date) + "\n" + $.map(d.clusters, function (v, f) { return f; }).join("\n") });
}

/*
 * Setup the control in some container element.
 * container: container element as a jquery selection
 * initialQuery: the initial (empty) query
 * globalQuery: the global query
 */
function setupFlowPlot(container, globalQuery) {
	// TODO: this is just for testing
	var defaultEntityString = "person:Hannibal, person:Scipio Africanus, person: Antiochus III the Great, person:Philip V of Macedon, person:Qin Shi Huang",
	    defaultStartYear = -225,
	    defaultEndYear = -180,
	    defaultRelaxIters = 3;

	// The view space for SVG; this doesn't have to correspond to screen units.
	var viewBox = { x: 0, y : 0, width: 1024, height: 768 };
	// Margins for the graph
	var margins = { left: 50, right: 30, top: 60, bottom: 60 };

	var outerElt = $("<div class=\"flowplot\"></div>").appendTo(container);
	var topBoxElt = $("<div class=\"topbox\"></div>").appendTo(outerElt);
	var loadingIndicator = new LoadingIndicator(outerElt);
	var outerSvgElt = $("<svg class=\"outersvg\"></svg>").appendTo(outerElt);
	var svgElt = $("<svg class=\"innersvg\" viewBox=\"" + viewBox.x + " " + viewBox.y + " " + viewBox.width + " " + viewBox.height + "\" preserveAspectRatio=\"none\"></svg>").appendTo(outerSvgElt);

	var formElt = $("<form></form>").appendTo(topBoxElt);
	var updateElt = $("<button type=\"submit\" class=\"btn btn-warning\" title=\"Update the visualization\">Update</button></ul>").appendTo(formElt);
	var startYearElt = $("<input type=\"text\" class=\"year\" title=\"Starting year\"></input>").val(defaultStartYear).appendTo(formElt);
	var endYearElt = $("<input type=\"text\" class=\"year\" title=\"End year\"></input>").val(defaultEndYear).appendTo(formElt);
	var relaxItersElt = $("<input type=\"text\" class=\"year\" title=\"Relaxation iterations\"></input>").val(defaultRelaxIters).appendTo(formElt);
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

	var startYear = defaultStartYear,
	    endYear = defaultEndYear;
	var relaxIters = defaultRelaxIters; // TODO: remove after testing

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
		relaxIters = parseInt(relaxItersElt.val());
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
			drawFlowPlot(svg, graphBox, resultToSankeyData(data, startYear, endYear), relaxIters);
			scaleSvg();
		} else {
			setLoadingIndicator(false);
		}
	}

	globalQueryResultWatcher.setCallback(function(result, getContinuer) {
		if (result.plottimeline.hasOwnProperty('error')) {
			data = null;
			loadingIndicator.error('flowplot', true);
			loadingIndicator.enabled(true);
		} else {
			loadingIndicator.error('flowplot', false);
			data = result.plottimeline;
			draw();
		}
	});
}
