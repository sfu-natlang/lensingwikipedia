from flask import (request, url_for, render_template, g, redirect,
                   flash, abort, make_response, jsonify, Response)
from flask.ext.login import login_required, logout_user, current_user
from werkzeug.datastructures import Headers
from social.apps.flask_app import routes    # noqa
from functools import wraps
from . import app, db, lm, forms
from .models import User, Tab, Note


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
    tab_configs = {tab.name: tab.config for tab in visible_tabs}

    # The Javascript code that reads this stuff will be cleaner if we have empty
    # configs instead of 'null'.
    for k, v in tab_configs.items():
        if v is None:
            tab_configs[k] = {}

    tracking_cookie = request.cookies.get("tracking", "")

    resp = make_response(render_template("index.html",
                                         title=app.config["SITETITLE"],
                                         tabs=tabs_with_names,
                                         tracking_cookie=tracking_cookie,
                                         tab_configs=tab_configs))

    if g.user.is_authenticated():
        # so that the query backend is able to log using the user's email
        # address without having to know about user accounts
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
@login_required
def client_log():
    """Log anything the client sends us for later processing."""

    email = g.user.email
    tracking_code = request.cookies.get("tracking", "")
    message = ", ".join([email, tracking_code])

    try:
        client_message = request.form['message']
    except KeyError:
        return make_response(("FAIL", 400))

    log_message = ", ".join([message, client_message])
    app.logger.info(log_message)

    return "OK"


@app.route('/admin', methods=['GET', 'POST'])
@login_required
@admin_required
def admin_console():
    return render_template("admin/manage.html",
                           title="Admin console",
                           tabs=Tab.query.order_by(Tab.order).all())


@app.route('/admin/user-log')
@login_required
@admin_required
def get_user_log():

    def generate():
        with open("/var/log/rsyslog.log", encoding='utf-8') as log:
            for line in log:
                parts = line.strip().split()
                if parts[2] == "[frontend]":
                    csv_line = " ".join([parts[0] + ","] + parts[3:])

                    csv = csv_line.split(', ', 4)
                    if csv[3].startswith("notes "):
                        try:
                            csv[4] = '"{}"'.format(csv[4].replace('"', r'\"'))
                        except IndexError:
                            # sometimes notes get opened/closed without having
                            # any contents
                            pass

                    yield ", ".join(csv) + "\n"

    response_headers = Headers()
    response_headers.add('Content-Disposition', 'attachment',
                         filename='lensing.log')
    return Response(generate(), mimetype='text/plain', headers=response_headers)


@app.route('/api/notes', methods=['POST', 'GET'])
@login_required
def user_notes():
    # we only have one note for now, but we'll have more in the future, so
    # return a list of notes anyways

    if request.method == "POST":
        note = Note(user_id=g.user.id, raw_contents=request.form['contents'])
        db.session.add(note)
        db.session.commit()
        return jsonify(id=note.id)

    return jsonify(ids=[note.id for note in g.user.notes.all()])


@app.route('/api/notes/<int:id>', methods=['DELETE', 'PUT', 'GET'])
@login_required
def user_note(id):

    note = Note.query.get(id)

    if note is None or note.user_id != g.user.id:
        response = jsonify(status="error", message="Note not found")
        response.status_code = 404
        return response

    if request.method == "DELETE":
        db.session.delete(note)
        db.session.commit()
        return jsonify(status="success")
    elif request.method == "PUT":
        note.raw_contents = request.form['contents']
        return jsonify(status="success")

    return jsonify(id=note.id, contents=note.raw_contents)


@app.route('/api/tabs')
def api_tabs():
    """Return all tab configs.
    """
    all_tabs = Tab.query.order_by(Tab.order).all()

    def make_attrs(tab):
        return {"visible": tab.visible, "config": tab.config}

    return jsonify({"tabs": [{tab.name: make_attrs(tab)} for tab in all_tabs]})


@app.route('/api/tabs/<name>/config', methods=['GET', 'PUT', 'DELETE'])
def api_tab(name):
    """Retrieve or update the configuration for a certain tab
    """

    tab = Tab.query.filter_by(name=name).first()

    if tab is None:
        response = jsonify(status="error", message="Tab not found")
        response.status_code = 404
        return response

    if request.method == "GET":
        return jsonify({"visible": tab.visible, "config": tab.config})

    elif request.method == "PUT":
        if not (current_user.is_authenticated() and current_user.is_admin()):
            abort(403)

        tab.config = request.get_json(force=True)

        # We want to allow setting the tab visibiliity using this API, but we
        # want to store it as a separate column in the table since it's more of
        # a general UI option than a tab-specific option.
        if 'visible' in tab.config:
            tab.visible = tab.config['visible']
            # since we don't want to deal with storing this in two places,
            del tab.config['visible']

        db.session.commit()
        return jsonify(status="success", message="Updated config")

    elif request.method == "DELETE":
        if not (current_user.is_authenticated() and current_user.is_admin()):
            abort(403)

        tab.config = None
        db.session.commit()
        return jsonify(status="success", message="Deleted config")
