from flask import (request, url_for, render_template, g, redirect,
                   flash, abort, make_response, send_from_directory)
from flask.ext.login import login_required, logout_user, current_user
from social.apps.flask_app import routes    # noqa
from functools import wraps
import json
from . import app, db, lm, forms
from .models import User, Tab


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


@app.teardown_appcontext
def commit_on_success(error=None):
    # XXX: DO NOT REMOVE
    #      This makes it so that logging in works.
    # This is taken from the python-social-auth flask example
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
            for tab in Tab.query.order_by(Tab.order).all():
                g.user.tabs.append(tab)

            db.session.commit()

    visible_tabs = Tab.query.filter(Tab.visible.is_(True)).all()

    if g.user.is_authenticated():
        visible_tabs = set(visible_tabs) & set(g.user.tabs)

    def _order(tab):
        return tab.order

    tabs_with_names = [t.name_pair for t in sorted(visible_tabs, key=_order)]

    # TODO move this to a proper place
    admin_config = json.dumps({"show_facet_search": False})

    tracking_cookie = request.cookies.get("tracking", "")

    resp = make_response(render_template("index.html",
                                         title=app.config["SITETITLE"],
                                         tabs=tabs_with_names,
                                         admin_config=admin_config,
                                         tracking_cookie=tracking_cookie))

    if g.user.is_authenticated():
        # Since we may allow the user to set a tracking cookie, and we can't
        # easily verify its uniqueness, we'll also keep track of the user email
        resp.set_cookie("email", value=g.user.email)

        if "tracking" not in request.cookies:
            resp.set_cookie(tracking_cookie)

    return resp


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

    def _process_name(tab):
        return tab.name, tab.external_name + ("" if tab.visible else "*")

    all_tabs = Tab.query.order_by(Tab.order).all()
    modify_user_form.tabs.choices = [_process_name(t) for t in all_tabs]

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


@app.route('/log', methods=['POST'])
def client_log():
    """Log anything the client sends us for later processing."""

    # we're not reading g.user.email here because we want to be consistent with
    # the backend.py
    email = request.cookies.get("email", "no-email")
    tracking_code = request.cookies.get("tracking", "")
    log_tracker = '[' + email + ' ' + tracking_code + '] '

    try:
        message = request.form['message']
    except KeyError:
        return make_response(("FAIL", 400))

    log_message = log_tracker + message

    app.logger.info(log_message)

    return "OK"


@app.route('/admin', methods=['GET', 'POST'])
@login_required
@admin_required
def admin_console():
    all_tabs = Tab.query.order_by(Tab.order).all()
    visible_tabs_form = forms.VisibleTabs()

    visible_tabs_form.tabs.choices = [t.name_pair for t in all_tabs]

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


@app.route('/admin/user-log')
@login_required
@admin_required
def get_user_log():
    return send_from_directory('/var/log', 'rsyslog.log', as_attachment=True,
                               mimetype='text/plain')
