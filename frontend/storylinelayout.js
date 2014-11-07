/*
Introduction
============

This is a graph layout algorithm intended to produce plots similar to XKCD #657:
- Randall Munroe. "Movie Narrative Charts" (XKCD #657). http://xkcd.com/657

Prior work refers to this kind of plot as 'storylines' or 'storyflow', and includes:
- Ogawa and Ma, "Software Evolution Storylines". SOFTVIS 2010. http://www.michaelogawa.com/research/storylines
- Tanahashi and Ma "Design Considerations for Optimizing Storyline Visualizations", INFOVIS 2012. http://www.cse.ohio-state.edu/~raghu/teaching/CSE5544/Visweek2012/infovis/papers/tanahashi.pdf
- Liu, Wu, Wei, Liu, and Liu "StoryFlow: Tracking the Evolution of Stories", INFOVIS 2013. http://research.microsoft.com/en-us/um/people/ycwu/projects/infovis13.html

Additionally, there is at least one existing project to produce plots based directly on XKCD #657:
- Iskander, Thorne, and Kaplan. "Comic Book Narrative Charts". http://csclub.uwaterloo.ca/~n2iskand/?page_id=13

The present algorithm works like none of the above, but is based on general concepts from them.

Input and output
================

The input is
- An ordered of list of *times*, which are identifiers for discrete points on the time axis. They don't have to be contiguous, just ordered.
- *Entity IDs*, which are identifiers for entities in the data.
- *(Input) nodes*, which each have a time and a set of entity IDs. An entity ID must occur no more than once among the nodes for any given time.
- A list of *important entity IDs* which will be given extra priority in the layout.

We wish to draw an line for each entity ID, which passes through all the nodes that have that entity ID in order of time. We want a good visual layout for the nodes and the lines.

The output is
- *Slots*, which are positions in a list giving an ordering of one axis of the plot
- *Vis(ual) nodes*, of which there is one for each input node as well as *filler vis nodes* which are added route lines. Each filler vis nodes are considered to have exactly one entity ID, corresponding to the line it routes, while other visual nodes are considered to have the entity IDs of their corresponding input node. The layout assigns a range of contiguous slots to each vis node, one slot for each entity ID.
- *Entity lines*, which are ordered lists of *entity points* for each entity ID. Each entity point is where its entities line touches a vis node, and is assigned a slot.

Note that the layout has the time order as one plot axis and the slot order as the other axis, but does not not use exact screen positions.

Algorithm
=========

Let the vis nodes by
1. one for each input node
2. one for each time t and entity e such that there is at least one vis cluster at t but e does not appear in any input node at t

We define *priority* as an metric for ordering thing we want to layout, so we can be greedy. The *priority of an entity e* is
	w(e) * \sum_{input node n with e} (number of entities at e - 1)
where w(n) is 2 if e is one of the important entity IDs and otherwise 1. The *priority of a vis node n* is
	\sum_{entity e at n} priority(e)

The idea is that if an entity line interacts with other entity lines a lot then we want to give it a higher priority. Additionally we want to give important entities higher weight. Note that we don't normalize vis node priority against the number of entities at n, so vis nodes with more entities get higher priority; this is again because they will affect more entity lines.

The algorithm is then:

	def desired_slot_index(vis node n):
		centre := mean(slot index of previous line point on l for each line point l at n)
		round(centre - (num entities at n) / 2)

	def update_time(time t):
		for each vis node n at t in decreasing order of priority:
			i* := desired_slot_index(n)
			if i* is undefined (ie all entity lines at n start at n):
				insert enough new slots at bottom to fit n
				i := first free slot index at the bottom
			else
				i := slot index with enough free slots at t for n and min |i - i*|
				if i is undefined (ie no space anywhere for n):
					add enough slots for n at which ever of the top or bottom is closest
					i := first index for new free slots
			assign n to slots at indices i, i+1, ..., i+(num entities at n)
			sort the line points at n by slot index of previous points on their entity lines
			assign each line point at n to its respective slot

	for each time t in increasing order:
			update_time(t)
	for each time t in decreasing order:
			update_time(t)

Basically we go through each time in order, at each time placing vis nodes and their line points in order of priority. Each vis node goes at the closest available position to the ideal position based on incoming entity lines. First we do that forward, and then backwards to straighten out any lines that wiggled around when going forward but in retrospect actually had space to go straight.
*/

