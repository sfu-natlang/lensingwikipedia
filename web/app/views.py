from flask import request, url_for, render_template, g, session, redirect, \
        flash, abort, jsonify
from flask.ext.login import login_required, logout_user, current_user
from flask_admin.contrib.sqla import ModelView
import sqlalchemy
from social.apps.flask_app import routes
from functools import wraps
import textwrap
import datetime
from . import app, db, lm, forms
from .models import User, Tab, Note, ROLE, STATUS, TAB_NAMES

def admin_required(f):
    @wraps(f)
    def decorated_view(*args, **kwargs):
        if not (current_user.is_authenticated() and current_user.is_admin()):
            abort(403)
        return f(*args, **kwargs)
    return decorated_view

@lm.user_loader
def load_user(userid):
    try:
        return User.query.get(int(userid))
    except (TypeError, ValueError):
        pass

@app.before_request
def before_request():
    # so that we can access the current user wherever
    g.user = current_user

    if g.user.is_authenticated():
        g.user.last_seen = datetime.datetime.utcnow()
        # TODO: is the line below necessary?
        db.session.add(g.user)
        db.session.commit()

@app.teardown_appcontext
def commit_on_success(error=None):
    # XXX: DO NOT REMOVE
    #      This makes it so that logging in works.
    # This is taken from here: https://github.com/omab/python-social-auth/blob/master/examples/flask_example/__init__.py
    # TODO: Figure out why we can't remove this.
    if error is None:
        db.session.commit()
    else:
        db.session.rollback()

    db.session.remove()

@app.route('/')
def index():
    if g.user.is_authenticated():
        if not g.user.tabs:
            # if there are no tabs set, the user should be able to see all tabs
            for tab in Tab.query.all():
                g.user.tabs.append(tab)

            db.session.commit()

    visible_tabs = Tab.query.filter(Tab.visible == 1).all()

    if g.user.is_authenticated():
        visible_tabs = set(visible_tabs) & set(g.user.tabs)

    tabs_with_names = [(tab.name, TAB_NAMES[tab.name]) for tab in visible_tabs]

    return render_template("index.html", title=app.config["SITETITLE"],
                           tabs=tabs_with_names)

@app.route("/logout")
def logout():
    logout_user()
    flash("You were logged out")
    return redirect(url_for("index"))

@app.route('/user', methods=['GET', 'POST'])
@login_required
@admin_required
def users():
    users = User.query.all()
    return render_template("admin/users.html",
            users=users)

@app.route("/user/<int:id>", methods=['GET', 'POST'])
@login_required
def user(id):
    if not (g.user.is_admin() or g.user.id == id):
        abort(403)

    user = User.query.get_or_404(id)

    modify_user_form = forms.ModifyUser(role=str(user.role),
                                        status=str(user.status))

    _process_name = lambda x: x.external_name + ("" if x.visible else "*")

    modify_user_form.tabs.choices = [(t.name, _process_name(t))
                                     for t in Tab.query.all()]

    if request.method == 'GET':
        modify_user_form.tabs.default = [t.name for t in user.tabs]
        modify_user_form.tabs.process(None)

    if modify_user_form.validate_on_submit():
        user.role = int(modify_user_form.role.data)
        user.status = int(modify_user_form.status.data)

        for tab in modify_user_form.tabs:
            t = Tab.query.filter_by(name=tab.data).first()
            if tab.checked:
                if t not in user.tabs:
                    user.tabs.append(t)
                    db.session.commit()
            else:
                try:
                    user.tabs.remove(t)
                except ValueError:
                    # it was not in the list
                    continue

        flash("Saved user settings")

    return render_template("admin/user.html",
            title="User %d = %s" % (id, user.username),
            user=user,
            form=modify_user_form)


@app.route('/admin', methods=['GET', 'POST'])
@login_required
@admin_required
def admin_console():
    all_tabs = Tab.query.all()
    visible_tabs_form = forms.VisibleTabs()

    visible_tabs_form.tabs.choices = [(t.name, t.external_name) for t in all_tabs]

    if request.method == 'GET':
        visible_tabs_form.tabs.default = [t.name for t in all_tabs if t.visible]
        visible_tabs_form.tabs.process(None)

    if visible_tabs_form.validate_on_submit():
        for tab in visible_tabs_form.tabs:
            t = Tab.query.filter_by(name=tab.data).first()
            t.visible = tab.checked

        db.session.commit()
        flash("Saved settings")

    return render_template("admin/manage.html",
                           title="Admin console",
                           form=visible_tabs_form)

# class LensingModelView(ModelView):
    # def is_accessible(self):
        # return g.user.is_admin()

# admin.add_view(LensingModelView(User, db.session))
# admin.add_view(LensingModelView(Tab, db.session))
