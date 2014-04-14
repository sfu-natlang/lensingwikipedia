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
		fper = codecs.open(sys.argv[1], "r", encoding='utf-8')
		fperNER = codecs.open(sys.argv[2], "r", encoding='utf-8')
		fDict = codecs.open(sys.argv[3], "w", encoding='utf-8')
	except:
		print "usage:   python %s <person_file> <NER_person_file> <personDictionaryName>" %(sys.argv[0])
		exit(1)

	perDic = {}
	for line in fper:
		items = json.loads(line[:-1], "utf-8")				
		#perDic[items['url']] = items
		perDic[items['url']] = {}
		perDic[items['url']]['title'] = items['title']
		perDic[items['url']]['url'] = items['url']
	fper.close

	for line in fperNER:
		items = json.loads(line[:-1], "utf-8")	
		if not type(items['text']) is list:
			textList = [items['text']]			
		for ii in textList:
			text = str(ii)
			if text in perDic:# and items['latitude'] != perDic[text]['latitude']:
				print line[:-1]
				print  perDic[text]
				print textList
				continue
			else:
				#perDic[text] = items
				perDic[text] = {}
				perDic[text]['title'] = items['title']
				perDic[text]['text'] = text
	fperNER.close

	for key in perDic:

		#print >> fDict, "%s\t%s" %(key, title)
		print >> fDict, json.dumps(perDic[key])

	print "No of persons: ", len(perDic)

	fDict.close