var storylinelayout = (function() {

function calcEntityPriority(timeOrder, nodesByTime, getNodeEntityIds, entityIds, importantEntityIds) {
	var priorityTable = {};
	for (var entityIdI = 0; entityIdI < entityIds.length; entityIdI++)
		priorityTable[entityIds[entityIdI]] = 0;

	for (var timeI = 0; timeI < timeOrder.length; timeI++) {
		var timeNodes = nodesByTime[timeOrder[timeI]];
		for (var nodeI = 0; nodeI < timeNodes.length; nodeI++) {
			var node = timeNodes[nodeI],
			    nodeEntityIds = getNodeEntityIds(node);
			for (var entityIdI = 0; entityIdI < nodeEntityIds.length; entityIdI++)
				priorityTable[nodeEntityIds[entityIdI]] += nodeEntityIds.length - 1;
		}
	}

	for (var entityIdI = 0; entityIdI < importantEntityIds.length; entityIdI++) {
		var entityId = importantEntityIds[entityIdI];
		if (priorityTable.hasOwnProperty(entityId))
			priorityTable[entityId] *= 2;
	}

	return function(entityId) {
		return priorityTable[entityId];
	}
}

function prioritizeVisNodes(timeOrder, visNodesByTime, getNodeEntityIds, entityPriority) {
	for (var timeI = 0; timeI < timeOrder.length; timeI++) {
		var time = +timeOrder[timeI],
		    timeVisNodes = visNodesByTime[time];
		for (var visNodeI = 0; visNodeI < timeVisNodes.length; visNodeI++) {
			var visNode = timeVisNodes[visNodeI],
			    visNodeEntityIds = visNode.isFiller ? [visNode.entityId] : getNodeEntityIds(visNode.node);
			visNode.priority = 0;
			for (var entityIdI = 0; entityIdI < visNodeEntityIds.length; entityIdI++)
				visNode.priority += entityPriority(visNodeEntityIds[entityIdI]);
		}
		timeVisNodes.sort(function (vc1, vc2) { return vc2.priority - vc1.priority; });
	}
}

function makeVisNodes(timeOrder, inputNodesByTime, getNodeEntityIds, allEntities) {
	function findEntityFirstLastTimes(timeOrder, inputNodesByTime) {
		var firstTimes = {},
		    lastTimes = {};
		for (var timeI = 0; timeI < timeOrder.length; timeI++) {
			var time = +timeOrder[timeI],
			    timeInputNodes = inputNodesByTime[time];
			for (var nodeI = 0; nodeI < timeInputNodes.length; nodeI++) {
				var inputNode = timeInputNodes[nodeI],
				    inputNodeEntityIds = getNodeEntityIds(inputNode);
				for (var entityIdI = 0; entityIdI < inputNodeEntityIds.length; entityIdI++) {
					var entityId = inputNodeEntityIds[entityIdI];
					if (!firstTimes.hasOwnProperty(entityId))
						firstTimes[entityId] = time;
					lastTimes[entityId] = time;
				}
			}
		}
		return {
			first: firstTimes,
			last: lastTimes
		};
	}

	var entityTimes = findEntityFirstLastTimes(timeOrder, inputNodesByTime);
	var visNodes = [],
	    visNodesForInputNodes = [],
	    visNodesByTime = {};
	for (var timeI = 0; timeI < timeOrder.length; timeI++) {
		var time = +timeOrder[timeI],
				timeInputNodes = inputNodesByTime[time],
				timeVisNodes = [],
				seen = {};
		visNodesByTime[time] = timeVisNodes;
		for (var inputNodeI = 0; inputNodeI < timeInputNodes.length; inputNodeI++) {
			var inputNode = timeInputNodes[inputNodeI],
			    inputNodeEntityIds = getNodeEntityIds(inputNode);
			var visNode = {
				isFiller: false,
				time: time,
				node: inputNode
			};
			visNodes.push(visNode);
			visNodesForInputNodes.push(visNode);
			timeVisNodes.push(visNode);
			for (var entityIdI = 0; entityIdI < inputNodeEntityIds.length; entityIdI++)
				seen[inputNodeEntityIds[entityIdI]] = true;
		}
		for (var entityIdI = 0; entityIdI < allEntities.length; entityIdI++) {
			var entityId = allEntities[entityIdI];
			if (!seen.hasOwnProperty(entityId) && time >= entityTimes.first[entityId] && time <= entityTimes.last[entityId]) {
				var visNode = {
					isFiller: true,
					time: time,
					entityId: entityId
				};
				visNodes.push(visNode);
				timeVisNodes.push(visNode);
			}
		}
	}
	return {
		all: visNodes,
		forInputNodes: visNodesForInputNodes,
		byTime: visNodesByTime
	}
}

function makeEntityLines(timeOrder, visNodesByTime, getNodeEntityIds) {
	var entityLines = [],
	    lookup = {};
	for (var timeI = 0; timeI < timeOrder.length; timeI++) {
		var time = +timeOrder[timeI],
				timeVisNodes = visNodesByTime[time];
		for (var visNodeI = 0; visNodeI < timeVisNodes.length; visNodeI++) {
			var visNode = timeVisNodes[visNodeI],
			    visNodeEntityIds = visNode.isFiller ? [visNode.entityId] : getNodeEntityIds(visNode.node);
			visNode.linePoints = {};
			for (var entityIdI = 0; entityIdI < visNodeEntityIds.length; entityIdI++) {
				var entityId = visNodeEntityIds[entityIdI];
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
					visNode: visNode
				};
				entityLine.points.push(linePoint);
				visNode.linePoints[entityId] = linePoint;
			}
		}
	}
	return entityLines;
}

function slottifyVisNodes(timeOrder, visNodesByTime, getNodeEntityIds, entityPriority) {
	function makeTopSpace(slots, numSlots, forceNew) {
		var slotsToAdd = numSlots;
		if (!forceNew) {
			for (var i = 0; i < numSlots && i < slots.length; i++) {
				if (slots[i].lastUsedTime != time)
					slotsToAdd--;
				else
					break;
			}
		}
		for (var i = slotsToAdd; i >= 0; i--) {
			slots.unshift({
				index: i,
				lastUsedTime: null
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
				if (slots[slots.length - 1 - i].lastUsedTime != time)
					slotsToAdd--;
				else
					break;
			}
		}
		var origLength = slots.length;
		for (var i = 0; i < slotsToAdd; i++) {
			slots.push({
				index: slots.length,
				lastUsedTime: null
			});
		}
		return slots.length - numSlots;
	}

	function updateDesiredPositions(visNodes, lastSeenEntities) {
		for (var visNodeI = 0; visNodeI < visNodes.length; visNodeI++) {
			var visNode = visNodes[visNodeI],
			    visNodeEntityIds = visNode.isFiller ? [visNode.entityId] : getNodeEntityIds(visNode.node);
			var total = 0,
			    samples = 0;
			for (var entityIdI = 0; entityIdI < visNodeEntityIds.length; entityIdI++) {
				var entityId = visNodeEntityIds[entityIdI];
				if (lastSeenEntities.hasOwnProperty(entityId)) {
					total += lastSeenEntities[entityId].index;
					samples += 1;
				}
			}
			visNode.desiredSlotIndex = samples > 0 ? Math.round(total / samples) : undefined;
		}
	}

	function closestAvailPosition(slots, time, wantIndex, numSlots) {
		// The code complexity here is to minimize the number of slots that we have to look at before stopping

		var bestIndex = null,
		    bestDist = Number.MAX_VALUE;

		var atWantUsedI = null;
		    atWantIsAvail = true;
		for (atWantUsedI = wantIndex; atWantUsedI < wantIndex + numSlots; atWantUsedI++) {
			if (atWantUsedI == slots.length || slots[atWantUsedI].lastUsedTime == time) {
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
				if (slots[usedI].lastUsedTime == time) {
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
				if (slots[usedI].lastUsedTime == time) {
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
			slots[slotI].lastUsedTime = null;
	}

	function handleTimeVisNodes(time, timeVisNodes, slots, lastSeenEntities) {
		for (var visNodeI = 0; visNodeI < timeVisNodes.length; visNodeI++) {
			var visNode = timeVisNodes[visNodeI],
			    visNodeEntityIds = visNode.isFiller ? [visNode.entityId] : getNodeEntityIds(visNode.node);
			var insertI = null;
			if (visNode.desiredSlotIndex == null) {
				insertI = makeBottomSpace(slots, visNodeEntityIds.length, true);
			} else {
				insertI = closestAvailPosition(slots, time, visNode.desiredSlotIndex, visNodeEntityIds.length);
				if (insertI == null) {
					if (insertI < slots.length / 2)
						insertI = makeTopSpace(slots, visNodeEntityIds.length);
					else
						insertI = makeBottomSpace(slots, visNodeEntityIds.length);
				}
			}
			visNodeEntityIds.sort(function (eid1, eid2) {
				if (lastSeenEntities.hasOwnProperty(eid1) && lastSeenEntities.hasOwnProperty(eid2))
					return lastSeenEntities[eid1].index - lastSeenEntities[eid2].index;
			});
			if (insertI != null) {
				visNode.startSlot = slots[insertI];
				for (var entityIdI = 0; entityIdI < visNodeEntityIds.length; entityIdI++) {
					var entityId = visNodeEntityIds[entityIdI],
					    slot = slots[insertI + entityIdI];
					visNode.linePoints[entityId].slot = slot;
					slot.lastUsedTime = time;
					lastSeenEntities[entityId] = slot;
				}
			} else {
				console.log("error: unable to place vis node", time, visNodeI);
			}
		};
	}

	var slots = [],
	    lastSeenEntities = {};
	for (var timeI = 0; timeI < timeOrder.length; timeI++) {
		var time = +timeOrder[timeI];
		    timeVisNodes = visNodesByTime[time];
		updateDesiredPositions(timeVisNodes, lastSeenEntities);
		handleTimeVisNodes(time, timeVisNodes, slots, lastSeenEntities);
	}
	clearSlotsLastUsed(slots);
	for (var timeI = timeOrder.length - 1; timeI >= 0; timeI--) {
		var time = +timeOrder[timeI];
		    timeVisNodes = visNodesByTime[time];
		updateDesiredPositions(timeVisNodes, lastSeenEntities);
		handleTimeVisNodes(time, timeVisNodes, slots, lastSeenEntities);
	}

	return slots;
}

/*
 * Lays out a storyline plot.
 *
 * @param timeOrder list of known times in order, where times are anything usable as a property name
 * @param entityIds list of known entity IDs, where entity IDs are anything usable as a property name
 * @param nodesByTime look up table from times to nodes which occur at that time
 * @param getNodeEntityIds function to get the list of entity IDs for a node
 * @param importantEntityIds list of important entity IDs
 * @return a structure with properties:
 *	visNode: a list of all vis nodes
 *	visNodesForInputNodes: a list of all non-filler vis nodes
 *	entityLines: a list of entity lines
 *	numSlots: the number of slots needed for the plot
 *
 * Vis node objects have the following properties:
 *	isFiller: flag set true for filler nodes
 *	time: the time position
 * and non-filler vis nodes also have:
 *	node: the corresponding input node
 * whereas filler vis nodes have:
 *	entityId: entity ID the vis node is on the entity line of
 *
 * Entity line objects have the following properties:
 *	entityId: corresponding entity ID
 *	points: list of line points in time order
 *
 * Line point objects have the following properties:
 *  visNode: the vis node this line point is on
 *	slot: the assigned slot
 *
 * Slot objects have the following properties:
 *	index: assigned index in ordering of slots
 */
function layout(timeOrder, entityIds, nodesByTime, getNodeEntityIds, importantEntityIds) {
	var visNodes = makeVisNodes(timeOrder, nodesByTime, getNodeEntityIds, entityIds);
	var entityLines = makeEntityLines(timeOrder, visNodes.byTime, getNodeEntityIds);
	var entityPriority = calcEntityPriority(timeOrder, nodesByTime, getNodeEntityIds, entityIds, importantEntityIds);
	prioritizeVisNodes(timeOrder, visNodes.byTime, getNodeEntityIds, entityPriority);
	var slots = slottifyVisNodes(timeOrder, visNodes.byTime, getNodeEntityIds, entityPriority);

	return {
		visNodes: visNodes.all,
		visNodesForInputNodes: visNodes.forInputNodes,
		entityLines: entityLines,
		slots: slots
	}
}

/*
 * Normalize the entity lines for a layout where times are numbers so that:
 * 1. each change of slot position is between line points at exactly one time unit apart
 * 2. there are no line points not necessary to represent changes in slot
 *
 * That is, normalization strips out line points that don't represent a change of position for the line, and makes sure that all slot position changes are over a distance of one time unit. The later condition is because otherwise the time distance of slot position changes is affected by time positions of filler vis nodes, which can be visually odd.
 *
 * The entity lines are modified in place and the list of vis nodes may be modified.
 *
 * @param layout a layout from layout()
 */
function normalizeEntityLineFillerVisNodes(layout) {
	for (var entityLineI = 0; entityLineI < layout.entityLines.length; entityLineI++) {
		var entityLine = layout.entityLines[entityLineI],
		    newLinePoints = [entityLine.points[0]],
			  lastUsedLinePoint = entityLine.points[0],
		    lastUnusedFillerLinePoint = null;
		for (var linePointI = 1; linePointI < entityLine.points.length; linePointI++) {
			var linePoint = entityLine.points[linePointI];
			// We want to keep all line points for non-filler vis nodes or which represent a change of slot
			if (!linePoint.visNode.isFiller || linePoint.slot != lastUsedLinePoint.slot) {
				// If there was change of slot, we want to make sure the starting point is one time unit before the ending point
				if (linePoint.slot != lastUsedLinePoint.slot && linePoint.visNode.time - lastUsedLinePoint.visNode.time > 1) {
					var moveLinePoint = null;
					// If the line point we skipped over last was actually the starting point we want now, use it; otherwise make a new line point and a new filler vis node for it
					if (lastUnusedFillerLinePoint != null && linePoint.visNode.time - lastUnusedFillerLinePoint.visNode.time == 1) {
						moveLinePoint = lastUnusedFillerLinePoint;
						lastUnusedFillerLinePoint = null;
					} else {
						var movePointFillerVisNode = {
							isFiller: true,
							entityId: entityLine.entityId,
							time: linePoint.visNode.time - 1
						};
						layout.visNodes.push(movePointFillerVisNode);
						moveLinePoint = {
							slot: lastUsedLinePoint.slot,
							visNode: movePointFillerVisNode
						};
					}
					newLinePoints.push(moveLinePoint);
				}
				newLinePoints.push(linePoint);
				lastUsedLinePoint = linePoint;
				if (lastUnusedFillerLinePoint != null)
					lastUnusedFillerLinePoint.visNode.unused = true;
				lastUnusedFillerLinePoint = null;
			} else if (linePoint.visNode.isFiller) {
				// We keep the last unused filler vis node line point in case it turns out to be the slot change starting point we want at the next step
				lastUnusedFillerLinePoint = linePoint;
			}
		}
		newLinePoints.push(entityLine.points[entityLine.points.length - 1]);
		entityLine.points = newLinePoints;
	}

	layout.visNodes = layout.visNodes.filter(function (visNode) {
		return visNode.unused != true;
	});
}

/*
 * Generate a list of individual links (line point pairs) representing entity lines.
 *
 * @param entityLine a list of entityLines as from layout()
 * @return a list of link objects, each of which has properties:
 *	entityLines: the entity line the link is for
 *	source: the starting line point
 *	target: the ending line point
 */
function makeEntityLineLinks(entityLines) {
	var links = [];
	for (var entityLineI = 0; entityLineI < entityLines.length; entityLineI++) {
		var entityLine = entityLines[entityLineI],
		    lastLinePoint = entityLine.points[0];
		for (var linePointI = 1; linePointI < entityLine.points.length; linePointI++) {
			var linePoint = entityLine.points[linePointI];
			links.push({
				entityLine: entityLine,
				source: lastLinePoint,
				target: linePoint
			});
			lastLinePoint = linePoint;
		}
	}
	return links;
}

/*
 * Lays out textual labels by adjusting their slot indices and screen x positions so that they do not overlap in screen space and stay on the screen.
 *
 * Each label object must have a .width property giving the width in screen space and a .slotsIndex property (which will be modified) giving its slot index in the layout.
 *
 * @param labels list of labels
 * @param numSlots number of slots in the layout
 * @param xExtent pair giving the extent of the layout on the x axis in screen space
 * @param getLabelX function to get the screen x position of a label
 * @param setLabelX function to set the screen x position of a label
 */
function layoutLabels(labels, numSlots, xExtent, getLabelX, setLabelX) {
	function findClosestFreeSlot(slotIndex, startX, lastUsed) {
		if (!lastUsed.hasOwnProperty(slotIndex) || lastUsed[slotIndex] < startX)
			return slotIndex;
		var bestSlotIndex = null,
		    upBestDist = Number.MAX_VALUE;
		for (var i = slotIndex - 1; i > 0; i--) {
			if (!lastUsed.hasOwnProperty(i) || lastUsed[i] < startX) {
				bestSlotIndex = i;
				upBestDist = slotIndex - i;
				break;
			}
		}
		for (var i = slotIndex + 1; i < numSlots; i++) {
			if (!lastUsed.hasOwnProperty(i) || lastUsed[i] < startX) {
				var dist = i - slotIndex;
				if (dist < upBestDist)
					bestSlotIndex = i;
				break;
			}
		}
		return bestSlotIndex;
	}

	var lastUsed = {};
	labels.sort(function (l1, l2) { return getLabelX(l1) - getLabelX(l2) });
	for (var labelI = 0; labelI < labels.length; labelI++) {
		var label = labels[labelI];
		var changedX = false,
		    startX = getLabelX(label) - label.width / 2;
		if (startX < xExtent[0]) {
			startX = xExtent[0];
			changedX = true;
		}
		var endX = startX + label.width;
		if (endX >= xExtent[1]) {
			endX = xExtent[1];
			startX = endX - label.width;
			changedX = true;
		}
		var toIndex = findClosestFreeSlot(label.slotIndex, startX, lastUsed);
		if (toIndex != null) {
			lastUsed[toIndex] = endX;
			label.slotIndex = toIndex;
		} else {
			console.log("warning: can't choose good slot for entity line label");
		}
		if (changedX)
			setLabelX(label, startX + label.width / 2);
	}
}

return {
	layout: layout,
	layoutLabels: layoutLabels,
	normalizeEntityLineFillerVisNodes: normalizeEntityLineFillerVisNodes,
	makeEntityLineLinks: makeEntityLineLinks
}

}());
