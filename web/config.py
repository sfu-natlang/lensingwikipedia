# XXX DON'T PUT LOCAL SETTINGS IN HERE.
# THIS FILE IS ONLY FOR DEFAULTS SO THAT THE CODE RUNS.
# PUT LOCAL SETTINGS IN local_config.py!

import os
basedir = os.path.abspath(os.path.dirname(__file__))

WTF_CSRF_ENABLED = True
SECRET_KEY = os.urandom(32)

SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(basedir, 'app.db')

# override this in the local_config, but we need a default
DOMAIN = "wikipediahistory"

# XXX This will definitely need to be overridden in local_config.py
BACKEND_URL = "http://natlang-web.cs.sfu.ca:1500"

# This selects which tabs you want to show up in the interface
TABS = [
    "facets",
    "storyline",
    "timeline",
    "comparison",
    "map",
    "cluster",
    "text"
]

try:
    from local_config import *
except ImportError:
    pass
