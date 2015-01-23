This code is implemented using Flask.

Setup
=====

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
