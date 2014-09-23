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

// TODO: extract the fields list help from the text search message and share here?
var storylineQueryHelpText = " \
	<strong>Query format:</strong> \
	A query is a list of entities separated by spaces. An entity is determined by a field name and value separated by a colon. For example: \
	<blockquote> \
		person:Hannibal, person:Scipio Africanus, person:Antiochus III the Great \
	</blockquote> \
"
var storylineFacetHelpText = " \
	Make a selection in the facet to generate a storyline. \
"

/*
 * Parse the manual query format.
 */
function parsePlotlineQueryString(entitiesString) {
	return entitiesString.split(",").map(function (entityString) {
		var parts = entityString.split(":").map(function (p) { return p.replace(/^\s+|\s+$/g, "") });
		return {
			field: parts[0],
			value: parts[1]
		}
	});
} 

/*
 * Output the manual query format.
 */
function unparsePlotlineQuery(entities) {
	return $.map(entities, function (entity) {
		return [entity.field, entity.value].join(":");
	}).join(", ");
} 

/*
 * Convert data from backend to data for Sankey plot.
 */
function resultToSankeyData(resultData) {
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

	var nodes = [];

	var byYear = {};
	var entities = [];
	var nextEntityId = 0;
	$.each(resultData.timeline, function (field, valueTable) {
		$.each(valueTable, function (value, yearsTable) {
			// We ignore entities that only appear once, and thus can't form a line
			// TODO: is this a sensible place to do this?
			var nonEmptyYearCount = 0;
			$.each(yearsTable, function (year, clusters) {
				if (clusters.length > 0) {
					nonEmptyYearCount++;
					if (nonEmptyYearCount > 1)
						return false;
				}
			});
			if (nonEmptyYearCount > 1) {
				var addedEntity = false;
				$.each(yearsTable, function (year, clusters) {
					year = parseInt(year);
					if (!byYear.hasOwnProperty(year))
						byYear[year] = {};
					var forYear = byYear[year];
					$.each(clusters, function (clusterI, cluster) {
						if (!forYear.hasOwnProperty(cluster))
							forYear[cluster] = [];
						addedEntity = true;
						forYear[cluster].push(nextEntityId);
					});
				});
				if (addedEntity) {
					entities.push({ field: field, value: value });
					nextEntityId++;
				}
			}
		});
	});

	var visClusters = [],
	    visClustersByYear = {};
	$.each(byYear, function (year, clusters) {
		year = parseInt(year);
		var yearVisClusters = $.map(clusters, function (entityIds, cluster) {
			var visCluster = {
				clusters: {},
				entityIds: {}
			};
			visCluster.clusters[cluster] = true;
			$.each(entityIds, function (entityIdI, entityId) {
				visCluster.entityIds[entityId] = true;
			});
			return visCluster;
		});
		while (true) {
			var changed = false;
			var entityAssignment = {};
			for (var visClusterI = 0; visClusterI < yearVisClusters.length; visClusterI++) {
				var visCluster = yearVisClusters[visClusterI];
				if (visCluster != undefined) {
					var mergeWithI = null;
					$.each(visCluster.entityIds, function (entityId) {
						if (entityAssignment.hasOwnProperty(entityId)) {
							mergeWithI = entityAssignment[entityId];
							return false;
						}
					});
					if (mergeWithI == null) {
						$.each(visCluster.entityIds, function (entityId) {
								entityAssignment[entityId] = visClusterI;
						});
					} else {
						var mergeWith = yearVisClusters[mergeWithI];
						$.each(visCluster.clusters, function (cluster) {
							mergeWith.clusters[cluster] = true;
						});
						$.each(visCluster.entityIds, function (entityId) {
							mergeWith.entityIds[entityId] = true;
						});
						delete yearVisClusters[visClusterI];
						changed = true;
					}
				}
			}
			if (!changed)
				break;
		}
		visClustersByYear[year] = $.map(yearVisClusters, function (visCluster) {
			if (visCluster != null) {
				var visClusterId = visClusters.length;
				visClusters.push({
					year: year,
					date: jsDateOfYear(year),
					clusters: visCluster.clusters,
					entityIds: Object.keys(visCluster.entityIds)
				});
				return visClusterId;
			}
		});
	});

	var nodes = visClusters;

	var yearsOrder = yearsArrayOfTable(visClustersByYear);

	// TODO: I think this was compensating for an old bug that is now fixed properly. Is that right?
	/*
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
					}
				} else
					visClusters[visCluster].entityIds.push(entityId);
				lastSeen[entityId] = visCluster;
			});
		});
	});
	*/

	// TODO: if we calculate the years order here, should we return it for later?

	// TODO: what do we actually need to return in this function?
	return {
		nodes: nodes,
		entities: entities
	}
}

