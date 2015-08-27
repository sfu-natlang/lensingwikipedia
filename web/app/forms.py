from flask.ext.wtf import Form
from wtforms import RadioField, BooleanField
from wtforms.validators import Required, Optional

from .models import ROLE, STATUS

class ModifyUser(Form):
    role = RadioField("Role", choices=[(str(v),k) for k,v in ROLE.items()],
            validators=[Optional()])
    status = RadioField("Status", choices=[(str(v),k) for k,v in STATUS.items()])

    confirm = BooleanField("confirm", validators=[Required()])
