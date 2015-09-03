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
app.config.from_object('local_config')

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
