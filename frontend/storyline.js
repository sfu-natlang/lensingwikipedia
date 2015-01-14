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

var storylineQueryHelpText = " \
	<strong>Query format:</strong> \
	A query is a list of entities separated by spaces. An entity is determined by a field name and value separated by a colon. For example: \
	<blockquote> \
		person:Hannibal, person:Philip V of Macedon \
	</blockquote> \
	List of fields:  \
	<ul class=\"fieldexamples\"> \
	</ul> \
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
					if (clusters.length > 0) {
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
					}
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

/*
 * Do complete layout.
 */
function makeLayout(data, importantEntities, layoutHeight, layoutMarginSlots) {
	function getImportantEntityIds(entities) {
		var importantEntityIds = [];
		$.each(entities, function (entityId, entity) {
			if (importantEntities.hasOwnProperty(entity.field) && importantEntities[entity.field].indexOf(entity.value) >= 0)
				importantEntityIds.push(entityId);
		});
		return importantEntityIds;
	}

	function findXExtent(visClusters, pad) {
		var xExtent = d3.extent(visClusters, function (vc) { return vc.date; });
		xExtent = [new Date(xExtent[0]), new Date(xExtent[1])];
		xExtent[0].setFullYear(xExtent[0].getFullYear() - pad);
		xExtent[1].setFullYear(xExtent[1].getFullYear() + pad);
		return xExtent;
	}

	var entities = extractEntities(data),
	    yearsOrder = Object.keys(entities.byYear);

	yearsOrder.sort(function (y1, y2) { return y1 - y2; });
	var importantEntityIds = getImportantEntityIds(entities.all),
	    visClusters = makeVisClusters(yearsOrder, entities.byYear);
	var layout = storylinelayout.layout(yearsOrder, Object.keys(entities.all), visClusters.byYear, function (n) { return n.entityIds; }, importantEntityIds);
	storylinelayout.normalizeEntityLineFillerVisNodes(layout);
	layout.entityLineLinks = storylinelayout.makeEntityLineLinks(layout.entityLines);
	layout.entities = entities.all;
	layout.visClusters = visClusters.all;
	layout.ySpacePerSlot = layoutHeight / (layout.slots.length + layoutMarginSlots),
	layout.ySlotOffset = layoutMarginSlots / 2;
	layout.xExtent = findXExtent(visClusters.all, 1);

	// Add dummy input nodes (ie vis clusters) to output vis nodes for ease of drawing
	$.each(layout.visNodes, function (visNodeI, visNode) {
		if (visNode.isFiller) {
			visNode.node = {
				year: visNode.time,
				date: jsDateOfYear(visNode.time)
			}
		}
	});

	return layout;
}

