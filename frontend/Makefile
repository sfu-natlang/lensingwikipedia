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
# Make settings that can be altered by the environment or the config files.
#

# Directory to look in for the source files.
SRC?=.
# Path for output of the release site.
RELEASEOUT?=release
# Path for output of the development site.
DEVELOUT?=devel
# Working directory for intermediate files.
SCRATCH?=scratch

#
# Settings that can be altered by the config files.
#

# CSS minimizer program. Should take a filename for input on the command line and output to stdout.
MINCSS=cat
# Javascript minimizer program. Should take a filename for input on the command line and output to stdout.
MINJS=cat
# Library CSS file to add to the build; each should include appropriate credits and licence information.
LIBCSS=$(addprefix $(SRC)/, lib/bootstrap/css/bootstrap.min.css lib/bootstrap/css/bootstrap-responsive.min.css)
# Site-specific CSS files to add to the build.
OWNCSS=$(addprefix $(SRC)/, loadingindicator.css constraintslist.css eventdescriptionslist.css facet.css timeline.css map.css tsne.css textsearch.css storyline.css main.css)
# Library JS file to add to the build; each should include appropriate credits and licence information.
LIBJS=$(addprefix $(SRC)/, lib/jquery.min.js lib/jquery.cookie.min.js lib/d3/d3.v3.min.js lib/d3/topojson.v1.min.js lib/d3/d3.geo.projection.v0.min.js lib/d3/d3.geo.polyhedron.v0.min.js lib/d3/d3.sankey.min.js lib/bootstrap/js/bootstrap.min.js)
# Project Javascript files to add to the build.
OWNJS=$(addprefix $(SRC)/, utils.js layoututils.js d3utils.js timeaxisutils.js loadingindicator.js queries.js constraintslist.js eventdescriptionslist.js facet.js timeline.js map.js tsne.js textsearch.js storylinelayout.js storyline.js descriptions.js)
# HTML fragment to use in the HTML head section (adding to any fixed lines).
HEADFILE=
# HTML fragment file to use as the header in the page layout.
BODYHEADERFILE=
# Project HTML files to use as the about page. If a line contains a {} delimited keyword with optional surrounding whitespace, it will be replaced with other text indented to the same level as the opening brace. Valid replacements are:
#   {CSS} the needed CSS includes
#   {JS} the needed Javascript includes
#   {HEAD} the HTML head section fragment as used on the index page
#   {BODYHEADER} the header HTML fragment as used on the index page.
HTMLFILES=$(addprefix $(SRC)/, index.html)
# Other project files to include in the output.
FILES=$(addprefix $(SRC)/, map.json search.png lib/bootstrap/img/glyphicons-halflings.png)

#
# Handling the config files.
#

frontendsettings.js: $(SRC)/settings_defaults.js
	cp $^ $@
frontendsettings.mk: $(SRC)/settings_defaults.mk
	cp $^ $@

# Use both config files in order.
include frontenddomain.mk
include frontendsettings.mk

#
# Build.
#

#
# Target to build release version, with packing and minimization.
#
release: $(addprefix $(RELEASEOUT)/, lib.css lw.css lib.js lw.js $(notdir $(HTMLFILES) $(FILES)))

#
# Target to build development version. No packing or minimization.
#
devel: $(addprefix $(DEVELOUT)/, $(notdir $(LIBCSS) $(LIBJS) $(OWNCSS) $(OWNJS) $(HTMLFILES) $(FILES)))

#
# The main purpose of this makefile is to automate optional packing and
# minimization of CSS and Javascript resources while still being able to build
# the website with the separate files for development. There are probably better
# tools to do this task, but our case is very basic and doing it this way avoids
# extra dependencies.
#

.DEFAULT: devel
.PHONY: release devel clean-intermediate clean

#
# HTML files get other files substituted in.
#

$(SCRATCH)/htmlfiles.d: $(SRC)/htmlreplace.awk $(HTMLFILES)
	for f in $(HTMLFILES); do \
		echo -e "$(RELEASEOUT)/$$(basename "$${f}") $(DEVELOUT)/$$(basename "$${f}"): %/$$(basename "$${f}"): $${f} $(SCRATCH)/%.css.list.html $(SCRATCH)/%.js.list.html\n\t@mkdir -p \$$(@D)\n\tawk -f $< -v scratchprefix=\"$(SCRATCH)/\$$*\" -v headfile=\"$(HEADFILE)\" -v bodyheaderfile=\"$(BODYHEADERFILE)\" $$< > \$$@\n"; \
	done > $@

-include $(SCRATCH)/htmlfiles.d 

#
# Other devel build files are mostly copied directly with directory flattening.
#

$(SCRATCH)/develfiles.d: $(LIBCSS) $(LIBJS) $(OWNCSS) $(OWNJS) $(FILES)
	@mkdir -p $(@D)
	for f in $(LIBCSS) $(LIBJS) $(OWNCSS) $(OWNJS) $(FILES); do \
		echo -e "$(DEVELOUT)/$$(basename "$${f}"): $$f\n\t@mkdir -p \$$(@D)\n\tcp \$$< \$$@\n"; \
	done > $@

-include $(SCRATCH)/develfiles.d

#
# Any extra files expected in release output are copied directly.
#

$(SCRATCH)/otherreleasefiles.d: $(FILES)
	for f in $(FILES); do \
		echo -e "$(RELEASEOUT)/$$(basename "$${f}"): $$f\n\t@mkdir -p \$$(@D)\n\tcp \$$< \$$@\n"; \
	done > $@

-include $(SCRATCH)/otherreleasefiles.d

# CSS and Javascript files for release output.
$(RELEASEOUT)/lib.css: $(SCRATCH)/lib.css.cat $(SRC)/libheader
	@mkdir -p $(@D)
	(cat $(SRC)/libheader $^) > $@
$(RELEASEOUT)/lw.css: $(SCRATCH)/own.css.cat
	@mkdir -p $(@D)
	$(MINCSS) $^ > $@
$(RELEASEOUT)/lib.js: $(SCRATCH)/lib.js.cat $(SRC)/libheader
	@mkdir -p $(@D)
	(cat $(SRC)/libheader $^) > $@
$(RELEASEOUT)/lw.js: $(SCRATCH)/own.js.cat
	@mkdir -p $(@D)
	$(MINJS) $^ > $@

# For release we need only the packed CSS and Javascript files, while for devel we need the lists of individual files.
$(SCRATCH)/$(RELEASEOUT).%.list:
	@mkdir -p $(@D)
	echo -e "lib.$*\nlw.$*" > $@
$(SCRATCH)/$(DEVELOUT).%.list: $(SCRATCH)/lib.%.list $(SCRATCH)/own.%.list
	@mkdir -p $(@D)
	cat $^ | while read f; do \
		echo "$$(basename "$${f}")"; \
	done > $@

# CSS and Javascript include lists formatted for inclusion in HTML.
%.css.list.html: %.css.list
	@mkdir -p $(@D)
	awk '{ printf("<link rel=\"stylesheet\" type=\"text/css\" href=\"%s\">\n", $$0) }' $^ > $@
%.js.list.html: %.js.list
	@mkdir -p $(@D)
	awk '{ printf("<script src=\"%s\"></script>\n", $$0) }' $^ > $@

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

# Clean up intermediate build files but not the output.
clean-intermediate:
	rm -rf $(SCRATCH)

# Clean up all build files.
clean: clean-intermediate
	rm -rf $(RELEASEOUT) $(DEVELOUT)
