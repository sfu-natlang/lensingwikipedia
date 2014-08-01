/*
 * Entity timeline visualization similar to XKCD #657.
 */

// Number for generating unique clipping element IDs
var timelineClipNum = 0;

function yearsArrayOfTable(yearsTable) {
	var years = [];
	$.each(yearsTable, function (year, clusters) {
		years.push(parseInt(year));
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

	// TODO: if we calculate the years order here, should we return it for later?

	// TODO: what do we actually need to return in this function?
	return {
		nodes: nodes,
		links: links,
		entities: entities
	}
}

// TODO: fix up the data converter function and remove this wrapper
function layout(data, size, nodeHeightPerEntity, nodeHeightGap, looseRelaxationIters, middleRelaxationIters, tightRelaxationIters, yearDistWeight) {
	var byYear = {};
	$.each(data.nodes, function (nodeI, node) {
		if (!byYear.hasOwnProperty(node.year))
			byYear[node.year] = [];
		node.id = nodeI;
		byYear[node.year].push(node);
	});

	console.log("size", size);
	data.entityLines = flowLayout(byYear, size[1], nodeHeightPerEntity, nodeHeightGap, yearDistWeight, looseRelaxationIters, middleRelaxationIters, tightRelaxationIters);
}

function flowLayout(nodesByYear, layoutHeight, nodeHeightPerEntity, nodeHeightGap, yearDistWeight, looseRelaxationIters, middleRelaxationIters, tightRelaxationIters) {
	function initialYearLayout(yearNodes) {
		var totalEntities = 0;
		$.each(yearNodes, function (nodeI, node) {
			totalEntities += node.entityIds.length;
		});
		var space = (layoutHeight - totalEntities * nodeHeightPerEntity) / (yearNodes.length + 1);
		$.each(yearNodes, function (nodeI, node) {
			node.layout.y = space * (nodeI + 1);
			node.layout.dy = node.entityIds.length * nodeHeightPerEntity;
		});
	}

	function makeEntityPaths(yearsOrder) {
		var entityPaths = {};
		$.each(yearsOrder, function (yearI, year) {
			$.each(nodesByYear[year], function (nodeI, node) {
				$.each(node.entityIds, function (entityIdI, entityId) {
					if (!entityPaths.hasOwnProperty(entityId))
						entityPaths[entityId] = [];
					entityPaths[entityId].push({ node: node, yearIndex: yearI });
				});
			});
		});
		return entityPaths;
	}

	function findNeighbours() {
		$.each(entityPaths, function (entityId, entityPath) {
			var lastSeenNode = {};
			$.each(entityPath, function (pathPointI, pathPoint) {
				var node = pathPoint.node;
				if (lastSeenNode.hasOwnProperty(entityId)) {
					var prevNode = lastSeenNode[entityId];
					if (!prevNode.layout.neighbours.hasOwnProperty(node.layout.id))
						prevNode.layout.neighbours[node.layout.id] = { node: node, count: 1 };
					else
						prevNode.layout.neighbours[node.layout.id].count += 1;
					if (!node.layout.neighbours.hasOwnProperty(prevNode.layout.id))
						node.layout.neighbours[prevNode.layout.id] = { node: prevNode, count: 1 };
					else
						node.layout.neighbours[prevNode.layout.id].count += 1;
				}
				lastSeenNode[entityId] = node;
			});
		});
	}

	function neighbourWeight(diffYear) {
		return (diffYear - 1) * yearDistWeight + 1;
	}

	function calculateNeighbourWeights() {
		$.each(yearsOrder, function (yearI, year) {
			$.each(nodesByYear[year], function (nodeI, node) {
				node.layout.neighbourWeightsTotal = 0;
				$.each(node.layout.neighbours, function (neighbourId, neighbour) {
					var weight = neighbour.count / neighbourWeight(Math.abs(node.year - neighbour.node.year));
					node.layout.neighbourWeightsTotal += weight;
					neighbour.weight = weight;
				});
			});
		});
	}

	function makeEntityLines(yearsOrder, entityPaths, addFillers) {
		function assignNodeYs(entityLines) {
			var lastYForLine = {};
			$.each(yearsOrder, function (yearI, year) {
				var yearNodes = nodesByYear[year];
				$.each(yearNodes, function (nodeI, node) {
					node.layout.lineIntersections.sort(function (li1, li2) { return lastYForLine[li1.lineId] - lastYForLine[li2.lineId] });
					$.each(node.layout.lineIntersections, function (linePointI, linePoint) {
						var entityLine = entityLines[linePoint.lineId];
						var linePoint = entityLine[linePoint.pos];
						linePoint.y = node.layout.y + (linePointI + 0.5) * (nodeHeightPerEntity);
						lastYForLine[linePoint.lineId] = linePoint.y;
					});
				});
			});
		}
		function assignFillerYs(entityLines) {
			$.each(entityLines, function (entityLineI, entityLine) {
				var lastNodeY = null;
				$.each(entityLine, function (linePointI, linePoint) {
					if (linePoint.node != null)
						lastNodeY = linePoint.y;
					else
						linePoint.y = lastNodeY;
				});
			});
		}
		var entityLines = [];
		$.each(entityPaths, function (entityPathI, entityPath) {
			var entityLine = [];
			var secondNodeLayout = null;
			entityLines.push(entityLine);
			$.each(entityPath, function (pathPointI, pathPoint) {
				if (addFillers && pathPointI > 0) {
					for (var yearI = entityPath[pathPointI - 1].yearIndex + 1; yearI < pathPoint.yearIndex; yearI++) {
						entityLine.push({
							year: yearsOrder[yearI],
							date: jsDateOfYear(yearsOrder[yearI]),
							node: null,
							lineId: entityPathI,
							pos: entityLine.length
						});
					}
				}
				var linePoint = {
					year: pathPoint.node.year,
					date: pathPoint.node.date,
					node: pathPoint.node,
					lineId: entityPathI,
					yearIndex: pathPoint.yearIndex,
					pos: entityLine.length
				};
				pathPoint.node.layout.lineIntersections.push(linePoint);
				entityLine.push(linePoint);
				if (pathPointI == 1)
					secondNodeLayout = pathPoint.node.layout;
			});
		});
		assignNodeYs(entityLines);
		if (addFillers)
			assignFillerYs(entityLines);
		return entityLines;
	}

	function fixNodeOverlaps(yearNodes) {
		yearNodes.sort(function (n1, n2) { return n1.y - n2.y });
		var carryYOffset = 0;
		for (var nodeI = 0; nodeI < yearNodes.length - 1; nodeI++) {
			var node1 = yearNodes[nodeI];
			var node2 = yearNodes[nodeI + 1];
			var d = node1.layout.y + node1.layout.dy + nodeHeightGap - node2.layout.y;
			if (d > 0) {
				node1.layout.toAdjustY = d / 2;
				carryYOffset += d / 2;
				node2.layout.y += carryYOffset;
			} else {
				node1.layout.toAdjustY = 0;
			}
		}
		yearNodes[yearNodes.length - 1].layout.toAdjustY = 0;
		carryYOffset = 0;
		for (var nodeI = yearNodes.length - 1; nodeI >= 0; nodeI--) {
			var node = yearNodes[nodeI];
			carryYOffset += node.layout.toAdjustY;
			node.layout.y -= carryYOffset;
		}
		for (var nodeI = yearNodes.length - 1; nodeI >= 0; nodeI--) {
			var node = yearNodes[nodeI];
			if (node.layout.y < 0)
				node.layout.y = 0;
			if (node.layout.y + node.layout.dy > layoutHeight)
				node.layout.y = layoutHeight - node.layout.dy;
		}
	}

	function looseRelax(yearsOrder, iterations) {
		for (var iter = 0; iter < iterations; iter++) {
			console.log("loose relaxation iteration", iter);
			$.each(yearsOrder, function (yearI, year) {
				var yearNodes = nodesByYear[year];
				$.each(yearNodes, function (nodeI, node) {
					var sumCentreY = 0;
					$.each(node.layout.neighbours, function (neighbourId, neighbour) {
						sumCentreY += (neighbour.node.layout.y + neighbour.node.layout.dy / 2) * neighbour.weight;
					});
					node.layout.y = (sumCentreY / node.layout.neighbourWeightsTotal) - node.layout.dy / 2;
				});
				fixNodeOverlaps(yearNodes);
			});
		}
	}

	function getLinePointsByYear(yearsOrder, entityLines) {
		var byYear = {};
		$.each(yearsOrder, function (yearI, year) {
			byYear[year] = [];
		});
		$.each(entityLines, function (entityLineI, entityLine) {
			for (var linePointI = 0; linePointI < entityLine.length; linePointI++) {
				var linePoint = entityLine[linePointI];
				byYear[linePoint.year].push(linePoint);
			}
		});
		return byYear;
	}

	function middleRelax(yearsOrder, entityLines, iterations) {
		for (var iter = 0; iter < iterations; iter++) {
			console.log("middle relaxation iteration", iter);
			$.each(yearsOrder, function (yearI, year) {
				var yearNodes = nodesByYear[year];
				$.each(yearNodes, function (nodeI, node) {
					var sumCentreY = 0;
					var numSamples = 0;
					$.each(node.layout.lineIntersections, function (linePointI, linePoint) {
						var entityLine = entityLines[linePoint.lineId];
						if (linePoint.pos > 0) {
							sumCentreY += entityLine[linePoint.pos - 1].y
							numSamples++;
						}
						if (linePoint.pos < entityLine.length - 1) {
							sumCentreY += entityLine[linePoint.pos + 1].y
							numSamples++;
						}
					});
					var newY = (sumCentreY / numSamples) - node.layout.dy / 2;
					var dY = newY - node.layout.y;
					node.layout.y = newY;
				});
				fixNodeOverlaps(yearNodes);
			});
		}
	}

	function fixLineOverlaps(yearLinePoints) {
		function dist(point1, point2) {
			var d = point1.y + nodeHeightPerEntity - point2.y;
			if (point1.node != null && point2.node != null && point1.node != point2.node)
				d += nodeHeightGap;
			return d;
		}
		yearLinePoints.sort(function (p1, p2) { return p1.y - p2.y });
		var carryYOffset = 0;
		for (var linePointI = 0; linePointI < yearLinePoints.length - 1; linePointI++) {
			var point1 = yearLinePoints[linePointI];
			var point2 = yearLinePoints[linePointI + 1];
			var d = dist(point1, point2);
			if (d > 0) {
				point1.toAdjustY = d / 2;
				carryYOffset += d / 2;
				point2.y += carryYOffset;
				point1.isClear = false;
				point2.isClear = false;
			} else {
				point1.toAdjustY = 0;
				point2.isClear = true;
			}
		}
		yearLinePoints[yearLinePoints.length - 1].toAdjustY = 0;
		carryYOffset = 0;
		for (var linePointI = yearLinePoints.length - 1; linePointI >= 0; linePointI--) {
			var point2 = yearLinePoints[linePointI];
			carryYOffset += point2.toAdjustY;
			if (carryYOffset != 0)
				point2.isClear = false;
			point2.y -= carryYOffset;
		}
	}

	function tightRelax(yearsOrder, entityLines, linePointsByYear, iterations) {
		for (var iter = 0; iter < iterations; iter++) {
			console.log("tight relaxation iteration", iter);
			$.each(entityLines, function (entityLineI, entityLine) {
				if (entityLine.length > 1) {
					for (var linePointI = 0; linePointI < entityLine.length; linePointI++) {
						var linePoint = entityLine[linePointI],
						    prevLinePoint = entityLine[linePointI - 1],
						    nextLinePoint = entityLine[linePointI + 1];
						var totalWeight = 0,
						    newY = 0;
						if (prevLinePoint != null) {
							var weight1 = neighbourWeight(linePoint.year - prevLinePoint.year) / 2;
							totalWeight += weight1;
							newY += weight1 * prevLinePoint.y;
						}
						if (nextLinePoint != null) {
							var weight2 = neighbourWeight(nextLinePoint.year - linePoint.year) / 2;
							totalWeight += weight2;
							newY += weight2 * nextLinePoint.y;
						}
						if (totalWeight != 0) {
							newY /= totalWeight;
							if (linePoint.node != null) {
								var dy = newY - linePoint.y;
								linePoint.node.layout.y += dy;
								$.each(linePoint.node.layout.lineIntersections, function (linePoint2I, linePoint2) {
									linePoint2.y += dy;
								});
							}
							linePoint.y = newY;
						}
					}
				}
			});
			$.each(linePointsByYear, function (year, yearLinePoints) {
				fixLineOverlaps(yearLinePoints);
			});
		}
	}

	function makeNodesMatchLines() {
		$.each(nodesByYear, function (year, yearNodes) {
			$.each(yearNodes, function (nodeI, node) {
				var minY = layoutHeight + 1,
				    maxY = -1;
				$.each(node.layout.lineIntersections, function (linePointI, linePoint) {
					if (linePoint.y < minY)
						minY = linePoint.y;
					if (linePoint.y > maxY)
						maxY = linePoint.y;
				});
				node.layout.y = minY - nodeHeightPerEntity / 2;
				node.layout.dy = maxY - node.layout.y + nodeHeightPerEntity / 2;
			});
		});
	}

	function trimEntityLines(entityLines) {
		var newLines = [];
		$.each(entityLines, function (entityLineI, entityLine) {
			newLines.push(
				$.map(entityLine, function (linePoint) {
					if (linePoint.node != null || !linePoint.isClear)
						return linePoint;
					else
						return null;
				})
			);
		});
		return newLines;
	}

	var id = 0;
	$.each(nodesByYear, function (year, yearNodes) {
		$.each(yearNodes, function (nodeI, node) {
			node.layout = {
				id: id++,
				neighbours: {},
				lineIntersections: []
			};
		});
		initialYearLayout(yearNodes);
	});

	var yearsOrder = yearsArrayOfTable(nodesByYear);

	var entityPaths = makeEntityPaths(yearsOrder);

	findNeighbours();
	calculateNeighbourWeights();
	looseRelax(yearsOrder, looseRelaxationIters);
	var entityLines = makeEntityLines(yearsOrder, entityPaths, false);
	middleRelax(yearsOrder, entityLines, middleRelaxationIters);
	$.each(nodesByYear, function (year, yearNodes) {
		$.each(yearNodes, function (nodeI, node) {
			node.layout.lineIntersections = []
		});
	});
	entityLines = makeEntityLines(yearsOrder, entityLines, true);
	var linePointsByYear = getLinePointsByYear(yearsOrder, entityLines);
	tightRelax(yearsOrder, entityLines, linePointsByYear, tightRelaxationIters);
	makeNodesMatchLines();
	entityLines = trimEntityLines(entityLines);

	return entityLines;
}

/*
 * Draw the whole visualization.
 */
function drawFlowPlot(svg, box, data) {
	console.log("plot", data); // TODO

	var nodeWidth = box.width * 0.01;
	var nodeHeightPerEntity = box.height * 0.06;
	var nodeHeightGap = nodeHeightPerEntity * 2;
	var yearDistWeight = 1;
	var looseRelaxationIters = 3;
	var middleRelaxationIters = 1;
	var tightRelaxationIters = 3;

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

	layout(data, [box.width, box.height - xAxisSpace], nodeHeightPerEntity, nodeHeightGap, looseRelaxationIters, middleRelaxationIters, tightRelaxationIters, yearDistWeight);

	function classEnitityLines(entityIds, value) {
		d3.selectAll(entityIds.map(function (eid) { return ".line" + eid; }).join(', '))
			.classed('highlight', value);
	}

	var linesColor = d3.scale.category10();
	var linesLine = d3.svg.line()
		.x(function (p) { return xScale(p.date); })
		.y(function (p) { return p.y; })
		.interpolate('cardinal')
		.tension(0.8);
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
		.attr("y", function (n) { return n.layout.y; })
		.attr("height", function(n) { return n.layout.dy; })
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
	    defaultEndYear = -180;

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
			drawFlowPlot(svg, graphBox, resultToSankeyData(data, startYear, endYear));
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
