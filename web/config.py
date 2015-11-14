# XXX DON'T PUT LOCAL SETTINGS IN HERE.
# THIS FILE IS ONLY FOR DEFAULTS SO THAT THE CODE RUNS.
# PUT LOCAL SETTINGS IN local_config.py!

import os
basedir = os.path.abspath(os.path.dirname(__file__))

WTF_CSRF_ENABLED = True
SECRET_KEY = os.urandom(32)

# This is the default location when this site is running within a Docker
# container
SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(basedir, 'app.db')

# override this in the local_config, but we need a default
DOMAIN = os.environ.get("LENSING_DOMAIN", "wikipediahistory")
SITETITLE = os.environ.get("LENSING_SITETITLE", "Lensing Wikipedia").strip("'")

BACKEND_URL = os.environ.get("LENSING_BACKEND_URL", "http://natlang-web.cs.sfu.ca:1500")

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

# It's fine if these are None when running db_create.py, so we shouldn't use []
SOCIAL_AUTH_GOOGLE_OAUTH2_KEY = os.environ.get('SOCIAL_AUTH_GOOGLE_OAUTH2_KEY')
SOCIAL_AUTH_GOOGLE_OAUTH2_SECRET = os.environ.get('SOCIAL_AUTH_GOOGLE_OAUTH2_SECRET')

# DO NOT TOUCH
SOCIAL_AUTH_USER_MODEL = 'app.models.User'
SOCIAL_AUTH_AUTHENTICATION_BACKENDS = ('social.backends.google.GoogleOAuth2',)
SOCIAL_AUTH_LOGIN_REDIRECT_URL = '/'

# List of email addresses for the admins.
# This is for a user who will never be able to lose admin rights, and is going
# to be the first admin. You can set multiple users, but it's probably best if
# you only have one.
ADMINS = ['anoop.sarkar@natlang.net', 'andrei@avacariu.me']

SITE_URL = os.environ.get("LENSING_SITE_URL", "lensingwikipedia.cs.sfu.ca")

DEBUG = os.environ.get("DEBUG", "false").lower() in ['true', 'yes']

# TODO set this to 'strong' when it stops being broken in flask-login
SESSION_PROTECTION = None
