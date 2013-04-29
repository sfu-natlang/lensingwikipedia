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




if __name__ == "__main__":
#       xtractDescriptions(sys.argv[1])
#        fileName = readNEROutput(sys.argv[1])
        fileName = removeNERTags(sys.argv[1])
#       fileName = sys.argv[1]
        #Preprocess(fileName)

