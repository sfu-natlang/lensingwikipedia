from pygeocoder import Geocoder
import sys
import time

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
	fin = open(sys.argv[1] ,"r")
	fout = open(sys.argv[2] ,"w")
	for line in fin:
		items = line[:-1].split("\t")
		lat,long = items[1].split(" , ")
		latitude = int(float(lat)*100)/100.0
		longtitude = int(float(long)*100)/100.0
		print latitude, longtitude
		try:
			results = Geocoder.reverse_geocode(latitude, longtitude)
			items.append(results.country.encode('utf8','ignore'))
		except:
			print "Unknown"
		print >> fout, "\t".join(items)
		time.sleep (50.0 / 100.0);
fin.close
fout.close
