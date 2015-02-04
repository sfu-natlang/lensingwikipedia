/*
 * Miscellaneous utilities.
 */

var Utils = (function () {

function extendObject(toExtend, module) {
	for (var i = 0; i < toExtend.length; i++) {
		var extending = toExtend[i];
		for (var attr in extending)
			if (extending.hasOwnProperty(attr) && !module.hasOwnProperty(attr))
				module[attr] = extending[attr];
	}
	return module;
}

var extendModule = extendObject;

/*
 * Convert a list of pairs to a dictionary object.
 */
function pairListToDict(list) {
	var dict = {};
	for (var i in list) {
		var pair = list[i];
		dict[pair[0]] = pair[1];
	}
	return dict;
}

return {
	extendObject: extendObject,
	extendModule: extendModule,
	pairListToDict: pairListToDict
};
}());
