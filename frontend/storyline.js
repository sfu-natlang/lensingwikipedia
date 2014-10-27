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

function calcEntityPriority(yearsOrder, visClustersByYear, entities, importantEntities) {
	var priorityTable = {};

	$.each(yearsOrder, function (yearI, year) {
		$.each(visClustersByYear[year], function (visClusterI, visCluster) {
			$.each(visCluster.entityIds, function (entityIdI, entityId) {
				if (!priorityTable.hasOwnProperty(entityId))
					priorityTable[entityId] = 0;
				priorityTable[entityId] += visCluster.entityIds.length - 1;
			});
		});
	});

	$.each(entities.all, function (entityId, entity) {
		if (importantEntities.hasOwnProperty(entity.field) && importantEntities[entity.field].indexOf(entity.value) >= 0)
			priorityTable[entityId] *= 2;
	});

	return function(entityId) {
		if (priorityTable.hasOwnProperty(entityId))
			return priorityTable[entityId];
		else
			return 0;
	}
}

function prioritizeNodes(yearsOrder, nodesByYear, entityPriority) {
	for (var yearI = 0; yearI < yearsOrder.length; yearI++) {
		var year = +yearsOrder[yearI],
				yearNodes = nodesByYear[year];
		$.each(yearNodes, function (nodeI, node) {
			node.priority = 0;
			$.each(node.entityIds, function (entityIdI, entityId) {
				node.priority += entityPriority(entityId);
			});
		});
		yearNodes.sort(function (vc1, vc2) { return vc2.priority - vc1.priority; });
	}
}

function makeFullNodes(yearsOrder, visClustersByYear, allEntities) {
	// Here a node will be either a vis cluster or a filler node so that every entity has a node at each year

	function findEntityFirstLastYears(yearsOrder, visClustersByYear) {
		var firstYears = {},
		    lastYears = {};
		for (var yearI = 0; yearI < yearsOrder.length; yearI++) {
			var year = +yearsOrder[yearI],
			    yearVisClusters = visClustersByYear[year];
			$.each(yearVisClusters, function (visClusterI, visCluster) {
				$.each(visCluster.entityIds, function (entityIdI, entityId) {
					if (!firstYears.hasOwnProperty(entityId))
						firstYears[entityId] = year;
					lastYears[entityId] = year;
				});
			});
		}
		return {
			first: firstYears,
			last: lastYears
		};
	}

	var entityYears = findEntityFirstLastYears(yearsOrder, visClustersByYear);
	var nodesByYear = {};
	for (var yearI = 0; yearI < yearsOrder.length; yearI++) {
		var year = +yearsOrder[yearI],
				yearVisClusters = visClustersByYear[year],
				yearNodes = [],
				seen = {};
		nodesByYear[year] = yearNodes;
		$.each(yearVisClusters, function (visClusterI, visCluster) {
			yearNodes.push(visCluster);
			$.each(visCluster.entityIds, function (entityIdI, entityId) {
				seen[entityId] = true;
			});
		});
		$.each(allEntities, function (entityId) {
			if (!seen.hasOwnProperty(entityId) && year >= entityYears.first[entityId] && year <= entityYears.last[entityId]) {
				yearNodes.push({
					isFiller: true,
					year: year,
					date: jsDateOfYear(year),
					entityIds: [entityId]
				});
			}
		});
	}
	return nodesByYear;
}

function makeEntityLines(yearsOrder, nodesByYear) {
	var entityLines = [],
	    lookup = {};
	for (var yearI = 0; yearI < yearsOrder.length; yearI++) {
		var year = +yearsOrder[yearI],
				yearNodes = nodesByYear[year];
		$.each(yearNodes, function (nodeI, node) {
			node.linePoints = {};
			$.each(node.entityIds, function (entityIdI, entityId) {
				var entityLine = null;
				if (lookup.hasOwnProperty(entityId)) {
					entityLine = lookup[entityId];
				} else {
					entityLine = {
						entityId: entityId,
						points: []
					};
					entityLines.push(entityLine);
					lookup[entityId] = entityLine;
				}
				var linePoint = {
					node: node
				};
				entityLine.points.push(linePoint);
				node.linePoints[entityId] = linePoint;
			});
		});
	}
	return entityLines;
}

