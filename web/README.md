This code is implemented using Flask and SQLAlchemy using plugins listed in
`requirements.txt`.

Setup
=====

If you're doing local development, you can setup the frontend by following
these steps. If you're deploying a copy of the site, follow the complete
instructions in the `website.md` file at the root of this repository.

The following steps aren't all mandatory.

* For a barebones frontend, follow steps 1, 2, 7.
* For a frontend with working database, follow steps 1, 2, 3, 7.
* If you've made a change to the schema, execute steps 4, 5.

If you're not familiar with database migrations, read the Flask-Migrate
documentation at https://flask-migrate.readthedocs.org/en/latest/.

If any of the files aren't executable for you, use `chmod u+x FILENAME`.

### The steps

1. It's strongly recommended to set up a virtualenv for this:

    virtualenv venv
    source venv/bin/activate

2. To install all necessary packages:

    pip install -r requirements.txt

3. To create a new database (used for user accounts):

    ./db_create.py

4. To create a migration (after making some changes to the schema):

    ./run.py db migrate

5. To apply a migration:

    ./run.py db upgrade

6. To run the server with debugging output on:

    ./run.py runserver -d

Configuration
=============

## Parameters

All default parameters are in `config.py`. If you want to override any of the
defaults, create a `local_config.py` file in the same directory as `config.py`
and put your parameters in there. The names should match the ones in
`config.py`. If you want to add *new* parameters, create a default one in
`config.py` first so that anyone running the code is guaranteed to have it
execute successfully.

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
