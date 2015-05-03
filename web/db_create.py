#!/usr/bin/env python2

from app import app, db

db.create_all()

# create the tables for python-social-auth
from sqlalchemy import create_engine
from social.apps.flask_app.default import models
engine = create_engine(app.config['SQLALCHEMY_DATABASE_URI'])
models.PSABase.metadata.create_all(engine)