function slottifyNodes(yearsOrder, nodesByYear, entityPriority) {
	function insertSlot(slots, index) {
		slots.splice(index, 0, {
			index: index,
			linePoints: [],
			lastUsedYear: null
		});
		for (var i = index + 1; i < slots.length; i++)
			slots[i].index = i;
	}

	function makeTopSpace(slots, numSlots, forceNew) {
		var slotsToAdd = numSlots;
		if (!forceNew) {
			for (var i = 0; i < numSlots && i < slots.length; i++) {
				if (slots[i].lastUsedYear != year)
					slotsToAdd--;
				else
					break;
			}
		}
		for (var i = 0; i < slotsToAdd; i++) {
			slots.unshift({
				index: i,
				linePoints: [],
				lastUsedYear: null
			});
		}
		for (var i = slotsToAdd; i < slots.length; i++)
			slots[i].index = i;
		return 0;
	}

	function makeBottomSpace(slots, numSlots, forceNew) {
		var slotsToAdd = numSlots;
		if (!forceNew) {
			for (var i = 0; i < numSlots && i < slots.length; i++) {
				if (slots[slots.length - 1 - i].lastUsedYear != year)
					slotsToAdd--;
				else
					break;
			}
		}
		var origLength = slots.length;
		for (var i = 0; i < slotsToAdd; i++) {
			slots.push({
				index: slots.length,
				linePoints: [],
				lastUsedYear: null
			});
		}
		return slots.length - numSlots;
	}

	function updateDesiredPositions(nodes, lastSeenEntities) {
		$.each(nodes, function (nodeI, node) {
			var total = 0,
			    samples = 0;
			$.each(node.entityIds, function (entityIdI, entityId) {
				if (lastSeenEntities.hasOwnProperty(entityId)) {
					total += lastSeenEntities[entityId].index;
					samples += 1;
				}
			});
			node.desiredSlotIndex = samples > 0 ? Math.round(total / samples) : undefined;
		});
	}

	function closestAvailPosition(slots, year, wantIndex, numSlots) {
		// The code complexity here is to minimize the number of slots that we have to look at before stopping

		var bestIndex = null,
		    bestDist = Number.MAX_VALUE;

		var atWantUsedI = null;
		    atWantIsAvail = true;
		for (atWantUsedI = wantIndex; atWantUsedI < wantIndex + numSlots; atWantUsedI++) {
			if (atWantUsedI == slots.length || slots[atWantUsedI].lastUsedYear == year) {
				atWantIsAvail = false;
				break;
			}
		}
		if (atWantIsAvail)
			return wantIndex;

		for (var i = Math.min(slots.length, wantIndex + numSlots) - 1; i >= numSlots - 1; i--) {
			var usedI = null,
			    isAvail = true;
			for (usedI = i; usedI > i - numSlots; usedI--) {
				if (slots[usedI].lastUsedYear == year) {
					isAvail = false;
					break;
				}
			}
			var startI = i - numSlots + 1,
			    dist = Math.abs(wantIndex - startI);
			if (isAvail) {
				bestIndex = startI;
				bestDist = dist;
				break;
			} else {
				i = usedI;
			}
		}

		for (var i = wantIndex + 1; i < slots.length - numSlots + 1; i++) {
			var usedI = null,
			    isAvail = true;
			for (usedI = i; usedI < i + numSlots; usedI++) {
				if (slots[usedI].lastUsedYear == year) {
					isAvail = false;
					break;
				}
			}
			var dist = Math.abs(wantIndex - i);
			if (bestDist != null && dist >= bestDist)
				break;
			if (isAvail) {
				bestIndex = i;
				bestDist = dist;
				break;
			} else {
				i = usedI;
			}
		}

		return bestIndex;
	}

	function clearSlotsLastUsed(slots) {
		for (var slotI = 0; slotI < slots.length; slotI++)
			slots[slotI].lastUsedYear = null;
	}

	function handleYearNodes(year, yearNodes, slots, lastSeenEntities) {
		$.each(yearNodes, function (nodeI, node) {
			var insertI = null;
			if (node.desiredSlotIndex == null) {
				insertI = makeBottomSpace(slots, node.entityIds.length, true);
			} else {
				insertI = closestAvailPosition(slots, year, node.desiredSlotIndex, node.entityIds.length);
				if (insertI == null) {
					if (insertI < slots.length / 2)
						insertI = makeTopSpace(slots, node.entityIds.length);
					else
						insertI = makeBottomSpace(slots, node.entityIds.length);
				}
			}
			node.entityIds.sort(function (eid1, eid2) {
				if (lastSeenEntities.hasOwnProperty(eid1) && lastSeenEntities.hasOwnProperty(eid2))
					return lastSeenEntities[eid1].index - lastSeenEntities[eid2].index;
			});
			if (insertI != null) {
				node.startSlot = slots[insertI];
				for (var entityIdI = 0; entityIdI < node.entityIds.length; entityIdI++) {
					var entityId = node.entityIds[entityIdI],
					    slot = slots[insertI + entityIdI];
					node.linePoints[entityId].slot = slot;
					slot.lastUsedYear = year;
					lastSeenEntities[entityId] = slot;
				}
			} else {
				console.log("error: unable to place node", year, nodeI);
			}
		});
	}

	var slots = [],
	    lastSeenEntities = {};
	for (var yearI = 0; yearI < yearsOrder.length; yearI++) {
		var year = +yearsOrder[yearI];
		    yearNodes = nodesByYear[year];
		updateDesiredPositions(yearNodes, lastSeenEntities);
		handleYearNodes(year, yearNodes, slots, lastSeenEntities);
	}
	clearSlotsLastUsed(slots);
	for (var yearI = yearsOrder.length - 1; yearI >= 0; yearI--) {
		var year = +yearsOrder[yearI];
		    yearNodes = nodesByYear[year];
		updateDesiredPositions(yearNodes, lastSeenEntities);
		handleYearNodes(year, yearNodes, slots, lastSeenEntities);
	}

	return slots;
}

