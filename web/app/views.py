from flask import request, url_for, render_template, g, session, redirect, \
        flash, abort
from flask.ext.login import login_required, login_user, logout_user, \
        current_user, user_unauthorized
from flask.ext.mail import Message
from functools import wraps
import textwrap
from . import app, db, lm, forms, mail
from .models import User, ForgotPasswordUrl, ConfirmationUrl

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

@app.route('/', methods=['GET', 'POST'])
def index():
    # prefixes are needed so that there's no conflict between the two forms
    login_form = forms.Login(prefix="login_form")
    register_form = forms.Register(prefix="register_form")

    if request.method == "POST":
        login_form_submitted = (request.form.get('submit-btn', '') == "Sign in")
        register_form_submitted = (request.form.get('submit-btn', '') == "Register")

        if login_form_submitted and login_form.validate_on_submit():
            login_user(login_form.user)
            print("logged in a user")
            return redirect(url_for("index"))

        if register_form_submitted and register_form.validate_on_submit():
            user = User(email=register_form.email.data,
                        password=register_form.password.data,
                        username=register_form.username.data)

            db.session.add(user)
            db.session.commit()

            print("registered a new user")

            _send_confirmation_email(user)

            flash("Registered! Check your email for a confirmation!")

            return redirect(url_for("index"))

    return render_template("index.html",
            title="index",
            login_form=login_form,
            register_form=register_form)

@app.route("/logout")
def logout():
    logout_user()
    flash("You were logged out")
    return redirect(url_for("index"))

@app.route("/forgot-password", methods=['GET', 'POST'])
@app.route("/forgot-password/<uuid>", methods=['GET', 'POST'])
def forgot_password(uuid=None):

    if uuid is not None:
        url = ForgotPasswordUrl.query.filter_by(uuid=uuid).first()
        if url is None:
            flash("That URL doesn't exist")
            return redirect(url_for('forgot_password'))

        # if the user clicked "forgot password" before confirming his email
        # address, we can consider this as confirmation.
        if not url.user.confirmed:
            url.user.confirmed = True

        login_user(url.user)

        flash("Reset your password here!")

        db.session.delete(url)
        db.session.commit()

        return redirect(url_for('user', id=url.user.id))

    form = forms.ForgotPassword()

    if form.validate_on_submit():
        _send_reset_email(form.user)
        flash("Password reset email sent!")

        return redirect(url_for("index"))

    return render_template("forgot_password.html", form=form)

@app.route("/confirm-email", methods=['GET', 'POST'])
@app.route("/confirm-email/<uuid>", methods=['GET', 'POST'])
def confirm_email(uuid=None):

    if uuid is not None:
        confirm_url = ConfirmationUrl.query.filter_by(uuid=uuid).first()

        if confirm_url is None:
            flash("That URL doesn't exist")
            abort(404)

        confirm_url.user.confirmed = True
        db.session.commit()

        login_user(confirm_url.user)

        db.session.delete(confirm_url)
        db.session.commit()

        flash("Welcome to Lensing!")
        return redirect(url_for('index'))

    form = forms.ResendConfirmation()

    if form.validate_on_submit():
        _send_confirmation_email(form.user)
        flash("Confirmation email sent!")

        return redirect(url_for('index'))

    return render_template("confirm_email.html", form=form)


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
    delete_form = forms.DeleteUser(prefix='delete_form')
    modify_form = forms.ModifyUser(prefix='modify_form');

    if request.method == "POST":
        modify_form_submitted = (request.form.get('submit-btn', '') == "save")
        delete_form_submitted = (request.form.get('submit-btn', '') == "delete")

        if modify_form_submitted and modify_form.validate_on_submit():
            user.set_password(modify_form.password.data)
            db.session.commit();
            flash("Reset password")
            return redirect(url_for("user", id=g.user.id))

        if delete_form_submitted and delete_form.validate_on_submit():
            redirect_location = "users"
            if g.user.id == id:
                redirect_location = "index"
                logout_user()

            db.session.delete(user)
            db.session.commit()

            return redirect(url_for(redirect_location))

    return render_template("admin/user.html",
            title="User %d = %s" % (id, user.username),
            user=user, delete_form=delete_form, modify_form=modify_form)


def _send_confirmation_email(user):
    confirmation_path = ConfirmationUrl()
    user.confirmation_urls.append(confirmation_path)
    db.session.commit()

    confirm_url = url_for('confirm_email', uuid=confirmation_path.uuid, _external=True)

    msg = Message("Confirm your email address", recipients=[user.email])
    msg.body = textwrap.dedent("""\
            Hi {name},

            Thanks for registering! Click this link to confirm your email address:

            {confirm_url}

            If you didn't request this, just ignore the message.


            Cheers,

            The Lensing Team
            """).format(name=user.username, confirm_url=confirm_url)

    mail.send(msg)

def _send_reset_email(user):
    reset_path = ForgotPasswordUrl()

    user.forgot_password_urls.append(reset_path)
    db.session.commit()

    reset_url = url_for('forgot_password', uuid=reset_path.uuid, _external=True)

    msg = Message("Reset your password", recipients=[user.email])
    msg.body = textwrap.dedent("""\
            Hi {name},

            Looks like asked for a link to reset your password, so here it is!

            {reset_url}

            The URL will expire in the next 24 hours.

            If you didn't request this, just ignore the message.


            Cheers,

            The Lensing Team
            """).format(name=user.username, reset_url=reset_url)

    mail.send(msg)
