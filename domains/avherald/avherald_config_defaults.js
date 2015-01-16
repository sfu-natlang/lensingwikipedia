/*
 * Default Javascript config for Avherald.
 */

var FrontendConfig = (function () {

// Range of allowed map zoom levels
minMapZoom = 1, maxMapZoom = 5;
// URL for the map data file (can be relative to the path where the frontend is running)
mapDataUrl = "map.json";
// List of facets by field name (to ask the backend for) and title (to show the user)
facets = {
        "role": "Role",
        "predicate": "Predicate",
        "organization": "Organization",
        "location": "Location",
        "category": "Category"
};
// Facets to include in the storyline view
storylineUseFacets = ["organization"];
// Field to use to define clusters in the storyline
storylineClusterField = "referencePoints";
// Default facet to use for the storyline view
defaultStorylineFacet = "organization";
// Verbose log settings that can be set in the browser console
verboseLog = {
	// Print out the queries being sent to the backend
	outgoingQuery: false,
	// Print out the replies being received from the backend
	incomingReply: false,
	// Print out timing information for the query handling system
	queryTiming: false
}

return Utils.extendModule([AvheraldDomain], {
	minMapZoom: minMapZoom,
	maxMapZoom: maxMapZoom,
	mapDataUrl: mapDataUrl,
	facets: facets,
	storylineUseFacets: storylineUseFacets,
	storylineClusterField: storylineClusterField,
	defaultStorylineFacet: defaultStorylineFacet,
	verboseLog: verboseLog
});
}());
