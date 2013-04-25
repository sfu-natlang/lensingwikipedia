import sys
import re

def readNEROutput(fileName):
        inpFile = open(fileName, "r")
        #outFile = open("eventDescription.tok", "w")
        outFile = open(fileName+".tok", "w")
        locFile = open("locFromNER.txt", "w")

        outputLine = ''
        for line in inpFile:
                if "PAR_SPLITTER_SYMBOL" in line: #or "PAR_SPLITTER_SYMBOL" in line:
                        outputLine += "\n"
                        outFile.write(outputLine)
                        outputLine = ''
                        continue

                words = re.sub(r'\s', ' ', line).split()
		location = []
                for w in words:
                        w_parts = w.split('/')
                        outputLine += w_parts[0]+' '
                        if w_parts[-1] == 'LOCATION':
				location.append(w_parts[0])
			elif len(location) > 0:
                                print >> locFile, " ".join(location)
				location = []

        outputLine += "\n"
        outFile.write(outputLine)

        outFile.close
	locFile.close
        return fileName+".ner"



def removeNERTags(fileName):
        inpFile = open(fileName, "r")
        #outFile = open("eventDescription.tok", "w")
        outFile = open(fileName+".tok", "w")
        locFile = open("locFromNER.txt", "w")

        outputLine = ''
        for line in inpFile:
                words = re.sub(r'\s', ' ', line).split()
                location = []
		lineWords = []
                for w in words:
                        w_parts = w.split('/')
                        lineWords.append(w_parts[0])
                        if w_parts[-1] == 'LOCATION':
                                location.append(w_parts[0])
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

