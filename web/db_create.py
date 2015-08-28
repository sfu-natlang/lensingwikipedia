#!/usr/bin/env python2

from app import app, db
from app.models import Tab

db.create_all()

# create the tables for python-social-auth
from sqlalchemy import create_engine
from social.apps.flask_app.default import models
engine = create_engine(app.config['SQLALCHEMY_DATABASE_URI'])
models.PSABase.metadata.create_all(engine)

# Make sure we have all the tabs in the database.
for tab, tabname in app.config['TABS']:
    if Tab.query.filter_by(name=tab).count() == 0:
        t = Tab(name=tab)
        db.session.add(t)
    db.session.commit()