// TODO: fix up the data converter function and remove this wrapper
function layout(data, layoutHeight, nodeHeightPerEntity, nodeHeightGap, looseRelaxationIters, middleRelaxationIters, tightRelaxationIters, yearDistWeight) {
	var byYear = {};
	$.each(data.nodes, function (nodeI, node) {
		if (!byYear.hasOwnProperty(node.year))
			byYear[node.year] = [];
		node.id = nodeI;
		byYear[node.year].push(node);
	});
	data.entityLines = storylineLayout(byYear, layoutHeight, nodeHeightPerEntity, nodeHeightGap, yearDistWeight, looseRelaxationIters, middleRelaxationIters, tightRelaxationIters);
}

function storylineLayout(nodesByYear, layoutHeight, nodeHeightPerEntity, nodeHeightGap, yearDistWeight, looseRelaxationIters, middleRelaxationIters, tightRelaxationIters) {
	var topMargin = nodeHeightGap;

	function initialLayout(yearsOrder) {
		$.each(yearsOrder, function (yearI, year) {
			var yearNodes = nodesByYear[year];
			var totalEntities = 0;
			$.each(yearNodes, function (nodeI, node) {
				totalEntities += node.entityIds.length;
			});
			var space = (layoutHeight - totalEntities * nodeHeightPerEntity) / (yearNodes.length + 1);
			$.each(yearNodes, function (nodeI, node) {
				node.layout.y = space * (nodeI + 1);
				node.layout.dy = node.entityIds.length * nodeHeightPerEntity;
			});
		});
	}

	function fixOverlaps(nodesByYear, entityLines) {
		// TODO: unnecessary moving of some line points in fix step

		$.each(nodesByYear, function (year, yearNodes) {
			yearNodes.sort(function (n1, n2) { return n1.layout.y - n2.layout.y });
			var headInterval = {
				y: yearNodes[0].layout.y,
				dy: yearNodes[0].layout.dy,
				nodes: [yearNodes[0]],
				next: null
			};
			for (var nodeI = 1, lastInterval = headInterval; nodeI < yearNodes.length; nodeI++) {
				lastInterval.next = {
					y: yearNodes[nodeI].layout.y,
					dy: yearNodes[nodeI].layout.dy,
					nodes: [yearNodes[nodeI]],
					next: null
				};
				lastInterval = lastInterval.next;
			}

			while (true) {
				var overlapped = false;
				for (var interval1 = headInterval, interval2 = headInterval.next; interval2 != null; ) {
					var dY = interval1.y + interval1.dy + nodeHeightGap - interval2.y;
					if (dY > 0) {
						interval1.y -= Math.min(dY / 2, interval1.y - topMargin);
						interval1.dy += interval2.dy + nodeHeightGap;
						interval1.nodes = interval1.nodes.concat(interval2.nodes);
						interval1.next = interval2.next;
						interval2 = interval2.next;
						overlapped = true;
					} else {
						interval1 = interval2;
						interval2 = interval2.next;
					}
				}
				if (!overlapped)
					break;
			}

			for (var interval = headInterval; interval != null; interval = interval.next) {
				var offset = 0;
				for (var nodeI = 0; nodeI < interval.nodes.length; nodeI++) {
					var layout = interval.nodes[nodeI].layout;
					layout.y = interval.y + offset;
					offset += layout.dy + nodeHeightGap;
				}
			}
		});
	}

	function relax(nodesByYear, yearsOrder, entityLines) {
		$.each(nodesByYear, function (year, yearNodes) {
			$.each(yearNodes, function (nodeI, node) {
				node.layout.relaxYSum = 0;
				node.layout.relaxYCount = 0;
			});
		});

		function yearDistFactor(year1, year2) {
			var d = Math.abs(year2 - year1);
			return 1.0 / d;
		}

		$.each(entityLines, function (entityLineI, entityLine) {
			$.each(entityLine.points, function (linePointI, linePoint) {
				if (linePointI > 0) {
					var f = yearDistFactor(linePoint.node.year, entityLine.points[linePointI - 1].node.year);
					linePoint.node.layout.relaxYSum += f * entityLine.points[linePointI - 1].node.layout.y;
					linePoint.node.layout.relaxYCount += f;
				}
				if (linePointI < entityLine.points.length - 1) {
					var f = yearDistFactor(linePoint.node.year,  entityLine.points[linePointI + 1].node.year);
					linePoint.node.layout.relaxYSum += f * entityLine.points[linePointI + 1].node.layout.y;
					linePoint.node.layout.relaxYCount += f;
				}
			});
		});

		$.each(nodesByYear, function (year, yearNodes) {
			$.each(yearNodes, function (nodeI, node) {
				node.layout.y = node.layout.relaxYSum / node.layout.relaxYCount;
			});
		});
	}

	$.each(nodesByYear, function (year, yearNodes) {
		$.each(yearNodes, function (nodeI, node) {
			node.layout = {};
		});
	});

	var yearsOrder = yearsArrayOfTable(nodesByYear);
	initialLayout(yearsOrder);

	function makeEntityLines(yearsOrder, addFillerNodes) {
		var entityLines = [],
		    entityLinesLookup = {};
		$.each(yearsOrder, function (yearI, year) {
			$.each(nodesByYear[year], function (nodeI, node) {
				$.each(node.entityIds, function (entityIdI, entityId) {
					var entityLineId = null,
					    entityLine = null;
					if (entityLinesLookup.hasOwnProperty(entityId)) {
						entityLineId = entityLinesLookup[entityId];
						entityLine = entityLines[entityLineId];
					} else {
						entityLineId = entityLines.length;
						entityLine = {
							entityId: entityId,
							points: []
						};
						entityLinesLookup[entityId] = entityLineId;
						entityLines.push(entityLine);
					}
					if (addFillerNodes && entityLine.points.length > 0) {
						var lastPoint = entityLine.points[entityLine.points.length - 1];
						for (var yearJ = lastPoint.yearIndex + 1; yearJ < yearI; yearJ++) {
							var year = yearsOrder[yearJ],
							    date = jsDateOfYear(year);
							entityLine.points.push({
								yearIndex: yearJ,
								node: {
									isDummy: true,
									year: year,
									date: date,
									layout: {
										dy: nodeHeightPerEntity
									}
								},
								lineId: entityLineId,
								pos: entityLine.points.length
							});
						}
					}
					entityLine.points.push({
						yearIndex: yearI,
						node: node,
						lineId: entityLineId,
						pos: entityLine.points.length
					});
				});
			});
		});
		return entityLines;
	}

	function setInitialEntityLinePositions(entityLines) {
		$.each(entityLines, function (entityLineI, entityLine) {
			$.each(entityLine.points, function (linePointI, linePoint) {
				linePoint.y = linePoint.node.layout.y + linePoint.node.layout.dy / 2;
			});
		});
	}

	function updateNodesWithLinePoints(entityLines) {
		// TODO: is this init to empty lists really needed?
		$.each(yearsOrder, function (yearI, year) {
			$.each(nodesByYear[year], function (nodeI, node) {
				node.layout.linePoints = [];
			});
		});

		$.each(entityLines, function (entityLineI, entityLine) {
			$.each(entityLine.points, function (linePointI, linePoint) {
				if (linePoint.node != null) {
					if (!linePoint.node.layout.hasOwnProperty('linePoints'))
						linePoint.node.layout.linePoints = [];
					linePoint.node.layout.linePoints.push(linePoint);
				}
			});
		});
	}

	/*
	 * Make a complete nodes-by-year table that includes any dummy nodes added.
	 */
	function completeNodesByYear(nodesByYear, entityLines) {
		var complete = {};
		$.each(nodesByYear, function (year, yearNodes) {
			complete[year] = yearNodes.slice();
		});
		$.each(entityLines, function (entityLineI, entityLine) {
			$.each(entityLine.points, function (linePointI, linePoint) {
				if (linePoint.node.isDummy)
					complete[linePoint.node.year].push(linePoint.node);
			});
		});
		return complete;
	}

	/*
	 * Set proper y positions for each line, separated in each node box and including dummy nodes.
	 */
	function setCompleteEntryLinePositions(nodesByYear, yearsOrder, entityLines) {
		var lastNodePointY = {};
		$.each(yearsOrder, function (yearI, year) {
			$.each(nodesByYear[year], function (nodeI, node) {
				node.layout.linePoints.sort(function (lp1, lp2) {
					var lp1line = entityLines[lp1.lineId],
					    lp2line = entityLines[lp2.lineId];
					var lp1yp = lp1.pos > 0 ? lp1line.points[lp1.pos - 1].y : null,
					    lp2yp = lp2.pos > 0 ? lp2line.points[lp2.pos - 1].y : null;
					var lp1yn = lp1.pos < lp1line.points.length - 1 ? lp1line.points[lp1.pos + 1].y : null,
					    lp2yn = lp2.pos < lp2line.points.length - 1 ? lp2line.points[lp2.pos + 1].y : null;
					if (lp1yp != null && lp2yp != null && lp1yn != null && lp2yn != null
						&& ((lp1yp - lp2yp) * (lp1yn - lp2yn)) < 0)
						return 1;
					else if (lp1yp != null && lp2yp != null)
						return lp1yp - lp2yp;
					else if (lp1yn != null && lp2yn != null)
						return lp1yn - lp2yn;
					else
						return -1;
				});
				$.each(node.layout.linePoints, function (linePointI, linePoint) {
					linePoint.y = node.layout.y + nodeHeightPerEntity * (linePointI + 0.5);
					lastNodePointY[linePoint.lineId] = linePoint.y;
				});
			});
		});
		$.each(entityLines, function (entityLineI, entityLine) {
			$.each(entityLine.points, function (linePointI, linePoint) {
				if (linePoint.node.isDummy)
					linePoint.y = linePoint.node.layout.y + nodeHeightPerEntity / 2;
			});
		});
	}

	function initDummyNodePositions(entityLines) {
		$.each(entityLines, function (entityLineI, entityLine) {
			var lastNonDummmyY = null;
			$.each(entityLine.points, function (linePointI, linePoint) {
				if (linePoint.node.isDummy) {
					linePoint.node.layout.y = lastNonDummmyY - nodeHeightPerEntity;
				} else {
					lastNonDummmyY = linePoint.node.layout.y;
				}
			});
		});
	}

	entityLines = makeEntityLines(yearsOrder, false);
	for (var iter = 0; iter < 3; iter++) {
		console.log("initial relax iter", iter);
		relax(nodesByYear, yearsOrder, entityLines);
		updateNodesWithLinePoints(entityLines);
		fixOverlaps(nodesByYear, entityLines);
	}
	setCompleteEntryLinePositions(nodesByYear, yearsOrder, entityLines);

	entityLines = makeEntityLines(yearsOrder, true);
	nodesByYearWithDummies = completeNodesByYear(nodesByYear, entityLines);
	for (var iter = 0; iter < 3; iter++) {
		console.log("second relax iter", iter);
		updateNodesWithLinePoints(entityLines);
		initDummyNodePositions(entityLines);
		relax(nodesByYearWithDummies, yearsOrder, entityLines);
		fixOverlaps(nodesByYearWithDummies, entityLines);
		setCompleteEntryLinePositions(nodesByYearWithDummies, yearsOrder, entityLines);
	}

	return entityLines;
}

