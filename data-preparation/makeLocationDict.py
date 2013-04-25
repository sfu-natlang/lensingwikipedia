import sys


#fres = open("response.txt", "r")
#floc = open("location.txt", "r")

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
		floc = open(sys.argv[1], "r")
		flocNER = open(sys.argv[2], "r")
		fDict = open(sys.argv[3], "w")
	except:
		print "usage:   python %s <locations_file> <NER_location_file> <locationDictionaryName>" %(sys.argv[0])
		exit(1)

	locDic = {}
	for line in floc:
		items = line[:-1].split("\t")
		locDic[items[0]] = items[1]
		#for ii in items[2:]:
		#	locDic[ii] = items[1]
	floc.close

	for line in flocNER:
		items = line[:-1].split("\t")
		for ii in items[2:]:
			if ii in locDic and items[1] != locDic[ii]:
				print line[:-1],  locDic[ii]
			else:
				locDic[ii] = items[1]
	flocNER.close

	for key in locDic:
		lat,long = locDic[key].split(" , ")
                latitude = str(convertCord(lat))
                longitude = str(convertCord(long))

		print >> fDict, "%s\t%s , %s" %(key, latitude, longitude)

	print "No of locations: ", len(locDic)

	fDict.close
