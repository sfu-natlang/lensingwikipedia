from flask import request, url_for, render_template, g, session, redirect, \
        flash, abort
from flask.ext.login import login_required, logout_user, current_user
from social.apps.flask_app import routes
from functools import wraps
import textwrap
import datetime
from . import app, db, lm, forms
from .models import User, Tab, ROLE, STATUS, TAB_NAMES

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
    if error is None:
        db.session.commit()
    else:
        raise Exception(error)

@app.route('/')
def index():
    if g.user.is_authenticated():
        if not g.user.tabs:
            # if there are no tabs set, the user should be able to see all tabs
            for tab in Tab.query.all():
                g.user.tabs.append(tab)

            db.session.commit()

    config_tabs = app.config['TABS']
    visible_tabs = []

    # we only want to show the user the intersection between config_tabs and
    # the tabs they're allowed to see.
    if g.user.is_authenticated():
        for tab in g.user.tabs:
            if tab.name in config_tabs:
                visible_tabs.append(tab.name)
    else:
        visible_tabs = config_tabs

    tabs_with_names = [(tab, TAB_NAMES[tab]) for tab in visible_tabs]

    return render_template("index.html", title=app.config["SITETITLE"],
            tabs=tabs_with_names)

@app.route("/logout")
def logout():
    logout_user()
    flash("You were logged out")
    return redirect(url_for("index"))

@app.route('/user')
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

    user_tabs_names = map(lambda x: x.name, user.tabs)

    modify_user_form = forms.ModifyUser(role=str(user.role),
                                        status=str(user.status),
                                        tabs=user_tabs_names)

    if modify_user_form.validate_on_submit():
        user.role = int(modify_user_form.role.data)
        user.status = int(modify_user_form.status.data)

        for t in user.tabs:
            user.tabs.remove(t)
            db.session.commit()

        for tab in modify_user_form.tabs:
            if tab.checked:
                user.tabs.append(Tab.query.filter_by(name=tab.data).first())

        db.session.commit()
        flash("Saved user settings")

    return render_template("admin/user.html",
            title="User %d = %s" % (id, user.username),
            user=user,
            form=modify_user_form)
