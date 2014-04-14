import sys
import json
import codecs



def convertCord(cord):
        sign = -1 if cord[-1] == 'S' or cord[-1] == 'W' else 1
        digits = ''
        for c in cord:
                if str.isdigit(c) or c == '.': digits += c
                else: digits +=' '
        s = '0'
        m = '0'
        if len(digits.split())>2:
                d,m,s = digits.split()
        elif len(digits.split())==2:
                d,m = digits.split()
        else:
                d=digits.strip()
        d = float(d)
        m = float(m)
        s = float(s)
        return sign*(d+m/60+s/3600)


if __name__ == "__main__":
	try:
		floc = codecs.open(sys.argv[1], "r", encoding='utf-8')
		flocNER = codecs.open(sys.argv[2], "r", encoding='utf-8')
		fDict = codecs.open(sys.argv[3], "w", encoding='utf-8')
	except:
		print "usage:   python %s <locations_json_file> <NER_location_json_file> <locationDictionaryName>" %(sys.argv[0])
		exit(1)

	locDic = {}
	for line in floc:
		items = json.loads(line[:-1], "utf-8")				
		#locDic[items['url']] = items
		locDic[items['url']] = {}
		locDic[items['url']]['latitude'] = items['latitude']
		locDic[items['url']]['longitude'] = items['longitude']
		locDic[items['url']]['title'] = items['title']
		locDic[items['url']]['url'] = items['url']
	floc.close

	for line in flocNER:
		items = json.loads(line[:-1], "utf-8")	
		if not type(items['text']) is list:
			textList = [items['text']]			
		for ii in textList:
			text = str(ii)
			if text in locDic and items['latitude'] != locDic[text]['latitude']:
				print line[:-1]
				print  locDic[text]
				print textList
				continue
			else:
				#locDic[text] = items
				locDic[text] = {}
				locDic[text]['latitude'] = items['latitude']
				locDic[text]['longitude'] = items['longitude']
				locDic[text]['title'] = items['title']
				locDic[text]['text'] = text
	flocNER.close

	for key in locDic:
		lat = str(locDic[key]['latitude'].encode('utf8', 'ignore'))
		long = str(locDic[key]['longitude'].encode('utf8', 'ignore'))
                locDic[key]['latitude'] = convertCord(lat)
                locDic[key]['longitude'] = convertCord(long)

		#print >> fDict, "%s\t%s , %s\t%s" %(key, latitude, longitude, title)
		print >> fDict, json.dumps(locDic[key])

	print "No of locations: ", len(locDic)

	fDict.close
