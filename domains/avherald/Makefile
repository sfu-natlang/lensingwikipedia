#
# Makefile to build various parts of the project.
#

ROOTPATH=../..
BACKENDPATH=$(ROOTPATH)/backend
BACKENDOUTPUT=backend

all: backend

backend: $(BACKENDPATH)
	SRC=$(BACKENDPATH) CONFIG=. OUT=$(BACKENDOUTPUT) make -f $(BACKENDPATH)/Makefile build

clean:
	SRC=$(BACKENDPATH) CONFIG=. OUT=$(BACKENDOUTPUT) make -f "$(BACKENDPATH)"/Makefile $@
