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

function extractEntities(resultData) {
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
	return {
		all: entities,
		byYear: byYear
	}
}

function makeVisClusters(entitiesByYear) {
	var visClusters = [],
	    visClustersByYear = {};
	$.each(entitiesByYear, function (year, clusters) {
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
				var visCluster = {
					year: year,
					date: jsDateOfYear(year),
					clusters: visCluster.clusters,
					entityIds: Object.keys(visCluster.entityIds)
				};
				visClusters.push(visCluster);
				return visCluster;
			}
		});
	});
	return {
		all: visClusters,
		byYear: visClustersByYear
	}
}

function makeRows(visClusters) {
	// TODO: if we keep using this then can we integrate with finding vis clusters for more efficiency?

	// TODO: here or in vis cluster making?
	$.each(visClusters, function (visClusterI, visCluster) {
		visCluster.clustersId = "";
		$.each(visCluster.clusters, function (cluster) {
			visCluster.clustersId += "|" + cluster;
		});
	});

	var rowsLookup = {};
	$.each(visClusters, function (visClusterI, visCluster) {
		if (!rowsLookup.hasOwnProperty(visCluster.clustersId)) {
			rowsLookup[visCluster.clustersId] = {
				clustersId: visCluster.clustersId,
				clusters: visCluster.clusters,
				visClusters: [visCluster]
			};
		} else {
			rowsLookup[visCluster.clustersId].visClusters.push(visCluster);
		}
	});

	// TODO: do we need to sort?
	$.each(rowsLookup, function (clustersId, row) {
		row.visClusters.sort(function (vc1, vc2) { return vc1.year - vc2.year; });
	});

	var rows = [];
	$.each(rowsLookup, function (clustersId, row) {
		rows.push(row);
	});
	
	return rows;
}

function sortRows(rows, metric) {
	function listify(array) {
		var head = {
			index: 0,
			value: array[0],
			prev: null,
			next: null
		};
		var node = head;
		for (var i = 1; i < array.length; i++) {
			node.next = {
				index: i,
				value: array[i],
				prev: node,
				next: null
			};
			node = node.next;
		}
		return head;
	}

	function delistify(list) {
		var array = [];
		var node = list;
		while (node != null) {
			array.push(node.value);
			node = node.next;
		}
		return array;
	}

	function moveListElt(head, moveFromNode, moveToNode) {
		if (moveFromNode.prev == null)
			head = moveFromNode.next;
		else
			moveFromNode.prev.next = moveFromNode.next;
		if (moveFromNode.next != null)
			moveFromNode.next.prev = moveFromNode.prev;
		if (moveToNode.prev == null)
			head = moveFromNode;
		else
			moveToNode.prev.next = moveFromNode;
		moveFromNode.prev = moveToNode.prev;
		moveFromNode.next = moveToNode;
		moveToNode.prev = moveFromNode;
		return head;
	}

	var rowsList = listify(rows);

	var iters = 2 * rows.length;
	var lastBestSim = {};
	for (var iter = 0; iter < iters; iter++) {
		var moveFromI = Math.floor(Math.random() * rows.length),
		    moveFromNode = null;
		for (var rowNode = rowsList; rowNode != null; rowNode = rowNode.next) {
			if (rowNode.index == moveFromI) {
				moveFromNode = rowNode;
				break;
			}
		}
		var lastSim = 0;
		if (moveFromNode.prev != null)
			bestSim += metric(moveFromI, moveFromNode.prev.index);
		if (moveFromNode.next != null)
			bestSim += metric(moveFromI, moveFromNode.next.index);
		var moveToNode = null,
		    bestSim = lastSim
		for (var rowNode = rowsList; rowNode != null; rowNode = rowNode.next) {
			if (rowNode.index != moveFromI && (rowNode.prev == null || rowNode.prev.index != moveFromI)) {
				var sim = metric(moveFromI, rowNode.index);
				if (rowNode.prev != null)
					sim += metric(moveFromI, rowNode.prev.index);
				if (sim > bestSim) {
					moveToNode = rowNode;
					bestSim = sim;
				}
			}
		}
		if (moveToNode != null)
			rowsList = moveListElt(rowsList, moveFromNode, moveToNode);
		console.log("hillclimb iter", iter, lastSim, bestSim, bestSim - lastSim);
	}

	return delistify(rowsList);
}