function drawStorylineDiagram(svg, box, clipId, data, layoutHeight, nodeWidth, nodeHeightPerEntity, xAxisSpace, drawLabels, doMouseovers, useFieldPrefixes, importantEntities, onSelectNode) {
	var scale = box.height / layoutHeight;

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

	function classEnitityLines(entityIds, value) {
		draw.selectAll(entityIds.map(function (eid) { return ".line" + eid; }).join(', '))
			.classed('highlight', value);
	}

	draw.append('g')
		.attr('class', "x axis ")
		.attr('transform', "translate(0," + box.height + ")")
		.attr('clip-path', "url(#" + clipId + ")")
		.call(xAxis);

	var linesColor = d3.scale.category10();
	var linesLine = d3.svg.line()
		.x(function (p, i) { return xScale(p.node.date); })
		.y(function (p) { return p.y * scale; })
		.interpolate('cardinal')
		.tension(0.8);
	var lines = draw.append("g")
		.selectAll(".line")
		.data(data.entityLines)
		.enter()
		.append("path")
		.attr('clip-path', "url(#" + clipId + ")")
		.attr("class", function (l) {
			var e = data.entities[l.entityId];
			var c = "line line" + l.entityId;
			if (importantEntities.hasOwnProperty(e.field) && importantEntities[e.field].indexOf(e.value) >= 0)
				c += " important";
			return c;
		})
		.style("stroke", function(l, i) { return linesColor(i); });
	if (doMouseovers)
		lines
			.on("mouseover", function () {
				d3.select(this).classed('highlight', true);
			})
			.on("mouseout", function () {
				d3.select(this).classed('highlight', false);
			})
			.append("title")
			.text(function (l) { var e = data.entities[l.entityId]; return "" + (useFieldPrefixes ? e.field + ":" : "") + e.value; });

	var node = draw.append("g")
		.selectAll(".node")
		.data(data.nodes)
		.enter()
		.append("rect")
		.attr("class", "node")
		.attr('clip-path', "url(#" + clipId + ")");
	if (doMouseovers)
		node
			.on("mouseover", function (n) {
				d3.select(this).classed('highlight', true);
				classEnitityLines(n.entityIds, true);
			})
			.on("mouseout", function (n) {
				d3.select(this).classed('highlight', false);
				classEnitityLines(n.entityIds, false);
			})
			.append("title")
			.text(function(d) {
				return "" + timeAxisTickFormater(d.date)
					+ "\n" + $.map(d.entityIds, function (eid, i) { var e = data.entities[eid]; return "" + (useFieldPrefixes ? e.field + ":" : "") + e.value; }).join("\n")
					+ "\n" + $.map(d.clusters, function (v, f) { return f; }).join("\n");
			});
	if (onSelectNode != null)
		node.on("click", onSelectNode);

	var labelGroups = null;
	if (drawLabels) {
		labelGroups = draw.append("g")
			.selectAll(".linelabel")
			.data(data.entityLines)
			.enter()
			.append("g")
			.attr('class', "linelabel");
		var text = labelGroups
			.append("text")
			.text(function (l, i) { var e = data.entities[l.entityId]; return "" + (useFieldPrefixes ? e.field + ":" : "") + e.value; })
			.attr("dy", ".35em");
		if (doMouseovers)
			text
				.on("mouseover", function (l, i) {
					classEnitityLines([i], true);
				})
				.on("mouseout", function (l, i) {
					classEnitityLines([i], false);
				})
	}

	function update() {
		lines
			.attr("d", function (d) { return linesLine(d.points); });
		node
			.attr("x", function (n) { return xScale(n.date) - nodeWidth / 2; })
			.attr("y", function (n) { return n.layout.y * scale; })
			.attr("height", function(n) { return n.layout.dy * scale; })
			.attr("width", nodeWidth);
		if (labelGroups != null)
			labelGroups
				.attr('visibility', function (l) {
					if (xScale(l.points[l.points.length - 1].date) < 0)
						return 'hidden';
					else if (xScale(l.points[0].date) > box.width)
						return 'hidden';
					else
						return 'visible';
				})
				.attr('text-anchor', function (l) {
					var x = xScale(l.points[0].date);
					if (x <= 0)
						return 'left';
					else
						return 'middle';
				})
				.attr('transform', function(l) {
					var x = Math.min(box.width, Math.max(0, xScale(l.points[0].node.date)));
					return "translate(" + x + "," + (l.points[0].y * scale - nodeHeightPerEntity / 3) + ")";
				})
	}
	update();

	function updateX(newXDomain) {
		xScale.domain(newXDomain);
		draw.select('.x.axis').call(xAxis);
		update();
	}

	return {
		draw: draw,
		scales: { x: xScale },
		updateX: updateX
	};
}

