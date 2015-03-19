#
# Makefile to build various parts of the project.
#

ROOTPATH=../..
BACKENDPATH=$(ROOTPATH)/backend
BACKENDOUTPUT=backend

all: backend release devel

backend: $(BACKENDPATH)
	SRC=$(BACKENDPATH) CONFIG=. OUT=$(BACKENDOUTPUT) make -f $(BACKENDPATH)/Makefile build

clean:
	OUT=$(BACKENDOUTPUT) make -f "$(BACKENDPATH)"/Makefile $@
