from flask import request, url_for, render_template, g, session, redirect, \
        flash
from flask.ext.login import login_required, login_user, logout_user, \
        current_user
from . import app, db, lm, forms
from .models import User

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
    login_form = forms.Login()
    register_form = forms.Register()

    if login_form.validate_on_submit():
        login_user(login_form.user)
        return redirect(url_for("index"))

    elif register_form.validate_on_submit():
        user = User(email=register_form.email.data,
                    password=register_form.password.data)

        db.session.add(user)
        db.session.commit()

        flash("Registered!")

        login_user(user)
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