/*
 * Draw the whole visualization.
 */
function drawStoryline(svg, detailBox, selectBox, data, useFieldPrefixes, importantEntities, onSelectNode) {
	var nodeWidth = detailBox.width * 0.01;
	var nodeHeightPerEntity = detailBox.height * 0.06;
	var nodeHeightGap = nodeHeightPerEntity;
	var yearDistWeight = 1;
	var looseRelaxationIters = 3;
	var middleRelaxationIters = 1;
	var tightRelaxationIters = 3;
	var xAxisSpace = 100;
	var layoutHeight = detailBox.height;

	var clipId = "timelineclip" + timelineClipNum;
	timelineClipNum++;
	svg.append('defs')
		.append('clipPath')
		.attr('id', clipId)
		.append('rect')
		.attr('width', detailBox.width)
		.attr('height', detailBox.height);

	layout(data, layoutHeight, nodeHeightPerEntity, nodeHeightGap, looseRelaxationIters, middleRelaxationIters, tightRelaxationIters, yearDistWeight);
	var detailPlot = drawStorylineDiagram(svg, detailBox, clipId, data, layoutHeight, nodeWidth, nodeHeightPerEntity, xAxisSpace, true, true, useFieldPrefixes, importantEntities, onSelectNode);
	var selectPlot = drawStorylineDiagram(svg, selectBox, clipId, data, layoutHeight, nodeWidth, nodeHeightPerEntity, xAxisSpace, false, false, useFieldPrefixes, importantEntities, null);

	var brush = null;
	function onBrush() {
		detailPlot.updateX(brush.empty() ? selectPlot.scales.x.domain() : brush.extent());
	}
	brush = d3.svg.brush()
		.x(selectPlot.scales.x)
		.on('brush', onBrush);
	selectPlot.draw.append('g')
		.attr('class', 'x brush')
		.call(brush)
		.selectAll('rect')
		.attr('y', -2)
		.attr('height', selectBox.height + 6);
}

