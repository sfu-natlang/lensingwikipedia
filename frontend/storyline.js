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

function makeVisClusters(yearsOrder, entitiesByYear) {
	function makeClusterSetId(clusters) {
		var clusterSetId = "";
		$.each(clusters, function (cluster) {
			clusterSetId += "|" + cluster;
		});
		return clusterSetId;
	}

	var visClusters = [],
	    visClustersByYear = {};
	$.each(yearsOrder, function (yearI, year) {
		var clusters = entitiesByYear[year];
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
					entityIds: Object.keys(visCluster.entityIds),
					clusterSetId: makeClusterSetId(visCluster.clusters)
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

function SelfList() {
	this._head = null;
	this._length = 0;
}

SelfList.prototype.length = function() {
	return this._length;
}

SelfList.prototype.each = function(f) {
	for (var node = this._head, i = 0; node != null; node = node.next, i++) {
		f(node, i);
	}
}

SelfList.prototype.pushFirst = function(newNode) {
	newNode.prev = null;
	newNode.next = this._head;
	if (this._head != null)
		this._head.prev = newNode;
	this._head = newNode;
	this._length++;
}

SelfList.prototype.pushBefore = function(before, newNode) {
	if (before.prev == null)
		this._head = newNode;
	else
		before.prev.next = newNode;
	newNode.prev = before.prev;
	newNode.next = before;
	before.prev = newNode;
	this._length++;
}

SelfList.prototype.find = function (pred) {
	for (var node = this._head; node != null; node = node.next) {
		if (pred(node))
			return node;
	}
	return null;
}

SelfList.prototype.max = function (f) {
	var bestNode = null,
	    bestValue = Number.MIN_VALUE;
	for (var node = this._head; node != null; node = node.next) {
		var value = f(node);
		if (value > bestValue) {
			bestNode = node;
			bestValue = value;
		}
	}
	return bestNode;
}

function calcClusterSetAffinity(yearsOrder, visClusters) {
	function clusterOverlap(clusters1, clusters2) {
		var same = 0,
		    notSame = 0;
		$.each(clusters1, function (cluster1) {
			if (clusters2.hasOwnProperty(cluster1))
				same += 1;
			else
				notSame += 1;
		});
		return same / (same + notSame);
	}

	function makeOverlapTable(visClusters) {
		var clusterSetLookup = {};
		$.each(visClusters, function (visClusterI, visCluster) {
			if (!clusterSetLookup.hasOwnProperty(visCluster.clusterSetId)) {
				clusterSetLookup[visCluster.clusterSetId] = visCluster.clusters;
			}
		});

		var table = {};
		$.each(clusterSetLookup, function (clusterSetId, clusterSet) {
			table[clusterSetId] = {};
		});
		$.each(clusterSetLookup, function (clusterSetId1, clusterSet1) {
			$.each(clusterSetLookup, function (clusterSetId2, clusterSet2) {
				if (clusterSetId1 < clusterSetId2) {
					var overlap = clusterOverlap(clusterSet1, clusterSet2);
					table[clusterSetId1][clusterSetId2] = overlap;
				}
			});
		});
		return table;
	}

	function countLineMoves(yearsOrder, visClusters) {
		var lastSeen = {},
		    countTable = {};
		function incrCount(clusterSetId1, clusterSetId2) {
			if (clusterSetId2 < clusterSetId1) {
				var tmp = clusterSetId1;
				clusterSetId1 = clusterSetId2;
				clusterSetId2 = tmp;
			}
			if (!countTable.hasOwnProperty(clusterSetId1))
				countTable[clusterSetId1] = {};
			if (!countTable[clusterSetId1].hasOwnProperty(clusterSetId2))
				countTable[clusterSetId1][clusterSetId2] = 1;
			else
				countTable[clusterSetId1][clusterSetId2] += 1;
		}
		$.each(yearsOrder, function (yearI, year) {
			$.each(visClusters.byYear[year], function (visClusterI, visCluster) {
				$.each(visCluster.entityIds, function (entityIdI, entityId) {
					if (lastSeen.hasOwnProperty(entityId))
						incrCount(lastSeen[entityId], visCluster.clusterSetId);
					lastSeen[entityId] = visCluster.clusterSetId;
				});
			});
		});
		var maxCount = 0;
		$.each(countTable, function (clusterSetId1, part) {
			$.each(part, function (clusterSetId2, count) {
				if (count > maxCount)
					maxCount = count;
			});
		});
		$.each(countTable, function (clusterSetId1, part) {
			$.each(part, function (clusterSetId2, count) {
				part[clusterSetId2] = count / maxCount;
			});
		});
		return countTable;
	}

	var overlapTable = makeOverlapTable(visClusters.all),
	    lineMovesTable = countLineMoves(yearsOrder, visClusters);

	function affinity(clusterSetId1, clusterSetId2) {
		if (clusterSetId2 < clusterSetId1) {
			var tmp = clusterSetId1;
			clusterSetId1 = clusterSetId2;
			clusterSetId2 = tmp;
		}
		var value = overlapTable[clusterSetId1][clusterSetId2];
		if (lineMovesTable.hasOwnProperty(clusterSetId1)) {
			var part = lineMovesTable[clusterSetId1];
			if (part.hasOwnProperty(clusterSetId2))
				value += part[clusterSetId2];
		}
		return value;
	}
	return affinity;
}

function makeInitialSlots(yearsOrder, visClustersByYear, clusterSetAffinity, mergeMinYearDist) {
	var slots = new SelfList(),
	    slotByClusterSetId = {};

	function insertFirstYearVisCluster(visCluster) {
		var newSlot = {
			fixedVisClusters: [visCluster],
			lastClusterSetId: visCluster.clusterSetId
		};
		visCluster.isFixed = true; // TODO: remove after testing
		slotByClusterSetId[visCluster.clusterSetId] = newSlot
		var closest = slots.max(function (slots) {
			return clusterSetAffinity(visCluster.clusterSetId, slots.clusterSetId);
		});
		if (closest != null)
			slots.pushBefore(closest, newSlot);
		else
			slots.pushFirst(newSlot);
	}

	function insertJoinVisCluster(visCluster) {
		visCluster.isFixed = true; // TODO: remove after testing
		if (slotByClusterSetId.hasOwnProperty(visCluster.clusterSetId)) {
			slotByClusterSetId[visCluster.clusterSetId].fixedVisClusters.push(visCluster);
		} else {
			var bestSlot = slots.max(function (slot) {
				return clusterSetAffinity(visCluster.clusterSetId, slot.lastClusterSetId);
			});
			if (bestSlot != null && visCluster.year - bestSlot.fixedVisClusters[bestSlot.fixedVisClusters.length - 1].year >= mergeMinYearDist) {
				bestSlot.fixedVisClusters.push(visCluster);
				bestSlot.lastClusterSetId = visCluster.clusterSetId;
			} else {
				var newSlot = {
					fixedVisClusters: [visCluster],
					lastClusterSetId: visCluster.clusterSetId
				};
				if (bestSlot != null)
					slots.pushBefore(bestSlot, newSlot);
				else
					slots.pushFirst(newSlot);
			}
		}
	}

	$.each(visClustersByYear[yearsOrder[0]], function (visClusterI, visCluster) {
		insertFirstYearVisCluster(visCluster);
	});

	for (var yearI = 1; yearI < yearsOrder.length; yearI++) {
		$.each(visClustersByYear[yearsOrder[yearI]], function (visClusterI, visCluster) {
			if (visCluster.entityIds.length > 1)
				insertJoinVisCluster(visCluster);
		});
	}

	return slots;
}

function storylineLayout(resultData, layoutHeight, layoutMarginLineSpaces, slotMarginLineSpaces, minSlot, hillclimbIters) {
	var mergeMinYearDist = 4;

	var entities = extractEntities(resultData);
	var yearsOrder = Object.keys(entities.byYear);
	yearsOrder.sort(function (y1, y2) { return y1 - y2; });
	var visClusters = makeVisClusters(yearsOrder, entities.byYear);
	var clusterSetAffinity = calcClusterSetAffinity(yearsOrder, visClusters);
	var slots = makeInitialSlots(yearsOrder, visClusters.byYear, clusterSetAffinity, mergeMinYearDist);

	var ySpacePerSlot = layoutHeight / slots.length();
	var ySpacePerLine = ySpacePerSlot;

	var usedVisClusters = [];
	slots.each(function (slot, slotI) {
		$.each(slot.fixedVisClusters, function (visClusterI, visCluster) {
			usedVisClusters.push(visCluster);
		});
	});

	var entityLines = [],
	    lookup = {};
	for (var yearI = 0; yearI < yearsOrder.length; yearI++) {
		$.each(visClusters.byYear[yearsOrder[yearI]], function (visClusterI, visCluster) {
			if (visCluster.isFixed) {
				visCluster.linePoints = [];
				$.each(visCluster.entityIds, function (entityI, entityId) {
					var entityLine = null;
					if (!lookup.hasOwnProperty(entityId)) {
						entityLine = {
							entityId: entityId,
							points: []
						};
						entityLines.push(entityLine);
						lookup[entityId] = entityLine;
					} else {
						entityLine = lookup[entityId];
					}
					if (entityLine.points.length > 0 && visCluster.year - entityLine.points[entityLine.points.length - 1].visCluster.year > 1) {
						var moveLinePoint = {
							visCluster: null,
							year: visCluster.year - 1
						};
						moveLinePoint.date = jsDateOfYear(moveLinePoint.year);
						entityLine.points.push(moveLinePoint);
					}
					var clusterLinePoint = {
						visCluster: visCluster
					};
					entityLine.points.push(clusterLinePoint);
					visCluster.linePoints.push(clusterLinePoint);
				});
			}
		});
	}

	// TODO: margins etc.
	slots.each(function (slot, slotI) {
		slot.y = ySpacePerSlot * (slotI + 0.5);
		$.each(slot.fixedVisClusters, function (visClusterI, visCluster) {
			usedVisClusters.push(visCluster);
			visCluster.y = slot.y;
			visCluster.ySpace = ySpacePerSlot;
			visCluster.ySpacePerLine = ySpacePerSlot / visCluster.linePoints.length;
		});
	});
	$.each(entityLines, function (entityLineI, entityLine) {
		var lastPoint = null;
		$.each(entityLine.points, function (pointI, point) {
			if (point.visCluster != null)
				point.y = point.visCluster.y;
			else
				point.y = lastPoint.y;
			lastPoint = point;
		});
	});

	slots.each(function (slot, slotI) {
		var years = [];
		$.each(slot.fixedVisClusters, function (visClusterI, visCluster) {
			years.push(visCluster.year);
		});
		console.log("slot", slotI, slot.fixedVisClusters.length, years.join(','));
	});
	slots.each(function (slot, slotI) {
		$.each(slot.fixedVisClusters, function (visClusterI, visCluster) {
			console.log("vis cluster", slotI, visClusterI, visCluster.y, visCluster.ySpacePerLine);
		});
	});
	$.each(entityLines, function (entityLineI, entityLine) {
		var years = [];
		$.each(entityLine.points, function (linePointI, linePoint) {
			if (linePoint.visCluster != null)
				years.push(linePoint.visCluster.year);
			else
				years.push(linePoint.year);
		});
		console.log("entity line", entityLineI, entityLine.entityId, entityLine.points.length, years.join(','));
	});

	return {
		entities: entities.all,
		visClusters: usedVisClusters,
		entityLines: entityLines,
		ySpacePerLine: ySpacePerLine
	}
}

function drawStorylineDiagram(svg, box, clipId, data, layout, layoutHeight, ySpacePerLine, nodeWidth, lineWidth, drawLabels, doMouseovers, useFieldPrefixes, importantEntities, onSelectNode) {
	var scale = box.height / layoutHeight;

	var draw = svg.append('g')
		.attr('transform', "translate(" + box.x + "," + box.y + ")");

	var xScale = d3.time.scale()
		.range([0, box.width])
		.domain(d3.extent(layout.visClusters, function (vc) { return vc.date; }));
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

	function buildLinks(entityLines) {
		var links = [];
		$.each(entityLines, function (entityLineI, entityLine) {
			var lastPoint = entityLine.points[0];
			if (lastPoint.visCluster != null) {
				links.push({
					entityId: entityLine.entityId,
					type: 'cluster',
					source: lastPoint,
					target: lastPoint
				});
			}
			for (var pointI = 1; pointI < entityLine.points.length; pointI++) {
				var point = entityLine.points[pointI];
				links.push({
					entityId: entityLine.entityId,
					type: 'connect',
					source: lastPoint,
					target: point
				});
				if (point.visCluster != null) {
					links.push({
						entityId: entityLine.entityId,
						type: 'cluster',
						source: point,
						target: point
					});
				}
				lastPoint = point;
			}
		});
		return links;
	}

	var linesColor = d3.scale.category10();
	var linesLine = d3.svg.diagonal()
		.source(function (l) {
			var xOffset = 0;
			if (l.type == 'cluster')
				xOffset = -nodeWidth / 2;
			else if (l.source.visCluster != null)
				xOffset = nodeWidth / 2;
			var date = l.source.visCluster != null ? l.source.visCluster.date : l.source.date;
			return {
				y: xScale(date) + xOffset,
				x: l.source.y * scale
			};
		})
		.target(function (l) {
			var xOffset = 0;
			if (l.type == 'cluster')
				xOffset = nodeWidth / 2;
			else if (l.target.visCluster != null)
				xOffset = -nodeWidth / 2;
			var date = l.target.visCluster != null ? l.target.visCluster.date : l.target.date;
			return {
				y: xScale(date) + xOffset,
				x: l.target.y * scale
			};
		})
		.projection(function (xy) {
			// We swap x and y above and put them back here to get the right orientation of curves (see http://stackoverflow.com/questions/15007877/how-to-use-the-d3-diagonal-function-to-draw-curved-lines)
			return [xy.y, xy.x];
		});
	var lines = draw.append("g")
		.selectAll(".line")
		.data(buildLinks(layout.entityLines))
		.enter()
		.append("path")
		.attr('clip-path', "url(#" + clipId + ")")
		.attr("class", classForLine)
		.style('stroke-width', lineWidth)
		.style("stroke", function(l, i) { return linesColor(l.entityId); });
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
		.data(layout.visClusters)
		.enter()
		.append("rect")
		.attr("class", "node")
		.attr('clip-path', "url(#" + clipId + ")");
	if (doMouseovers)
		node
			.on("mouseover", function (vc) {
				d3.select(this).classed('highlight', true);
				classEnitityLines(vc.entityIds, true);
			})
			.on("mouseout", function (vc) {
				d3.select(this).classed('highlight', false);
				classEnitityLines(vc.entityIds, false);
			})
			.append("title")
			.text(function(vc) {
				return "" + timeAxisTickFormater(vc.date)
					+ "\n" + $.map(vc.entityIds, function (eid, i) { var e = layout.entities[eid]; return "" + (useFieldPrefixes ? e.field + ":" : "") + e.value; }).join("\n")
					+ "\n" + $.map(vc.clusters, function (v, f) { return f; }).join("\n");
			});
	if (onSelectNode != null)
		node.on("click", onSelectNode);

	var labelGroups = null;
	if (drawLabels) {
		labelGroups = draw.append("g")
			.selectAll(".linelabel")
			.data(layout.entityLines)
			.enter()
			.append("g")
			.attr('class', function (l) { return "linelabel" + classForLine(l); });
		var text = labelGroups
			.append("text")
			.text(function (l, i) { var e = layout.entities[l.entityId]; return "" + (useFieldPrefixes ? e.field + ":" : "") + e.value; })
			.attr("dy", ".35em")
			.style('pointer-events', 'none');
	}

	function update() {
		lines
			.attr("d", linesLine);
		node
			.attr("x", function (vc) {
				return xScale(vc.date) - nodeWidth / 2;
			})
			.attr("y", function (vc) {
				return (vc.y + (vc.ySpace - Math.min(ySpacePerLine, vc.ySpacePerLine) * vc.linePoints.length) / 2) * scale;
			})
			.attr("height", function(vc) {
				return (Math.min(ySpacePerLine, vc.ySpacePerLine) * vc.linePoints.length) * scale;
			})
			.attr("width", nodeWidth);
		if (labelGroups != null)
			labelGroups
				.attr('visibility', function (l) {
					if (xScale(l.points[l.points.length - 1].date) < 0)
						return 'hidden';
					else if (xScale(l.points[0].visCluster.date) > box.width)
						return 'hidden';
					else
						return 'visible';
				})
				.attr('text-anchor', function (l) {
					var x = xScale(l.points[0].visCluster.date);
					if (x <= 0)
						return 'left';
					else
						return 'middle';
				})
				.attr('transform', function(l) {
					var x = Math.min(box.width, Math.max(0, xScale(l.points[0].visCluster.date)));
					return "translate(" + x + "," + (l.points[0].y * scale - lineWidth / 2) + ")";
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
	var nodeWidth = detailBox.width * 0.01,
	    layoutHeight = detailBox.height,
	    hillclimbIters = 2,
			layoutMarginLineSpaces = 4,
	    slotMarginLineSpaces = 0.4,
			minSlotYSpace = 8,
			minLineWidth = 1,
			lineWidthAsFracOfSpace = 0.25;

	var clipId = "timelineclip" + timelineClipNum;
	timelineClipNum++;
	svg.append('defs')
		.append('clipPath')
		.attr('id', clipId)
		.append('rect')
		.attr('width', detailBox.width)
		.attr('height', detailBox.height);

	var layout = storylineLayout(data, layoutHeight, layoutMarginLineSpaces, slotMarginLineSpaces, minSlotYSpace, hillclimbIters);
	// TODO
	//var lineWidth = Math.max(minLineWidth, layout.ySpacePerLine * lineWidthAsFracOfSpace);
	var lineWidth = 4;

	var detailPlot = drawStorylineDiagram(svg, detailBox, clipId, data, layout, layoutHeight, layout.ySpacePerLine, nodeWidth, lineWidth, true, true, useFieldPrefixes, importantEntities, onSelectNode);
	var selectPlot = drawStorylineDiagram(svg, selectBox, clipId, data, layout, layoutHeight, layout.ySpacePerLine, nodeWidth, lineWidth, false, false, useFieldPrefixes, importantEntities, null);

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