function storylineLayout(resultData, importantEntities) {
	var mergeMinYearDist = 4;

	var entities = extractEntities(resultData);
	var yearsOrder = Object.keys(entities.byYear);
	yearsOrder.sort(function (y1, y2) { return y1 - y2; });
	var visClusters = makeVisClusters(yearsOrder, entities.byYear);
	var nodesByYear = makeFullNodes(yearsOrder, visClusters.byYear, entities.all);
	var entityLines = makeEntityLines(yearsOrder, nodesByYear);
	var entityPriority = calcEntityPriority(yearsOrder, visClusters.byYear, entities, importantEntities);
	prioritizeNodes(yearsOrder, nodesByYear, entityPriority);
	var slots = slottifyNodes(yearsOrder, nodesByYear, entityPriority);

	return {
		entities: entities.all,
		visClusters: visClusters.all,
		entityLines: entityLines,
		numSlots: slots.length
	}
}

function drawStorylineDiagram(svg, box, clipId, data, layout, layoutHeight, ySlotOffset, ySpacePerSlot, nodeWidth, lineWidth, drawLabels, doMouseovers, useFieldPrefixes, importantEntities, onSelectNode) {
	var scale = box.height / layoutHeight;

	var draw = svg.append('g')
		.attr('transform', "translate(" + box.x + "," + box.y + ")");

	var xExtent = d3.extent(layout.visClusters, function (vc) { return vc.date; });
	xExtent = [new Date(xExtent[0]), new Date(xExtent[1])];
	xExtent[0].setFullYear(xExtent[0].getFullYear() - 1);
	xExtent[1].setFullYear(xExtent[1].getFullYear() + 1);
	var xScale = d3.time.scale()
		.range([0, box.width])
		.domain(xExtent);
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

	function slotY(slot) {
		return (ySlotOffset + slot.index) * ySpacePerSlot * scale;
	}
	function slotsDY(numSlots) {
		return numSlots * ySpacePerSlot * scale;
	}
	var yLineOffset = (ySpacePerSlot / 2) * scale,
	    yNodeOffset = (ySpacePerSlot * 0.1) * scale;

	function buildLinks(entityLines) {
		var links = [];
		$.each(entityLines, function (entityLineI, entityLine) {
		entityLine  = entityLines[entityLineI];
			var lastPoint = entityLine.points[0];
			if (!lastPoint.node.isFiller) {
				links.push({
					entityId: entityLine.entityId,
					type: 'cluster',
					source: lastPoint,
					target: lastPoint
				});
			}
			for (var pointI = 1; pointI < entityLine.points.length; pointI++) {
				var point = entityLine.points[pointI];
				if (!point.node.isFiller || point.slot != lastPoint.slot) {
					if (point.node.year - lastPoint.node.year > 1) {
						var movePoint = entityLine.points[pointI - 1];
						if (point.node.year - movePoint.node.year > 1) {
							var moveDate = new Date(point.node.date);
							moveDate.setFullYear(moveDate.getFullYear() - 1);
							var movePoint = {
								node: {
									date: moveDate,
									isFiller: true
								},
								slot: lastPoint.slot
							};
						}
						links.push({
							entityId: entityLine.entityId,
							type: 'connectpart1',
							source: lastPoint,
							target: movePoint
						});
						lastPoint = movePoint;
					}
					links.push({
						entityId: entityLine.entityId,
						type: 'connect',
						source: lastPoint,
						target: point
					});
					lastPoint = point;
				}
				if (!point.node.isFiller) {
					links.push({
						entityId: entityLine.entityId,
						type: 'cluster',
						source: point,
						target: point
					});
				}
			}
		});

		return links;
	}

	var linesColor = d3.scale.category10()
	var linesLine = d3.svg.diagonal()
		.source(function (l) {
			var xOffset = 0;
			if (l.type == 'cluster')
				xOffset = -nodeWidth / 2;
			else if (!l.source.node.isFiller)
				xOffset = nodeWidth / 2;
			return {
				y: xScale(l.source.node.date) + xOffset,
				x: slotY(l.source.slot) + yLineOffset
			};
		})
		.target(function (l) {
			var xOffset = 0;
			if (l.type == 'cluster')
				xOffset = nodeWidth / 2;
			else if (!l.target.node.isFiller)
				xOffset = -nodeWidth / 2;
			return {
				y: xScale(l.target.node.date) + xOffset,
				x: slotY(l.target.slot) + yLineOffset
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
			.attr('class', function (l) { return "linelabel" + classForLine(l); })
			.style("stroke", function(l, i) { return linesColor(l.entityId); });
		labelGroups
			.append("text")
			.text(function (l, i) { var e = layout.entities[l.entityId]; return "" + (useFieldPrefixes ? e.field + ":" : "") + e.value; })
			.attr("dy", ".35em")
			.style('pointer-events', 'none');
	}

	function update() {
		lines
			.attr("d", linesLine);
		node
			.attr("x", function (vc) { return xScale(vc.date) - nodeWidth / 2; })
			.attr("y", function (vc) { return slotY(vc.startSlot) + yNodeOffset; })
			.attr("height", function(vc) { return slotsDY(vc.entityIds.length) - yNodeOffset * 2; })
			.attr("width", nodeWidth);
		if (labelGroups != null)
			labelGroups
				.attr('visibility', function (l) {
					if (xScale(l.points[l.points.length - 1].date) < 0)
						return 'hidden';
					else if (xScale(l.points[0].node.date) > box.width)
						return 'hidden';
					else
						return 'visible';
				})
				.attr('text-anchor', function (l) {
					var x = xScale(l.points[0].node.date);
					if (x <= 0)
						return 'left';
					else
						return 'middle';
				})
				.attr('transform', function(l) {
					var x = Math.min(box.width, Math.max(0, xScale(l.points[0].node.date))),
					    y = slotY(l.points[0].slot) + yLineOffset;
					return "translate(" + x + "," + (y - lineWidth / 2) + ")";
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
			layoutMarginSlots = 4,
			lineWidth = 4;

	var clipId = "timelineclip" + timelineClipNum;
	timelineClipNum++;
	svg.append('defs')
		.append('clipPath')
		.attr('id', clipId)
		.append('rect')
		.attr('width', detailBox.width)
		.attr('height', detailBox.height);

	var layout = storylineLayout(data, importantEntities);
	var ySpacePerSlot = layoutHeight / (layout.numSlots + layoutMarginSlots);
	var ySlotOffset = layoutMarginSlots / 2;

	var detailPlot = drawStorylineDiagram(svg, detailBox, clipId, data, layout, layoutHeight, ySlotOffset, ySpacePerSlot, nodeWidth, lineWidth, true, true, useFieldPrefixes, importantEntities, onSelectNode);
	var selectPlot = drawStorylineDiagram(svg, selectBox, clipId, data, layout, layoutHeight, ySlotOffset, ySpacePerSlot, nodeWidth, lineWidth, false, false, useFieldPrefixes, importantEntities, null);

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
}
