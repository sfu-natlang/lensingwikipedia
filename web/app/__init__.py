import os

from flask import Flask

from flask.ext.sqlalchemy import SQLAlchemy
from flask.ext.login import LoginManager
from flask.ext.script import Manager
from flask.ext.migrate import upgrade, stamp, Migrate, MigrateCommand

from social.apps.flask_app.routes import social_auth
from social.apps.flask_app.default.models import init_social

import sqlalchemy.exc

import logging
from logging.handlers import SysLogHandler

basedir = os.path.abspath(os.path.dirname(__file__))
migrations_dir = os.path.join(basedir, '../migrations')

app = Flask(__name__)
app.config.from_object('config')
app.config.from_envvar('LENSING_SETTINGS', silent=True)

db = SQLAlchemy(app)
migrate = Migrate(app, db, directory=migrations_dir)

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
        syslog_handler = SysLogHandler(address='/run/rsyslog/rsyslog.sock')
        syslog_handler.setLevel(logging.INFO)

        formatter = logging.Formatter("[frontend] %(message)s")
        syslog_handler.setFormatter(formatter)

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
        stamp()

    print("Database created.")


def get_current_revision(db_connection):
    from alembic.migration import MigrationContext
    context = MigrationContext.configure(db_connection)
    return context.get_current_revision()


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

        # We only want to upgrade if there is already something there since
        # create_db will also add in our tabs and create the python-social-auth
        # tables
        conn = db.engine.connect()
        print("Current rev:", get_current_revision(conn))
        if get_current_revision(conn):
            upgrade()
        else:
            create_db()
