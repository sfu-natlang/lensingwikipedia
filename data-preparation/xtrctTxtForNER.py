import sys


try:
	fres = open(sys.argv[1], "r")
except:
	print "python findLocation.py <events_file>"
	exit(1)

fEveDec = open("eventDescription.txt", "w")

haveLoc = 0
noEvents = 0
for line  in fres:
	items = line[:-1].split('\t')
	if len(items) < 3:
	#	print >> sys.stderr, "escape: ", line
		continue
	noEvents +=1
	year = items[0]
	header = items[1]
	if items[2].split()[-1] == '.':
		print >> fEveDec, "%s \n\nPAR_SPLITTER_SYMBOL .\n" %(items[2])
	else:
		print >> fEveDec, "%s .\n\nPAR_SPLITTER_SYMBOL .\n" %(items[2])

print "No of Events: ", noEvents

fEveDec.close
fres.close
