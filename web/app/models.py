from app import app, db
from flask.ext.login import UserMixin
from social.apps.flask_app.default import models
import datetime

ROLE = {'user': 0, 'admin': 1}
STATUS = {'regular': 0, 'banned': 1}

tabs = db.Table('tabs',
    db.Column('tab_name', db.Integer, db.ForeignKey('tab.name')),
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'))
)

class Tab(db.Model):
    name = db.Column(db.String, unique=True, primary_key=True)

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(200))
    email = db.Column(db.String, index=True, unique=True)
    role = db.Column(db.SmallInteger, default=ROLE['user'])
    status = db.Column(db.SmallInteger, default=STATUS['regular'])
    last_seen = db.Column(db.DateTime)
    notes = db.Column(db.Text)

    tabs = db.relationship('Tab', secondary=tabs,
                           backref=db.backref('users', lazy='dynamic'))

    @property
    def is_admin(self):
        return (self.role == ROLE['admin'] or
                self.email in app.config['ADMINS'])

    @property
    def is_active(self):
        return self.status == STATUS['regular']

    @property
    def is_banned(self):
        return self.status == STATUS['banned']

    def __repr__(self):
        return '<User %r>' % self.email
