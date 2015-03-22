#!/usr/bin/env python2

from app import db, create_admin

db.create_all()
create_admin()
