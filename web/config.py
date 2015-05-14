# XXX DON'T PUT LOCAL SETTINGS IN HERE.
# THIS FILE IS ONLY FOR DEFAULTS SO THAT THE CODE RUNS.
# PUT LOCAL SETTINGS IN local_config.py!

import os
basedir = os.path.abspath(os.path.dirname(__file__))

WTF_CSRF_ENABLED = True
SECRET_KEY = 'something'

SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(basedir, 'app.db')

# override this in the local_config, but we need a default
DOMAIN = "wikipediahistory"

BACKEND_URL = "http://localhost:1500"

# Tokens used to access Google Spreadsheet API on the command line.
# To generate these, click 'Create new Client ID' and select 'Installed
# application' in the Google Developers Console.
CLI_OAUTH2_ID = '***'
CLI_OAUTH2_SECRET = '***'

try:
    from local_config import *
except ImportError:
    pass
