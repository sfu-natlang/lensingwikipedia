import sys
import json
import codecs


try:
	fres = open(sys.argv[1], "r")
except:
	print "python findLocation.py <events_json_file>"
	exit(1)

fEveDec = codecs.open("eventDescription.txt",'w', encoding='utf-8')

haveLoc = 0
noEvents = 0
for line  in fres:
	l = json.loads(line[:-1], "utf-8")				
	if not 'description' in l or  len(l["description"]) == 0:
		print "err: without description!", line
		continue
	noEvents +=1
	description = l['description']
	if description.split()[-1] == '.':
		print >> fEveDec, "%s \n\nPAR_SPLITTER_SYMBOL .\n" %(description)
	else:
		print >> fEveDec, "%s .\n\nPAR_SPLITTER_SYMBOL .\n" %(description)

print "No of Events: ", noEvents

fEveDec.close
fres.close
