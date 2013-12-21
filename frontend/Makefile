#
# Makefile to build the webpage.
#
# This makefile will include first domain.mk if it exists and then settings.mk
# if it exists. Those files can alter the config variables at the top of this
# file. The can also Javascript config variables by adding an Javascript file
# to the build.
#

all: release
test: devel

#
# Settings that can be altered by the config files.
#

# CSS minimizer program. Should take a filename for input on the command line and output to stdout.
MINCSS=csso
# Javascript minimizer program. Should take a filename for input on the command line and output to stdout.
MINJS=uglifyjs
# Library CSS file to add to the build; each should include appropriate credits and licence information.
LIBCSS=lib/bootstrap/css/bootstrap.min.css lib/bootstrap/css/bootstrap-responsive.min.css
# Site-specific CSS files to add to the build.
OWNCSS=loadingindicator.css constraintslist.css eventdescriptionslist.css facet.css timeline.css map.css textsearch.css main.css
# Library JS file to add to the build; each should include appropriate credits and licence information.
LIBJS=lib/jquery.min.js lib/jquery.cookie.min.js lib/d3/d3.v3.min.js lib/d3/topojson.v1.min.js lib/d3/d3.geo.projection.v0.min.js lib/d3/d3.geo.polyhedron.v0.min.js lib/bootstrap/js/bootstrap.min.js
# Project Javascript files to add to the build.
OWNJS=utils.js layoututils.js d3utils.js loadingindicator.js queries.js constraintslist.js eventdescriptionslist.js facet.js timeline.js map.js textsearch.js descriptions.js
# Project files to include in the output.
FILES=index.html about.html map.json search.png favicon.ico lib/bootstrap/img/glyphicons-halflings.png
# Path for output of the release site.
RELEASEOUT=out
# Path for output of the development site.
DEVELOUT=devel
# Working directory for intermediate files.
SCRATCH=scratch

#
# Handling the config files.
#

# Defaults for configs.
domain.mk: domain_defaults.mk
	cp $^ $@
settings.js: settings_defaults.js
	cp $^ $@
settings.mk: settings_defaults.mk
	cp $^ $@

# Use both config files in order.
include domain.mk
include settings.mk

#
# Build.
#

#
# Target to build release version, with packing and minimization.
#
release: $(addprefix $(RELEASEOUT)/, lib.css lw.css lib.js lw.js $(FILES))

#
# Target to build development version. No packing or minimization.
#
devel: $(addprefix $(DEVELOUT)/, $(LIBCSS) $(OWNCSS) $(LIBJS) $(OWNJS) $(FILES))

#
# The main purpose of this makefile is to automate optional packing and
# minimization of CSS and Javascript resources while still being able to build
# the website with the separate files for development. There are probably better
# tools to do this task, but our case is very basic and doing it this way avoids
# extra dependencies.
#

.DEFAULT: devel
.PHONY: release devel clean-intermediate clean

# Substitute the CSS and Javascript include lists into the index file.
$(RELEASEOUT)/index.html $(DEVELOUT)/index.html: %/index.html: $(SCRATCH)/%.css.list.html $(SCRATCH)/%.js.list.html index.html
	@mkdir -p $(@D)
	awk "/{CSS}/ { system(\"cat $(SCRATCH)/$*.css.list.html\"); d=1 } /{JS}/ { system(\"cat $(SCRATCH)/$*.js.list.html\"); d=1 } !d { print } { d=0 }" index.html > $@

# Substitute the CSS list into the about file.
$(RELEASEOUT)/about.html $(DEVELOUT)/about.html: %/about.html: $(SCRATCH)/%.css.list.html about.html
	@mkdir -p $(@D)
	awk "/{CSS}/ { system(\"cat $(SCRATCH)/$*.css.list.html\"); d=1 } !d { print } { d=0 }" about.html > $@

# CSS and Javascript files for release output.
$(RELEASEOUT)/lib.css: $(SCRATCH)/lib.css.cat libheader
	@mkdir -p $(@D)
	(cat libheader $^ | sed -e 's|"\.\./img/glyphicons-halflings.png"|"lib/bootstrap/img/glyphicons-halflings.png"|g') > $@
$(RELEASEOUT)/lw.css: $(SCRATCH)/own.css.cat
	@mkdir -p $(@D)
	$(MINCSS) $^ > $@
$(RELEASEOUT)/lib.js: $(SCRATCH)/lib.js.cat libheader
	@mkdir -p $(@D)
	(cat libheader $^) > $@
$(RELEASEOUT)/lw.js: $(SCRATCH)/own.js.cat
	@mkdir -p $(@D)
	$(MINJS) $^ > $@

# For release we need only the packed CSS and Javascript files, while for devel we need the lists of individual files.
$(SCRATCH)/$(RELEASEOUT).%.list:
	@mkdir -p $(@D)
	echo -e "lib.$*\nlw.$*" > $@
$(SCRATCH)/$(DEVELOUT).%.list: $(SCRATCH)/lib.%.list $(SCRATCH)/own.%.list
	@mkdir -p $(@D)
	cat $^ > $@

# CSS and Javascript include lists formatted for inclusion in HTML.
%.css.list.html: %.css.list
	@mkdir -p $(@D)
	awk '{ printf("\t\t<link rel=\"stylesheet\" type=\"text/css\" href=\"%s\">\n", $$0) }' $^ > $@
%.js.list.html: %.js.list
	@mkdir -p $(@D)
	awk '{ printf("\t\t<script src=\"%s\"></script>\n", $$0) }' $^ > $@

# Concatenated CSS and Javascript files and lists of the component filenames.
$(SCRATCH)/lib.css.cat $(SCRATCH)/lib.css.list: $(LIBCSS)
$(SCRATCH)/own.css.cat $(SCRATCH)/own.css.list: $(OWNCSS)
$(SCRATCH)/lib.js.cat $(SCRATCH)/lib.js.list: $(LIBJS)
$(SCRATCH)/own.js.cat $(SCRATCH)/own.js.list: $(OWNJS)
$(SCRATCH)/%.cat $(SCRATCH)/%.list:
	@mkdir -p $(@D)
	cat $^ > $(@D)/$*.cat
	echo $^ | tr ' ' '\n' > $(@D)/$*.list
$(SCRATCH)/%.list: $(SCRATCH)/%.cat

# Any extra files expected in output are copied directly.
$(RELEASEOUT)/% $(DEVELOUT)/%: %
	@mkdir -p $(@D)
	cp $< $@

# Clean up intermediate build files but not the output.
clean-intermediate:
	rm -rf $(SCRATCH)

# Clean up all build files.
clean: clean-intermediate
	rm -rf $(RELEASEOUT) $(DEVELOUT)
