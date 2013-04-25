import sys


#fres = open("response.txt", "r")
#floc = open("location.txt", "r")
try:
	fres = open(sys.argv[1], "r")
	floc = open(sys.argv[2], "r")
except:
	print "python findLocation.py <events_file> <locations_file>"
	exit(1)

locDic = {}
for line in floc:
	items = line[:-1].split("\t")
	locDic[items[0]] = items[1]
	for ii in items[2:]:
		locDic[ii] = items[1]
floc.close


fEveDec = open("eventDescription.txt", "w")
fFulEve = open("eventsStep2.txt", "w")

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
	location = locDic[header] if header in locDic else ""
	if location == "" and len(items) > 3:
		for ii in items[3:]:
			if len(ii) ==0: continue
			text = " ".join(ii.split()[1:])	
			url = ii.split()[0]
			if text in locDic:
				location = locDic[text]
				break  ###TODO: if it is possible to have more than one location for one event, remove this line
			elif url in locDic:
				location = locDic[url]
				break  ###TODO: if it is possible to have more than one location for one event, remove this line
	if location != "": haveLoc+=1
	print >> fFulEve, "%s\t%s\t%s\t%s" %(year, header, location, "\t".join(items[2:]))
	if items[2].split()[-1] == '.':
		print >> fEveDec, "%s \n\nPAR_SPLITTER_SYMBOL .\n" %(items[2])
	else:
		print >> fEveDec, "%s .\n\nPAR_SPLITTER_SYMBOL .\n" %(items[2])

print "No of Events: ", noEvents
print "No of Events which have location: ", haveLoc

fEveDec.close
fFulEve.close
fres.close
