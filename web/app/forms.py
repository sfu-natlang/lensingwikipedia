from flask.ext.wtf import Form
from wtforms import TextField, PasswordField
from wtforms.validators import Required, ValidationError, Email, EqualTo

from .models import User

class Login(Form):
    email = TextField("email", validators=[Required(), Email()])
    password = PasswordField("password", validators=[Required()])

    def validate(self):
        rv = Form.validate(self)
        if not rv:
            return False

        user = User.query.filter_by(email=self.email.data).first()

        if user is None:
            self.email.errors.append("Email doesn't exist")
            return False

        if not user.check_password(self.password.data):
            self.password.errors.append("Incorrect password")
            return False

        self.user = user
        return True

class Register(Form):
    username = TextField("username", validators=[Required()])
    email = TextField("email", validators=[Required(), Email()])
    password = PasswordField("Password", validators=[Required(), EqualTo("confirm", message="Passwords must match")])
    confirm = PasswordField("Repeat password", validators=[Required()])

    def validate(self):
        self.user = None
        rv = Form.validate(self)
        if not rv:
            return False

        user = User.query.filter_by(email=self.email.data).first()

        if user is not None:
            self.email.errors.append("Email is already registered")
            self.user = user
            return False

        return True
