from flask.ext.wtf import Form
from wtforms import BooleanField
from wtforms.validators import Required

class BanUser(Form):
    confirm = BooleanField("delete", validators=[Required()])
