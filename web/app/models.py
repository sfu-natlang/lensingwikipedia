from app import app, db
from flask.ext.login import UserMixin
from social.apps.flask_app.default import models    # noqa

from collections import OrderedDict


import sqlalchemy.types as types
import json


class StringyJSON(types.TypeDecorator):
    """Stores and retrieves JSON as TEXT."""

    impl = types.TEXT

    def process_bind_param(self, value, dialect):
        if value is not None:
            value = json.dumps(value)
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            value = json.loads(value)
        return value


# We want our magic JSON type to use the regular Postgres JSON type when
# possible, since we only want to dump the JSON to a string when using SQLite
MagicJSON = types.JSON().with_variant(StringyJSON, 'sqlite')


ROLE = {'user': 0, 'admin': 1}
STATUS = {'regular': 0, 'banned': 1}

# maps internal tab names to user-visible tab names
# this is the default order, but it can be changed using Tab.order
TAB_NAMES = OrderedDict([
    ("facets", "Facets"),
    ("storyline", "Storyline"),
    ("timeline", "Timeline"),
    ("comparison", "Comparison"),
    ("map", "Map"),
    ("cluster", "Cluster"),
    ("textsearch", "Text Search")
])

# tab_name is the keys in TAB_NAMES above
tabs = db.Table('tabs',
                db.Column('tab_name', db.String, db.ForeignKey('tab.name')),
                db.Column('user_id', db.Integer, db.ForeignKey('user.id')),
                db.UniqueConstraint('tab_name', 'user_id')
                )


class Tab(db.Model):
    name = db.Column(db.String, unique=True, primary_key=True)
    external_name = db.Column(db.String, unique=True)
    visible = db.Column(db.Boolean, default=True)
    order = db.Column(db.Integer, unique=True)
    config = db.Column(MagicJSON)

    @property
    def name_pair(self):
        return (self.name, self.external_name)

    def __repr__(self):
        return "<Tab {}>".format(self.name)


class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(200))
    email = db.Column(db.String, index=True, unique=True)
    role = db.Column(db.SmallInteger, default=ROLE['user'])
    status = db.Column(db.SmallInteger, default=STATUS['regular'])
    last_seen = db.Column(db.DateTime)

    tabs = db.relationship('Tab', secondary=tabs,
                           backref=db.backref('users', lazy='dynamic'))

    notes = db.relationship('Note', backref='user', lazy='dynamic')

    def is_admin(self):
        return (self.role == ROLE['admin'] or
                self.email in app.config['ADMINS'])

    def is_active(self):
        return self.status == STATUS['regular']

    def is_banned(self):
        return self.status == STATUS['banned']

    def __repr__(self):
        return '<User %r>' % self.email


class Note(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    raw_contents = db.Column(db.Text)