function orderRows(yearsOrder, rows, visClusters) {
	function similarity(row1, row2) {
		var same = 0,
		    notSame = 0;
		$.each(row1.clusters, function (cluster) {
			if (row2.clusters.hasOwnProperty(cluster))
				same += 1;
			else
				notSame += 1;
		});
		return same / (same + notSame);
	}

	function makeSimilarityTable(rows) {
		var simTable = {};
		$.each(rows, function (row1I, row1) {
			simTable[row1I] = {};
		});
		$.each(rows, function (row1I, row1) {
			$.each(rows, function (row2I, row2) {
				if (row1I < row2I) {
					var sim = similarity(row1, row2);
					simTable[row1I][row2I] = sim;
					simTable[row2I][row1I] = sim;
				}
			});
		});
		return simTable;
	}

	function countLineMoves(yearsOrder, visClusters) {
		var lastSeen = {},
		    countTable = {};
		$.each(yearsOrder, function (yearI, year) {
			$.each(visClusters.byYear[year], function (visClusterI, visCluster) {
				$.each(visCluster.entityIds, function (entityIdI, entityId) {
					if (lastSeen.hasOwnProperty(entityId)) {
						var lastClustersId = lastSeen[entityId];
						if (!countTable.hasOwnProperty(lastClustersId))
							countTable[lastClustersId] = {};
						if (!countTable[lastClustersId].hasOwnProperty(visCluster.clustersId))
							countTable[lastClustersId][visCluster.clustersId] = 1;
						else
							countTable[lastClustersId][visCluster.clustersId] += 1;
					}
					lastSeen[entityId] = visCluster.clustersId;
				});
			});
		});
		var maxCount = 0;
		$.each(countTable, function (clustersId1, part) {
			$.each(part, function (clustersId2, count) {
				if (count > maxCount)
					maxCount = count;
			});
		});
		$.each(countTable, function (clustersId1, part) {
			$.each(part, function (clustersId2, count) {
				part[clustersId2] = count / maxCount;
			});
		});
		return countTable;
	}

	var simTable = makeSimilarityTable(rows),
	    lineMovesTable = countLineMoves(yearsOrder, visClusters);

	function metric(row1I, row2I) {
		var row1 = rows[row1I],
		    row2 = rows[row2I];
		var m = simTable[row1I][row2I];
		if (lineMovesTable.hasOwnProperty(row1.clustersId)) {
			var part = lineMovesTable[row1.clustersId];
			if (part.hasOwnProperty(row2.clustersId))
				m += part[row2.clustersId];
		}
		return m;
	}

	return sortRows(rows, metric);
}