function drawStorylineDiagram(svg, box, clipId, data, layout, layoutHeight, nodeWidth, lineWidth, drawLabels, doMouseovers, useFieldPrefixes, importantEntities, onChooseNode, onChooseEntityLine) {
	var yScale = box.height / layoutHeight;

	var draw = svg.append('g')
		.attr('transform', "translate(" + box.x + "," + box.y + ")");

	var xScale = d3.time.scale()
		.range([0, box.width])
		.domain(layout.xExtent);
	var xAxis = d3.svg.axis()
		.scale(xScale)
		.orient('bottom')
		.tickFormat(timeAxisTickFormater)
		.tickValues(timeAxisTickValues(xScale));

	function classEnitityLines(entityIds, value, classname) {
		draw.selectAll(entityIds.map(function (eid) { return ".line" + eid; }).join(', '))
			.classed(classname, value);
	}
	function classForEntityLine(line) {
		var e = layout.entities[line.entityId];
		var c = "line line" + line.entityId;
		if (importantEntities.hasOwnProperty(e.field) && importantEntities[e.field].indexOf(e.value) >= 0)
			c += " important";
		return c;
	}
	function classForNode(visNode) {
		return "node node" + visNode.node.key;
	}

	draw.append('g')
		.attr('class', "x axis ")
		.attr('transform', "translate(0," + box.height + ")")
		.attr('clip-path', "url(#" + clipId + ")")
		.call(xAxis);

	function slotY(slotIndex) {
		return (layout.ySlotOffset + slotIndex) * layout.ySpacePerSlot * yScale;
	}
	function slotsDY(numSlots) {
		return numSlots * layout.ySpacePerSlot * yScale;
	}
	var yLineOffset = (layout.ySpacePerSlot / 2) * yScale,
	    yNodeOffset = (layout.ySpacePerSlot * 0.1) * yScale;

	var linesColour = d3.scale.category10()
	var linesLine = d3.svg.diagonal()
		.source(function (l) {
			return {
				y: xScale(l.source.visNode.node.date),
				x: slotY(l.source.slot.index) + yLineOffset
			};
		})
		.target(function (l) {
			return {
				y: xScale(l.target.visNode.node.date),
				x: slotY(l.target.slot.index) + yLineOffset
			};
		})
		.projection(function (xy) {
			// We swap x and y above and put them back here to get the right orientation of curves (see http://stackoverflow.com/questions/15007877/how-to-use-the-d3-diagonal-function-to-draw-curved-lines)
			return [xy.y, xy.x];
		});
	var lines = draw.append("g")
		.selectAll(".line")
		.data(layout.entityLineLinks)
		.enter()
		.append("path")
		.attr('clip-path', "url(#" + clipId + ")")
		.attr("class", function (l) { return classForEntityLine(l.entityLine); })
		.style('stroke-width', lineWidth)
		.style("stroke", function(l, i) { return linesColour(l.entityLine.entityId); });
	if (doMouseovers)
		lines
			.on("mouseover", function (l) {
				classEnitityLines([l.entityLine.entityId], true, 'highlight');
			})
			.on("mouseout", function (l) {
				classEnitityLines([l.entityLine.entityId], false, 'highlight');
			})
			.append("title")
			.text(function (l) { var e = layout.entities[l.entityLine.entityId]; return "" + (useFieldPrefixes ? e.field + ":" : "") + e.value; });
	var node = draw.append("g")
		.selectAll(".node")
		.data(layout.visNodesForInputNodes)
		.enter()
		.append("rect")
		.attr("class", classForNode)
		.attr('clip-path', "url(#" + clipId + ")");
	if (doMouseovers)
		node
			.on("mouseover", function (vn) {
				d3.select(this).classed('highlight', true);
				classEnitityLines(vn.node.entityIds, true, 'highlight');
			})
			.on("mouseout", function (vn) {
				d3.select(this).classed('highlight', false);
				classEnitityLines(vn.node.entityIds, false, 'highlight');
			})
			.append("title")
			.text(function(vn) {
				return "" + timeAxisTickFormater(vn.node.date)
					+ "\n" + $.map(vn.node.entityIds, function (eid, i) { var e = layout.entities[eid]; return "" + (useFieldPrefixes ? e.field + ":" : "") + e.value; }).join("\n")
					+ "\n" + $.map(vn.node.clusters, function (v, f) { return f; }).join("\n");
			});

	if (onChooseNode != null)
		node.on("click", function (n) { return onChooseNode(n.node); });
	if (onChooseEntityLine != null)
		lines.on("click", function (el) { return onChooseEntityLine(el.entityLine); });
	function selectNodes(nodeKeys, areSelected) {
		if (nodeKeys.length > 0)
			draw.selectAll(nodeKeys.map(function (nk) { return ".node" + nk; }).join(', '))
				.classed('selected', areSelected);
	}
	function selectEntities(entityIds, areSelected) {
		if (entityIds.length > 0)
			draw.selectAll(entityIds.map(function (eid) { return ".line" + eid; }).join(', '))
				.classed('selected', areSelected);
	}

	var updateLabelGroups = null;
	function makeLabels(entityLines) {
		return $.map(entityLines, function (entityLine) {
			return {
				entityLine: entityLine
			};
		});
	}
	if (drawLabels) {
		var labels = makeLabels(layout.entityLines);
		labelGroups = draw.append("g")
			.selectAll(".linelabel")
			.data(labels)
			.enter()
			.append("g")
			.attr('class', function (l) { return "linelabel" + classForEntityLine(l.entityLine); })
			.style('stroke', function(l, i) { return linesColour(l.entityLine.entityId); })
			.attr('text-anchor', 'middle');
		var labelText = labelGroups
			.append("text")
			.text(function (l, i) { var e = layout.entities[l.entityLine.entityId]; return "" + (useFieldPrefixes ? e.field + ":" : "") + e.value; })
			.attr("dy", ".35em")
			.style('pointer-events', 'none');
		updateLabelGroups = function (scaleWidthChanged) {
			if (scaleWidthChanged) {
				labelText.each(function (label) {
					label.date = label.entityLine.points[0].visNode.node.date;
					label.slotIndex = label.entityLine.points[0].slot.index;
					label.width = this.getBBox().width;
				});
				storylinelayout.layoutLabels(labels, layout.slots.length,
						[xScale(layout.xExtent[0]), xScale(layout.xExtent[1])],
						function (l) { return xScale(l.date); },
						function (l, x) { l.date = xScale.invert(x); }
					);
			}
			labelGroups
				.attr('transform', function(l) {
					var x = xScale(l.date),
					    y = slotY(l.slotIndex) + yLineOffset;
					return "translate(" + x + "," + y + ")";
				});
		}
	}

	function update(scaleWidthChanged) {
		lines
			.attr("d", linesLine);
		node
			.attr("x", function (vn) { return xScale(vn.node.date) - nodeWidth / 2; })
			.attr("y", function (vn) { return slotY(vn.startSlot.index) + yNodeOffset; })
			.attr("height", function(vn) { return slotsDY(vn.node.entityIds.length) - yNodeOffset * 2; })
			.attr("width", nodeWidth);
		if (updateLabelGroups != null)
			updateLabelGroups(scaleWidthChanged);
	}
	update(true);

	var lastXDomainWidth = null,
	    cumXDomWidthChange = 0;
	function updateX(newXDomain) {
		var newXDomainWidth = newXDomain[1] - newXDomain[0],
		    xDomWidthChange = newXDomainWidth - lastXDomainWidth;
		// We try to filter out spurious x domain width changes since there seems to be some jitter
		cumXDomWidthChange += xDomWidthChange;
		var isRealChange = Math.abs(cumXDomWidthChange) > 1;
		if (isRealChange)
			cumXDomWidthChange = 0;
		xScale.domain(newXDomain);
		draw.select('.x.axis').call(xAxis);
		update(isRealChange);
		lastXDomainWidth = newXDomainWidth;
	}

	return {
		draw: draw,
		scales: { x: xScale },
		updateX: updateX,
		selectNodes: selectNodes,
		selectEntities: selectEntities
	};
}

