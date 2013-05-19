import sys
import json
import codecs

origEvents = {}


def readOrigFile(nameFile):
	fin = open(nameFile, "r")
	global origEvents
	for line in fin:
		l = json.loads(line[:-1], "utf-8")				
		if len(l["description"]) == 0:
			print "err: without description!", line
			exit(1)
		origEvents[l["description"]] = 1
	print len(origEvents)
	fin.close


def readNewFile(nameFile):
	#fin = open(nameFile, "r")
	#fout = open("newEvents.txt", "w")
	fin = codecs.open(nameFile,'r', encoding='utf-8')
	fout = codecs.open(sys.argv[3],'w', encoding='utf-8')
	co = 0
	global origEvents
	print len(origEvents)
	c = 0
	for line in fin:
		items = line.split("\t")		
		c+=1
		if not(items[2] in origEvents):
			print >> fout, line[:-1]
			co += 1
	fout.close
	fin.close
	print "new Events: ", co

if __name__ == "__main__":
	readOrigFile(sys.argv[1])
	readNewFile(sys.argv[2])
