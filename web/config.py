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
# Format: (internal_name, display_name)
# XXX The code relies on the fact that the name of the modules is capitalized
#     internal_name
TABS = [
    ("facets", "Facets"),
    ("storyline", "Storyline"),
    ("timeline", "Timeline"),
    ("comparison", "Comparison"),
    ("map", "Map"),
    ("cluster", "Cluster"),
    ("textsearch", "Text Search")
]

MAIL_SERVER = 'mailgate.sfu.ca'
MAIL_PORT = 465
MAIL_USE_SSL = True
MAIL_USERNAME = 'computing_id'
MAIL_PASSWORD = 'XXX'
MAIL_DEFAULT_SENDER = 'computing_id@sfu.ca'

try:
    from local_config import *
except ImportError:
    pass