/*
 * Draw the whole visualization.
 */
function drawStoryline(svg, detailBox, selectBox, data, initialBrushExtent, useFieldPrefixes, importantEntities, onSelectNode, onSelectEntityLine, brushCallback) {
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
	
	var layout = makeLayout(data, importantEntities, layoutHeight, layoutMarginSlots);

	function stringHash(string) {
		// Same string hash function that Java uses
		// http://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript-jquery
		// http://en.wikipedia.org/wiki/Java_hashCode()
		if (string.length == 0)
			return 0;
		var hash = 0;
		for (var i = 0; i < string.length; i++) {
			hash = ((hash << 5) - hash) + string.charCodeAt(i);
			hash |= 0;
		}
		return hash;
	}
	function keyVisClusters(visClusters) {
		var knownKeys = {};
		$.each(visClusters, function (visClusterI, visCluster) {
			// Generate unique keys for each cluster, hashing so we can use them in HTML class names without worry
			visCluster.key = stringHash("" + visCluster.year + ":" + visCluster.clusterSetId);
			knownKeys[visCluster.key] = true;
		});
		return knownKeys;
	}
	function findKnownEntities(entities) {
		var knownEntities = {};
		$.each(entities, function (entityI, entity) {
			if (!knownEntities.hasOwnProperty(entity.field))
				knownEntities[entity.field] = {};
			knownEntities[entity.field][entity.value] = true;
		});
		return knownEntities;
	}
	var knownVisClusterKeys = keyVisClusters(layout.visClusters),
			knownEntities = findKnownEntities(layout.entities);

	var detailPlot = drawStorylineDiagram(svg, detailBox, clipId, data, layout, layoutHeight, nodeWidth, lineWidth, true, true, useFieldPrefixes, importantEntities, onSelectNode, onSelectEntityLine);
	var selectPlot = drawStorylineDiagram(svg, selectBox, clipId, data, layout, layoutHeight, nodeWidth, lineWidth, false, false, useFieldPrefixes, importantEntities, null, null);

	var brush = null;
	function updateBrush() {
		detailPlot.updateX(brush.empty() ? selectPlot.scales.x.domain() : brush.extent());
	}
	function onBrush() {
		updateBrush();
		brushCallback(brush.empty() ? null : brush.extent());
	}
	brush = d3.svg.brush()
		.x(selectPlot.scales.x)
		.on('brush', onBrush);
	if (initialBrushExtent != null) {
		brush.extent(initialBrushExtent);
		updateBrush();
	}
	selectPlot.draw.append('g')
		.attr('class', 'x brush')
		.call(brush)
		.selectAll('rect')
		.attr('y', -2)
		.attr('height', selectBox.height + 6);

	return {
		update: onBrush,
		selectNodes: detailPlot.selectNodes,
		selectEntities: detailPlot.selectEntities,
		checkVisClusterKey: function (k) { return knownVisClusterKeys.hasOwnProperty(k); },
		checkEntity: function (n, v) { return knownEntities.hasOwnProperty(n) && knownEntities[n].hasOwnProperty(v); },
		lookupEntity: function(eid) { return layout.entities[eid]; }
	};
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

	facets = facets.filter(function (facet) {
		return storylineUseFacets.indexOf(facet.field) >= 0;
	});

	var outerElt = $("<div class=\"storyline\"></div>").appendTo(container);
	var topBoxElt = $("<div class=\"topbox\"></div>").appendTo(outerElt);
	var loadingIndicator = new LoadingIndicator(outerElt);
	var outerSvgElt = $("<svg class=\"outersvg\"></svg>").appendTo(outerElt);
	var svgElt = $("<svg class=\"innersvg\" viewBox=\"" + viewBox.x + " " + viewBox.y + " " + viewBox.width + " " + viewBox.height + "\" preserveAspectRatio=\"none\"></svg>").appendTo(outerSvgElt);
	var facetHelpElt = $("<div class=\"alert alert-warning alert-dismissable\"></div>").appendTo(outerElt);
	var queryHelpElt = $("<div class=\"alert alert-warning alert-dismissable\"></div>").appendTo(outerElt);

	var formElt = $("<form></form>").appendTo(topBoxElt);
	var clearSelElt = $("<button type=\"button\" class=\"btn btn-mini btn-warning clear mapclear\" title=\"Clear the map selection.\">Clear selection</button>").appendTo(formElt);
	var modeElt = $("<select class=\"btn btn-mini\"></select>").appendTo(formElt);
	var statusElt = $("<span class=\"status\"></span>").appendTo(formElt);
	var queryFormElt = $("<form class=\"query\"></form>").appendTo(topBoxElt);
	var clearQueryElt = $("<button type=\"button\" class=\"btn btn-warning\" title=\"Clear the visualization\">Clear</button></ul>").appendTo(queryFormElt);
	var updateElt = $("<button type=\"submit\" class=\"btn btn-primary\" title=\"Update the visualization\">Update</button></ul>").appendTo(queryFormElt);
	var queryElt = $("<input type=\"text\" title=\"Query\"></input>").appendTo($("<div class=\"inputbox\"></div>").appendTo(queryFormElt));

	fillElement(container, outerElt, 'vertical');
	setupPanelled(outerElt, topBoxElt, outerSvgElt, 'vertical', 0, false);
	var scaleSvg = dontScaleSvgParts(outerSvgElt, 'text,.tick');

	facetHelpElt.html(storylineFacetHelpText);
	queryHelpElt.html(storylineQueryHelpText);
	var queryHelpFieldExElt = queryHelpElt.find('.fieldexamples');
	$.each(helpFieldsList, function (fieldI, field) {
		$("<li>" + field + "</li>").appendTo(queryHelpFieldExElt);
	});
	var allHelpElts = [facetHelpElt, queryHelpElt],
	    useHelpElt = null;
	function updateHelp(show) {
		if (show) {
			$.each(allHelpElts, function (helpEltI, helpElt) {
				if (helpElt == useHelpElt)
					helpElt.show();
				else
					helpElt.hide();
			});
		} else {
			$.each(allHelpElts, function (helpEltI, helpElt) {
					helpElt.hide();
			});
		}
	}

	var width = viewBox.width - margins.left - margins.right,
	    height = viewBox.height - margins.top - margins.bottom - margins.between;
	var detailBox = { x: viewBox.x + margins.left, y: viewBox.y + margins.top, width: width, height: height * split },
	    selectBox = { x: viewBox.x + margins.left, y: viewBox.y + margins.top + detailBox.height + margins.between, width: width, height: height * (1.0 - split) };

	var ownCnstrQuery = new Query(globalQuery.backendUrl());
	var nodesConstraint = new Constraint(),
	    entityConstraints = {};
	globalQuery.addConstraint(nodesConstraint);
	ownCnstrQuery.addConstraint(nodesConstraint);
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
	function updateQuery(resultWatcher) {
		function getUniqFields(entities) {
			var fields = [],
			    seenFields = {};
			$.each(entities, function (entityI, entity) {
				if (!seenFields.hasOwnProperty(entity.field)) {
					fields.push(entity.field);
					seenFields[entity.field] = true;
				}
			});
			return fields;
		}
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
					"clusterField": storylineClusterField,
					"entities": entities
				}
			};
			view.plottimeline.cooccurrences = 'and';
			view.plottimeline.cooccurrenceFields = getUniqFields(queryEntities);
			drawEntityTitlePrefixes = view.plottimeline.cooccurrenceFields.length > 1;
			drawImportantEntities = entities;
			if (oldResultWatcher != null)
				oldResultWatcher.clear();
			oldResultWatcher = resultWatcher;
			resultWatcher.set(view);
			contextQuery.update();
			updateHelp(false);
			setLoadingIndicator(true);
			clearQueryElt.removeAttr('disabled');
		} else {
			resultWatcher.clear();
			setLoadingIndicator(false);
			clearQueryElt.attr('disabled', 'disabled');
			updateHelp(true);
			statusElt.html("");
			outerSvgElt.hide();
		}
	}

	var nodeSelection = {};
	function cleanSelectionToMatchData() {
		var changed = false;
		if (vis != null) {
			$.each(nodeSelection, function (nodeKey, node) {
				if (!vis.checkVisClusterKey(nodeKey)) {
					delete nodeSelection[nodeKey];
					changed = true;
				}
			});
			$.each(entityConstraints, function (field, valueTable) {
				$.each(valueTable, function (value) {
					if (!vis.checkEntity(field, value)) {
						var constraint = entityConstraints[field][value].constraint;
						globalQuery.removeConstraint(constraint);
						ownCnstrQuery.removeConstraint(constraint);
						delete entityConstraints[field][value];
						changed = true;
					}
				});
			});
		}
		return changed;
	}
	function constrainToNodeSelection() {
		if ($.isEmptyObject(nodeSelection)) {
			var haveEntityConstraints = true;
			$.each(entityConstraints, function (field, valueTable) {
				if (!$.isEmptyObject(valueTable)) {
					haveEntityConstraints = false;
					return false;
				}
			});
			if (haveEntityConstraints)
				clearSelElt.attr('disabled', 'disabled');
			nodesConstraint.clear();
		} else {
			var nodeCount = 0,
			    seen = {},
			    selPointStrs = [];
			$.each(nodeSelection, function (nodeKey, node) {
				nodeCount += 1;
				$.each(node.clusters, function (cluster, mem) {
					if (!seen.hasOwnProperty(cluster)) {
						seen[cluster] = true;
						selPointStrs.push(cluster);
					}
				});
			});
			nodesConstraint.name("Storyline: " + nodeCount + (nodeCount == 1 ? " node" : " nodes"));
			nodesConstraint.set({
				type: 'referencepoints',
				points: selPointStrs
			});
			clearSelElt.removeAttr('disabled');
		}
		globalQuery.update();
	}
	function constrainEntity(entityId, entity, set) {
		if (!set) {
			var constraint = entityConstraints[entity.field][entity.value].constraint;
			globalQuery.removeConstraint(constraint);
			ownCnstrQuery.removeConstraint(constraint);
			delete entityConstraints[entity.field][entity.value];
			vis.selectEntities([entityId], false);
			if ($.isEmptyObject(nodeSelection))
				clearSelElt.attr('disabled', 'disabled');
		} else {
			var constraint = new Constraint();
			constraint.name("Storyline: " + entity.field + " = " + entity.value);
			constraint.set({
				type: 'fieldvalue',
				field: entity.field,
				value: entity.value
			});
			constraint.onChange(function (type, query) {
				if (type == 'removed' && query == globalQuery)
					constrainEntity(entityId, entity, false);
			});
			globalQuery.addConstraint(constraint);
			ownCnstrQuery.addConstraint(constraint);
			if (!entityConstraints.hasOwnProperty(entity.field))
				entityConstraints[entity.field] = {};
			entityConstraints[entity.field][entity.value] = {
				entityId: entityId,
				constraint: constraint
			};
			vis.selectEntities([entityId], true);
			clearSelElt.removeAttr('disabled');
		}
		globalQuery.update();
	}
	function onSelectNode(node) {
		var nowSelected = null;
		if (!nodeSelection.hasOwnProperty(node.key)) {
			nodeSelection[node.key] = node;
			nowSelected = true;
		} else {
			delete nodeSelection[node.key];
			nowSelected = false;
		}
		vis.selectNodes([node.key], nowSelected);
		constrainToNodeSelection();
	}
	function onSelectEntityLine(entityLine) {
		var entity = vis.lookupEntity(entityLine.entityId);
		var toSet = !(entityConstraints.hasOwnProperty(entity.field) && entityConstraints[entity.field].hasOwnProperty(entity.value));
		constrainEntity(entityLine.entityId, entity, toSet);
	}
	clearSelElt.attr('disabled', 'disabled');
	clearSelElt.bind('click', function () {
		{
			if (vis != null)
				vis.selectNodes(Object.keys(nodeSelection), false);
			nodeSelection = {};
			constrainToNodeSelection();
		}
		{
			var removingEntityIds = [];
			$.each(entityConstraints, function (field, valueTable) {
				$.each(valueTable, function (value, info) {
					removingEntityIds.push(info.entityId);
					globalQuery.removeConstraint(info.constraint);
					ownCnstrQuery.removeConstraint(info.constraint);
				});
			});
			vis.selectEntities(removingEntityIds, false);
			entityConstraints = {};
		}
	});
	nodesConstraint.onChange(function (type, query) {
		if (type == 'removed' && query == globalQuery) {
			if (vis != null)
				vis.selectNodes(Object.keys(nodeSelection), false);
			nodeSelection = {};
		}
	});

	var data = null,
	    vis = null,
	    lastBrushSelection = null;
	function draw() {
		if (data != null) {
			svgElt.children().remove();
			var svg = jqueryToD3(svgElt);
			setLoadingIndicator(false);
			outerSvgElt.show();
			function onBrush(selection) {
				lastBrushSelection = selection;
			}
			vis = drawStoryline(svg, detailBox, selectBox, data, lastBrushSelection, drawEntityTitlePrefixes, drawImportantEntities, onSelectNode, onSelectEntityLine, onBrush);
			if (cleanSelectionToMatchData())
				constrainToNodeSelection();
			vis.selectNodes(Object.keys(nodeSelection), true);
			vis.selectEntities($.map(entityConstraints, function (r) { return $.map(r, function (ec) { return ec.entityId; }); }), true);
			statusElt.html(
				"showing "
				+ (data.numIncludedCooccurringEntities < data.numCooccurringEntities ? "top" : "all")
				+ " " + data.numIncludedCooccurringEntities
				+ " co-occurring entities"
			);
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
			draw();
		}
	}

	resultWatcher.setCallback(function (a) {
		onResult(a);
	});

	updateElt.bind('click', function() {
		setLoadingIndicator(true);
		queryEntities = parsePlotlineQueryString(queryElt.val());
		updateQuery(resultWatcher);
	});
	queryFormElt.submit(function () {
		return false;
	});

	clearQueryElt.bind('click', function () {
		queryEntities = [];
		updateQuery(resultWatcher);
	});

	var defaultFacetI = -1;
	facetManagers = $.map(facets, function (facet, facetI) {
		var excludeQuery = new Query(globalQuery.backendUrl(), 'setminus', contextQuery, facet.constraintsQuery);
		var excludeResultWatcher = new ResultWatcher(function (a) {
			onResult(a);
		});
		excludeResultWatcher.enabled(false);
		excludeQuery.addResultWatcher(excludeResultWatcher);
		function useFacet() {
			queryEntities = $.map(facet.constraintsQuery.constraints(), function (cnstr) {
				var cnstrValue = cnstr.value();
				return {
					field: cnstrValue.field,
					value: cnstrValue.value
				}
			});
			updateQuery(excludeResultWatcher);
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
	$("<option value=\"query\">Query</option>").appendTo(modeElt);
	var curFacetManager = null;
	modeElt.bind('change', function () {
		var newMode = this.options[this.selectedIndex].value;
		var curQueryText = $.trim(queryElt.val());
		if (curFacetManager != null)
			curFacetManager.watcher.active(false);
		if (newMode == 'query') {
			queryFormElt.show();
			useHelpElt = queryHelpElt;
			if (curFacetManager != null) {
				facetQueryText = unparsePlotlineQuery(queryEntities);
				queryEntities = [];
				updateQuery(resultWatcher);
			} else {
				updateHelp(true);
			}
			curFacetManager = null;
			if (curQueryText)
				updateElt.click();
		} else {
			queryFormElt.hide();
			useHelpElt = facetHelpElt;
			updateHelp(true);
			facetManagers[this.selectedIndex].use();
			curFacetManager = facetManagers[this.selectedIndex];
			curFacetManager.watcher.active(true);
		}
	});
	queryFormElt.hide();
	if (defaultFacetI >= 0) {
		useHelpElt = queryHelpElt;
		modeElt.val(defaultFacetI);
	} else {
		useHelpElt = facetHelpElt;
		modeElt.val('query');
	}
	modeElt.change();
	updateQuery(resultWatcher);

	$('a[data-toggle="tab"]').on('shown', function (e) {
		if ($(e.target.getAttribute('href'))[0] === container[0] && vis != null)
			vis.update();
	});
}
