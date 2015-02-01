import os
basedir = os.path.abspath(os.path.dirname(__file__))

WTF_CSRF_ENABLED = True
SECRET_KEY = 'something'

SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(basedir, 'app.db')

# override this in the local_config, but we need a default
DOMAIN = "wikipediahistory"

try:
    from local_config import *
except ImportError:
    pass
