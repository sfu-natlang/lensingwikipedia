from flask.ext.wtf import Form
from wtforms import widgets, RadioField, BooleanField, SelectMultipleField
from wtforms.validators import Required, Optional

from . import app
from .models import ROLE, STATUS, TAB_NAMES

_tab_choices = [(tab, TAB_NAMES[tab]) for tab in app.config['TABS']]

class MultiCheckboxField(SelectMultipleField):
    widget = widgets.ListWidget(prefix_label=False)
    option_widget = widgets.CheckboxInput()

class ModifyUser(Form):
    role = RadioField("Role", choices=[(str(v),k) for k,v in ROLE.items()],
            validators=[Optional()])
    status = RadioField("Status", choices=[(str(v),k) for k,v in STATUS.items()])
    tabs = MultiCheckboxField('Tabs', choices=_tab_choices)

    confirm = BooleanField("confirm", validators=[Required()])