function storylineLayout(resultData, layoutHeight, marginRows) {
	function makeNodes(rows, spacePerRow) {
		var nodes = [];
		$.each(rows, function (rowI, row) {
			var y = (marginRows / 2 + 0.5 + rowI) * spacePerRow;
			$.each(row.visClusters, function (visClusterI, visCluster) {
				node = {
					visCluster: visCluster,
					linePoints: [],
					y: y
				};
				nodes.push(node);
				// TODO: can we get rid of this back reference?
				visCluster.layoutNode = node;
			});
		});
		return nodes;
	}

	function makeLines(yearsOrder, visClustersByYear) {
		var lineLookup = {},
		    lines = [];
		$.each(yearsOrder, function (yearI, year) {
			$.each(visClustersByYear[year], function (visClusterI, visCluster) {
				$.each(visCluster.entityIds, function (entityIdI, entityId) {
					var node = visCluster.layoutNode;
					var linePoint = {
						node: node,
						y: node.y
					};
					node.linePoints.push(linePoint);
					if (!lineLookup.hasOwnProperty(entityId)) {
						var line = {
							entityId: entityId,
							points: [linePoint]
						};
						lines.push(line);
						lineLookup[entityId] = line;
					} else {
						lineLookup[entityId].points.push(linePoint);
					}
				});
			});
		});
		return lines;
	}

	var entities = extractEntities(resultData);
	var yearsOrder = Object.keys(entities.byYear);
	yearsOrder.sort(function (y1, y2) { return y1 - y2; });
	var visClusters = makeVisClusters(entities.byYear);
	var rows = makeRows(visClusters.all);
	rows = orderRows(yearsOrder, rows, visClusters);
	var spacePerRow = layoutHeight / (rows.length + marginRows);
	var nodes = makeNodes(rows, spacePerRow);
	var lines = makeLines(yearsOrder, visClusters.byYear);

	var maxLinesPerNode = 0;
	$.each(nodes, function (nodeI, node) {
		if (node.linePoints.length > maxLinesPerNode)
			maxLinesPerNode = node.linePoints.length;
	});

	return {
		ySpacePerRow: spacePerRow,
		maxLinesPerNode: maxLinesPerNode,
		entities: entities.all,
		nodes: nodes,
		lines: lines
	}
}

