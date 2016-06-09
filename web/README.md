This code is implemented using Flask and SQLAlchemy using plugins listed in
`requirements.txt`.

Setup
=====

**NOTE:** The details below only apply for development without using Docker. If
you're using Docker, you don't have to worry about any of this; it happens
automatically in the Dockerfile and docker-compose.yml.

If you're doing local development, you can setup the frontend by following
these steps. If you're deploying a copy of the site, follow the complete
instructions in the `website.md` file at the root of this repository.

If you're not familiar with database migrations, read the Flask-Migrate
documentation at https://flask-migrate.readthedocs.org/en/latest/, and the
alembic documentation at http://alembic.readthedocs.org/en/latest/index.html.

### The steps

1. It's strongly recommended to set up a virtualenv for this:

    virtualenv venv
    source venv/bin/activate

2. To install all necessary packages. **NOTE:** Don't edit this file directly!
   Read "Setup Notes" below for more info.

    pip install -r requirements.txt

3. To create a new database. **NOTE:** Don't run this after making changes to
   the schema. You want to create the database first, then make your changes in
   `models.py`, and then run `db migrate` to autogenerate the migration
   scripts.

    python run.py create_db

4. To create a migration (after making some changes to the schema). Make sure
   you go through the migration script and remove the python-social-auth
   changes; it doesn't detect those models so it think they got removed. Make
   sure they don't get removed!

    python run.py db migrate -m MESSAGE

5. To apply a migration:

    python run.py db upgrade

6. To run the server with debugging output on:

    python run.py runserver -p PORT -d


Setup Notes
===========

Note that there are two requirements files: `requirements.txt` and
`requirements-to-freeze.txt`. The `requirements.txt` is an explicit and
complete list of libraries and versions that will be installed in staging and
production. On the other hand `requirements-to-freeze.txt` is a list of
libraries we're using directly with less exact (or maybe even missing) version
information. The idea is you can install and upgrade libraries from
`requirements-to-freeze` and work with those locally, and once you've ensured
there are no issues, you run `pip freeze > requirements.txt` to fix the
versions.

You can find more info about this workflow here:
http://www.kennethreitz.org/essays/a-better-pip-workflow

Configuration
=============

## Parameters

**NOTE:** The details below only apply for development without using Docker. If
you're using Docker, you can configure your settings using `config.env` in the
parent directory.

All default parameters are in `config.py`. If you want to override any of the
defaults, create a `local_config.py` file in the same directory as `config.py`
and put your parameters in there. The names should match the ones in
`config.py`. If you want to add *new* parameters, create a default one in
`config.py` first so that anyone running the code is guaranteed to have it
execute successfully. Also, make sure that you're allowing the parameters in
`config.py` to be overridden using environment variables (i.e. use
`os.environ.get` everywhere).

The parameters in `config.py` are available as `config.PARAMETER` in the Python
code and in the templates.

**IMPORTANT:** Local configuration details (such as keys), should go in
`local_config.py`, not in `config.py`. Don't accidentally commit personal
settings!

## Extra code

If you want to add any local Javascript code, add it to either
`web/app/js/static/avherald_config_local.js` or
`wikipediahistory_config_local.js`, depending on which domain you're working
on. These files are ignored by git, so you'll probably need to create the files
yourself.

All of the domain-specific Javascript code is loaded in the `index.html`
template in conditional blocks. If you want to add extra domain-specific files,
add a new line in that template.

Debugging
=========

The `verboseLog` structure in `config.js` sets options for verbose logging in
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
