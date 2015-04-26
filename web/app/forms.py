from flask import g
from flask.ext.wtf import Form
from wtforms import TextField, PasswordField, BooleanField
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

        if not user.confirmed:
            self.email.errors.append("Account exists, but address hasn't been confirmed")
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

class DeleteUser(Form):
    confirm = BooleanField("delete", validators=[Required()])

class ChangeUserPassword(Form):
    old_password = PasswordField("Old Password", validators=[Required()])
    password = PasswordField("Password", validators=[Required(), EqualTo("confirm", message="Passwords must match")])
    confirm = PasswordField("Repeat password", validators=[Required()])

    def __init__(self, user, *args, **kwargs):
        super(ChangeUserPassword, self).__init__(*args, **kwargs)
        self.user = user

    def validate(self):
        # so that the Required() validator is satisfied
        if g.user.is_admin():
            self.old_password.data = "some text"

        rv = Form.validate(self)
        if not rv:
            return False

        # admin doesn't have to input the old_password
        if not g.user.is_admin():
            if not self.user.check_password(self.old_password.data):
                self.old_password.errors.append("Incorrect password")
                return False

        return True

class ResetPassword(Form):
    password = PasswordField("Password", validators=[Required(), EqualTo("confirm", message="Passwords must match")])
    confirm = PasswordField("Repeat password", validators=[Required()])

class ForgotPassword(Form):
    email = TextField("email", validators=[Required(), Email()])

    def validate(self):
        rv = Form.validate(self)
        if not rv:
            return False

        user = User.query.filter_by(email=self.email.data).first()

        if user is None:
            self.email.errors.append("Email doesn't exist")
            return False

        self.user = user
        return True

class ResendConfirmation(Form):
    email = TextField("email", validators=[Required(), Email()])

    def validate(self):
        rv = Form.validate(self)
        if not rv:
            return False

        user = User.query.filter_by(email=self.email.data).first()

        if user is None:
            self.email.errors.append("Email doesn't exist")
            return False

        if user.confirmed:
            self.email.errors.append("Email address is already confirmed!")
            return False

        self.user = user
        return True
