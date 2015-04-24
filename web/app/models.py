from app import db
from flask.ext.login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
import uuid
import datetime

ROLE_USER = 0
ROLE_ADMIN = 1

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String)
    email = db.Column(db.String, index=True, unique=True)
    pw_hash = db.Column(db.String)
    role = db.Column(db.SmallInteger, default=ROLE_USER)

    queries = db.relationship("Query", backref="user", lazy="dynamic")
    forgot_password_urls = db.relationship("ForgotPasswordUrl", backref="user", lazy="dynamic")

    def __init__(self, email, password, *args, **kwargs):
        super(User, self).__init__(*args, **kwargs)
        self.email = email
        self.set_password(password)

    def is_admin(self):
        return self.role == ROLE_ADMIN

    def set_password(self, password):
        self.pw_hash = generate_password_hash(password)

    def check_password(self, password):
        if self.pw_hash is None:
            return False
        else:
            return check_password_hash(self.pw_hash, password)

    def __repr__(self):
        return '<User %r>' % self.email

class ForgotPasswordUrl(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    uuid = db.Column(db.String(36), unique=True)
    date = db.Column(db.DateTime)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))

    def __init__(self, *args, **kwargs):
        super(ForgotPasswordUrl, self).__init__(*args, **kwargs)
        self.uuid = str(uuid.uuid4())
        self.date = datetime.datetime.utcnow()


class Query(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    json = db.Column(db.String)

    user_id = db.Column(db.Integer, db.ForeignKey("user.id"))
