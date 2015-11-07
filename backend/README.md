Backend stuff, including the index builder.

Usage and introduction
======================

Domain-specific code
--------------------

To use the backend you first need to create a `backend_domain_config.py` and
any other needed file containing domain-specific code. This file can provide
names for extra keyword fields (especially for facets) and functions that
provide values for both the required fields and extra keyword fields.

After the domain code is in place then the following steps will work.

### Building domain-specific programs

Domain-specific files for Wikipedia and AVHerald are found in `domain_config/`.

The build is identical regardless of the domain, but you have to specify the
domain through the `LENSING_DOMAIN` environment variable.

To build everything, just run

    make build

**Note:** You probably don't want to build the TSNE code since that's just used
when building the index (read below). If you just want the backend query
handler, all you need is:

    make python

You can then use the programs in build/ for the following steps.

Creating an index from the data
-------------------------------

The first step is putting the basic data from the data preparation step into a
Whoosh index. A Whoosh index is just a directory that Whoosh keeps its files
in. The input to this step is a data file where each line of the file is a JSON
object for a single event.

To build the backend, first run

    make build-image

That will create a `build/` directory and create the Docker image from which
you'll run the container to build the index. This will check if the image is
already built (so it won't rebuilt it), but you should run this every time to
create the `build/` directory.

Next, copy your `fullData.json` file into the `build/` directory, and then run

    make index

That will create a Docker image and container, install everything needed within
the container, build the index, cluster it, and run the TSNE code on it (all
within the container).

The result will be in `build/fullData.index`.

Starting the backend
--------------------

To minimally start a backend, simply give the path to the index on the command
line:

	backend -i data.index

If you need to change the port, use -p. However, with the above invocation
there is no way to change the path to the index or other settings without
restarting the backend. The backend can instead be given a configuration file
to read settings from. Let's say that we put the following in demo.conf:

	{
	  'server': {
	    'index_dir_path': 'data.index'
	  },
	}

We can then start a backend using this configuration file:

	backend -c demo.conf

Note that the index path is relative to wherever the backend is started.
Setting an absolute path may be safer.

Backend behaviour and configuration
-----------------------------------

The backend reloads the configuration file and updates its settings at an
interval determined by the `settings_timeout` server setting. If there is any
error reading the configuration file, the backend ignores the file and
continues using the current settings.

Note that if you change the configuration file non-atomically, there is the
possibility that the backend will see incorrect or unreadable settings. To
avoid this, you could for example create a separate new file and use unix mv to
replace the configuration file atomically.

When the backend reloads the configuration file, it also checks for changes to
the index. If the index path has not changed but the index has been modified
since the last settings reload, the backend resets by clearing all caches and
re-priming them. If the index path (given by the `index_dir_path` server
setting) has changed, it starts using the new index and then does the same
reset. If you want to force the backend to reset at every settings reload
regardless of index changes you can use the `always_reset `server setting (but
there is no obvious reason to do so).

The settings reload and any necessary index loading and cache priming is done
in a background thread. The changes will be applied at the next query received
after all such work is done. Any query received while the reload and reset is
still running will be handled with the old settings, index, and caches.

Note that the configuration file is configuration for a backend instance, not
configuration for the data. In general each live instance of the backend should
have its own configuration file so that its settings can be changed without
restarting.

See `backend_settings_defaults.py` for a list of settings and the format of a
configuration file. In general you would want to at least set the index path
and make sure that the `all_argument_numbers` and `fields_to_prime` querier
settings match your data.

Testing queries
---------------

For testing, we can run a query directly against the index (without the
backend, but using the same query handling code):

    queryindex -c demo.conf test.index query.json

The -c option here uses the querier settings (but not server settings) from
test.conf.

We can also run a query through a running backend:

    querybackend http://localhost:1500 query.json

You can try this with the .json query files in examplequeries/, for example.

Index format
============

Event data
----------

Only the data needed to support the backend protocol is indexed. For details
see the buildindex program, especially make_event_doc().

The principles used in preparing data for the index are:
- Any text that needs to be pre-formatted is added as a new field.
- Relevant information from fields with compound information is extracted into
  flat lists for efficient querying.
- If a set of fields will be searched on together, a new field is added to
  combine them.

We use Whoosh not only to index the data for searching but also to retrieve
complete results. Thus fields should have the stored flag set in the Whoosh
schema unless they are strictly not needed in results.

Numbers can be given to Whoosh as numbers (rather than strings). All strings
must be given as unicode. Whoosh requires the fields containing a list of
keywords be given as strings with either space or comma separators. Code in
whooshutils.py is responsible for standardizing the conversion to this format,
including escaping any separator characters in the input.

Keywords may have whitespace normalized at the indexing step, in the interests
of easy and consistent list formatting.

Reference points
----------------

Reference points are assigned to each event based on the event's geographic
coordinates. These are currently produced with a clustering algorithm, but they
could also be produced by eg rounding coordinates or snapping to some grid.
What constitutes an appropriate choice of reference points is determined by how
the frontend uses them. Reference points are longitude-latitude points as
strings with the two coordinates separated by a comma.

Design notes
============

Miscellaneous 
-------------

The backend is designed to have no per-client state. Caching is used in limited
cases where being stateless is a potential performance issue.

We cache all initial (empty constraint) view results. The predicate
`should_cache()` in `queries.py` determines which views need result caching, so
the scope of this caching can be expanded easily if desired.

All caches are cleared at the timeout when the backend reloads its settings if
there has been any change to the index (identity or contents), so that if the
data changed we get the current version. The caches are initially primed by
auto-submitting common queries. The `queries_to_prime()` function in
`queries.py` generates the queries for priming.

Caches are controlled by being isolated in a query handler (`Querier` in
`queries.py`) object. This allows a complete reset of the query handling state
(for resetting caches) by creating a new query handler.

The backend uses a single background thread which handles settings loading,
index loading, and creating new query handlers (to reset the caches), and waits
on the timeout between settings loads. This thread sends settings and query
handler changes to the main thread through a thread-safe queue.

Pagination
----------

For pagination of count view results, we get complete results (without
pagination), sort by the count, and clip to the desired page size. We cache the
unclipped results so that this isn't horribly inefficient. It should be
efficient enough as long as the cache is large enough relative to the number of
users. Which views get this kind of pagination is controlled by
`how_to_paginate_results()` in `queries.py`.

For queries which don't need counting, Whoosh handles pagination for us through
its `search_page()` function. The Whoosh documentation indicates that this
function simply runs the complete query but only returns the appropriate page
(presumably similar to our clipping on counted results), but in practice this
seems incur little slowdown for larger page numbers.
