from flask import Flask

from flask.ext.sqlalchemy import SQLAlchemy
from flask.ext.login import LoginManager

from flask.ext.script import Manager
from flask.ext.migrate import Migrate, MigrateCommand

from social.apps.flask_app.routes import social_auth
from social.apps.flask_app.template_filters import backends
from social.apps.flask_app.default.models import init_social

app = Flask(__name__)
app.config.from_object('config')

try:
    app.config.from_object('local_config')
except ImportError:
    # This will occur when there's no local_config.py, and that's an acceptable
    # situation.
    pass

try:
    app.config.from_envvar('LENSING_SETTINGS')
except RuntimeError:
    # This happens when the environment variable is not set.
    # We can safely ignore this because we usually won't use this (unless we
    # don't want to use local_config.py in a container).
    pass

db = SQLAlchemy(app)
migrate = Migrate(app, db)

manager = Manager(app)
manager.add_command('db', MigrateCommand)

app.register_blueprint(social_auth)
init_social(app, db.session)

lm = LoginManager()
lm.init_app(app)

# Don't leave empty lines where the blocks were.
# This allows us to have if statements within multiline Javascript strings,
# which, although a bad idea, might sometimes be necessary.
app.jinja_env.trim_blocks = True
app.jinja_env.lstrip_blocks = True

from app import views, models, forms

# CREATE ALL DATABASE + TABLES AT RUNTIME
# THIS DEFINITELY CAN'T HANDLE MIGRATIONS
from os.path import isfile
from urlparse import urlparse

db_path = urlparse(app.config['SQLALCHEMY_DATABASE_URI']).path

if not isfile(db_path):
    db.create_all()

    # create the tables for python-social-auth
    from sqlalchemy import create_engine
    from social.apps.flask_app.default import models
    engine = create_engine(app.config['SQLALCHEMY_DATABASE_URI'])
    models.PSABase.metadata.create_all(engine)

    from models import Tab

    # Make sure we have all the tabs in the database.
    for tab in app.config['TABS']:
        if Tab.query.filter_by(name=tab).count() == 0:
            t = Tab(name=tab)
            db.session.add(t)

    db.session.commit()
