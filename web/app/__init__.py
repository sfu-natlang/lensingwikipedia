from flask import Flask

from flask.ext.sqlalchemy import SQLAlchemy
from flask.ext.login import LoginManager

from flask.ext.script import Manager
from flask.ext.migrate import current, upgrade, stamp, Migrate, MigrateCommand

from social.apps.flask_app.routes import social_auth
from social.apps.flask_app.default.models import init_social

import sqlalchemy.exc

import logging
from logging.handlers import SysLogHandler

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


@app.before_first_request
def per_process_init():
    """Sets up per process settings.

    This is useful when you're running the app in uWSGI using multiple processes
    since the logger object is shared within each Python process but not across
    processes.
    """

    if not app.debug:
        # we add it in here because otherwise this ends up overriding the
        # regular debugging handlers
        syslog_handler = SysLogHandler(address=app.config['SYSLOG_ADDRESS'])
        syslog_handler.setLevel(logging.INFO)

        app.logger.setLevel(logging.INFO)
        app.logger.addHandler(syslog_handler)


# Don't leave empty lines where the blocks were.
# This allows us to have if statements within multiline Javascript strings,
# which, although a bad idea, might sometimes be necessary.
app.jinja_env.trim_blocks = True
app.jinja_env.lstrip_blocks = True

from app import views, models, forms    # noqa


@manager.command
def create_db():
    import os

    db.create_all()

    # create the tables for python-social-auth
    from sqlalchemy import create_engine
    from social.apps.flask_app.default import models as PSA_models
    engine = create_engine(app.config['SQLALCHEMY_DATABASE_URI'])
    PSA_models.PSABase.metadata.create_all(engine)

    from .models import Tab, TAB_NAMES

    # Make sure we have all the tabs in the database.
    # TODO make this a bit more reliable since it can fail if some tabs are
    # there and some aren't and we're messing with the order column
    for i, (tab, tab_name) in enumerate(TAB_NAMES.items()):
        if Tab.query.filter_by(name=tab).first() is None:
            t = Tab(name=tab, external_name=tab_name, order=i)
            db.session.add(t)

    db.session.commit()

    with app.app_context():
        basedir = os.path.abspath(os.path.dirname(__file__))
        stamp(directory=os.path.join(basedir, '../migrations'))

    print("Database created.")


if app.config['AUTO_DB_MANAGEMENT']:
    # CREATE ALL DATABASE + TABLES AT RUNTIME
    # XXX: This should only be done while running within Docker, otherwise
    # you'll have problems generating migrations
    import os
    import time

    basedir = os.path.abspath(os.path.dirname(__file__))

    with app.app_context():
        # In the case that we're running in Docker, the Postgres container may
        # not be up and running yet, or have no database set up in it yet, so we
        # need to wait for that to be done first
        try:
            db.engine.connect()
        except sqlalchemy.exc.OperationalError:
            # If it's not done in 10 seconds, then there's probably some other
            # error, but we'll worry about that later
            time.sleep(10)

        if current(directory=os.path.join(basedir, '../migrations')):
            upgrade(directory=os.path.join(basedir, '../migrations'))
        else:
            create_db()
