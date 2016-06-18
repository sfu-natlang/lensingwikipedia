from flask.ext.wtf import Form
from wtforms import widgets, RadioField, BooleanField, SelectMultipleField
from wtforms.validators import Required, Optional

from .models import ROLE, STATUS


class MultiCheckboxField(SelectMultipleField):
    widget = widgets.ListWidget(prefix_label=False)
    option_widget = widgets.CheckboxInput()


class ModifyUser(Form):
    role = RadioField("Role", choices=[(str(v), k) for k, v in ROLE.items()],
                      validators=[Optional()])
    status = RadioField("Status", choices=[(str(v), k) for k, v in
                                           STATUS.items()])

    tabs = MultiCheckboxField('Tabs')

    confirm = BooleanField("confirm", validators=[Required()])


class VisibleTabs(Form):
    tabs = MultiCheckboxField('Tabs')
    confirm = BooleanField("confirm", validators=[Required()])
