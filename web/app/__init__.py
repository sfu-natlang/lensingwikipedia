from flask import Flask

from flask.ext.sqlalchemy import SQLAlchemy
from flask.ext.login import LoginManager

from flask.ext.script import Manager
from flask.ext.migrate import upgrade, stamp, Migrate, MigrateCommand

from social.apps.flask_app.routes import social_auth
from social.apps.flask_app.template_filters import backends
from social.apps.flask_app.default.models import init_social

app = Flask(__name__)
app.config.from_object('config')
app.config.from_envvar('LENSING_SETTINGS', silent=True)

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

@manager.command
def create_db():
    import os

    db.create_all()

    # create the tables for python-social-auth
    from sqlalchemy import create_engine
    from social.apps.flask_app.default import models as PSA_models
    engine = create_engine(app.config['SQLALCHEMY_DATABASE_URI'])
    PSA_models.PSABase.metadata.create_all(engine)

    from models import Tab

    # Make sure we have all the tabs in the database.
    for tab in app.config['TABS']:
        if Tab.query.filter_by(name=tab).count() == 0:
            t = Tab(name=tab)
            db.session.add(t)

    db.session.commit()

    with app.app_context():
        basedir = os.path.abspath(os.path.dirname(__file__))
        stamp(directory=os.path.join(basedir, '../migrations'))

    print("Database created.")


if app.config['AUTO_DB_MANAGEMENT']:
    # CREATE ALL DATABASE + TABLES AT RUNTIME
    # This should only be done while running within Docker, otherwise you'll
    # have problems generating migrations
    from os.path import isfile
    from urlparse import urlparse
    import os

    basedir = os.path.abspath(os.path.dirname(__file__))
    db_path = urlparse(app.config['SQLALCHEMY_DATABASE_URI']).path

    if not isfile(db_path):
        create_db()

    else:
        with app.app_context():
            upgrade(directory=os.path.join(basedir, '../migrations'))