/*
 * Setup the control in some container element.
 * container: container element as a jquery selection
 * initialQuery: the initial (empty) query
 * globalQuery: the global query
 */
function setupStoryline(container, globalQuery, facets) {
	// The view space for SVG; this doesn't have to correspond to screen units.
	var viewBox = { x: 0, y : 0, width: 1024, height: 768 };
	// Margins for the graph
	var margins = { left: 30, right: 30, top: 60, bottom: 60, between: 40 };
	// Vertical size of the detail area as a fraction of the total.
	var split = 0.8;

	var outerElt = $("<div class=\"storyline\"></div>").appendTo(container);
	var topBoxElt = $("<div class=\"topbox\"></div>").appendTo(outerElt);
	var loadingIndicator = new LoadingIndicator(outerElt);
	var outerSvgElt = $("<svg class=\"outersvg\"></svg>").appendTo(outerElt);
	var svgElt = $("<svg class=\"innersvg\" viewBox=\"" + viewBox.x + " " + viewBox.y + " " + viewBox.width + " " + viewBox.height + "\" preserveAspectRatio=\"none\"></svg>").appendTo(outerSvgElt);
	var helpElt = $("<div class=\"alert alert-warning alert-dismissable\"></div>").appendTo(outerElt);

	var formElt = $("<form></form>").appendTo(topBoxElt);
	var clearSelElt = $("<button type=\"button\" class=\"btn btn-mini btn-warning clear mapclear\" title=\"Clear the map selection.\">Clear selection</button>").appendTo(formElt);
	var modeElt = $("<select class=\"btn btn-mini\"></select>").appendTo(formElt);
	var queryFormElt = $("<form class=\"query\"></form>").appendTo(topBoxElt);
	var updateElt = $("<button type=\"submit\" class=\"btn btn-warning\" title=\"Update the visualization\">Update</button></ul>").appendTo(queryFormElt);
	var queryElt = $("<input type=\"text\" title=\"Query\"></input>").appendTo($("<div class=\"inputbox\"></div>").appendTo(queryFormElt));

	fillElement(container, outerElt, 'vertical');
	setupPanelled(outerElt, topBoxElt, outerSvgElt, 'vertical', 0, false);
	var scaleSvg = dontScaleSvgParts(outerSvgElt, 'text,.tick');

	var width = viewBox.width - margins.left - margins.right,
	    height = viewBox.height - margins.top - margins.bottom - margins.between;
	var detailBox = { x: viewBox.x + margins.left, y: viewBox.y + margins.top, width: width, height: height * split },
	    selectBox = { x: viewBox.x + margins.left, y: viewBox.y + margins.top + detailBox.height + margins.between, width: width, height: height * (1.0 - split) };

	var ownCnstrQuery = new Query(globalQuery.backendUrl());
	var constraint = new Constraint();
	globalQuery.addConstraint(constraint);
	ownCnstrQuery.addConstraint(constraint);
	var contextQuery = new Query(globalQuery.backendUrl(), 'setminus', globalQuery, ownCnstrQuery);

	var resultWatcher = new ResultWatcher(function () {});
	contextQuery.addResultWatcher(resultWatcher);

	var facetManagers = null;

	function setLoadingIndicator(enabled) {
		svgElt.css('display', !enabled ? '' : 'none');
		loadingIndicator.enabled(enabled);
	}

	var queryEntities = [],
	    oldResultWatcher = null,
	    drawEntityTitlePrefixes = true,
	    drawImportantEntities = {};
	function updateQuery(resultWatcher, cooccurrenceFields) {
		function organizeEntities(entities) {
			var entitiesLookup = {};
			for (var i = 0; i < entities.length; i++) {
				var entity = entities[i];
				if (!entitiesLookup.hasOwnProperty(entity.field))
					entitiesLookup[entity.field] = [];
				entitiesLookup[entity.field].push(entity.value);
			}
			return entitiesLookup;
		}
		if (queryEntities.length > 0) {
			var entities = organizeEntities(queryEntities);
			var view = {
				"plottimeline": {
					"type": "plottimeline",
					"clusterField": "referencePoints",
					"entities": entities
				}
			};
			if (cooccurrenceFields != null) {
				view.plottimeline.cooccurrences = 'and';
				view.plottimeline.cooccurrenceFields = cooccurrenceFields;
				drawEntityTitlePrefixes = false;
				drawImportantEntities = entities;
			} else {
				drawEntityTitlePrefixes = true;
				drawImportantEntities = {};
			}
			if (oldResultWatcher != null)
				oldResultWatcher.clear();
			oldResultWatcher = resultWatcher;
			resultWatcher.set(view);
			contextQuery.update();
			setLoadingIndicator(true);
		} else {
			resultWatcher.clear();
			setLoadingIndicator(false);
			helpElt.show();
			outerSvgElt.hide();
		}
	}

	var selection = {};
	function updateSelection() {
		if ($.isEmptyObject(selection)) {
			clearSelElt.attr('disabled', 'disabled');
			constraint.clear();
		} else {
			var nodeCount = 0,
			    seen = {},
			    selPointStrs = [];
			$.each(selection, function (nodeId, clusters) {
				nodeCount += 1;
				$.each(clusters, function (cluster, mem) {
					if (!seen.hasOwnProperty(cluster)) {
						seen[cluster] = true;
						selPointStrs.push(cluster);
					}
				});
			});
			constraint.name("Storyline: " + nodeCount + (nodeCount == 1 ? " node" : " nodes"));
			constraint.set({
				type: 'referencepoints',
				points: selPointStrs
			});
			clearSelElt.removeAttr('disabled');
		}
		globalQuery.update();
	}
	function onClearSelection() {
		selection = {};
		updateSelection();
	}
	function onSelectNode(node) {
		if (!selection.hasOwnProperty(node.id))
			selection[node.id] = node.clusters;
		else
			delete selection[node.id];
		updateSelection();
	}
	clearSelElt.attr('disabled', 'disabled');
	clearSelElt.bind('click', onClearSelection);

	var data = null;
	function draw() {
		if (data != null) {
			svgElt.children().remove();
			var svg = jqueryToD3(svgElt);
			setLoadingIndicator(false);
			outerSvgElt.show();
			helpElt.hide();
			drawStoryline(svg, detailBox, selectBox, resultToSankeyData(data), drawEntityTitlePrefixes, drawImportantEntities, onSelectNode);
			scaleSvg();
		} else {
			setLoadingIndicator(false);
		}
	}

	function onResult(result) {
		if (result.plottimeline.hasOwnProperty('error')) {
			data = null;
			loadingIndicator.error('storyline', true);
			loadingIndicator.enabled(true);
		} else {
			loadingIndicator.error('storyline', false);
			loadingIndicator.enabled(false);
			data = result.plottimeline;
			outerSvgElt.show();
			helpElt.hide();
			draw();
		}
	}

	resultWatcher.setCallback(function (a) {
		onResult(a);
	});

	updateElt.bind('click', function() {
		setLoadingIndicator(true);
		queryEntities = parsePlotlineQueryString(queryElt.val());
		updateQuery(resultWatcher, null);
	});
	queryFormElt.submit(function () {
		return false;
	});

	var defaultFacetI = -1;
	facetManagers = $.map(facets, function (facet, facetI) {
		var excludeQuery = new Query(globalQuery.backendUrl(), 'setminus', globalQuery, facet.constraintsQuery);
		var excludeResultWatcher = new ResultWatcher(function (a) {
			onResult(a);
		});
		excludeResultWatcher.enabled(false);
		excludeQuery.addResultWatcher(excludeResultWatcher);
		function useFacet() {
			var seenFields = {},
			allFields = [];
			queryEntities = $.map(facet.constraintsQuery.constraints(), function (cnstr) {
				var cnstrValue = cnstr.value();
				if (!seenFields.hasOwnProperty(cnstrValue.field)) {
					seenFields[cnstrValue] = true;
					allFields.push(cnstrValue.field);
				}
				return {
					field: cnstrValue.field,
					value: cnstrValue.value
				}
			});
			updateQuery(excludeResultWatcher, allFields);
		}
		var watcher = new ChangeWatcher(function () { useFacet() });
		watcher.active(false);
		facet.constraintsQuery.addChangeWatcher(watcher);
		if (facet.field == defaultStorylineFacet)
			defaultFacetI = facetI;
		return {
			use: useFacet,
			watcher: watcher,
			excludeResultWatcher: excludeResultWatcher
		}
	});

	$.each(facets, function (facetI, facet) {
		$("<option value=\"" + facetI + "\">" + facet.title + " facet</option>").appendTo(modeElt);
	});
	var queryModeElt = $("<option>Query</option>").appendTo(modeElt);
	var curFacetManager = null;
	modeElt.bind('change', function () {
		var newMode = this.options[this.selectedIndex].value;
		var curQueryText = $.trim(queryElt.val());
		if (curFacetManager != null)
			curFacetManager.watcher.active(false);
		if (newMode == queryModeElt.text()) {
			if (curFacetManager != null) {
				facetQueryText = unparsePlotlineQuery(queryEntities);
				queryEntities = [];
				updateQuery(resultWatcher, null);
			}
			queryFormElt.show();
			helpElt.html(storylineQueryHelpText);
			curFacetManager = null;
			if (curQueryText)
				updateElt.click();
		} else {
			queryFormElt.hide();
			helpElt.html(storylineFacetHelpText);
			facetManagers[this.selectedIndex].use();
			curFacetManager = facetManagers[this.selectedIndex];
			curFacetManager.watcher.active(true);
		}
	});
	queryFormElt.hide();
	if (defaultFacetI > 0)
		modeElt.val(defaultFacetI);
	modeElt.change();
	updateQuery(resultWatcher, null);
}
