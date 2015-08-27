from flask import request, url_for, render_template, g, session, redirect, \
        flash, abort
from flask.ext.login import login_required, logout_user, current_user
from social.apps.flask_app import routes
from functools import wraps
import textwrap
import datetime
from . import app, db, lm, forms
from .models import User, ROLE, STATUS

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
    return render_template("index.html", title="index")

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
    modify_user_form = forms.ModifyUser(role=str(user.role),
                                        status=str(user.status))

    if modify_user_form.validate_on_submit():
        user.role = int(modify_user_form.role.data)
        user.status = int(modify_user_form.status.data)

        db.session.commit()

    return render_template("admin/user.html",
            title="User %d = %s" % (id, user.username),
            user=user,
            form=modify_user_form)
