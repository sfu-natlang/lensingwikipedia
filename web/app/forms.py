from flask.ext.wtf import Form
from wtforms import TextField, PasswordField
from wtforms.validators import Required, ValidationError

from .models import User

class Login(Form):
    email = TextField("email", validators=[Required()])
    password = PasswordField("password", validators=[Required()])

    def validate(self):
        rv = Form.validate(self)
        if not rv:
            return False

        user = User.query.filter_by(email=self.email.data).first()

        if user is None:
            self.password.errors.append("Email doesn't exist")
            return False

        if not user.check_password(self.password.data):
            self.password.errors.append("Incorrect password")
            return False

        self.user = user
        return True

class Register(Form):
    email = TextField("email", validators=[Required()])
    password = PasswordField("password", validators=[Required()])