function drawStorylineDiagram(svg, box, clipId, data, layout, layoutHeight, nodeHeight, nodeWidth, lineWidth, drawLabels, doMouseovers, useFieldPrefixes, importantEntities, onSelectNode) {
	var scale = box.height / layoutHeight;

	var draw = svg.append('g')
		.attr('transform', "translate(" + box.x + "," + box.y + ")");

	var xScale = d3.time.scale()
		.range([0, box.width])
		.domain(d3.extent(layout.nodes, function (n) { return n.visCluster.date; }));
	var xAxis = d3.svg.axis()
		.scale(xScale)
		.orient('bottom')
		.tickFormat(timeAxisTickFormater)
		.tickValues(timeAxisTickValues(xScale));

	function classEnitityLines(entityIds, value) {
		draw.selectAll(entityIds.map(function (eid) { return ".line" + eid; }).join(', '))
			.classed('highlight', value);
	}
	function classForLine(line) {
		var e = layout.entities[line.entityId];
		var c = "line line" + line.entityId;
		if (importantEntities.hasOwnProperty(e.field) && importantEntities[e.field].indexOf(e.value) >= 0)
			c += " important";
		return c;
	}

	draw.append('g')
		.attr('class', "x axis ")
		.attr('transform', "translate(0," + box.height + ")")
		.attr('clip-path', "url(#" + clipId + ")")
		.call(xAxis);

	var linesColor = d3.scale.category10();
	var linesLine = d3.svg.line()
		.x(function (p, i) { return xScale(p.node.visCluster.date); })
		.y(function (p) { return p.y * scale; })
		.interpolate('cardinal')
		.tension(0.8);
	var lines = draw.append("g")
		.selectAll(".line")
		.data(layout.lines)
		.enter()
		.append("path")
		.attr('clip-path', "url(#" + clipId + ")")
		.attr("class", classForLine)
		.style('stroke-width', lineWidth)
		.style("stroke", function(l, i) { return linesColor(i); });
	if (doMouseovers)
		lines
			.on("mouseover", function (l) {
				classEnitityLines([l.entityId], true);
			})
			.on("mouseout", function (l) {
				classEnitityLines([l.entityId], false);
			})
			.append("title")
			.text(function (l) { var e = layout.entities[l.entityId]; return "" + (useFieldPrefixes ? e.field + ":" : "") + e.value; });

	var node = draw.append("g")
		.selectAll(".node")
		.data(layout.nodes)
		.enter()
		.append("rect")
		.attr("class", "node")
		.attr('clip-path', "url(#" + clipId + ")");
	if (doMouseovers)
		node
			.on("mouseover", function (n) {
				d3.select(this).classed('highlight', true);
				classEnitityLines(n.visCluster.entityIds, true);
			})
			.on("mouseout", function (n) {
				d3.select(this).classed('highlight', false);
				classEnitityLines(n.visCluster.entityIds, false);
			})
			.append("title")
			.text(function(n) {
				return "" + timeAxisTickFormater(n.visCluster.date)
					+ "\n" + $.map(n.visCluster.entityIds, function (eid, i) { var e = layout.entities[eid]; return "" + (useFieldPrefixes ? e.field + ":" : "") + e.value; }).join("\n")
					+ "\n" + $.map(n.visCluster.clusters, function (v, f) { return f; }).join("\n");
			});
	if (onSelectNode != null)
		node.on("click", onSelectNode);

	var labelGroups = null;
	if (drawLabels) {
		labelGroups = draw.append("g")
			.selectAll(".linelabel")
			.data(layout.lines)
			.enter()
			.append("g")
			.attr('class', function (l) { return "linelabel" + classForLine(l); });
		var text = labelGroups
			.append("text")
			.text(function (l, i) { var e = layout.entities[l.entityId]; return "" + (useFieldPrefixes ? e.field + ":" : "") + e.value; })
			.attr("dy", ".35em");
		if (doMouseovers)
			text
				.on("mouseover", function (l) {
					classEnitityLines([l.entityId], true);
				})
				.on("mouseout", function (l) {
					classEnitityLines([l.entityId], false);
				});
	}

	function update() {
		lines
			.attr("d", function (l) { return linesLine(l.points); });
		node
			.attr("x", function (n) { return xScale(n.visCluster.date) - nodeWidth / 2; })
			.attr("y", function (n) { return n.y * scale; })
			.attr("height", function(n) { return nodeHeight * scale; })
			.attr("width", nodeWidth);
		if (labelGroups != null)
			labelGroups
				.attr('visibility', function (l) {
					if (xScale(l.points[l.points.length - 1].node.visCluster.date) < 0)
						return 'hidden';
					else if (xScale(l.points[0].node.visCluster.date) > box.width)
						return 'hidden';
					else
						return 'visible';
				})
				.attr('text-anchor', function (l) {
					var x = xScale(l.points[0].node.visCluster.date);
					if (x <= 0)
						return 'left';
					else
						return 'middle';
				})
				.attr('transform', function(l) {
					var x = Math.min(box.width, Math.max(0, xScale(l.points[0].node.visCluster.date)));
					return "translate(" + x + "," + (l.points[0].node.y * scale - lineWidth / 2) + ")";
				});
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
	var layoutHeight = detailBox.height;

	var clipId = "timelineclip" + timelineClipNum;
	timelineClipNum++;
	svg.append('defs')
		.append('clipPath')
		.attr('id', clipId)
		.append('rect')
		.attr('width', detailBox.width)
		.attr('height', detailBox.height);

	var layout = storylineLayout(data, layoutHeight, 2);

	var nodeHeight = Math.max(4, layout.ySpacePerRow * 0.9);
	var lineWidth = Math.max(2, nodeHeight / (layout.maxLinesPerNode * 2));

	var detailPlot = drawStorylineDiagram(svg, detailBox, clipId, data, layout, layoutHeight, nodeHeight, nodeWidth, lineWidth, true, true, useFieldPrefixes, importantEntities, onSelectNode);
	var selectPlot = drawStorylineDiagram(svg, selectBox, clipId, data, layout, layoutHeight, nodeHeight, nodeWidth, lineWidth, false, false, useFieldPrefixes, importantEntities, null);

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
			drawStoryline(svg, detailBox, selectBox, data, drawEntityTitlePrefixes, drawImportantEntities, onSelectNode);
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

	// FIXME: testing
	queryEntities = parsePlotlineQueryString("person:Hannibal, person:Scipio Africanus, person: Antiochus III the Great, person:Philip V of Macedon, person:Qin Shi Huang");
	//queryEntities = parsePlotlineQueryString("person:Hannibal, person:Scipio Africanus");
	updateQuery(resultWatcher, null);
}
