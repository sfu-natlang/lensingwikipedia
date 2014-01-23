#
# Makefile to build various parts of the project.
#

ROOTPATH=../..
BACKENDPATH=$(ROOTPATH)/backend
FRONTENDPATH=$(ROOTPATH)/frontend
BACKENDOUTPUT=backend

all: backend release devel

backend: $(BACKENDPATH)
	@mkdir -p $(BACKENDOUTPUT)
	find $(BACKENDPATH) -maxdepth 1 \( -name '*.py' -o -executable \) \( -not -type d \) -exec cp {} $(BACKENDOUTPUT) \;
	cp *.py $(BACKENDOUTPUT)

clean:
	rm -rf $(BACKENDOUTPUT)
	SRC=$(FRONTENDPATH) make -f "$(FRONTENDPATH)"/Makefile $@

%:
	SRC=$(FRONTENDPATH) make -f "$(FRONTENDPATH)"/Makefile $@
