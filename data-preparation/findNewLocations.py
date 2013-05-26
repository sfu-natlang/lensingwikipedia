from pygeocoder import Geocoder
import sys
import time
import json
import codecs



if __name__ == "__main__":
	fnew = codecs.open(sys.argv[1],'r', encoding='utf-8')
	fold = codecs.open(sys.argv[2],'r', encoding='utf-8')
	fout = codecs.open(sys.argv[3],'w', encoding='utf-8')

	oldDict = {}
	woC = 0
	for line in fold:
		items = json.loads(line)
		if 'url' in items: key = items['url']
		elif 'text' in items: key = items['text']
		else:	
			print "unk entry in %s: \n%s" %(sys.argv[2],items)
			exit(1)
		dict = {}
		for v in items:
			if v != 'url' and v!= 'text':
				dict[v] = items[v]	
		if 'country' not in dict: 
			woC += 1
		else:
			oldDict[key] = dict
			
	print woC
	fold.close

	fold = codecs.open(sys.argv[2]+'.cln','w', encoding='utf-8')
	for line in fnew:
		items = json.loads(line, "utf-8")				
		latitude = int(float(items['latitude'])*100)/100.0
		longitude = int(float(items['longitude'])*100)/100.0
		if 'url' in items: key = items['url']
		elif 'text' in items: key = items['text']
		else:	
			print "unk entry:  ", items
			exit(1)
		if key in oldDict and abs(latitude- oldDict[key]['latitude']) < 0.1 and abs(longitude - oldDict[key]['longitude']) < 0.1:
			#print oldDict[key], longitude, latitude
			#print "unk entry:  ", items  
			#exit(1)  ## TODO: we may need to renew latitude, longitude in previous file
			print >> fold, json.dumps(oldDict[key])
		else:			
			print >> fout, json.dumps(items)
fnew.close
fout.close
fold.close
