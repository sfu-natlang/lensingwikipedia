function timeAxisTickFormater(date) {
	var year = date.getFullYear();
	return year <= 0 ?  1 - year + "BCE" : year + "CE";
}
function timeAxisTickValues(xScale) {
	// For any BCE tick that is aligned to a round five years and is at least five years from the next tick, we bump it up one year to produce ticks at rounder-looking dates. This is a bit of a hack but seems to work ok.
	var ticks = xScale.ticks();
	var n = ticks.length - 1;
	for (var i = 0; i < n; i++) {
		var fullYear = ticks[i].getFullYear();
		if (fullYear > 0)
			break;
		if (-fullYear % 5 != 0)
			continue;
		var rounded = new Date(0, 0, 1), minNext = new Date(0, 0, 1);
		rounded.setFullYear(ticks[i].getFullYear());
		minNext.setFullYear(ticks[i].getFullYear() + 5);
		if (rounded.getTime() == ticks[i].getTime() && minNext.getTime() <= ticks[i + 1].getTime())
			ticks[i].setFullYear(ticks[i].getFullYear() + 1);
	}
	return ticks;
}
function jsDateOfYear(year) {
	var jsYear = +year;
	// The input data represents n BCE as -n whereas Javascript uses 1-n
	if (jsYear < 0)
		jsYear += 1;
	var date = new Date(0, 0, 1);
	date.setFullYear(jsYear);
	return date;
}
