Web visualization frontend.

The frontend interfaces with the backend by sending queries in a JSON format.
See the backend documentation for details on these queries.

Usage
=====

We assume here the backend is already running and has data. To set up the
frontend, first setup a `frontenddomain.mk` and any associated files (see
below).  In general you would keep these in another directory along with
another makefile which calls the one here.

Once domain code is in place, generate a `frontendsettings.mk` and associated
Javascript file manually or by running the makefile once to create a default.
The default will create a `frontendsettings.js` that sets the backend URL as
follows; modify it for the real URL:

	backendUrl = "http://example.net:1500";

Either way you can also override other settings. See below for more information
on the config files.

By default make uses uglifyjs for Javascript minimization and csso for CSS
minimization. You can change these choices by setting MINJS and MINCSS
respectively in `settings.mk`. Alternatively you can set these variables in the
environment before calling make. If you don't want to do minimization for one
or both components, set the relevant variable(s) to "cat".

Now use make to run the build process. There are two main targets:

* *release* -- Build the site with packed and minimized CSS and Javascript
  files.  Outputs to `release/` by default.
* *devel* -- Build the site with independent CSS and Javascript files. Useful
  for development and debugging. Outputs to `devel/` by default.

After building, serve the files from either `out/ `or `devel/`.

Configuration
=============

Configuration works by the makefile first including `frontenddomain.mk` and
then including `frontendsettings.mk`. These files can override the settings
variables at the top of the makefile, and especially can add Javascript and CSS
files to the build by appending to the appropriate variables. This
configuration system is intended to allow the common codebase, code for a data
domain, and installation specific settings to be maintained in separate files
without interfering with each other.

Configuration for the data domain goes in `frontenddomain.mk `and any files it
references. In general it would add at least one Javacript file and one CSS
file to the build.

Configuration for a specific installation goes in `frontendsettings.mk`. In
general it would add at least one Javacript file to the build, which can set
the backend URL and override any default settings from the data domain
Javacript as desired.

See the top of Makefile for the makefile variables the config files can
override.

Debugging
=========

The `verbose_log` structure in `config.js` sets options for verbose logging in
the browser console. These options can be set at runtime in the console.

Design notes
============

Query system
------------

Queries to the backend follow the specification in the backend documentation.
See `queries.js` for how the frontend constructs these queries and collects
results.

Factoring
---------

Each of the main controls (constraint list, description list, facet, timeline,
map) has its own .js file and .css file. The controls are intended to be used
flexibly, including possibly using more than one of each control at once.
Therefore I have tried to isolate the CSS rules for each control and to avoid
using any HTML element IDs that are not certain to be unique.

Control pattern
---------------

My general design pattern for the main controls (constraint list, description
list, facet, timeline, map) is something like this:

	function setLoadingIndicator(isLoading) {
		// show a loading indicator if isLoading is set, otherwise hide it
	}
	setLoadingIndicator(true);

	var data1 = null,
	    data2 = null;
	function update() {
		if (data1 != null && data2 != null) {
			setLoadingIndicator(false);
			displayTheData(data1, data2);
		}
	}

	query1.onChange(function () {
		setLoadingIndicator(true);
	});
	query2.onChange(function () {
		setLoadingIndicator(true);
	});

	query1.onResult(function (result) {
		data1 = processData(result);
	});
	query2.onResult(function (result) {
		data2 = processData(result);
	});

*Note:*

* The loading indicator is shown initially and again whenever the constraints
  have changed but we have not yet received new results. It gets hidden
  whenever we have all the results we need.
* The control watches for changes and results on callbacks, sets shared
  variables as needed, and then calls a function to change the state.
* The main update() function only acts when it has all the data it needs. It
  takes the data through shared variables instead of arguments because the
  callbacks that set the data may be called at any time but we want to actually
  update only when all the data is ready.

I don't know if this is a good design pattern, but it has been working for me
so far.
