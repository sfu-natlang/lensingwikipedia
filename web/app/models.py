from app import db
from flask.ext.login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

ROLE_USER = 0
ROLE_ADMIN = 1

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String)
    email = db.Column(db.String, index=True, unique=True)
    pw_hash = db.Column(db.String)
    role = db.Column(db.SmallInteger, default=ROLE_USER)

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
