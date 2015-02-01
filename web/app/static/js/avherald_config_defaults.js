/*
 * Default Javascript config for Avherald.
 */

// Range of allowed map zoom levels
minMapZoom = 1, maxMapZoom = 5;
// URL for the map data file (can be relative to the path where the frontend is running)
mapDataUrl = "static/js/map.json";
// List of facets by field name (to ask the backend for) and title (to show the user)
facets = {
        "role": "Role",
        "predicate": "Predicate",
        "organization": "Organization",
        "location": "Location",
        "category": "Category"
};
// Field to use to define clusters in the storyline
storylineClusterField = "referencePoints";
// Default facet to use for the storyline view
defaultStorylineFacet = "organization";
// Verbose log settings that can be set in the browser console
verbose_log = {
	// Print out the queries being sent to the backend
	outgoing_query: false,
	// Print out the replies being received from the backend
	incoming_reply: false,
	// Print out timing information for the query handling system
	query_timing: false
}
