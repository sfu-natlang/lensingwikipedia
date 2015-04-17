This code is implemented using Flask.

Setup
=====

It's strongly recommended to set up a virtualenv for this:

    virtualenv venv
    source venv/bin/activate

To install all necessary packages:

    pip install -r requirements.txt

To create a new database:

    ./db_create.py

To set up migrations:

    ./run.py db init

To create a migration (after making some changes to the schema):

    ./run.py db migrate

To apply a migration:

    ./run.py db upgrade

To run the server with debug on:

    ./run.py runserver -d

Configuration
=============

All default parameters are in `config.py`. If you want to override any of the
defaults, create a `local_config.py` file in the same directory as `config.py`
and put your parameters in there. The names should match the ones in
`config.py`. If you want to add *new* parameters, create a default one in
`config.py` first so that anyone running the code is guaranteed to have it
execute successfully.
