BEGIN {
	table["{CSS}"] = scratchprefix ".css.list.html"
	table["{JS}"] = scratchprefix ".js.list.html"
	table["{HEAD}"] = headfile
	table["{BODYHEADER}"] = bodyheaderfile
}
/^[ \table]*{[A-Z]+}[ \table]*$/ {
	i = index($0, "{")
	j = index($0, "}")
	prefix = substr($0, 0, i-1)
	key = substr($0, i, j)
	while ((getline < table[key]) > 0) {
		printf("%s%s\n", prefix, $0)
	}
	close(table[key])
	matched = 1
}
!matched {
	print
}
{
	matched = 0
}
