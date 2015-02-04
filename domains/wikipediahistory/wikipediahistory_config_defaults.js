/*
 * Default Javascript config for Wikipedia history.
 */

var FrontendConfig = (function () {

// Range of allowed map zoom levels
minMapZoom = 1, maxMapZoom = 5;
// URL for the map data file (can be relative to the path where the frontend is running)
mapDataUrl = "map.json";
// List of facets by field name (to ask the backend for) and title (to show the user)
facets = [
	{
		field: "role",
		title: "Role"
	},
	{
		field: "person",
		title: "Person",
		storylineInclude: true,
		storylineDefault: true
	},
	{
		field: "organization",
		title: "Organization",
		storylineInclude: true
	},
	{
		field: "location",
		title: "Location"
	},
	{
		field: "category",
		title: "Category"
	}
];
// Field to use to define clusters in the storyline
storylineClusterField = "referencePoints";
// Verbose log settings that can be set in the browser console
verboseLog = {
	// Print out the queries being sent to the backend
	outgoingQuery: false,
	// Print out the replies being received from the backend
	incomingReply: false,
	// Print out timing information for the query handling system
	queryTiming: false
}

return Utils.extendModule([WikipediaHistoryDomain], {
	minMapZoom: minMapZoom,
	maxMapZoom: maxMapZoom,
	mapDataUrl: mapDataUrl,
	facets: facets,
	storylineClusterField: storylineClusterField,
	verboseLog: verboseLog
});
}());
