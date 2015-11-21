# XXX DON'T PUT LOCAL SETTINGS IN HERE.
# THIS FILE IS ONLY FOR DEFAULTS SO THAT THE CODE RUNS.
# PUT LOCAL SETTINGS IN local_config.py, if you're running this using the Flask
# dev server, or pass things in through environment variables

# NOTE: All the .strip("'") are there because the config.env file has values
# wrapped in single quotes. We can't remove the single quotes because
# `source config.env` would break in Bash (since it would end up trying to
# execute things because they're not prefixe with 'export').

import os
basedir = os.path.abspath(os.path.dirname(__file__))

WTF_CSRF_ENABLED = True
SECRET_KEY = os.urandom(32)

SQLALCHEMY_DATABASE_URI = os.environ.get("LENSING_DB_URI",
    'sqlite:///' + os.path.join(basedir, 'app.db'))

DOMAIN = os.environ.get("LENSING_DOMAIN", "wikipediahistory")
SITETITLE = os.environ.get("LENSING_SITETITLE", "Lensing Wikipedia").strip("'")

BACKEND_URL = os.environ.get("LENSING_BACKEND_URL",
                             "http://natlang-web.cs.sfu.ca:1500")

# This selects which tabs you want to show up in the interface
TABS = ["facets", "storyline", "timeline", "comparison", "map", "textsearch"]
_env_tabs = os.environ.get("LENSING_TABS")
if _env_tabs:
    import json
    TABS = json.loads(_env_tabs.strip("'"))

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

# TODO set this to 'strong' when it stops being broken in flask-login
SESSION_PROTECTION = None

# Automatically create and migrate the database as needed
# This should only be enabled when it's deployed, since it won't allow you to
# test changes to your models (you won't be able to create a db without
# creating the migration files first)
AUTO_DB_MANAGEMENT = os.environ.get("LENSING_AUTO_DB_MANAGEMENT", "false").lower() in ['true', 'yes']
