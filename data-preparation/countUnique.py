import sys
import json
import codecs, collections


dic = {}

def readFile(fileName):
	fin = open(fileName, "r")
	for line in fin:
		items = json.loads(line[:-1], "utf-8")
		for tt in items["text"]:
			if tt in dic:
				del dic[tt]
		#if items["text"] in dic:
		#	del dic[items["text"]]
	print "Number of Entries without hyperlink:", len(dic)
	fin.close

if __name__ == "__main__":
	fin = open(sys.argv[1], "r")
	co = 0
        dic = {}
	for line in fin:
		items = json.loads(line[:-1], "utf-8")
		if items['year'] not in dic: dic[items['year']] = 0
 		dic[items['year']] += 1
		co+=1
	fin.close
        od = collections.OrderedDict(sorted(dic.items()))
	split_point = -1500
	s = 0
	for k, v in od.iteritems():
		s+= v
		if s >= co/10:
	                print str(split_point)+";"+str(k)
			#print (split_point,k), ":", s
			s=0
			split_point = k+1
	
	#print (split_point,k), ":", s
	print str(split_point)+";"+str(k)
