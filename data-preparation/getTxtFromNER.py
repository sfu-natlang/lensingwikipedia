import sys
import re


def removeNERTags(fileName):
        inpFile = open(fileName, "r")
        #outFile = open("eventDescription.tok", "w")
        outFile = open(fileName+".tok", "w")
        locFile = open(sys.argv[2], "w")

        outputLine = ''
        for line in inpFile:
                line = re.sub(r'\\/', '/', line)
                words = re.sub(r'\s', ' ', line).split()
                location = []
		lineWords = []
                for w in words:
                        w_parts = w.split('/')
                        lineWords.append("/".join(w_parts[:-1]))
                        if w_parts[-1] == 'LOCATION':
                                location.append("/".join(w_parts[:-1]))
                        elif len(location) > 0:
                                print >> locFile, " ".join(location)
                                location = []

		outputLine=" ".join(lineWords)
		if len(lineWords) > 1 or (len(lineWords) ==1 and lineWords[0] != '.'):
	        	print >> outFile, outputLine
		lineWords = []
	inpFile.close
        outFile.close
        locFile.close
        return fileName+".ner"


def readNER(fileName):
        inpFile = open(fileName, "r")
        outFile = open(fileName+".tok", "w")
        locFile = open(sys.argv[2]+".loc", "w")
        personFile = open(sys.argv[2]+".person", "w")
        global nerLst
        nerLst = []
        personLst = []
        orgLst = []
        locationLst = []
        wLst = []
        preTag = ''
        for line in inpFile:
                if "PAR_SPLITTER_SYMBOL" in line: #or "PAR_SPLITTER_SYMBOL" in line:
                        nerLst.append((personLst,orgLst,locationLst))
                        personLst = []
                        orgLst = []
                        locationLst = []
	        	print >> outFile, "PAR_SPLITTER_SYMBOL ."
                        continue
                line = re.sub(r'\\/', '/', line)
                words = re.sub(r'\s', ' ', line).split()
		lineWords = []
                for w in words:
                        w_parts = w.split('/')
                        lineWords.append("/".join(w_parts[:-1]))
                        if preTag != w_parts[-1] and preTag == 'PERSON':
                                personLst.append(" ".join(wLst))
                        	if len(wLst) > 0:
                                	print >> personFile, " ".join(wLst)
                                preTag = w_parts[-1]
                                wLst = []
                        elif preTag != w_parts[-1] and preTag == 'ORGANIZATION':
                                orgLst.append(" ".join(wLst))
                                preTag = w_parts[-1]
                                wLst = []
                        elif preTag != w_parts[-1] and preTag == 'LOCATION':
                                locationLst.append(" ".join(wLst))
                        	if len(wLst) > 0:
                                	print >> locFile, " ".join(wLst)
                                preTag = w_parts[-1]
                                wLst = []
                        elif preTag != w_parts[-1]:
                                preTag = w_parts[-1]
                                wLst = []
                        wLst.append("/".join(w_parts[:-1]))
		outputLine=" ".join(lineWords)
		if len(lineWords) > 1 or (len(lineWords) ==1 and lineWords[0] != '.'):
	        	print >> outFile, outputLine


        #if len(locationLst) > 0 or len(personLst) > 0 or len(orgLst) > 0:
        nerLst.append((personLst,orgLst,locationLst))
        print len(nerLst)
        inpFile.close
	locFile.close
	outFile.close
	personFile.close





if __name__ == "__main__":
#       xtractDescriptions(sys.argv[1])
#        fileName = readNEROutput(sys.argv[1])
        #fileName = removeNERTags(sys.argv[1])
        fileName = readNER(sys.argv[1])
#       fileName = sys.argv[1]
        #Preprocess(fileName)

