from flask import Flask

from flask.ext.sqlalchemy import SQLAlchemy
from flask.ext.login import LoginManager
from flask.ext.script import Manager
from flask.ext.migrate import Migrate, MigrateCommand
from flask.ext.mail import Mail

app = Flask(__name__)
app.config.from_object('config')

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

lm = LoginManager()
lm.init_app(app)

# Don't leave empty lines where the blocks were.
# This allows us to have if statements within multiline Javascript strings,
# which, although a bad idea, might sometimes be necessary.
app.jinja_env.trim_blocks = True
app.jinja_env.lstrip_blocks = True

mail = Mail(app)
from app import views, models, forms

def create_admin():
    """Creates a default admin account. Will be run from within db_create.py"""
    try:
        if models.User.query.filter_by(email="admin@lensingwikpedia.cs.sfu.ca").first() is None:
            user = models.User(email="admin@lensingwikipedia.cs.sfu.ca",
                               password="password", username="admin",
                               role=models.ROLE_ADMIN)
            db.session.add(user)
            db.session.commit()
    except Exception, e:
        print "DATABASE: USER CREATION FAILED WITH %s" % str(e)
